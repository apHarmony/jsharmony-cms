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
var _ = require('lodash');
var url = require('url');
var path = require('path');
var ejs = require('ejs');
var fs = require('fs');
var urlparser = require('url');
var async = require('async');
var crypto = require('crypto');
var wclib = require('jsharmony/WebConnect');
var DiffMatchPatch = require('diff-match-patch');
var diff2html = require("diff2html").Diff2Html;

function ModuleFunctions(module){
  var funcs = this;
  var dmp = new DiffMatchPatch();

  this.getPageFile = function(page_file_id){
    return path.join(path.join(module.jsh.Config.datadir,'page'),page_file_id.toString()+'.json');
  }

  this.getClientPage = function(page, cb){
    var appsrv = this;

    var page_file_id = page.page_file_id;
    var template_id = page['template_id'];
    if(!template_id) for(var key in module.Templates){ template_id = key; break; }
    var template = module.Templates[template_id];

    //Load Page Content from disk
    module.jsh.ParseJSON(funcs.getPageFile(page_file_id), module.name, 'Page File ID#'+page_file_id, function(err, page_content){
      page_content = page_content || { body: template.default_body };
      if(!page_content.seo) page_content.seo = {};
      var client_page = {
        title: page.page_title||'',
        css: page_content.css||'',
        header: page_content.header||'',
        footer: page_content.footer||'',
        body: page_content.body||'',
        seo: {
          title: page_content.seo.title||'',
          keywords: page_content.seo.keywords||'',
          metadesc: page_content.seo.metadesc||'',
          canonical_url: page_content.seo.canonical_url||'',
        },
        lang: page.page_lang||'',
        tags: page.page_tags||'',
        author: page.page_author,
      };
      var client_template = {
        title: template.title||'',
        css: template.css||'',
        header: template.header||'',
        footer: template.footer||'',
        js: template.js||'',
      };
      
      return cb(null,{
        page: client_page,
        template: client_template
      });
    });
  }
  
  this.page = function (req, res, next) {
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
    var model = jsh.getModel(req, module.namespace + 'Page_Editor');
    
    if (!Helper.hasModelAction(req, model, 'IUD')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if(!req.params || !req.params.page_key) return next();
    var page_key = req.params.page_key;

    //Return updated LOV
    sql_ptypes = [dbtypes.BigInt];
    sql_params = { 'page_key': page_key };
    validate = new XValidate();
    verrors = {};
    validate.AddValidator('_obj.page_key', 'Page Key', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
    sql = 'select page_key,page_file_id,page_title,page_path,page_tags,page_author,template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang from '+(module.schema?module.schema+'.':'')+'v_my_page where page_key=@page_key';
    
    var fields = [];
    var datalockstr = '';
    appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
    sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
    
    verrors = _.merge(verrors, validate.Validate('B', sql_params));
    if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

    appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Page ID'); }
      var page = rslt[0][0];

      //Get Page Template
      var template_id = page['template_id'];
      var template = module.Templates[template_id];
      
      //Globally accessible
      if(template.remote_template && template.remote_template.editor){
        var urlparts = urlparser.parse(template.remote_template.editor, true);
        var remote_origin = urlparts.protocol + '//' + (urlparts.auth?urlparts.auth+'@':'') + urlparts.hostname + (urlparts.port?':'+urlparts.port:'');
        res.setHeader('Access-Control-Allow-Origin', remote_origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With, Content-Type, Accept');
        res.setHeader('Access-Control-Allow-Credentials', true);
      }
      
      if (verb == 'get'){
        //Validate parameters
        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        funcs.getClientPage(page, function(err, clientPage){
          if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }
          res.end(JSON.stringify({ 
            '_success': 1,
            'page': clientPage.page,
            'template': clientPage.template,
            'views': {
              'jsh_cms_editor.css': (jsh.getEJS('jsh_cms_editor.css')||'')+(jsh.getEJS('jsh_cms_editor.css.ext')||''),
              'jsh_cms_editor': jsh.getEJS('jsh_cms_editor')
            }
          }));
        });
      }
      else if(verb == 'post'){
        /*
          var client_page = {
            title: page.page_title||'',
            css: page_content.css||'',
            header: page_content.header||'',
            footer: page_content.footer||'',
            body: page_content.body||'',
            seo_title: page_content.seo_title||'',
            seo_keywords: page_content.seo_keywords||'',
            seo_metadesc: page_content.seo_metadesc||'',
            seo_canonical_url: page_content.seo_canonical_url||'',
            lang: page.page_lang||'',
            tags: page.page_tags||'',
            author: page.page_author,
          };
        */

        //Validate parameters
        if (!appsrv.ParamCheck('P', P, ['&title','&css','&header','&footer','&body','&seo','&lang','&tags','&author'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //XValidate
        var client_page = P;
        validate = new XValidate();
        verrors = {};
        validate.AddValidator('_obj.title', 'Title', 'B', [XValidate._v_MaxLength(1024)]);
        validate.AddValidator('_obj.css', 'CSS', 'B', []);
        validate.AddValidator('_obj.header', 'Header', 'B', []);
        validate.AddValidator('_obj.footer', 'Footer', 'B', []);
        validate.AddValidator('_obj.body', 'Body', 'B', []);
        validate.AddValidator('_obj.seo.title', 'SEO Title', 'B', [XValidate._v_IsNumeric(), XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.seo.keywords', 'SEO Keywords', 'B', []);
        validate.AddValidator('_obj.seo.metadesc', 'SEO Meta Description', 'B', []);
        validate.AddValidator('_obj.seo.canonical_url', 'SEO Canonical URL', 'B', [XValidate._v_IsNumeric(), XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.lang', 'Language', 'B', [XValidate._v_MaxLength(32)]);
        validate.AddValidator('_obj.tags', 'Tags', 'B', []);
        validate.AddValidator('_obj.author', 'Author', 'B', [XValidate._v_IsNumeric()]);
        verrors = _.merge(verrors, validate.Validate('B', client_page));
        if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

        //Save to database
        sql_ptypes = [
          dbtypes.VarChar(1024),
          dbtypes.VarChar(dbtypes.MAX),
          dbtypes.BigInt,
          dbtypes.VarChar(2048),
          dbtypes.VarChar(2048),
          dbtypes.VarChar(dbtypes.MAX),
          dbtypes.VarChar(32),
          dbtypes.BigInt,
        ];
        sql_params = {
          page_title: client_page.title,
          page_tags: client_page.tags,
          page_author: client_page.author,
          page_seo_title: client_page.seo.title,
          page_seo_canonical_url: client_page.seo.canonical_url,
          page_seo_metadesc: client_page.seo.metadesc,
          page_lang: client_page.lang
        };
        sql = 'update '+(module.schema?module.schema+'.':'')+'v_my_page set page_file_id=null,'+_.map(sql_params, function(val, key){ return key + '=@' + key }).join(',')+' where page_key=@page_key;';
        sql += 'select page_file_id from '+(module.schema?module.schema+'.':'')+'v_my_page where page_key=@page_key;';
        sql_params.page_key = page_key;

        fields = [];
        datalockstr = '';
        verrors = {};
        appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
        sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
        if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }
        
        appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
          if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length || !rslt[0][0]) return Helper.GenError(req, res, -99999, 'Invalid database result');
          page.page_file_id = rslt[0][0].page_file_id;
          //Save to disk
          fs.writeFile(funcs.getPageFile(page.page_file_id), JSON.stringify(client_page), 'utf8', function(err){
            res.end(JSON.stringify({ '_success': 1 }));
          });
        });

        return;
      }
      else return next();
    });
  }

  this.deploy_req = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};
    
    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var appsrv = this;
    var jsh = module.jsh;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Deployment_Add');
    
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    var sql = "select (param_cur_val from jsharmony.v_param_cur where param_cur_process='CMS' and param_cur_attrib='PUBLISH_TGT') publish_path, (select deployment_id from "+(module.schema?module.schema+'.':'')+"deployment where deployment_sts='PENDING' and deployment_date <= %%%%%%jsh.map.timestamp%%%%%% order by deployment_date asc) deployment_id";
    appsrv.ExecRow(req._DBContext, sql, [], {}, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      var publish_tgt = '';
      if(rslt && rslt[0]) publish_tgt = rslt[0].publish_path;
      if(!publish_tgt) { Helper.GenError(req, res, -9, 'Publish Target parameter is not defined'); return; }
      var publish_path = path.isAbsolute(publish_tgt) ? publish_tgt : path.join(jsh.Config.datadir,publish_tgt);
      publish_path = path.normalize(publish_path);

      var template_body = {};

      if (verb == 'get') {
        res.end(JSON.stringify({ '_success': 1, 'publish_path': publish_path }));
        return;
      }
      else if (verb == 'post') {
        if(rslt && rslt[0] && rslt[0].deployment_id){
          funcs.deploy(deployment_id, function(){
            res.end(JSON.stringify({ '_success': 1, 'publish_path': publish_path }));
          });
        }
        else return Helper.GenError(req, res, -9, 'No scheduled deployments');
        return;
      }
      return next();
    });
  }

  this.deploy = function (deployment_id, onComplete) {
    var appsrv = this;
    var jsh = module.jsh;
    var dbtypes = appsrv.DB.types;
    var cms = jsh.Modules['jsHarmonyCMS'];

    //Update deployment to running status
    var sql = "\
      update "+(module.schema?module.schema+'.':'')+"deployment set deployment_sts='RUNNING' where deployment_id=@deployment_id;\
      select \
        deployment_id, site_id, deployment_tag, deployment_target_name, deployment_target_path, deployment_target_params, deployment_target_sts, \
        (select param_cur_val from jsharmony.v_param_cur where param_cur_process='CMS' and param_cur_attrib='PUBLISH_TGT') publish_tgt \
        from "+(module.schema?module.schema+'.':'')+"deployment d \
        inner join "+(module.schema?module.schema+'.':'')+"deployment_target dt on d.deployment_target_id = dt.deployment_target_id \
        where deployment_sts='RUNNING' and deployment_id=@deployment_id\
      ";
    appsrv.ExecRow('deployment', sql, [dbtypes.BigInt], { deployment_id: deployment_id }, function (err, rslt) {
      if (err != null) { err.sql = sql; jsh.Log.error(err); return; }
      var publish_tgt = '';
      var deployment = (rslt ? rslt[0] : null);
      if(!deployment) { jsh.Log.error('Invalid Deployment ID'); return; }
      publish_tgt = deployment.publish_tgt;
      deployment_id = rslt[0].deployment_id;
      if(!publish_tgt){ jsh.Log.error('Publish Target parameter is not defined'); return; }
      if(deployment.deployment_target_sts.toUpperCase() != 'ACTIVE'){ jsh.Log.error('Deployment Target is not ACTIVE'); return; }
      var publish_path = path.isAbsolute(publish_tgt) ? publish_tgt : path.join(jsh.Config.datadir,publish_tgt);
      publish_path = path.normalize(publish_path);
      var site_files = {};

      var template_body = {};

      //Git Commands
      var git_path = cms.Config.git.bin_path || '';
      var git_branch = 'site_'+deployment.site_id;
      function gitExec(git_cmd, params, cb, exec_options){
        var rslt = '';
        exec_options = _.extend({ cwd: publish_path }, exec_options);
        wclib.xlib.exec(path.join(git_path, git_cmd), params, function(err){ //cb
          if(err) return cb(err, rslt.trim());
          return cb(null,rslt.trim());
        }, function(data){ //stdout
          rslt += data;
        }, null //stderr
        , function(err){ //onError
          return cb(err, rslt.trim());
        }, exec_options);
      }

      var farr = [];
      async.waterfall([
        //Create output folder if it does not exist
        function (cb){
          return HelperFS.createFolderRecursive(publish_path, cb);
        },

        //Git - Initialize and Select Branch
        function (cb) {
          if(!cms.Config.git || !cms.Config.git.enabled) return cb();

          async.waterfall([
            //Initialize Git, if not initialized in publish folder
            function(git_cb){
              gitExec('git', ['rev-parse','--show-toplevel'], function(err, rslt){
                if(err) return git_cb(err);
                if(rslt && (path.normalize(rslt)==publish_path)) return git_cb();
                //Initialize git for the first time
                jsh.Log.info('Initializing git in publish path: '+publish_path);
                gitExec('git', ['init','-q'], function(err, rslt){
                  if(err) return git_cb(err);
                  return git_cb(); 
                });
              });
            },

            //Check if branch exists, create if it does not
            function(git_cb){
              gitExec('git', ['show-ref','--verify','--quiet','refs/heads/'+git_branch], function(err, rslt){
                if(!err && !rslt) return git_cb();
                //Initialize git for the first time
                jsh.Log.info('Initializing git branch: '+git_branch);
                gitExec('git', ['checkout','-f','--orphan',git_branch], function(err, rslt){
                  if(err) return git_cb(err);
                  jsh.Log.info('Saving initial commit');
                  gitExec('git', ['commit','--allow-empty','-m','Initial commit'], function(err, rslt){
                    if(err) return git_cb(err);
                    return git_cb();
                  });
                });
              });
            },

            //Checking out target branch
            function(git_cb){
              jsh.Log.info('Checking out git branch: '+git_branch);
              gitExec('git', ['checkout','-f',git_branch], function(err, rslt){
                return git_cb(err);
              });
            }

          ], cb);          
        },

        //Clear output folder
        function (cb){
          //rmdirRecursive
          var isBasePath = false;
          HelperFS.funcRecursive(publish_path, function (filepath, relativepath, file_cb) { //filefunc
            fs.unlink(filepath, file_cb);
          }, function (dirpath, relativepath, dir_cb) { //dirfunc
            if(relativepath) HelperFS.rmdirRecursive(dirpath, dir_cb);
            else return dir_cb();
          }, { 
            file_before_dir: true,
            preview_dir: function(dirpath, relativepath, dir_cb){
              if(relativepath=='.git') return dir_cb(false);
              return dir_cb();
            }
          }, cb);
        },

        //Load remote templates
        function (cb){
          var wc = new wclib.WebConnect();
          async.eachOf(module.Templates, function(template, template_name, template_cb){
            if(!template.remote_template && !template.remote_template.publish){
              template_body[template_name] = template.body;
              return template_cb();
            }
            wc.req(template.remote_template.publish, 'GET', {}, {}, undefined, function(err, res, rslt){
              if(err) return template_cb(err);
              template_body[template_name] = rslt;
              return template_cb();
            });
          }, cb);
        },

        //Get list of all pages
        //For each page
        //  Merge content with template
        //  Save template to file
        function (cb){
          var sql = 'select \
            p.page_key,page_file_id,page_title,page_path,page_tags,page_author,template_id, \
            page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
            from '+(module.schema?module.schema+'.':'')+'page p \
            inner join '+(module.schema?module.schema+'.':'')+'branch_page bp on bp.page_id = p.page_id\
            inner join '+(module.schema?module.schema+'.':'')+'deployment d on d.branch_id = bp.branch_id and d.deployment_id=@deployment_id'
            ;
          var sql_ptypes = [dbtypes.BigInt];
          var sql_params = { deployment_id: deployment_id };
          appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; return cb(err); }
            if(!rslt || !rslt.length || !rslt[0]){ return cb(new Error('Error loading deployment pages')); }
            async.eachSeries(rslt[0], function(page, cb){
              funcs.getClientPage(page, function(err, clientPage){
                if(err) return cb(err);

                //Merge content with template
                var ejsparams = {
                  page: {
                    seo: {
                      title: clientPage.page.seo.title||clientPage.page.title||'',
                      keywords: clientPage.page.seo.keywords||'',
                      metadesc: clientPage.page.seo.metadesc||'',
                    },
                    css: (clientPage.template.css||'')+' '+(clientPage.page.css||''),
                    js: (clientPage.template.js||'')+' '+(clientPage.page.js||''),
                    header: (clientPage.template.header||'')+' '+(clientPage.page.header||''),
                    body: clientPage.page.body,
                    footer: (clientPage.template.footer||'')+(clientPage.page.footer||'')
                  }
                };
                var page_content = template_body[page.template_id]||'';
                page_content = ejs.render(page_content, ejsparams);

                var page_fpath = page.page_path||'';
                if(!page_fpath) return cb();
                while(page_fpath.substr(0,1)=='/') page_fpath = page_fpath.substr(1);
                var is_folder = (page_fpath[page_fpath.length-1]=='/');
                if(is_folder) page_fpath += 'index.html';
                if(path.isAbsolute(page_fpath)) return cb(new Error('Page path:'+page.page_path+' cannot be absolute'));
                if(page_fpath.indexOf('..') >= 0) return cb(new Error('Page path:'+page.page_path+' cannot contain directory traversals'));
                site_files[page_fpath] = {
                  md5: crypto.createHash('md5').update(page_content).digest("hex")
                };
                page_fpath = path.join(publish_path, page_fpath);

                //Save template to file
                //xxxxjsh.Log.info('Generating '+page_fpath);
                //Create folders for path
                HelperFS.createFolderRecursive(path.dirname(page_fpath), function(err){
                  if(err) return cb(err);
                  fs.writeFile(page_fpath, page_content, 'utf8', cb);
                });
              });
            }, cb);
          });
        },

        //Save to Git
        function (cb) {
          if(!cms.Config.git || !cms.Config.git.enabled) return cb();

          async.waterfall([
            //Adding / committing all files to git
            function(git_cb){
              gitExec('git', ['add','-A'], function(err, rslt){
                if(err) return git_cb(err);
                jsh.Log.info('Saving deployment commit');
                  gitExec('git', ['commit','--allow-empty','-m','Deployment '+deployment.deployment_tag], function(err, rslt){
                    if(err) return git_cb(err);
                    return git_cb();
                  });
              });
            }
          ], cb);
        },

        //Deploy to target
        function (cb) {
          var dpath = (deployment.deployment_target_path||'').toString();
          if(!dpath) return cb(new Error('Invalid Deployment Target Path'));

          if(dpath.substr(0,5)=='s3://'){
            //Amazon S3 Deployment
            var s3url = url.parse(dpath);
            var AWS = require('aws-sdk');
            var s3 = new AWS.S3(cms.Config.aws_key);
            var bucket = s3url.hostname;
            var bucket_prefix = s3url.path.substr(1);
            if(!bucket_prefix || (bucket_prefix[bucket_prefix.length-1]!='/')) bucket_prefix += '/';

            var s3_files = {};
            var s3_upload = [];
            var s3_delete = [];

            async.waterfall([
              //Get list of all files
              function(s3_cb){
                var list_complete = false;
                var next_token = undefined;
                jsh.Log.info('Getting files from '+dpath);
                async.until(function(){ return list_complete; }, function(list_cb){
                  s3.listObjectsV2({ Bucket: bucket, Prefix: bucket_prefix, ContinuationToken: next_token }, function(err, rslt) {
                    if(err) return list_cb(err);
                    _.each(rslt.Contents, function(file){
                      var fname = file.Key.substr(bucket_prefix.length);
                      if(fname.substr(0,1)=='/') fname = fname.substr(1);
                      if(fname) s3_files[fname] = file;
                    });
                    list_complete = !rslt.IsTruncated;
                    next_token = rslt.NextContinuationToken;
                    return list_cb();
                  });
                }, s3_cb);
              },

              //Decide which files need to be uploaded or deleted
              function(s3_cb){
                for(var fname in s3_files){
                  if(fname in site_files){
                    var site_md5 = site_files[fname].md5;
                    var s3_md5 = s3_files[fname].ETag.replace(/"/g,'');
                    if(site_md5 != s3_md5) s3_upload.push(fname);
                  }
                  else {
                    s3_delete.push(fname);
                  }
                }
                for(var fname in site_files){
                  if(!(fname in s3_files)) s3_upload.push(fname);
                }
                if(!s3_delete.length && !s3_upload.length) jsh.Log.info('No changes required');
                return s3_cb();
              },

              //Upload new files to S3
              function(s3_cb){
                async.eachSeries(s3_upload, function(page_path, page_cb){
                  var page_bpath = bucket_prefix + page_path;
                  var page_fpath = path.join(publish_path, page_path);
                  var fstream = fs.createReadStream(page_fpath);
                  jsh.Log.info('Uploading: '+page_path);
                  s3.upload({ Bucket: bucket, Key: page_bpath, Body: fstream }, function(err, data){
                    if(err) return page_cb(err);
                    return page_cb();
                  });
                }, s3_cb);
              },

              //Delete removed files from S3
              function(s3_cb){
                async.eachSeries(s3_delete, function(page_path, page_cb){
                  var page_bpath = bucket_prefix + page_path;
                  jsh.Log.info('Deleting: '+page_path);
                  s3.deleteObject({ Bucket: bucket, Key: page_bpath }, function(err, data){
                    if(err) return page_cb(err);
                    return page_cb();
                  });
                }, s3_cb);
              }

            ], cb);
          }
          else return cb(new Error('Deployment Target path not supported'));
        },

        function (cb){
          var sql = "update "+(module.schema?module.schema+'.':'')+"deployment set deployment_sts='COMPLETE' where deployment_id=@deployment_id;";
          var sql_ptypes = [dbtypes.BigInt];
          var sql_params = { deployment_id: deployment_id };
          appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; return cb(err); }
            return cb(null);
          });
        },

        function (cb) {
          jsh.Log.info('Deployment successful');
        }
      ], function (err, rslt) {
        if (err) {
          jsh.Log.error(err.toString() + '\n' + (new Error().stack));
        }
      });
    });
  }

  this.diff = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};
    
    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Branch_Review');
    
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'get') {
      var branch_id = req.query.branch_id;
      
      //Check if Asset is defined
      var sql_ptypes = [dbtypes.BigInt];
      var sql_params = { 'branch_id': branch_id };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      
      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      var branch_pages = [];
      var pages = {};

      async.waterfall([

        //Get all branch_pages
        function(cb){
          var sql = "select branch_page.page_key, branch_page.branch_page_action, branch_page.page_id, branch_page.page_orig_id, \
              old_page.page_path old_page_path, old_page.page_title old_page_title, old_page.page_file_id old_page_file_id,\
              new_page.page_path new_page_path, new_page.page_title new_page_title, new_page.page_file_id new_page_file_id\
            from "+(module.schema?module.schema+'.':'')+"branch_page branch_page \
              left outer join "+(module.schema?module.schema+'.':'')+"page old_page on old_page.page_id=branch_page.page_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page new_page on new_page.page_id=branch_page.page_id \
            where branch_id=@branch_id and branch_page_action is not null";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) branch_pages = rslt[0];
            return cb();
          });
        },

        //Get all pages
        function(cb){
          var sql = "select page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
            from "+(module.schema?module.schema+'.':'')+"page page \
            where page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@branch_id and branch_page_action is not null) or \
                  page.page_id in (select page_orig_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@branch_id and branch_page_action = 'UPDATE')";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]){
              _.each(rslt[0], function(page){
                pages[page.page_id] = page;
              });
            }
            return cb();
          });
        },

        //Get file content
        function(cb){
          async.eachOfSeries(pages, function(page, page_id, page_cb){
            funcs.getClientPage(page, function(err, clientPage){
              if(err) return page_cb(err);
              if(!clientPage) return page_cb(null); 
              page.compiled = clientPage.page;
              page.template_title = clientPage.template.title;
              return page_cb(null);
            });
          }, cb);
        },

        //Perform diff
        function(cb){

          _.each(branch_pages, function(branch_page){
            if(branch_page.branch_page_action.toUpperCase()=='UPDATE'){
              var old_page = pages[branch_page.page_orig_id];
              var new_page = pages[branch_page.page_id];
              
              branch_page.diff = {};
              _.each(['css','header','footer','body'], function(key){
                var diff = funcs.diffHTML(old_page.compiled[key], new_page.compiled[key]);
                if(diff) branch_page.diff[key] = diff;
              });
              _.each(['page_title','template_title'], function(key){
                if(old_page[key] != new_page[key]) branch_page.diff[key] = new_page[key];
              });
              branch_page.diff.seo = {};
              _.each(['title','keywords','metadesc','canonical_url'], function(key){
                if(old_page.compiled.seo[key] != new_page.compiled.seo[key]) branch_page.diff.seo[key] = new_page.compiled.seo[key];
              });
            }
          });
          return cb();
        },

      ], function(err){
        if(err) return Helper.GenError(req, res, -99999, err.toString());
        res.end(JSON.stringify({ '_success': 1, 'branch_pages': branch_pages }));
      });
      return;
    }
    else {
      return next();
    }
  }

  this.diffHTML = function(a, b){
    if(a==b) return '';

    var diff_lines = dmp.diff_linesToChars_(a, b);
    var diff_lineText1 = diff_lines.chars1;
    var diff_lineText2 = diff_lines.chars2;
    var diff_lineArray = diff_lines.lineArray;
    var diff = dmp.diff_main(diff_lineText1, diff_lineText2, false);
    dmp.diff_charsToLines_(diff, diff_lineArray);
    var patch = dmp.patch_toText(dmp.patch_make(a,diff));
    var patchlines = patch.split(/\n/);
    for(var i=0;i<patchlines.length;i++){
      var patchline = patchlines[i];
      var patchsplit = patchline.split(/%0A/);
      for(var j=1;j<patchsplit.length;j++){
        if((j < (patchsplit.length-1)) || patchsplit[j]){
          patchsplit[j] = patchsplit[0][0] + patchsplit[j];
        }
      }
      patchline = patchsplit.join('%0A');
      patchlines[i] = patchline;
    }
    patch = patchlines.join('\n');

    patch = decodeURIComponent("--- compare\n+++ compare\n" + patch);
    return Diff2Html.getPrettyHtml(patch, {
      inputFormat: "diff",
      matching: "lines"
    });
    
  }

  this.formatDiff = function(diff){
    var html = [];
    for (var x = 0; x < diff.length; x++) {
      var op = diff[x][0];
      var text = Helper.escapeHTMLBR(diff[x][1]);
      if(op==DiffMatchPatch.DIFF_INSERT){
        html[x] = '<ins style="background:#e6ffe6;">' + text + '</ins>';
      }
      else if(op==DiffMatchPatch.DIFF_DELETE){
        html[x] = '<del style="background:#ffe6e6;">' + text + '</del>';
      }
      else if(op==DiffMatchPatch.DIFF_EQUAL){
        html[x] = '<span>' + text + '</span>';
      }
    }
    return html.join('');
  }
}

exports = module.exports = ModuleFunctions;