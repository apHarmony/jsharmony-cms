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
var multiparty = require('jsharmony/lib/multiparty');
var _ = require('lodash');
var path = require('path');
var async = require('async');
var querystring = require('querystring');
var fs = require('fs');

module.exports = exports = function(module, funcs){
  var exports = {};
  var _t = module._t;

  exports.getMediaFilename = function(media_file_id, media_ext, thumbnail_id, thumbnail_config){
    var fname = media_file_id.toString();
    if(thumbnail_id) fname += '.' + thumbnail_id;
    else if(thumbnail_config && thumbnail_config.resize){
      fname += '.custom.'+(thumbnail_config.resize[0]||'').toString()+'x'+(thumbnail_config.resize[1]||'').toString();
    }
    else if(thumbnail_config) throw new Error('Unsupported media file name: '+JSON.stringify(thumbnail_config));
    fname += ((thumbnail_config && thumbnail_config.format) ? '.' + thumbnail_config.format : media_ext);
    return path.join(exports.getMediaFileFolder(), fname);
  };

  exports.getMediaFileFolder = function() {
    return path.join(module.jsh.Config.datadir,'media');
  }

  exports.getMediaFile = function(media_file_id, media_filename, media_ext, thumbnail_id, thumbnail_config, callback){
    var jsh = module.jsh;

    var srcpath = funcs.getMediaFilename(media_file_id, media_ext);
    var fpath = funcs.getMediaFilename(media_file_id, media_ext, thumbnail_id, thumbnail_config);
    var fname = path.basename(media_filename);

    if(thumbnail_config && thumbnail_config.format){
      var fext = path.extname(fname);
      if(fext.length > 1) fname = fname.substr(0, fname.length - fext.length) + '.' + thumbnail_config.format;
    }

    var transformMedia = function(transform_callback){
      if('resize' in thumbnail_config) jsh.Extensions.image.resize(srcpath, fpath, thumbnail_config.resize, thumbnail_config.format, transform_callback);
      else if('crop' in thumbnail_config) jsh.Extensions.image.crop(srcpath, fpath, thumbnail_config.crop, thumbnail_config.format, transform_callback);
      else if('format' in thumbnail_config) jsh.Extensions.image.resample(srcpath, fpath, thumbnail_config.format, transform_callback);
      else return transform_callback(new Error('Invalid thumbnail_config: '+JSON.stringify(thumbnail_config)));
    };

    fs.stat(fpath, function (err, stat) {
      if(err){
        if(HelperFS.fileNotFound(err)){
          if(!thumbnail_config) return callback(new Error('Media file not found'));
          //Generate thumbnail
          transformMedia(function(err){
            if(err) return callback(err);
            fs.stat(fpath, function (err, stat) {
              if(err) return callback(err);
              return callback(null, fpath, fname, stat);
            });
          });
        }
        else return callback(err);
      }
      else return callback(null, fpath, fname, stat);
    });
  };

  exports.appendThumbnail = function(fpath, thumbnail_id, thumbnail_config){
    if(!fpath) return fpath;
    var fname = path.basename(fpath);
    var fext = path.extname(fname);
    fpath = fpath.substr(0, fpath.length - fext.length) + '.' + thumbnail_id + fext;
    if(thumbnail_config && thumbnail_config.format){
      if(fext.length > 1) fpath = fpath.substr(0, fpath.length - fext.length) + '.' + thumbnail_config.format;
    }
    return fpath;
  };

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
    var model = jsh.getModel(req, module.namespace + 'Media_Tree');
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }


    funcs.getSiteConfig(req._DBContext, null, { continueOnConfigError: true }, function(err, siteConfig){
      if(err) return Helper.GenError(req, res, -99999, err.toString());
    
      if (verb == 'get'){ (function(){
        if(!req.params || !req.params.media_key) return next();
        var media_key = req.params.media_key;
        var thumbnail_id = req.params.thumbnail;
        var thumbnail_config = null;
        if(thumbnail_id) thumbnail_config = siteConfig.media_thumbnails[thumbnail_id];

        //Invalid Thumbnail
        if(thumbnail_id && !thumbnail_config) return next();

        //Check if media exists
        sql_ptypes = [dbtypes.BigInt];
        sql_params = { 'media_key': media_key };
        validate = new XValidate();
        verrors = {};
        validate.AddValidator('_obj.media_key', 'Media Key', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
        sql = 'select media_key,media_file_id,media_filename,media_path,media_ext from {schema}.v_my_media where media_key=@media_key';

        if(Q.media_id){
          sql_ptypes.push(dbtypes.BigInt);
          sql_params.media_id = Q.media_id;
          validate.AddValidator('_obj.media_id', 'Media ID', 'B', [XValidate._v_IsNumeric()]);
          sql = 'select media_key,media_file_id,media_filename,media_path,media_ext from {schema}.media where media_key=@media_key and media_id=@media_id and site_id={schema}.my_current_site_id()';
        }
        
        var fields = [];
        var datalockstr = '';
        appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
        sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
        
        verrors = _.merge(verrors, validate.Validate('B', sql_params));
        if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

        appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
          if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Media ID'); }
          var media = rslt[0][0];

          if(Q.media_file_id){
            if(Q.media_file_id.toString() != (media.media_file_id||'').toString()){
              //Redirect to correct media_file_id
              var query = req.query;
              query.media_file_id = media.media_file_id;
              var url = req.path + '?' + querystring.stringify(query);
              return Helper.Redirect302(res, url);
            }
          }
        
          //Validate parameters
          var validQueryParams = [
            '|width','|height','|download','|media_file_id','|media_id', '|crop', '|resize','|flip_horizontal',
            '|flip_vertical', '|rotate', '|invert', '|levels', '|sharpen', '|brightness', '|contrast', '|gamma', '|nocache'
          ];
          if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
          if (!appsrv.ParamCheck('Q', Q, validQueryParams)) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

          var transform = exports.getMediaTransformParameters(Q);

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

          verrors = validateTransformQuery(Q);
          if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

          var serveoptions = { attachment: !!('download' in Q), mime_override: media.media_ext };

          if(thumbnail_config && thumbnail_config.format) serveoptions.mime_override = '.' + thumbnail_config.format;

          funcs.getMediaFile(media.media_file_id, media.media_filename, media.media_ext, thumbnail_id, thumbnail_config, function(err, fpath, fname, stat){
            if(err){
              if(err.message == 'Media file not found') return Helper.GenError(req, res, -33, 'Media file not found.');
              jsh.Log.error(err.toString() + '\n' + (err.stack?err.stack:(new Error()).stack));
              return Helper.GenError(req, res, -99999, 'Error occurred during media processing operation (' + err.toString() + ')');
            }

            if (transform) {
              const transformFilename = exports.getMediaTransformFileName(media.media_file_id, path.extname(fpath).slice(1), transform);
              const transformFilePath = path.join(path.dirname(fpath), transformFilename);
              fs.readFile(transformFilePath, (error, buffer) => {
                if (error && error.code === 'ENOENT') {
                  jsh.Extensions.image.transform(fpath, undefined, undefined, transform, (tfError, tfBuffer) => {
                    if (tfError) {
                      return Helper.GenError(req, res, -99999, 'Error occurred during file operation (' + tfError.toString() + ')');
                    } else {
                      if (Q.nocache !== '1') {
                        // No need to wait for this.
                        // If cache fails  we will just have to try again next time.
                        fs.writeFile(transformFilePath, tfBuffer, () => {});
                      }
                      HelperFS.outputContent(req, res, tfBuffer, HelperFS.getMimeType(fpath), undefined);
                    }
                  });
                } else if (error) {
                  return Helper.GenError(req, res, -99999, 'Error occurred during file operation (' + error.toString() + ')');

                } else {
                  HelperFS.outputContent(req, res, buffer, HelperFS.getMimeType(fpath), undefined);
                }
              });
            } else {
              res.writeHead(200, {
                'Content-Type': HelperFS.getMimeType(serveoptions.mime_override||fpath),
                'Content-Length': stat.size,
                'Content-Disposition': 'attachment; filename=' + encodeURIComponent(fname)
              });
              fs.createReadStream(fpath).pipe(res);
            }
          });
          return;
        });
      })(); }
      else if (verb == 'put'){ (function(){
        if (!Helper.hasModelAction(req, model, 'I')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

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
                while(true){ // eslint-disable-line no-constant-condition
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
              if(!_.includes(['.jpg','.jpeg','.tif','.tiff','.png','.gif','.svg'], media_ext)) return cb();
              jsh.Extensions.image.size(tmp_file_path, function(err, size){
                if(err || !size || !size.width || !size.height) return cb();
                media_width = size.width;
                media_height = size.height;
                return cb();
              });
            },

            //Apply maximum image size, if applicable
            function(cb){
              if(!media_width || !media_height) return cb();
              if(siteConfig.media_thumbnails && siteConfig.media_thumbnails.maximum && siteConfig.media_thumbnails.maximum.resize){
                jsh.Extensions.image.resize(tmp_file_path, tmp_file_path, siteConfig.media_thumbnails.maximum.resize, undefined, function(err){
                  if(err) return cb(err);
                  media_height = null;
                  media_width = null;
                  jsh.Extensions.image.size(tmp_file_path, function(err, size){
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
              HelperFS.rename(tmp_file_path, funcs.getMediaFilename(media_key, media_ext), cb);
            },

          ], function(err){
            if(err){
              jsh.Log.error(err.toString() + '\n' + (err.stack?err.stack:(new Error()).stack));
              return Helper.GenError(req, res, -99999, 'Error occurred during media processing operation (' + err.toString() + ')');
            }
            res.end(JSON.stringify({ '_success': 1, 'media_key': media_key }));
          });
        });
      })(); }
      else if (verb == 'post'){ (function(){
        if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

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
            var media_height = null;
            var media_width = null;
            var media_data = null;

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
                jsh.Extensions.image.size(tmp_file_path, function(err, size){
                  if(err || !size || !size.width || !size.height) return cb();
                  media_width = size.width;
                  media_height = size.height;
                  return cb();
                });
              },
              
              //Apply maximum image size, if applicable
              function(cb){
                if(!media_width || !media_height) return cb();
                if(siteConfig.media_thumbnails && siteConfig.media_thumbnails.maximum && siteConfig.media_thumbnails.maximum.resize){
                  jsh.Extensions.image.resize(tmp_file_path, tmp_file_path, siteConfig.media_thumbnails.maximum.resize, undefined, function(err){
                    if(err) return cb(err);
                    media_height = null;
                    media_width = null;
                    jsh.Extensions.image.size(tmp_file_path, function(err, size){
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

                sql = 'update '+(module.schema?module.schema+'.':'')+'v_my_media set media_file_id=null,media_ext=@media_ext, media_path=@media_path, media_size=@media_size, media_width=@media_width, media_height=@media_height where media_key = @media_key; ';
                sql += 'select media_id, media_filename, media_file_id, media_uptstmp, jsharmony.my_db_user_fmt(media_upuser) media_upuser_fmt, media_mtstmp, jsharmony.my_db_user_fmt(media_muser) media_muser_fmt from '+(module.schema?module.schema+'.':'')+'v_my_media where media_key=@media_key;';
                
                var fields = [];
                var datalockstr = '';
                appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
                sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);

                appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
                  if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
                  if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Media ID'); }

                  media_file_id = rslt[0][0].media_file_id;
                  media_data = rslt[0][0];
                  return cb();
                });
              },

              //Copy file
              function (cb) {
                HelperFS.rename(tmp_file_path, funcs.getMediaFilename(media_file_id, media_ext), cb);
              },

            ], function(err){
              if(err){
                jsh.Log.error(err.toString() + '\n' + (err.stack?err.stack:(new Error()).stack));
                return Helper.GenError(req, res, -99999, 'Error occurred during media processing operation (' + err.toString() + ')');
              }
              var rslt_data = {
                '_success': 1,
                media: {
                  media_ext: media_ext,
                  media_path: media_path,
                  media_width: media_width,
                  media_height: media_height,
                  media_size: media_size
                }
              };
              rslt_data.media = _.extend(rslt_data.media, media_data);
              res.end(JSON.stringify(rslt_data));
            });
          });
          return;
        });
      })(); }
      else if (verb == 'delete'){ (function(){
        if (!Helper.hasModelAction(req, model, 'D')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

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
        
          //Validate parameters
          if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
          if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

          appsrv.ExecCommand(req._DBContext, 'delete from '+(module.schema?module.schema+'.':'')+'v_my_media where media_key=@media_key', sql_ptypes, sql_params, function (err, rslt) {
            if(err) return Helper.GenError(req, res, -99999, 'Error deleting file (' + err.toString() + ')');
            res.end(JSON.stringify({ '_success': 1 }));
          });
          return;
        });
      })(); }
      else return next();
    });
  };

  /**
   * @param {string} mediaId
   * @param {string} ext - filename extension to use.
   * @param {TransformOptions} transform
   * @returns {string | undefined}
   */
  exports.getMediaTransformFileName = function(mediaId, ext, transform) {

    /**************************************************
     * File Name Format
     * 
     * <media id>._.<transform>.<ext>
     * 
     * <transform> is a string created by
     * combining each transform part ID with a "dot".
     * 
     * Transform part IDs are given (with order maintained) as:
     *    crop :: c_<x>_<y>_<w>_<h>
     *    resize :: rs_<w>_<h>
     *    flip_horizontal :: fh
     *    flip_vertical :: fv
     *    rotate :: ro_<degrees>
     *    invert :: pi
     *    levels :: pl_<r>_<g>_<b>
     *    sharpen :: ps_<amount>
     *    brightness :: pb_<amount>
     *    contrast :: pc_<amount>
     *    gamma :: pg_<amount>
     * 
     * Round any floats to a max of 5 digits
     * 
     * Example:
     *    21._.c_0_0_100_100.re_500_500.fh.fv.ro_90.pi.pl_-1_0_-1.ps_-1.pb_1.pc_0.12345.pg_0.001.jpg
     * 
     *************************************************/

    const round = n => n == undefined ? 0 : Math.round(n * 100000) / 100000;

    const parts = [];

    if (transform.crop) {
      const c = transform.crop;
      parts.push(`c_${round(c.x)}_${round(c.y)}_${round(c.width)}_${round(c.height)}`);
    }
    if (transform.resize) {
      const r = transform.resize;
      parts.push(`rs_${round(r.width)}_${round(r.height)}`);
    }
    if (transform.flip_horizontal) {
      parts.push('fh');
    }
    if (transform.flip_vertical) {
      parts.push('fv');
    }
    if (transform.rotate) {
      parts.push(`ro_${round(transform.rotate)}`);
    }
    if (transform.invert) {
      parts.push('pi');
    }
    if (transform.levels && (transform.levels.r || transform.levels.g || transform.levels.b)) {
      const l = transform.levels;
      parts.push(`pl_${round(l.r)}_${round(l.g)}_${round(l.b)}`);
    }
    if (transform.sharpen) {
      parts.push(`ps_${round(transform.sharpen)}`);
    }
    if (transform.brightness) {
      parts.push(`pb_${round(transform.brightness)}`);
    }
    if (transform.contrast) {
      parts.push(`pc_${round(transform.contrast)}`);
    }
    if (transform.gamma) {
      parts.push(`pg_${round(transform.gamma)}`);
    }

    if (parts.length < 1) return undefined;

    return `${mediaId}._.${parts.join('.')}.${ext}`;
  }

  exports.getMediaTransformParameters = function(query) {

    const convertNum = (value, asFloat) => {
      const numValue = asFloat ? parseFloat(value) : parseInt(value);
      return isNaN(numValue) ? undefined : numValue;
    }

    let hasTransform = false;
    const transform = {};

    if (query.brightness != undefined) {
      hasTransform = true;
      transform.brightness = convertNum(query.brightness, true);
    }

    if (query.contrast != undefined) {
      hasTransform = true;
      transform.contrast = convertNum(query.contrast, true);
    }

    if (query.crop != undefined) {
      hasTransform = true;
      const cropValues = query.crop.split(',');
      transform.crop = {
        x: convertNum(cropValues[0], true),
        y: convertNum(cropValues[1], true),
        width: convertNum(cropValues[2], true),
        height: convertNum(cropValues[3], true),
      }
    }

    if (query.flip_horizontal === '1') {
      hasTransform = true;
      transform.flip_horizontal = true;
    }

    if (query.flip_vertical === '1') {
      hasTransform = true;
      transform.flip_vertical = true;
    }

    if (query.gamma != undefined) {
      hasTransform = true;
      transform.gamma = convertNum(query.gamma, true);
    }

    if (query.invert === '1') {
      hasTransform = true;
      transform.invert = true;
    }

    if (query.levels != undefined) {
      hasTransform = true;
      const levelValues = query.levels.split(',');
      transform.levels = {
        r: convertNum(levelValues[0], true),
        g: convertNum(levelValues[1], true),
        b: convertNum(levelValues[2], true)
      }
    }

    if (query.resize != undefined) {
      hasTransform = true;
      const resizeValues = query.resize.split(',');
      transform.resize = {
        width: convertNum(resizeValues[0]),
        height: convertNum(resizeValues[1])
      }
    }

    if (query.rotate != undefined) {
      hasTransform = true;
      transform.rotate = convertNum(query.rotate);
    }

    if (query.sharpen != undefined) {
      hasTransform = true;
      transform.sharpen = convertNum(query.sharpen, true);
    }

    return hasTransform ? transform : undefined;
  }

  function validateTransformQuery(query) {

    const XValidate = module.jsh.XValidate;
    const validate = new XValidate();
    
    validate.AddValidator('_obj.brightness', 'Brightness', 'B', [XValidate._v_IsFloat(), XValidate._v_MaxValue(1), XValidate._v_MinValue(-1)]);
    validate.AddValidator('_obj.contrast', 'Contrast', 'B', [XValidate._v_IsFloat(), XValidate._v_MaxValue(1), XValidate._v_MinValue(-1)]);
    validate.AddValidator('_obj.crop', 'Crop', 'B', [(caption, value, obj) => {
      if (!value) return '';
      const parts = value
        .split(',')
        .map(a => parseFloat(a.trim()))
        .filter(a => a != undefined && !isNaN(a));

      if (parts.length < 4) return `${caption} is missing values. Format: <x>,<y>,<width>,<height>`;

      const [x, y, width, height] = parts;
      if (x < 0 || x >= 1) return `${caption} x value must be equal to or greater than 0 and less than 1. Given ${x}.`;
      if (y < 0 || y >= 1) return `${caption} y value must be equal to or greater than 0 and less than 1. Given ${y}.`;
      if (width <= 0) return `${caption} width value must be greater than 0. Given ${width}.`;
      if (height <= 0) return `${caption} height value must be greater than 0. Given ${height}.`;
      if ((x + width) > 1) return `${caption} width exceeds image width.`
      if ((y + height) > 1) return `${caption} width exceeds image width.`
      
      return '';
    }]);
    validate.AddValidator('_obj.flip_horizontal', 'Flip Horizontal', 'B', [XValidate._v_InArray(['1', '0'])]);
    validate.AddValidator('_obj.flip_vertical', 'Flip Vertical', 'B', [XValidate._v_InArray(['1', '0'])]);
    validate.AddValidator('_obj.gamma', 'Gamma', 'B', [XValidate._v_IsFloat(), XValidate._v_MaxValue(1), XValidate._v_MinValue(-1)]);
    validate.AddValidator('_obj.invert', 'Invert', 'B', [XValidate._v_InArray(['1', '0'])]);
    validate.AddValidator('_obj.levels', 'Levels', 'B', [(caption, value, obj) => {
      if (!value) return '';
      const parts = value
        .split(',')
        .map(a => parseFloat(a.trim()))
        .filter(a => a != undefined && !isNaN(a));

      if (parts.length < 3) return `${caption} is missing values. Format: <red>,<green>,<blue>`;

      const [red, green, blue] = parts;
      if (red < -1 || red > 1) return `${caption} red value must be between -1 and 1 (inclusive). Given ${red}.`;
      if (green < -1 || green > 1) return `${caption} green value must be between -1 and 1 (inclusive). Given ${green}.`;
      if (blue < -1 || blue > 1) return `${caption} blue value must be between -1 and 1 (inclusive). Given ${blue}.`;

      return '';
    }]);
    validate.AddValidator('_obj.resize', 'Resize', 'B', [(caption, value, obj) => {
      if (!value) return '';
      const parts = value
        .split(',')
        .map(a => parseFloat(a.trim()))
        .filter(a => a != undefined && !isNaN(a));

      if (parts.length < 2) return `${caption} is missing values. Format: <width>,<height>`;

      const [width, height] = parts;
      if (width < 0) return `${caption} width value must be equal to or greater than 0. Given ${width}.`;
      if (height < 0) return `${caption} height value must be equal to or greater than 0. Given ${height}.`;

      return  '';
    }]);
    validate.AddValidator('_obj.rotate', 'Rotate', 'B', [XValidate._v_InArray(['0', '90', '180', '270'])]);
    validate.AddValidator('_obj.sharpen', 'Sharpen', 'B', [XValidate._v_IsFloat(), XValidate._v_MaxValue(1), XValidate._v_MinValue(-1)]);
    
    return validate.Validate('B', query);
  }

  return exports;
};



