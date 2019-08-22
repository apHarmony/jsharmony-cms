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
var path = require('path');
var ejs = require('ejs');
var fs = require('fs');
var urlparser = require('url');
var async = require('async');
var wclib = require('jsharmony/WebConnect');

function ModuleFunctions(module){
  var funcs = this;

  this.getPageFile = function(page_id){
    return path.join(path.join(module.jsh.Config.datadir,'page'),page_id.toString()+'.json');
  }

  this.getClientPage = function(page, cb){
    var appsrv = this;

    var page_id = page.page_id;
    var template_id = page['template_id'];
    var template = module.Templates[template_id];

    //Load Page Content from disk
    module.jsh.ParseJSON(funcs.getPageFile(page_id), module.name, 'Page ID#'+page_id, function(err, page_content){
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

    if(!req.params || !req.params.page_id) return next();
    var page_id = req.params.page_id;

    //Return updated LOV
    sql_ptypes = [dbtypes.BigInt];
    sql_params = { 'page_id': page_id };
    validate = new XValidate();
    verrors = {};
    validate.AddValidator('_obj.page_id', 'Page ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
    sql = 'select page_id,page_key,page_title,page_path,page_tags,page_author,template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang from '+(module.schema?module.schema+'.':'')+'page where page_id=@page_id';
    
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

        //Save to disk
        fs.writeFile(funcs.getPageFile(page_id), JSON.stringify(client_page), 'utf8', function(err){
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
          sql = 'update '+(module.schema?module.schema+'.':'')+'page set '+_.map(sql_params, function(val, key){ return key + '=@' + key }).join(',')+' where page_id=@page_id';
          sql_params.page_id = page_id;

          fields = [];
          datalockstr = '';
          verrors = {};
          appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
          sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
          if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }
          
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            res.end(JSON.stringify({ '_success': 1 }));
          });
        });

        return;
      }
      else return next();
    });
  }

  this.publish = function (req, res, next) {
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

    var model = jsh.getModel(req, module.namespace + 'Deployment_Listing');
    
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    var sql = "select param_cur_val from jsharmony.v_param_cur where param_cur_process='CMS' and param_cur_attrib='PUBLISH_TGT'";
    appsrv.ExecScalar(req._DBContext, sql, [], {}, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      var publish_tgt = '';
      if(rslt && rslt[0]) publish_tgt = rslt[0];
      if(!publish_tgt) { Helper.GenError(req, res, -9, 'Publish Target parameter is not defined'); return; }
      var publish_path = path.isAbsolute(publish_tgt) ? publish_tgt : path.join(jsh.Config.datadir,publish_tgt);
      publish_path = path.normalize(publish_path);

      var template_body = {};

      if (verb == 'get') {
        res.end(JSON.stringify({ '_success': 1, 'publish_path': publish_path }));
        return;
      }
      else if (verb == 'post') {
        var farr = [];
        async.waterfall([
          //Create output folder if it does not exist
          function (cb){
            return HelperFS.createFolderRecursive(publish_path, cb);
          },

          //Clear output folder
          function (cb){
            return HelperFS.clearFiles(publish_path, 0, undefined, cb);
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
            var sql = 'select page_id,page_key,page_title,page_path,page_tags,page_author,template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang from '+(module.schema?module.schema+'.':'')+'page';
            var sql_ptypes = [];
            var sql_params = {};
            appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
              if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
              if(!rslt || !rslt.length || !rslt[0]){ return Helper.GenError(req, res, -4, 'Error loading pages'); }
              async.eachSeries(rslt[0], function(page, page_cb){
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
                  if(!page_fpath) return page_cb();
                  while(page_fpath.substr(0,1)=='/') page_fpath = page_fpath.substr(1);
                  if(path.isAbsolute(page_fpath)) throw new Error('Page path:'+page.page_path+' cannot be absolute');
                  if(page_fpath.indexOf('..') >= 0) throw new Error('Page path:'+page.page_path+' cannot contain directory traversals');
                  page_fpath = path.join(publish_path, page_fpath);

                  //Save template to file
                  jsh.Log.info('Publishing '+page_fpath);
                  fs.writeFile(page_fpath, page_content, 'utf8', page_cb);
                });
              }, cb);
            });
          },
  
          function (cb) {
            res.end(JSON.stringify({ '_success': 1, 'publish_path': publish_path }));
          }
        ], function (err, rslt) {
          if (err) {
            if ('number' in err) { return Helper.GenError(req, res, err.number, err.message); }
            return Helper.GenError(req, res, -99999, err.message);
          }
        });
        return;
      }
      return next();
    });
  }
}

exports = module.exports = ModuleFunctions;