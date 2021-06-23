/*
Copyright 2020 apHarmony

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
var _ = require('lodash');
var path = require('path');
var async = require('async');
var yazl = require("yazl");
var yauzl = require("yauzl");
var moment = require('moment');
var crypto = require('crypto');
var fs = require('fs');

module.exports = exports = function(module, funcs){
  var exports = {};

  exports.branch_download = function (req, res, next) {
    var cms = module;
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
    var model = jsh.getModel(req, module.namespace + 'Branch_Download');

    if (req.query && (req.query.source=='js')) req.jsproxyid = 'cmsfiledownloader';

    if (verb == 'get'){
      if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

      if(!req.params || !req.params.branch_id) return next();
      var branch_id = parseInt(req.params.branch_id);

      //Validate parameters
      if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('Q', Q, ['|source'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      funcs.validateBranchAccess(req, res, branch_id, 'R%', ['PUBLISHER','WEBMASTER'], function(){

        //Check if branch exists
        sql_ptypes = [dbtypes.BigInt];
        sql_params = { 'branch_id': branch_id };
        validate = new XValidate();
        verrors = {};
        validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
        sql = "select branch_id,branch_name,site_id from "+(module.schema?module.schema+'.':'')+"v_my_branch_access where branch_id=@branch_id and branch_access like 'R%'";

        var fields = [];
        var datalockstr = '';
        appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
        sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);

        verrors = _.merge(verrors, validate.Validate('B', sql_params));
        if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

        appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
          if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Branch ID'); }
          var branch = rslt[0][0];
          var branchData = {
            data_files: [],
            site_id: branch.site_id,
          };

          async.waterfall([
            function(download_cb){
              async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
                if(!branch_item.download) return branch_item_cb();
                Helper.execif(branch_item.download.columns,
                  function(f){
                    var sql = "select branch_{item}.{item}_key,branch_{item}.{item}_id,";
                    sql += _.map(branch_item.download.columns || [], function(colname){ return '{item}.'+colname; }).join(',');

                    sql += " from {tbl_branch_item} branch_{item}"
                    sql += ' left outer join {tbl_item} {item} on {item}.{item}_id = branch_{item}.{item}_id';
          
                    sql += " where branch_{item}.branch_id=@branch_id and branch_{item}.{item}_id is not null";
                    
                    appsrv.ExecRecordset(req._DBContext, cms.applyBranchItemSQL(branch_item_type, sql), sql_ptypes, sql_params, function (err, rslt) {
                      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
                      if(!rslt || !rslt.length || !rslt[0]){ return download_cb(new Error('Error downloading revision data')); }
                      branchData[branch_item_type] = rslt[0];
                      return f();
                    });
                  },
                  branch_item_cb
                );
              }, download_cb);
            },
            function(download_cb){
              //Add paths to list
              async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
                if(!branch_item.download) return branch_item_cb();
                Helper.execif(branch_item.download.onGenerate,
                  function(f){
                    branch_item.download.onGenerate(branchData[branch_item_type], branchData, f);
                  },
                  branch_item_cb
                );
              }, download_cb);
            },
            function(download_cb){
              //Create zip file and stream back to user
              //data_files => "data" folder
              //"items.json"

              res.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-disposition': 'attachment; filename=cms_branch_'+HelperFS.cleanFileName(branch.branch_name,'-')+'__'+moment().format('YYYY-MM-DD-hh-mm-ss')+'.zip'
              });

              var zipfile = new yazl.ZipFile();
              zipfile.addBuffer(Buffer.from(JSON.stringify(branchData,null,4)), "items.json");
              _.each(branchData.data_files, function(data_file){
                zipfile.addFile(path.join(module.jsh.Config.datadir,data_file), "data/"+data_file);
              });
              zipfile.outputStream.pipe(res).on("close", function() {
                //Done
              });
              zipfile.end();
            },
          ], function(err){
            if(err) return Helper.GenError(req, res, -99999, err.toString());
          });
        });
      });
    }
    else return next();
  }

  exports.branch_upload = function (req, res, next) {
    var cms = module;
    var verb = req.method.toLowerCase();

    var DEBUG_BRANCH_UPLOAD = false;
    
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
    var model = jsh.getModel(req, module.namespace + 'Branch_Upload');

    if (verb == 'post'){
      if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

      //Validate parameters
      if (!appsrv.ParamCheck('P', P, ['&site_id','&branch_type','&branch_name','&branch_content'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      //Check if branch exists
      sql_ptypes = [dbtypes.BigInt,dbtypes.VarChar(32),dbtypes.VarChar(256)];
      sql_params = {
        'site_id': P.site_id,
        'branch_type': P.branch_type,
        'branch_name': P.branch_name,
      };
      validate = new XValidate();
      verrors = {};
      validate.AddValidator('_obj.site_id', 'Site ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.branch_type', 'Branch Type', 'B', [XValidate._v_MaxLength(32), XValidate._v_Required()]);
      validate.AddValidator('_obj.branch_name', 'Branch Name', 'B', [XValidate._v_MaxLength(256), XValidate._v_Required()]);

      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      funcs.validateSiteAccess(req, res, P.site_id, ['PUBLISHER'], function(){

        var baseurl = req.baseurl;
        if(baseurl.indexOf('//')<0) baseurl = req.protocol + '://' + req.get('host') + baseurl;

        var zip_file = '';
        var branchData = {
          _DBContext: req._DBContext,
          _baseurl: baseurl,
          site_id: null,
          LOVs: {},
          branchItems: {},
          contentFiles: {},
          pageTemplates: {},
          site_id: P.site_id,
        };

        async.waterfall([
          function(upload_cb){
            var fname = path.basename(P.branch_content);
            var file_ext = path.extname(fname).toLowerCase(); //Get extension
            if (file_ext != '.zip') { return Helper.GenError(req, res, -32, 'File extension is not supported.'); }
            zip_file = path.join(jsh.Config.datadir, 'temp', req._DBContext, fname);
            HelperFS.getFileStats(req, res, zip_file, function (err, stat) {
              if (err != null) { return Helper.GenError(req, res, -33, 'Revision content file not found.'); }
              upload_cb(null);
            });
          },
          function(upload_cb){
            //Validate file contents
            var items_text = '';
            funcs.unzip(zip_file, '', 
              { onEntry: function(entry, zipFile){
                branchData.contentFiles[entry.fileName] = { size: entry.uncompressedSize };
                return function(entry_cb){
                  zipFile.openReadStream(entry, function(err, readStream) {
                    if (err) return entry_cb(err);
                    var bpart = [];
                    var hash = crypto.createHash('sha1');
                    readStream.on('data', function(data){
                      if(entry.fileName == 'items.json') bpart.push(data);
                      hash.update(data);
                    });
                    readStream.on('end', function(){
                      //Save MD5 hash of file
                      branchData.contentFiles[entry.fileName].hash = hash.digest('hex');
                      if(entry.fileName == 'items.json'){
                        items_text = Buffer.concat(bpart).toString();
                      }
                      return entry_cb();
                    });
                  });
                }
              } },
              function(err){
                if(err) return upload_cb(err);

                if(!('items.json' in branchData.contentFiles)) return upload_cb(new Error('Invalid content file - missing items.json'));
                try{
                  branchData.branchItems = JSON.parse(items_text);
                }
                catch(ex){
                  return upload_cb(new Error('Error parsing items.json: ' + ex.toString()));
                }
                return upload_cb();
              }
            );
          },
          function(upload_cb){
            //Check for errors in content
            var errors = [];
            async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
              if(!branch_item.upload) return branch_item_cb();
              if(branch_item.upload.onValidate) branch_item.upload.onValidate(errors, branchData.branchItems[branch_item_type], branchData, branch_item_cb);
              else branch_item_cb();
            }, function(err){
              if(err) return upload_cb(err);
              if(errors.length) return upload_cb('Errors importing revision: \n'+errors.join('\n'));
              return upload_cb();
            });
          },
          function(upload_cb){
            var db = jsh.getDB('default');
            var dbtasks = {};

            //Create new branch (test error on duplicate, etc)
            dbtasks['branch_create'] = function (dbtrans, callback, transtbl) {
              var sql = "insert into {schema}.v_my_current_branch(branch_type, branch_name, site_id) values(@branch_type, @branch_name, @site_id);";
              db.Command(branchData._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, dbtrans, function (err, rslt) {
                if (err != null) { err.sql = sql; }
                callback(err, rslt);
              });
            }

            //Import branch items
            async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
              if(!branch_item.upload) return branch_item_cb();
              if(branch_item.upload.onImportDB) branch_item.upload.onImportDB(dbtasks, branchData.branchItems[branch_item_type], branchData, branch_item_cb);
              else branch_item_cb();
            }, function(err){
              if(err) return upload_cb(err);

              if(DEBUG_BRANCH_UPLOAD){
                //For testing - fail so that transaction doesn't go through
                dbtasks['fail'] = function (dbtrans, callback, transtbl) {
                  db.Command(branchData._DBContext, "select 1 fail testerr", [], {}, dbtrans, function (err, rslt) {
                    if (err != null) { err.sql = sql; }
                    callback(err, rslt);
                  });
                }
              }

              //Execute transactions
              db.ExecTransTasks(dbtasks, function (err, rslt) {
                if (DEBUG_BRANCH_UPLOAD) return upload_cb();
                if (err != null) { appsrv.AppDBError(req, res, err); return; }
                upload_cb(null);
              });
            });
          },
          function(upload_cb){
            funcs.unzip(zip_file, '', 
              { onEntry: function(entry, zipFile){
                if(!branchData.contentFiles[entry.fileName]) return false;
                if(!branchData.contentFiles[entry.fileName].onExtract) return false;
                return function(entry_cb){
                  zipFile.openReadStream(entry, function(err, readStream) {
                    if (err) return entry_cb(err);
                    if(branchData.contentFiles[entry.fileName].onExtract(readStream, entry_cb)===false){
                      readStream.destroy();
                      return entry_cb();
                    }
                  });
                }
              } },
              function(err){
                //For testing
                if(DEBUG_BRANCH_UPLOAD) return upload_cb(new Error('Testing Halted'));
                //Return result
                if(err) return upload_cb(err);
                return upload_cb();
              }
            );
          },
        ], function(err){
          if(err) return Helper.GenError(req, res, -99999, err.toString());
          //Return success
          return res.send(JSON.stringify({ _success: 1 }));
        });
      });
    }
    else return next();
  }

  exports.unzip = function(zipPath, dest, options, cb){
    options = _.extend({
      onEntry: null //function(entry, zipFile){} //Return false == do not extract.  Return string = new path.  Return function = cb
    }, options);
    yauzl.open(zipPath, { lazyEntries: true }, function(err, zipFile){
      if(err) throw err;
  
      var canceled = false;
      zipFile.on('error', function(err){ canceled = true; cb(err); });
      zipFile.on('close', function(){ if(canceled) return; cb(null); });
      zipFile.on('entry', function(entry){
        if(canceled) return;
  
        var next = function(){ zipFile.readEntry(); };
        if(entry.fileName.indexOf('__MACOSX/') == 0) return next();
  
        var targetPath = entry.fileName;
        if(options.onEntry) targetPath = options.onEntry(entry, zipFile);
        if(targetPath===false) return next();
        if((targetPath===true) || !targetPath) targetPath = entry.fileName;
        if(_.isFunction(targetPath)) return targetPath(function(err){
          if(err) return cb(err);
          return next();
        });
  
        async.waterfall([
          function(entry_cb){
            if(dest){
              targetPath = path.join(dest, targetPath)
              var targetFolder = path.dirname(targetPath);
              fs.realpath(targetFolder, function(err, realPath){
                if(err) return entry_cb(err);
  
                //Check if entry has directory traversal
                var relativePath = path.relative(dest, realPath);
                if(_.includes(relativePath.split(path.sep), '..')) return entry_cb(new Error('Project contains invalid file with directory traversal: '+entry.fileName));
  
                return entry_cb();
              });
            }
            else {
              targetPath = '';
              return entry_cb();
            }
          },
  
          function(entry_cb){
            if(!targetPath) return entry_cb();
  
            //Check if entry has invalid file mode
            var fileMode = (entry.externalFileAttributes >> 16) & 0xFFFF;
            if((fileMode & 61440) == 40960) return entry_cb(new Error('Project contains invalid file with symlink: '+entry.fileName));
  
            var isFolder = (((fileMode & 61440) == 16384) || (/\/$/.test(targetPath)));
            isFolder = isFolder || (((entry.versionMadeBy >> 8) === 0) && (entry.externalFileAttributes === 16));
  
            if(isFolder) {
              //Create directory
              exports.createFolderRecursive(targetPath, entry_cb);
            } else {
              //Create parent directory
              exports.createFolderRecursive(path.dirname(targetPath), function(err) {
                if (err) return entry_cb(err);
      
                zipFile.openReadStream(entry, function(err, readStream) {
                  if (err) return entry_cb(err);
      
                  //Save file contents
                  var writeStream = fs.createWriteStream(targetPath);
                  writeStream.on("close", function(){ return entry_cb(); });
                  readStream.pipe(writeStream);
                });
              });
            }
          }
        ], function(err){
          if(err) throw err;
          return next();
        });
      });
      zipFile.readEntry();
    });
  }

  exports.replaceSchema = function(sql){
    return Helper.ReplaceAll(sql,'{schema}.', module.schema?module.schema+'.':'');
  }

  exports.getLOV = function(branchData, key, tableName, options, callback){
    options = _.extend({}, options);
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var sql = 'select code_val, code_txt from ' + tableName + ' order by code_seq';
    appsrv.ExecRecordset(branchData._DBContext, funcs.replaceSchema(sql), [], {}, function (err, rslt) {
      if (err != null) { err.sql = sql; return callback(err); }
      if(!rslt || !rslt.length || !rslt[0]){ return callback(new Error('No data returned from database')); }
      branchData.LOVs[key] = {};
      _.each(rslt[0], function(row){
        branchData.LOVs[key][row.code_val] = row.code_txt;
      });
      return callback();
    });
  }

  exports.branch_upload_validatePage = function(errors, branchItems, branchData, callback){
    async.waterfall([
      function(cb){
        //Load Page Templates
        funcs.getPageTemplates(branchData._DBContext, branchData.site_id, { continueOnConfigError: true }, function(err, pageTemplates){
          if(err) return cb(err);
          branchData.pageTemplates = pageTemplates;
          return cb();
        });
      },
      function(cb){
        //Check pages for errors
        _.each(branchItems, function(item){
          if(item.page_template_id && !(item.page_template_id in branchData.pageTemplates)) errors.push('Page #'+item.page_id+' '+item.page_path+' - Page Template "'+item.page_template_id+'" not defined in current site');
          var contentFileName = 'data/page/'+item.page_file_id+'.json';
          if(!item.page_is_folder && item.page_file_id && !(contentFileName in branchData.contentFiles)) errors.push('Page #'+item.page_id+' '+item.page_path+' - Missing content file: '+contentFileName);
        });
        return cb();
      },
    ], callback);
  }

  exports.branch_upload_validateMedia = function(errors, branchItems, branchData, callback){
    async.waterfall([
      function(cb){ funcs.getLOV(branchData, 'media_type', '{schema}.code_media_type', {}, cb); },
      function(cb){
        async.eachSeries(branchItems, function(item, item_cb){
          if(item.media_type && !(item.media_type in branchData.LOVs.media_type)) errors.push('Media #'+item.media_id+' '+item.media_path+' - Invalid media type: '+item.media_type);
          var contentFileName = 'data/media/'+item.media_file_id+item.media_ext;
          if(!item.media_is_folder && item.media_file_id && !(contentFileName in branchData.contentFiles)) errors.push('Media #'+item.media_id+' '+item.media_path+' - Missing content file: '+contentFileName);
          return item_cb();
        }, cb);
      },
    ], callback);
  }

  exports.branch_upload_validateMenu = function(errors, branchItems, branchData, callback){
    async.waterfall([
      function(cb){
        _.each(branchItems, function(item){
          var contentFileName = 'data/menu/'+item.menu_file_id+'.json';
          if(!(contentFileName in branchData.contentFiles)) errors.push('Menu #'+item.menu_id+' '+item.menu_name+' - Missing content file: '+contentFileName);
        });
        return cb();
      },
    ], callback);
  }

  exports.branch_upload_validateRedirect = function(errors, branchItems, branchData, callback){
    async.waterfall([
      function(cb){ funcs.getLOV(branchData, 'redirect_url_type', '{schema}.code_redirect_url_type', {}, cb); },
      function(cb){ funcs.getLOV(branchData, 'redirect_http_code', '{schema}.code_redirect_http_code', {}, cb); },
      function(cb){
        _.each(branchItems, function(item){
          if(item.redirect_url_type && !(item.redirect_url_type in branchData.LOVs.redirect_url_type)) errors.push('Redirect #'+item.redirect_id+' '+item.redirect_url+' - Invalid Redirect URL Type: '+item.redirect_url_type);
          if(item.redirect_http_code && !(item.redirect_http_code in branchData.LOVs.redirect_http_code)) errors.push('Redirect #'+item.redirect_id+' '+item.redirect_url+' - Invalid Redirect HTTP Code: '+item.redirect_http_code);
        });
        return cb();
      },
    ], callback);
  }

  exports.branch_upload_validateSitemap = function(errors, branchItems, branchData, callback){
    async.waterfall([
      function(cb){ funcs.getLOV(branchData, 'sitemap_type', '{schema}.code_sitemap_type', {}, cb); },
      function(cb){
        _.each(branchItems, function(item){
          if(item.sitemap_type && !(item.sitemap_type in branchData.LOVs.sitemap_type)) errors.push('Sitemap #'+item.sitemap_id+' '+item.sitemap_name+' - Invalid sitemap type: '+item.sitemap_type);
          var contentFileName = 'data/sitemap/'+item.sitemap_file_id+'.json';
          if(!(contentFileName in branchData.contentFiles)) errors.push('Sitemap #'+item.sitemap_id+' '+item.sitemap_name+' - Missing content file: '+contentFileName);
        });
        return cb();
      },
    ], callback);
  }

  exports.branch_upload_importPage = function(dbtasks, branchItems, branchData, callback){
    var dbtaskid = 1;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var db = jsh.getDB('default');
    var dbtypes = appsrv.DB.types;

    branchData.page_mapping = {};

    _.each(branchItems, function(item){
      //Create mapping
      branchData.page_mapping[item.page_key] = item;

      //Add page to database
      dbtasks['page_'+(dbtaskid++)] = function (dbtrans, callback, transtbl) {
        if(item.page_is_folder){
          cols = ['page_is_folder','page_path'];
        }
        else {
          cols = ['page_path','page_title','page_tags','page_template_id','page_seo_title','page_seo_canonical_url','page_seo_metadesc','page_lang'];
        }

        var sql = appsrv.parseSQL('jsHarmonyCMS_Upload');
        sql = Helper.ReplaceAll(sql, '{item}', 'page');
        sql = Helper.ReplaceAll(sql, '{columns}', cols.join(','));
        sql = Helper.ReplaceAll(sql, '{values}', _.map(cols, function(col){ return '@' + col; }).join(','));

        var sql_ptypes = [
          dbtypes.Int,
          dbtypes.VarChar(2048),
          dbtypes.VarChar(1024),
          dbtypes.VarChar(-1),
          dbtypes.VarChar(255),
          dbtypes.VarChar(2048),
          dbtypes.VarChar(2048),
          dbtypes.VarChar(-1),
          dbtypes.VarChar(32),
        ];
        var sql_params = {
          'page_is_folder': 0,
          'page_path': null,
          'page_title': null,
          'page_tags': null,
          'page_template_id': null,
          'page_seo_title': null,
          'page_seo_canonical_url': null,
          'page_seo_metadesc': null,
          'page_lang': null
        };
        for(var key in item){ if(key in sql_params) sql_params[key] = item[key]; }
        db.Scalar(branchData._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, dbtrans, function (err, rslt) {
          if (err != null) { err.sql = sql; }
          //Store new page_id
          item.new_page_id = rslt;
          callback(err, rslt);
        });
      };

      //Extract page files
      var contentFileName = 'data/page/'+item.page_file_id+'.json';
      if(branchData.contentFiles[contentFileName]) branchData.contentFiles[contentFileName].onExtract = function(readStream, extract_cb){
        var bpart = [];
        var hasError = false;
        readStream.on('data', function(data){
          if(hasError) return;
          bpart.push(data);
        });
        readStream.on('error', function(err){
          if(hasError) return;
          hasError = true;
          return extract_cb(err);
        });
        readStream.on('end', function(){
          if(hasError) return;
          //Parse JSON
          var pageContent = {};
          try{
            pageContent = JSON.parse(Buffer.concat(bpart).toString());
          }
          catch(err){
            return extract_cb('Error parsing page '+contentFileName+': '+err.toString());
          }

          //Replace URLs
          function replaceURLs(content, options){
            var rslt = funcs.replaceBranchURLs(content, _.extend({ replaceComponents: true }, options, {
              getMediaURL: function(media_key, _branchData, getLinkContent){
                var orig_media_key = media_key;
                var media_file_id = media_key;
                if(branchData.media_mapping[orig_media_key]){
                  media_key = branchData.media_mapping[orig_media_key].new_media_id;
                  media_file_id = branchData.media_mapping[orig_media_key].new_media_file_id || media_key;
                }
                return branchData._baseurl+'_funcs/media/'+media_key+'/?media_file_id='+media_file_id+'#@JSHCMS';
              },
              getPageURL: function(page_key){
                var orig_page_key = page_key;
                if(branchData.page_mapping[orig_page_key]) page_key = branchData.page_mapping[orig_page_key].new_page_id;
                return branchData._baseurl+'_funcs/page/'+page_key+'/#@JSHCMS';
              },
              onError: function(err){
                jsh.Log.error(err);
              },
            }));
            return rslt;
          }
          
          var pageTemplate = branchData.pageTemplates[item.page_template_id];
          if(pageTemplate.raw){
            if(pageContent.content && pageContent.content.body) pageContent.content.body = replaceURLs(pageContent.content.body);
          }
          else {
            if(pageContent.content) for(var key in pageContent.content){
              pageContent.content[key] = replaceURLs(pageContent.content[key]);
            }
            _.each(['css','header','footer'], function(key){
              if(pageContent[key]) pageContent[key] = replaceURLs(pageContent[key]);
            });
          }

          //Save new file to disk
          fs.writeFile(path.join(module.jsh.Config.datadir, 'page', item.new_page_id + '.json'), JSON.stringify(pageContent), 'utf8', extract_cb);
        });
      };
    });
    return callback();
  }

  exports.branch_upload_importMedia = function(dbtasks, branchItems, branchData, callback){
    var dbtaskid = 1;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var db = jsh.getDB('default');
    var dbtypes = appsrv.DB.types;

    branchData.media_mapping = {};

    async.waterfall([
      function(cb){
        //Get all media from current database
        var sql = 'select distinct media_file_id,media_size,media_ext from {schema}.media order by media_file_id';
        appsrv.ExecRecordset(branchData._DBContext, funcs.replaceSchema(sql), [], {}, function (err, rslt) {
          if (err != null) { err.sql = sql; return cb(err); }
          if(!rslt || !rslt.length || !rslt[0]){ return cb(new Error('No data returned from database')); }
          branchData.media_files = {};
          _.each(rslt[0], function(item){
            var size = item.media_size;
            if(!(size in branchData.media_files)) branchData.media_files[size] = [];
            branchData.media_files[size].push(item);
          });
          return cb();
        });
      },
      function(cb){
        //Check if file is already in media folder
        async.eachSeries(branchItems, function(item, item_cb){
          if(!item.media_is_folder && item.media_file_id && branchData.media_files[item.media_size]){
            var sizeMatches = branchData.media_files[item.media_size];
            var zipfname = 'data/media/' + item.media_file_id + item.media_ext;
            if(zipfname in branchData.contentFiles){
              var hash = branchData.contentFiles[zipfname].hash;
              //Get first media file matching hash
              var foundMatch = false;
              async.eachSeries(sizeMatches, function(sizeMatch, sizeMatch_cb){
                if(foundMatch) return sizeMatch_cb();
                Helper.execif(!('hash' in sizeMatch),
                  function(f){
                    var fpath = path.join(module.jsh.Config.datadir, 'media', sizeMatch.media_file_id + sizeMatch.media_ext);
                    var fstream = fs.createReadStream(fpath);
                    var fhash = crypto.createHash('sha1');
                    var hasError = false;
                    fstream.on('data', function(data) { fhash.update(data); });
                    fstream.on('end', function() {
                      if(hasError) return;
                      sizeMatch.hash = fhash.digest('hex');
                      return f();
                    })
                    fstream.on('error', function(err){
                      if(hasError) return;
                      hasError = true;
                      return sizeMatch_cb(err);
                    });
                  },
                  function(){
                    if(sizeMatch.hash == hash){
                      foundMatch = true;
                      item.new_media_file_id = sizeMatch.media_file_id;
                    }
                    return sizeMatch_cb();
                  }
                );
              }, item_cb);
            }
            else return item_cb();
          }
          else return item_cb();
        }, cb);
      },
      function(cb){
        _.each(branchItems, function(item){
          //Create mapping
          branchData.media_mapping[item.media_key] = item;

          //Add media to database
          dbtasks['media_'+(dbtaskid++)] = function (dbtrans, callback, transtbl) {
            if(item.media_is_folder){
              cols = ['media_is_folder','media_path'];
            }
            else {
              cols = ['media_path','media_ext','media_size','media_width','media_height','media_desc','media_tags','media_type','media_lang'];
            }
            var sql_ptypes = [
              dbtypes.Int,
              dbtypes.VarChar(2048),
              dbtypes.VarChar(16),
              dbtypes.Int,
              dbtypes.Int,
              dbtypes.Int,
              dbtypes.VarChar(256),
              dbtypes.VarChar(-1),
              dbtypes.VarChar(32),
              dbtypes.VarChar(32),
              dbtypes.BigInt,
            ];
            var sql_params = {
              'media_is_folder': 0,
              'media_path': null,
              'media_ext': null,
              'media_size': null,
              'media_width': null,
              'media_height': null,
              'media_desc': null,
              'media_tags': null,
              'media_type': null,
              'media_lang': null,
              'media_file_id': null
            };
            for(var key in item){ if(key in sql_params) sql_params[key] = item[key]; }

            //Link to existing media file, if applicable
            if(!item.media_is_folder && item.new_media_file_id){
              sql_params.media_file_id = item.new_media_file_id;
              cols.push('media_file_id');
            }

            var sql = appsrv.parseSQL('jsHarmonyCMS_Upload');
            sql = Helper.ReplaceAll(sql, '{item}', 'media');
            sql = Helper.ReplaceAll(sql, '{columns}', cols.join(','));
            sql = Helper.ReplaceAll(sql, '{values}', _.map(cols, function(col){ return '@' + col; }).join(','));

            db.Scalar(branchData._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, dbtrans, function (err, rslt) {
              if (err != null) { err.sql = sql; }
              //Store new media_id
              item.new_media_id = rslt;
              callback(err, rslt);
            });
          };

          //Extract Media files
          var contentFileName = 'data/media/'+item.media_file_id+item.media_ext;
          if(branchData.contentFiles[contentFileName]) branchData.contentFiles[contentFileName].onExtract = function(readStream, extract_cb){
            if(item.new_media_file_id) return false;

            var hasError = false;
            
            //Save file contents
            var writeStream = fs.createWriteStream(path.join(module.jsh.Config.datadir, 'media', item.new_media_id + item.media_ext));
            var hasError = false;
            writeStream.on("error", function(err){
              if(hasError) return;
              hasError = true;
              return extract_cb(err);
            });
            writeStream.on("close", function(){
              if(hasError) return;
              return extract_cb();
            });
            readStream.pipe(writeStream);
          };
        });
        return cb();
      },
    ], callback);
  }

  exports.branch_upload_importMenu = function(dbtasks, branchItems, branchData, callback){
    var dbtaskid = 1;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var db = jsh.getDB('default');
    var dbtypes = appsrv.DB.types;
    _.each(branchItems, function(item){
      //Add menu to database
      dbtasks['menu_'+(dbtaskid++)] = function (dbtrans, callback, transtbl) {
        cols = ['menu_name','menu_tag','menu_lang'];

        var sql = appsrv.parseSQL('jsHarmonyCMS_Upload');
        sql = Helper.ReplaceAll(sql, '{item}', 'menu');
        sql = Helper.ReplaceAll(sql, '{columns}', cols.join(','));
        sql = Helper.ReplaceAll(sql, '{values}', _.map(cols, function(col){ return '@' + col; }).join(','));

        var sql_ptypes = [
          dbtypes.VarChar(256),
          dbtypes.VarChar(256),
          dbtypes.VarChar(32),
        ];
        var sql_params = {
          'menu_name':null,
          'menu_tag':null,
          'menu_lang':null
        };
        for(var key in item){ if(key in sql_params) sql_params[key] = item[key]; }
        db.Scalar(branchData._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, dbtrans, function (err, rslt) {
          if (err != null) { err.sql = sql; }
          //Store new menu_id
          item.new_menu_id = rslt;
          callback(err, rslt);
        });
      };

      //Extract menu files
      var contentFileName = 'data/menu/'+item.menu_file_id+'.json';
      if(branchData.contentFiles[contentFileName]) branchData.contentFiles[contentFileName].onExtract = function(readStream, extract_cb){
        var bpart = [];
        var hasError = false;
        readStream.on('data', function(data){
          if(hasError) return;
          bpart.push(data);
        });
        readStream.on('error', function(err){
          if(hasError) return;
          hasError = true;
          return extract_cb(err);
        });
        readStream.on('end', function(){
          if(hasError) return;
          //Parse JSON
          var menuContent = {};
          try{
            menuContent = JSON.parse(Buffer.concat(bpart).toString());
          }
          catch(err){
            return extract_cb('Error parsing menu '+contentFileName+': '+err.toString());
          }

          //Replace URLs
          if(menuContent) _.each(menuContent.menu_items, function(menuItem){
            var orig_key = menuItem.menu_item_link_dest;
            if(orig_key){
              if(menuItem.menu_item_link_type=='PAGE'){
                if(branchData.page_mapping[orig_key]){
                  menuItem.menu_item_link_dest = branchData.page_mapping[orig_key].new_page_id;
                }
              }
              else if(menuItem.menu_item_link_type=='MEDIA'){
                if(branchData.media_mapping[orig_key]){
                  menuItem.menu_item_link_dest = branchData.media_mapping[orig_key].new_media_id;
                }
              }
            }
          });
          
          //Save new file to disk
          fs.writeFile(path.join(module.jsh.Config.datadir, 'menu', item.new_menu_id + '.json'), JSON.stringify(menuContent), 'utf8', extract_cb);
        });
      };
    });
    return callback();
  }

  exports.branch_upload_importRedirect = function(dbtasks, branchItems, branchData, callback){
    var dbtaskid = 1;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var db = jsh.getDB('default');
    var dbtypes = appsrv.DB.types;
    _.each(branchItems, function(item){
      //Add redirect to database
      dbtasks['redirect_'+(dbtaskid++)] = function (dbtrans, callback, transtbl) {
        cols = ['redirect_url','redirect_url_type','redirect_seq','redirect_dest','redirect_http_code'];

        var sql = appsrv.parseSQL('jsHarmonyCMS_Upload');
        sql = Helper.ReplaceAll(sql, '{item}', 'redirect');
        sql = Helper.ReplaceAll(sql, '{columns}', cols.join(','));
        sql = Helper.ReplaceAll(sql, '{values}', _.map(cols, function(col){ return '@' + col; }).join(','));

        var sql_ptypes = [
          dbtypes.VarChar(1024),
          dbtypes.VarChar(32),
          dbtypes.Int,
          dbtypes.VarChar(1024),
          dbtypes.VarChar(32),
        ];
        var sql_params = {
          'redirect_url':null,
          'redirect_url_type':null,
          'redirect_seq':null,
          'redirect_dest':null,
          'redirect_http_code':null
        };
        for(var key in item){ if(key in sql_params) sql_params[key] = item[key]; }
        db.Scalar(branchData._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, dbtrans, function (err, rslt) {
          if (err != null) { err.sql = sql; }
          //Store new redirect_id
          item.new_redirect_id = rslt;
          callback(err, rslt);
        });
      }
    });
    return callback();
  }

  exports.branch_upload_importSitemap = function(dbtasks, branchItems, branchData, callback){
    var dbtaskid = 1;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var db = jsh.getDB('default');
    var dbtypes = appsrv.DB.types;
    _.each(branchItems, function(item){
      //Add sitemap to database
      dbtasks['sitemap_'+(dbtaskid++)] = function (dbtrans, callback, transtbl) {
        cols = ['sitemap_name','sitemap_type','sitemap_lang'];

        var sql = appsrv.parseSQL('jsHarmonyCMS_Upload');
        sql = Helper.ReplaceAll(sql, '{item}', 'sitemap');
        sql = Helper.ReplaceAll(sql, '{columns}', cols.join(','));
        sql = Helper.ReplaceAll(sql, '{values}', _.map(cols, function(col){ return '@' + col; }).join(','));

        var sql_ptypes = [
          dbtypes.VarChar(256),
          dbtypes.VarChar(32),
          dbtypes.VarChar(32),
        ];
        var sql_params = {
          'sitemap_name': null,
          'sitemap_type': null,
          'sitemap_lang': null
        };
        for(var key in item){ if(key in sql_params) sql_params[key] = item[key]; }
        db.Scalar(branchData._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, dbtrans, function (err, rslt) {
          if (err != null) { err.sql = sql; }
          //Store new sitemap_id
          item.new_sitemap_id = rslt;
          callback(err, rslt);
        });
      };

      
      //Extract sitemap files
      var contentFileName = 'data/sitemap/'+item.sitemap_file_id+'.json';
      if(branchData.contentFiles[contentFileName]) branchData.contentFiles[contentFileName].onExtract = function(readStream, extract_cb){
        var bpart = [];
        var hasError = false;
        readStream.on('data', function(data){
          if(hasError) return;
          bpart.push(data);
        });
        readStream.on('error', function(err){
          if(hasError) return;
          hasError = true;
          return extract_cb(err);
        });
        readStream.on('end', function(){
          if(hasError) return;
          //Parse JSON
          var sitemapContent = {};
          try{
            sitemapContent = JSON.parse(Buffer.concat(bpart).toString());
          }
          catch(err){
            return extract_cb('Error parsing sitemap '+contentFileName+': '+err.toString());
          }

          //Replace URLs
          if(sitemapContent) _.each(sitemapContent.sitemap_items, function(sitemapItem){
            var orig_key = sitemapItem.sitemap_item_link_dest;
            if(orig_key){
              if(sitemapItem.sitemap_item_link_type=='PAGE'){
                if(branchData.page_mapping[orig_key]){
                  sitemapItem.sitemap_item_link_dest = branchData.page_mapping[orig_key].new_page_id;
                }
              }
              else if(sitemapItem.sitemap_item_link_type=='MEDIA'){
                if(branchData.media_mapping[orig_key]){
                  sitemapItem.sitemap_item_link_dest = branchData.media_mapping[orig_key].new_media_id;
                }
              }
            }
          });
          
          //Save new file to disk
          fs.writeFile(path.join(module.jsh.Config.datadir, 'sitemap', item.new_sitemap_id + '.json'), JSON.stringify(sitemapContent), 'utf8', extract_cb);
        });
      };
    });
    return callback();
  }

  exports.site_checkout = function (req, res, next) {
    var cms = module;
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
    var model = jsh.getModel(req, module.namespace + 'Site_Listing');

    if (verb == 'get'){
      if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

      //Validate parameters
      if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('Q', Q, ['&site_id','|source'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      //Update user site
      sql = "update {schema}.v_my_session set site_id=@site_id";
      sql_ptypes = [dbtypes.BigInt];
      sql_params = { 'site_id': Q.site_id };
      validate = new XValidate();
      verrors = {};
      validate.AddValidator('_obj.site_id', 'Site ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);

      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      var site_id = parseInt(Q.site_id);
      if(site_id.toString() !== Q.site_id.toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters'); 

      appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
        if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
        var url = Q.source || req.jshsite.baseurl || '/';

        var sitePath = path.join(jsh.Config.datadir,'site');

        async.waterfall([
          //Create site folders if they do not exist
          function(site_cb){ HelperFS.createFolderIfNotExists(path.join(sitePath,site_id.toString()), site_cb); },
          function(site_cb){ HelperFS.createFolderIfNotExists(path.join(sitePath,site_id.toString(),'templates'), site_cb); },
          function(site_cb){ HelperFS.createFolderIfNotExists(path.join(sitePath,site_id.toString(),'templates','pages'), site_cb); },
          function(site_cb){ HelperFS.createFolderIfNotExists(path.join(sitePath,site_id.toString(),'templates','components'), site_cb); },
          function(site_cb){ HelperFS.createFolderIfNotExists(path.join(sitePath,site_id.toString(),'templates','websnippets'), site_cb); },
        ], function(err){
          if(err) return Helper.GenError(req, res, -99999, err.toString());

          //Redirect to final URL
          Helper.Redirect302(res, url);
        });
      });
      return;
    }
    else return next();
  }

  exports.validateBranchAccess = function(req, res, branch_id, branch_access, site_access, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt, dbtypes.VarChar(32)];
    var sql_params = { branch_id: branch_id, branch_access: branch_access };

    var sql = "select branch_id from {schema}.v_my_branch_access where branch_id=@branch_id and branch_access like @branch_access"
    if(site_access && site_access.length){
      if(!_.isArray(site_access)) site_access = [site_access];
      for(var i=0;i<site_access.length;i++){
        sql_ptypes.push(dbtypes.VarChar(32));
        sql_params['site_access'+i.toString()] = site_access[i];
      }
      sql += " and site_id in (select v_sys_user_site_access.site_id from {schema}.v_sys_user_site_access where v_sys_user_site_access.site_id=v_my_branch_access.site_id and sys_user_id=jsharmony.my_sys_user_id() and sys_user_site_access in ("+_.map(site_access, function(perm, idx){ return '@site_access'+idx.toString(); }).join(',')+"))";
    }
    appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; appsrv.AppDBError(req, res, err); return; }
      if (rslt[0].length!=1) return Helper.GenError(req, res, -11, 'No access to target revision');
      callback(null);
    });
  }

  exports.validateBranchAccessStep = function(dbcontext, branch_id, branch_access, site_access){
    return function(callback){
      var jsh = module.jsh;
      var appsrv = jsh.AppSrv;
      var dbtypes = appsrv.DB.types;
      var sql_ptypes = [dbtypes.BigInt, dbtypes.VarChar(32)];
      var sql_params = { branch_id: branch_id, branch_access: branch_access };

      var sql = "select branch_id from {schema}.v_my_branch_access where branch_id=@branch_id and branch_access like @branch_access"
      if(site_access && site_access.length){
        if(!_.isArray(site_access)) site_access = [site_access];
        for(var i=0;i<site_access.length;i++){
          sql_ptypes.push(dbtypes.VarChar(32));
          sql_params['site_access'+i.toString()] = site_access[i];
        }
        sql += " and site_id in (select v_sys_user_site_access.site_id from {schema}.v_sys_user_site_access where v_sys_user_site_access.site_id=v_my_branch_access.site_id and sys_user_id=jsharmony.my_sys_user_id() and sys_user_site_access in ("+_.map(site_access, function(perm, idx){ return '@site_access'+idx.toString(); }).join(',')+"))";
      }
      appsrv.ExecRecordset(dbcontext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
        if (err != null) { err.sql = sql; callback(err); return; }
        if (rslt[0].length!=1) { callback( Helper.NewError('No access to target revision',-11)); return; }
        callback(null);
      });
    };
  }

  exports.validateSiteAccess = function(req, res, site_id, site_access, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { site_id: site_id };

    var sql = "select site_id from {schema}.v_my_site where site_id=@site_id"
    if(site_access && site_access.length){
      if(!_.isArray(site_access)) site_access = [site_access];
      for(var i=0;i<site_access.length;i++){
        sql_ptypes.push(dbtypes.VarChar(32));
        sql_params['site_access'+i.toString()] = site_access[i];
      }
      sql += " and site_id in (select v_sys_user_site_access.site_id from {schema}.v_sys_user_site_access where v_sys_user_site_access.site_id=v_my_site.site_id and sys_user_id=jsharmony.my_sys_user_id() and sys_user_site_access in ("+_.map(site_access, function(perm, idx){ return '@site_access'+idx.toString(); }).join(',')+"))";
    }
    appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; appsrv.AppDBError(req, res, err); return; }
      if (rslt[0].length!=1) return Helper.GenError(req, res, -11, 'No access to target revision');
      callback(null);
    });
  }

  var branchArchivePath = function(branch_id) {
    return path.join(module.jsh.Config.datadir, 'branch', branch_id + '.json');
  }

  var branchArchiveColumns = function(dbtypes){
    return {
      'branch_{item}_id': dbtypes.BigInt,
      'branch_id': dbtypes.BigInt,
      '{item}_key': dbtypes.BigInt,
      '{item}_id': dbtypes.BigInt,
      'branch_{item}_action': dbtypes.VarChar(32),
      '{item}_orig_id': dbtypes.BigInt,
      'branch_{item}_etstmp': dbtypes.DateTime(7),
      'branch_{item}_euser': dbtypes.VarChar(20),
      'branch_{item}_mtstmp': dbtypes.DateTime(7),
      'branch_{item}_muser': dbtypes.VarChar(20),
    };
  };

  var asMs = function(record, field) {
    if (typeof(record[field]) == 'string') record[field] = Date.parse(record[field]);
  }

  exports.branch_indexToFile = function (dbcontext, branch_id, callback) {
    var cms = module;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = {branch_id: branch_id};

    async.waterfall([
      exports.validateBranchAccessStep(dbcontext, branch_id, 'R%', ['PUBLISHER','WEBMASTER']),
      function(dir_cb){
        fs.mkdir(path.join(module.jsh.Config.datadir, 'branch'), {recursive:true}, dir_cb);
      },
      function(index_cb){
        var branchData = {};
        var columns = _.without(_.keys(branchArchiveColumns(dbtypes)), 'branch_id');
        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          var sql = "select ";
          sql += _.map(columns || [], function(colname){ return 'branch_{item}.'+colname; }).join(',');

          sql += " from {tbl_branch_item} branch_{item}"

          sql += " where branch_{item}.branch_id=@branch_id";

          appsrv.ExecRecordset(dbcontext, cms.applyBranchItemSQL(branch_item_type, sql), sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; return branch_item_cb(err); }
            if(!rslt || !rslt.length || !rslt[0]){ return branch_item_cb(new Error('Error retrieving branch data')); }
            branchData[branch_item_type] = rslt[0];
            return branch_item_cb();
          });
        }, function() { return index_cb(null, branchData);} );
      },
      function(branchData, convert_cb){
        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          async.eachOfSeries(branchData[branch_item_type], function(record, record_index, record_cb) {
            asMs(record, 'branch_'+branch_item_type+'_etstmp');
            asMs(record, 'branch_'+branch_item_type+'_mtstmp');
            record_cb();
          }, branch_item_cb);
        }, function(err) {return convert_cb(err, branchData);});
      },
      function(branchData, write_cb){
        fs.writeFile(branchArchivePath(branch_id), JSON.stringify(branchData, null, 2), 'utf8', write_cb);
      },
      function(delete_cb){
        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          var sql = "delete from {tbl_branch_item} where branch_id=@branch_id";
          appsrv.ExecCommand(dbcontext, cms.applyBranchItemSQL(branch_item_type, sql), sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; return branch_item_cb(err); }
            return branch_item_cb();
          });
        }, function() { return delete_cb(null);} );
      },
    ], callback);
  }

  exports.branch_indexFromFile = function (dbcontext, branch_id, callback) {
    var cms = module;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = {branch_id: branch_id};

    async.waterfall([
      exports.validateBranchAccessStep(dbcontext, branch_id, 'RW', ['PUBLISHER','WEBMASTER']),
      function(read_cb){
        fs.readFile(branchArchivePath(branch_id), read_cb);
      },
      function(data, parse_cb){
        json = JSON.parse(data);
        if(json && json.page) return parse_cb(null, json);
        parse_cb(new Error('Error unarchiving branch data'));
      },
      function(branchData, insert_cb){
        var bac = branchArchiveColumns(dbtypes);
        var columns = _.keys(bac);
        var sql_ptypes = _.values(bac);

        var sql = "insert into {tbl_branch_item}(";
        sql += _.map(columns || [], function(colname){ return colname; }).join(',');
        sql += ") values(";
        sql += _.map(columns || [], function(colname){ return '@'+colname; }).join(',');
        sql += ")";

        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          async.eachOfSeries(branchData[branch_item_type], function(record, record_index, record_cb) {
            var sql_params = {};
            for(var key in bac){
              sql_params[cms.applyBranchItemSQL(branch_item_type, key)] = null;
            };
            sql_params['branch_id'] = branch_id;
            for(var key in record){ if(key in sql_params) sql_params[key] = record[key]; }

            appsrv.ExecCommand(dbcontext, cms.applyBranchItemSQL(branch_item_type, sql), sql_ptypes, sql_params, function (err, rslt) {
              if (err != null) { err.sql = sql; return record_cb(err); }
              return record_cb();
            });
          }, branch_item_cb);
        }, insert_cb);
      },
      function(delete_cb){
        fs.unlink(branchArchivePath(branch_id), delete_cb);
      },
    ], callback);
  }

  exports.set_my_current_branch_id = function(dbcontext, branch_id, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { 'branch_id': branch_id };
    var sql = "update "+(module.schema?module.schema+'.':'')+"v_my_current_branch set new_branch_id=@branch_id";
    appsrv.ExecCommand(dbcontext, sql, sql_ptypes, sql_params, function(err) {
      if (err) {err.sql = sql};
      callback(err);
    });
  }

  exports.my_current_branch_id = function(dbcontext, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var sql = "select "+(module.schema?module.schema+'.':'')+"my_current_branch_id()";
    appsrv.ExecScalar(dbcontext, sql, [], {}, function(err, rslt) {
      if (err) {err.sql = sql};
      callback(err, rslt[0]);
    });
  }

  exports.branch_checkout = function(dbcontext, branch_id, callback) {
    async.waterfall([
      function(cb) {exports.my_current_branch_id(dbcontext, cb)},
      function(previous_branch_id, cb) {
        if (branch_id == previous_branch_id) {
          cb({shortCircuit: true});
        } else {
          cb(null, previous_branch_id);
        }
      },
      function(previous_branch_id, cb) {
        exports.set_my_current_branch_id(dbcontext, branch_id, function(err) {
          cb(err, previous_branch_id);
        });
      },
    ], function(err) {
      if (err != null && !err.shortCircuit) { callback(err); return; }
      return callback();
    });
  }

  exports.req_branch_checkout = function (req, res, next) {
    var cms = module;
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
    var model = jsh.getModel(req, module.namespace + 'Branch_Checkout');

    if (verb == 'post'){
      if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

      if(!req.params || !req.params.branch_id) return next();
      var branch_id = parseInt(req.params.branch_id);

      //Validate parameters
      if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      sql_ptypes = [dbtypes.BigInt];
      sql_params = { 'branch_id': branch_id };
      validate = new XValidate();
      validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);

      verrors = validate.Validate('B', sql_params);
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      exports.branch_checkout(req._DBContext, branch_id, function(err) {
        if (err != null) { err.model = model; appsrv.AppDBError(req, res, err); return; }
        //Return success
        return res.send(JSON.stringify({ _success: 1 }));
      });
    }
    else return next();
  }

  return exports;
};