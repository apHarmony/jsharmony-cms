/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/
var Helper = require('jsharmony/Helper');
var HelperFS = require('jsharmony/HelperFS');
var HelperImg = require('jsharmony/HelperImg');
var multiparty = require('jsharmony/lib/multiparty');
var _ = require('lodash');
var path = require('path');
var async = require('async');

module.exports = exports = function(module, funcs){
  var exports = {};

  exports.getMediaFile = function(media_file_id, media_ext, thumbnail_name, thumbnail_config){
    var fname = media_file_id.toString();
    if(thumbnail_name) fname += '.' + thumbnail_name;
    else if(thumbnail_config && thumbnail_config.resize){
      fname += '.custom.'+(thumbnail_config.resize[0]||'').toString()+'x'+(thumbnail_config.resize[1]||'').toString();
    }
    else if(thumbnail_config) throw new Error('Unsupported media file name: '+JSON.stringify(thumbnail_config));
    fname += media_ext;
    return path.join(path.join(module.jsh.Config.datadir,'media'),fname);
  }

  exports.media = function (req, res, next) {
    var verb = req.method.toLowerCase();
    
    var Q = req.query;
    var P = req.body;
    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;
    var sql = '';
    var sql_ptypes = [];
    var sql_params = {};
    var verrors = {};
    var dbtypes = appsrv.DB.types;
    var validate = null;
    var model = jsh.getModel(req, module.namespace + 'Media_Editor');
    
    if (verb == 'get'){
      if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

      if(!req.params || !req.params.media_key) return next();
      var media_key = req.params.media_key;
      var thumbnail_name = req.params.thumbnail;
      var thumbnail_config = null;
      if(thumbnail_name) thumbnail_config = jsh.Modules['jsHarmonyCMS'].Config.media_thumbnails[thumbnail_name];

      //Invalid Thumbnail
      if(thumbnail_name && !thumbnail_config) return next();

      //Check if media exists
      sql_ptypes = [dbtypes.BigInt];
      sql_params = { 'media_key': media_key };
      validate = new XValidate();
      verrors = {};
      validate.AddValidator('_obj.media_key', 'Media Key', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      sql = 'select media_key,media_file_id,media_filename,media_path,media_ext from '+(module.schema?module.schema+'.':'')+'v_my_media where media_key=@media_key';
      if(Q.media_file_id){
        sql_ptypes.push(dbtypes.BigInt);
        sql_params.media_file_id = Q.media_file_id;
        validate.AddValidator('_obj.media_file_id', 'Media File ID', 'B', [XValidate._v_IsNumeric()]);
        sql += ' and media_file_id=@media_file_id';
      }
      
      var fields = [];
      var datalockstr = '';
      appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
      sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
      
      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
        if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
        if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Media ID'); }
        var media = rslt[0][0];
      
        //Validate parameters
        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, ['|width','|height','|download','|media_file_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //XValidate
        if(!thumbnail_config && (Q.width || Q.height)){

          validate = new XValidate();
          verrors = {};
          validate.AddValidator('_obj.width', 'Width', 'B', [ XValidate._v_IsNumeric(), XValidate._v_Required() ]);
          validate.AddValidator('_obj.height', 'Height', 'B', [ XValidate._v_IsNumeric(), XValidate._v_Required() ]);
          
          verrors = _.merge(verrors, validate.Validate('B', Q));
          if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

          thumbnail_config = { resize: [ parseInt(Q.width), parseInt(Q.height) ] };
        }

        var serveoptions = { attachment: !!('download' in Q), mime_override: media.media_ext };
        var srcpath = funcs.getMediaFile(media.media_file_id, media.media_ext);
        var fpath = funcs.getMediaFile(media.media_file_id, media.media_ext, thumbnail_name, thumbnail_config);
        var fname = path.basename(media.media_filename);

        var transformMedia = function(transform_callback){
          if('resize' in thumbnail_config) HelperImg.resize(srcpath, fpath, thumbnail_config.resize, thumbnail_config.format, transform_callback);
          else if('crop' in thumbnail_config) HelperImg.crop(srcpath, fpath, thumbnail_config.format, transform_callback);
          else if('format' in thumbnail_config) HelperImg.resample(srcpath, fpath, thumbnail_config.format, transform_callback);
        }

        var serveFile = function(serve_callback){
          HelperFS.outputFile(req, res, fpath, fname, serve_callback, serveoptions);
        }

        //Server media file
        serveFile(function (err) {
          //Only executes upon error
          if (err != null) {
            if (('code' in err) && (err.code == 'ENOENT')){
              if(!thumbnail_config) return Helper.GenError(req, res, -33, 'Media file not found.');
              //Generate thumbnail
              transformMedia(function(err){
                if(err){
                  jsh.Log.error(err.toString() + '\n' + (err.stack?err.stack:(new Error()).stack));
                  return Helper.GenError(req, res, -99999, 'Error occurred during media processing operation (' + err.toString() + ')');
                }
                //Try again to serve file
                serveFile(function (err) {
                  if (err != null) {
                    if (('code' in err) && (err.code == 'ENOENT')) return Helper.GenError(req, res, -33, 'Media file not found.');
                    else return Helper.GenError(req, res, -99999, 'Error occurred during file operation (' + err.toString() + ')');
                  }
                });
              });
            }
            else return Helper.GenError(req, res, -99999, 'Error occurred during file operation (' + err.toString() + ')');
          }
        });
        return;
      });
    }
    else if (verb == 'put'){
      if (!Helper.hasModelAction(req, model, 'I')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

      if(req.params && req.params.media_key) return next();

      var public_folder = jsh.Config.datadir + 'temp/public/';
      var form = new multiparty.Form({ maxFilesSize: jsh.Config.max_filesize, uploadDir: (public_folder) });
      form.parse(req, function (err, fields, files) {
        //Handle Error
        if (err != null) {
          if (('code' in err) && (err.code == 'ETOOBIG')) { return Helper.GenError(req, res, -31, 'Upload file exceeded maximum file size.'); }
          jsh.Log.error(err);
          return Helper.GenError(req, res, -30, 'Invalid file upload request.');
        }

        P = {};
        for(var field_name in fields){
          var field = fields[field_name];
          if(_.isArray(field) && field.length) field = field[0];
          P[field_name] = field;
        }
        
        if (files == null) { return Helper.GenError(req, res, -30, 'Invalid file upload request.'); }
        if (!('media_file' in files)) { return Helper.GenError(req, res, -30, 'Invalid file upload request.'); }
        if (files.media_file.length != 1) { return Helper.GenError(req, res, -30, 'Invalid file upload request.'); }
        
        var media_file = files.media_file[0];
        var media_size = media_file.size;
        var media_file_orig_name = path.basename(media_file.originalFilename);
        var tmp_file_path = media_file.path;
        var media_ext = path.extname(path.basename(media_file_orig_name)).toLowerCase()||'.'; //Get extension
        if (!_.includes(jsh.Config.valid_extensions, media_ext)) { return Helper.GenError(req, res, -32, 'File extension is not supported.'); }
        
        //Validate parameters
        if (!appsrv.ParamCheck('P', P, ['|media_desc', '&media_path', '|media_tags', '|media_type'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        validate = new XValidate();
        verrors = {};
        validate.AddValidator('_obj.media_desc', 'Description', 'B', [ XValidate._v_MaxLength(256) ]);
        validate.AddValidator('_obj.media_path', 'Path', 'B', [ XValidate._v_MaxLength(2048), XValidate._v_Required() ]);
        validate.AddValidator('_obj.media_tags', 'Tags', 'B', [ ]);
        validate.AddValidator('_obj.media_type', 'Type', 'B', [ XValidate._v_MaxLength(32) ]);
        verrors = _.merge(verrors, validate.Validate('B', P));
        if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

        //Calculate extension, size, width, height
        var media_key = null;
        var media_desc = P.media_desc;
        var media_path = P.media_path;
        var media_tags = P.media_tags;
        var media_type = P.media_type;
        var media_height = null;
        var media_width = null;

        var base_path = path.dirname(media_path);
        if(base_path[base_path.length - 1]!='/') base_path += '/';
        var media_filename = HelperFS.cleanFileName(path.basename(media_path));
        media_path = base_path + media_filename;


        async.waterfall([

          //Clear temp files
          function(cb){
            HelperFS.clearFiles(public_folder, jsh.Config.public_temp_expiration, -1, function(err){
              if (_.isObject(err) && ('number' in err) && (err.number == -36)) return Helper.GenError(req, res, -36, 'User exceeded max temp folder size');
              return cb();
            });
          },
          
          //Rename duplicate path
          function(cb){

            var media_path_base = base_path + media_filename.substr(0, media_filename.length - media_ext.length) + '%' + media_ext;
            
            sql_ptypes = [dbtypes.VarChar(2048)];
            sql_params = {
              'media_path_base': media_path_base
            };
            sql = 'select media_path from '+(module.schema?module.schema+'.':'')+'v_my_media where media_path like @media_path_base;';
            
            appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
              if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
              if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length) return cb();
              var conflicts = rslt[0];
              var curattempt = 0;
              while(true){
                var found_conflict = false;
                for(var i=0;i<conflicts.length;i++){
                  var conflict = conflicts[i];
                  if(conflict.media_path.toLowerCase()==media_path.toLowerCase()){ found_conflict = true; break; }
                }
                if(!found_conflict) break;
                curattempt++;
                media_path = base_path + media_filename.substr(0, media_filename.length - media_ext.length) + '('+curattempt.toString()+')' + media_ext;
              }
              return cb();
            });
          },

          //Get image width / height
          function(cb){
            HelperImg.size(tmp_file_path, function(err, size){
              if(err || !size || !size.width || !size.height) return cb();
              media_width = size.width;
              media_height = size.height;
              return cb();
            });
          },

          //Apply maximum image size, if applicable
          function(cb){
            var cmsConfig = jsh.Modules['jsHarmonyCMS'].Config;
            if(!media_width || !media_height) return cb();
            if(cmsConfig.media_thumbnails && cmsConfig.media_thumbnails.maximum && cmsConfig.media_thumbnails.maximum.resize){
              HelperImg.resize(tmp_file_path, tmp_file_path, cmsConfig.media_thumbnails.maximum.resize, undefined, function(err){
                if(err) return cb(err);
                media_height = null;
                media_width = null;
                HelperImg.size(tmp_file_path, function(err, size){
                  if(err || !size || !size.width || !size.height) return cb();
                  media_width = size.width;
                  media_height = size.height;
                  return cb();
                });
              });
            }
            else return cb();
          },

          //Insert into database
          function(cb){
            sql_ptypes = [dbtypes.VarChar(256),dbtypes.VarChar(2048),dbtypes.VarChar(-1),dbtypes.VarChar(32),dbtypes.VarChar(16),dbtypes.Int,dbtypes.Int,dbtypes.Int];
            sql_params = {
              'media_desc': media_desc,
              'media_path': media_path,
              'media_tags': media_tags,
              'media_type': media_type,
              'media_ext': media_ext,
              'media_size': media_size,
              'media_width': media_width,
              'media_height': media_height
            };

            sql = (module.schema?module.schema+'.':'')+'insert_media(@media_desc, @media_path, @media_tags, @media_type, @media_ext, @media_size, @media_width, @media_height);';
            
            var fields = [];
            var datalockstr = '';
            appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
            sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);

            appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
              if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
              if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Media ID'); }
              media_key = rslt[0][0].media_key;
              return cb();
            });
          },

          //Copy file
          function (cb) {
            HelperFS.rename(tmp_file_path, funcs.getMediaFile(media_key, media_ext), cb);
          },

        ], function(err){
          if(err){
            jsh.Log.error(err.toString() + '\n' + (err.stack?err.stack:(new Error()).stack));
            return Helper.GenError(req, res, -99999, 'Error occurred during media processing operation (' + err.toString() + ')');
          }
          res.end(JSON.stringify({ '_success': 1, 'media_key': media_key }));
        });
      });
    }
    else if (verb == 'post'){
      if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

      if(!req.params || !req.params.media_key) return next();
      var media_key = req.params.media_key;
      
      //Check if media exists
      sql_ptypes = [dbtypes.BigInt];
      sql_params = { 'media_key': media_key };
      validate = new XValidate();
      verrors = {};
      validate.AddValidator('_obj.media_key', 'Media Key', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      sql = 'select media_key,media_file_id,media_filename,media_path,media_ext from '+(module.schema?module.schema+'.':'')+'v_my_media where media_key=@media_key';
      
      var fields = [];
      var datalockstr = '';
      appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
      sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
      
      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
        if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
        if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Media ID'); }
        var media = rslt[0][0];

        var public_folder = jsh.Config.datadir + 'temp/public/';
        var form = new multiparty.Form({ maxFilesSize: jsh.Config.max_filesize, uploadDir: (public_folder) });
        form.parse(req, function (err, fields, files) {
          //Handle Error
          if (err != null) {
            if (('code' in err) && (err.code == 'ETOOBIG')) { return Helper.GenError(req, res, -31, 'Upload file exceeded maximum file size.'); }
            jsh.Log.error(err);
            return Helper.GenError(req, res, -30, 'Invalid file upload request.');
          }

          P = {};
          for(var field_name in fields){
            var field = fields[field_name];
            if(_.isArray(field) && field.length) field = field[0];
            P[field_name] = field;
          }
          
          if (files == null) { return Helper.GenError(req, res, -30, 'Invalid file upload request.'); }
          if (!('media_file' in files)) { return Helper.GenError(req, res, -30, 'Invalid file upload request.'); }
          if (files.media_file.length != 1) { return Helper.GenError(req, res, -30, 'Invalid file upload request.'); }
          
          var media_file = files.media_file[0];
          var media_size = media_file.size;
          var media_file_orig_name = path.basename(media_file.originalFilename);
          var tmp_file_path = media_file.path;
          var media_ext = path.extname(path.basename(media_file_orig_name)).toLowerCase()||'.'; //Get extension
          if (!_.includes(jsh.Config.valid_extensions, media_ext)) { return Helper.GenError(req, res, -32, 'File extension is not supported.'); }

          //Get new media_path base on media_ext
          var media_path = media.media_path.substr(0, media.media_path.length - media.media_ext.length) + media_ext;
          
          //Validate parameters
          if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
          if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

          //Calculate extension, size, width, height
          var media_file_id = null;
          var media_filename = null;
          var media_height = null;
          var media_width = null;

          async.waterfall([

            //Clear temp files
            function(cb){
              HelperFS.clearFiles(public_folder, jsh.Config.public_temp_expiration, -1, function(err){
                if (_.isObject(err) && ('number' in err) && (err.number == -36)) return Helper.GenError(req, res, -36, 'User exceeded max temp folder size');
                return cb();
              });
            },
            
            //Get image width / height
            function(cb){
              HelperImg.size(tmp_file_path, function(err, size){
                if(err || !size || !size.width || !size.height) return cb();
                media_width = size.width;
                media_height = size.height;
                return cb();
              });
            },
            
            //Apply maximum image size, if applicable
            function(cb){
              var cmsConfig = jsh.Modules['jsHarmonyCMS'].Config;
              if(!media_width || !media_height) return cb();
              if(cmsConfig.media_thumbnails && cmsConfig.media_thumbnails.maximum && cmsConfig.media_thumbnails.maximum.resize){
                HelperImg.resize(tmp_file_path, tmp_file_path, cmsConfig.media_thumbnails.maximum.resize, undefined, function(err){
                  if(err) return cb(err);
                  media_height = null;
                  media_width = null;
                  HelperImg.size(tmp_file_path, function(err, size){
                    if(err || !size || !size.width || !size.height) return cb();
                    media_width = size.width;
                    media_height = size.height;
                    return cb();
                  });
                });
              }
              else return cb();
            },

            //Update database
            function(cb){
              sql_ptypes = [dbtypes.BigInt,dbtypes.VarChar(16),dbtypes.VarChar(2048),dbtypes.Int,dbtypes.Int,dbtypes.Int];
              sql_params = {
                media_key: media_key,
                media_ext: media_ext,
                media_path: media_path,
                media_size: media_size,
                media_width: media_width,
                media_height: media_height
              };

              sql = 'update '+(module.schema?module.schema+'.':'')+'v_my_media set media_file_id=null,media_ext=@media_ext, media_path=@media_path, media_size=@media_size, media_width=@media_width, media_height=@media_height where media_key = @media_key; select media_filename, media_file_id from '+(module.schema?module.schema+'.':'')+'v_my_media where media_key=@media_key;';
              
              var fields = [];
              var datalockstr = '';
              appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
              sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);

              appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
                if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
                if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Media ID'); }

                media_file_id = rslt[0][0].media_file_id;
                media_filename = rslt[0][0].media_filename;
                return cb();
              });
            },

            //Copy file
            function (cb) {
              HelperFS.rename(tmp_file_path, funcs.getMediaFile(media_file_id, media_ext), cb);
            },

          ], function(err){
            if(err){
              jsh.Log.error(err.toString() + '\n' + (err.stack?err.stack:(new Error()).stack));
              return Helper.GenError(req, res, -99999, 'Error occurred during media processing operation (' + err.toString() + ')');
            }
            res.end(JSON.stringify({ '_success': 1, media_ext: media_ext, media_path: media_path, media_filename: media_filename, media_width: media_width, media_height: media_height, media_size: media_size, media_file_id: media_file_id }));
          });
        });
        return;
      });
    }
    else if (verb == 'delete'){
      if (!Helper.hasModelAction(req, model, 'D')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

      if(!req.params || !req.params.media_key) return next();
      var media_key = req.params.media_key;
      
      //Check if media exists
      sql_ptypes = [dbtypes.BigInt];
      sql_params = { 'media_key': media_key };
      validate = new XValidate();
      verrors = {};
      validate.AddValidator('_obj.media_key', 'Media Key', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      sql = 'select media_key,media_file_id,media_filename,media_path,media_ext from '+(module.schema?module.schema+'.':'')+'v_my_media where media_key=@media_key';
      
      var fields = [];
      var datalockstr = '';
      appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
      sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
      
      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
        if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
        if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Media ID'); }
        var media = rslt[0][0];
      
        //Validate parameters
        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        appsrv.ExecCommand(req._DBContext, 'delete from '+(module.schema?module.schema+'.':'')+'v_my_media where media_key=@media_key', sql_ptypes, sql_params, function (err, rslt) {
          if(err) return Helper.GenError(req, res, -99999, 'Error deleting file (' + err.toString() + ')');
          res.end(JSON.stringify({ '_success': 1 }));
        });
        return;
      });
    }
    else return next();
  }

  return exports;
};