/**
 * @typedef {object} TransformOptions
 * @property {(TransformCropOptions | undefined)} crop
 * @property {(TransformResizeOptions | undefined)} resize
 * @property {(TransformLevelsOptions | undefined)} levels
 * @property {(boolean | undefined)} flip_horizontal
 * @property {(boolean | undefined)} flip_vertical
 * @property {(number | undefined)} rotate - 0, 90, 180, 270
 * @property {(number | undefined)} sharpen - -1...1
 * @property {(number | undefined)} brightness - -1...1
 * @property {(number | undefined)} contrast - -1...1
 * @property {(number | undefined)} gamma - -1...1
 * @property {(boolean | undefined)} invert
 */

/**
 * @typedef {object} TransformCropOptions
 * @property {number} x - proportional to image width [0, 1]
 * @property {number} y - proportional to image height [0, 1]
 * @property {number} width - proportional to image width [0, 1]
 * @property {number} height - proportional to image height [0, 1]
 */

/**
 * @typedef {object} TransformResizeOptions
 * @property {(number | undefined)} height
 * @property {(number | undefined)} width
 */

/**
 * @typedef {object} TransformLevelsOptions
 * @property {(number | undefined)} r - -1...1
 * @property {(number | undefined)} g - -1...1
 * @property {(number | undefined)} b - -1...1
 */