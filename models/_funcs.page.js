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
var _ = require('lodash');
var async = require('async');
var path = require('path');
var fs = require('fs');
var urlparser = require('url');
var cheerio = require('cheerio');

module.exports = exports = function(module, funcs){
  var exports = {};

  exports.getPageFile = function(page_file_id){
    if(!page_file_id) throw new Error('Invalid page_file_id');
    return path.join(path.join(module.jsh.Config.datadir,'page'),page_file_id.toString()+'.json');
  }

  exports.getClientPage = function(page, cb){
    var appsrv = this;

    var page_file_id = page.page_file_id;
    var page_template_id = page.page_template_id;
    if(!page_template_id) page_template_id = module.defaultPageTemplate;
    var template = module.PageTemplates[page_template_id];

    //Load Page Content from disk
    module.jsh.ParseJSON(funcs.getPageFile(page_file_id), module.name, 'Page File ID#'+page_file_id, function(err, page_file){
      var page_file_content = '';
      try{
        page_file_content = JSON.parse(JSON.stringify(template.default_content||'')) || {};
      }
      catch(ex){
        module.jsh.Log.error('Error parsing JSON: '+ex.toString()+' :: '+template.default_content);
      }
      page_file = page_file || { };
      if(!('content' in page_file)) page_file.content = {};
      for(var key in template.content_elements){
        if(key in page_file.content) page_file_content[key] = page_file.content[key];
      }
      page_file.content = page_file_content;
      if(!page_file.seo) page_file.seo = {};
      var client_page = {
        title: page.page_title||'',
        css: page_file.css||'',
        header: page_file.header||'',
        footer: page_file.footer||'',
        content: page_file.content||{},
        seo: {
          title: page_file.seo.title||'',
          keywords: page_file.seo.keywords||'',
          metadesc: page_file.seo.metadesc||'',
          canonical_url: page_file.seo.canonical_url||'',
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
        content_elements: template.content_elements||{},
        raw: template.raw||false
      };
      
      return cb(null,{
        page: client_page,
        template: client_template
      });
    });
  }

  exports.replaceBranchURLs = function(content, options){
    options = _.extend({
      getMediaURL: function(media_key){ return ''; },
      getPageURL: function(page_key){ return ''; },
      removeClass: false
    }, options);
    var $ = cheerio.load(content, { xmlMode: true });

    function parseURLs(jobj,prop){
      if(jobj.attr('data-cke-saved-'+prop)) jobj.attr('data-cke-saved-'+prop, null);
      if(jobj.hasClass('cms-no-replace-url')) return;
      var url = jobj.attr(prop);
      if(!url) return;
      var urlparts = urlparser.parse(url, true);
      if(!urlparts.path) return;
      var patharr = (urlparts.path||'').split('/');

      if((urlparts.path.indexOf('/_funcs/media/')==0) && (patharr.length>=4)){
        var media_key = patharr[3];
        if(parseInt(media_key).toString()==media_key){
          var media_url = options.getMediaURL(media_key);
          jobj.attr(prop, media_url);
        }
      }
      if((urlparts.path.indexOf('/_funcs/page/')==0) && (patharr.length>=4)){
        var page_key = patharr[3];
        if(parseInt(page_key).toString()==page_key){
          var page_url = options.getPageURL(page_key);
          jobj.attr(prop, page_url);
        }
      }
    }

    $('a').each(function(obj_i,obj){
      parseURLs($(obj),'href');
    });
    $('img').each(function(obj_i,obj){
      parseURLs($(obj),'src');
    });
    //Prevent auto-closing HTML elements
    $('div,iframe,span,script').filter(function(idx,elem){ return !elem.children.length; }).text('');
    return $.html();
  }
  
  exports.page = function (req, res, next) {
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
    
    if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if(!req.params || !req.params.page_key) return next();
    var page_key = req.params.page_key;

    var referer = req.get('Referer');
    if(referer){
      var urlparts = urlparser.parse(referer, true);
      var remote_domain = urlparts.protocol + '//' + (urlparts.auth?urlparts.auth+'@':'') + urlparts.hostname + (urlparts.port?':'+urlparts.port:'');
      res.setHeader('Access-Control-Allow-Origin', remote_domain);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With, Content-Type, Accept');
      res.setHeader('Access-Control-Allow-Credentials', true);
    }

    //Get page
    sql_ptypes = [dbtypes.BigInt];
    sql_params = { 'page_key': page_key };
    validate = new XValidate();
    verrors = {};
    validate.AddValidator('_obj.page_key', 'Page Key', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
    sql = 'select page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang';

    if(Q.page_id){
      sql_ptypes.push(dbtypes.BigInt);
      sql_params.page_id = Q.page_id;
      validate.AddValidator('_obj.page_id', 'Page ID', 'B', [XValidate._v_IsNumeric()]);
      sql += ' from '+(module.schema?module.schema+'.':'')+'page where page_key=@page_key and page_id=@page_id';
    }
    else sql += ' from '+(module.schema?module.schema+'.':'')+'v_my_page where page_key=@page_key';

    var page_role = '';
    if(Helper.HasRole(req, 'PUBLISHER')) page_role = 'PUBLISHER';
    else if(Helper.HasRole(req, 'AUTHOR')) page_role = 'AUTHOR';
    else if(Helper.HasRole(req, 'VIEWER')) page_role = 'VIEWER';
    
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
      var page_template_id = page.page_template_id;
      var page_template = module.PageTemplates[page_template_id];

      var baseurl = req.baseurl;
      if(baseurl.indexOf('//')<0) baseurl = req.protocol + '://' + req.get('host') + baseurl;
      
      if (verb == 'get'){
        if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

        //Validate parameters
        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, ['|page_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        var authors = null;
        var clientPage = null;
        var media_file_ids = {};

        async.waterfall([

          //Get authors
          function(cb){
            if(Helper.HasRole(req, 'PUBLISHER')){
              sql = "select sys_user_id code_val,concat(sys_user_fname,' ',sys_user_lname) code_txt from jsharmony.sys_user where sys_user_id in (select sys_user_id from jsharmony.sys_user_role where sys_role_name in ('PUBLISHER','AUTHOR')) order by code_txt";
            }
            else {
              sql = "select sys_user_id code_val,concat(sys_user_fname,' ',sys_user_lname) code_txt from jsharmony.sys_user where sys_user_id = (select page_author from "+(module.schema?module.schema+'.':'')+"page where page_id=@page_id) order by code_txt";
            }

            appsrv.ExecRecordset(req._DBContext, sql, [dbtypes.BigInt], { page_id: page.page_id }, function (err, rslt) {
              if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
              if(!rslt || !rslt.length || !rslt[0]){ return Helper.GenError(req, res, -4, 'Invalid Page ID'); }
              authors = rslt[0];
              return cb();
            });
          },

          //Get media
          function(cb){
            appsrv.ExecRecordset(req._DBContext, "select media_key, media_file_id from "+(module.schema?module.schema+'.':'')+"v_my_media where (media_file_id is not null) and (media_is_folder = 0)", [], {}, function (err, rslt) {
              if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
              if(!rslt || !rslt.length || !rslt[0]){ return cb(); }
              _.each(rslt[0], function(media){
                media_file_ids[media.media_key] = media.media_file_id;
              });
              return cb();
            });
          },

          //Get page
          function(cb){
            funcs.getClientPage(page, function(err, _clientPage){
              if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }
              clientPage = _clientPage;
              if(!clientPage.page.content || _.isString(clientPage.page.content)) { Helper.GenError(req, res, -99999, 'page.content must be a data structure'); return; }
              if(clientPage.page.content && !clientPage.template.raw){
                for(var key in clientPage.page.content){
                  clientPage.page.content[key] = funcs.replaceBranchURLs(clientPage.page.content[key], {
                    getMediaURL: function(media_key){
                      return baseurl+'_funcs/media/'+media_key+'/?media_file_id='+media_file_ids[media_key];
                    },
                    getPageURL: function(page_key){
                      return baseurl+'_funcs/page/'+page_key+'/';
                    }
                  });
                }
              }
              return cb();
            });
          }
        ], function(err){
          if(err){ Helper.GenError(req, res, -99999, err.toString()); return; }

          res.end(JSON.stringify({ 
            '_success': 1,
            'page': clientPage.page,
            'template': clientPage.template,
            'authors': authors,
            'role': page_role,
            'views': {
              'jsh_cms_editor.css': (jsh.getEJS('jsh_cms_editor.css')||'')+(jsh.getEJS('jsh_cms_editor.css.ext')||''),
              'jsh_cms_editor': jsh.getEJS('jsh_cms_editor')
            }
          }));
        });
      }
      else if(verb == 'post'){
        if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }
        /*
          var client_page = {
            title: page.page_title||'',
            css: page_file.css||'',
            header: page_file.header||'',
            footer: page_file.footer||'',
            content: page_file.content||{},
            seo_title: page_file.seo_title||'',
            seo_keywords: page_file.seo_keywords||'',
            seo_metadesc: page_file.seo_metadesc||'',
            seo_canonical_url: page_file.seo_canonical_url||'',
            lang: page.page_lang||'',
            tags: page.page_tags||'',
            author: page.page_author,
          };
        */

        //Validate parameters
        if (!appsrv.ParamCheck('P', P, ['&title','&css','&header','&footer','&content','&seo','&lang','&tags','&author'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //XValidate
        var client_page = P;
        validate = new XValidate();
        verrors = {};
        validate.AddValidator('_obj.title', 'Title', 'B', [XValidate._v_MaxLength(1024)]);
        validate.AddValidator('_obj.css', 'CSS', 'B', []);
        validate.AddValidator('_obj.header', 'Header', 'B', []);
        validate.AddValidator('_obj.footer', 'Footer', 'B', []);
        validate.AddValidator('_obj.content', 'Content', 'B', []);
        validate.AddValidator('_obj.seo.title', 'SEO Title', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.seo.keywords', 'SEO Keywords', 'B', []);
        validate.AddValidator('_obj.seo.metadesc', 'SEO Meta Description', 'B', []);
        validate.AddValidator('_obj.seo.canonical_url', 'SEO Canonical URL', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.lang', 'Language', 'B', [XValidate._v_MaxLength(32)]);
        validate.AddValidator('_obj.tags', 'Tags', 'B', []);
        validate.AddValidator('_obj.author', 'Author', 'B', [ XValidate._v_Required() ]);
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
        sql += 'select page_file_id, page_path, page_folder from '+(module.schema?module.schema+'.':'')+'v_my_page where page_key=@page_key;';
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
          page.page_folder = rslt[0][0].page_folder;
          //Save to disk
          fs.writeFile(funcs.getPageFile(page.page_file_id), JSON.stringify(client_page), 'utf8', function(err){
            res.end(JSON.stringify({ '_success': 1, page_folder: page.page_folder }));
          });
        });

        return;
      }
      else return next();
    });
  }

  return exports;
};
