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
var path = require('path');
var fs = require('fs');
var urlparser = require('url');
var cheerio = require('cheerio');

module.exports = exports = function(module, funcs){
  var exports = {};

  exports.getPageFile = function(page_file_id){
    return path.join(path.join(module.jsh.Config.datadir,'page'),page_file_id.toString()+'.json');
  }

  exports.getClientPage = function(page, cb){
    var appsrv = this;

    var page_file_id = page.page_file_id;
    var template_id = page['template_id'];
    if(!template_id) template_id = module.DefaultTemplate;
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

  exports.replaceBranchURLs = function(page_content, options){
    options = _.extend({
      getMediaURL: function(media_key){ return ''; },
      getPageURL: function(page_key){ return ''; },
      removeClass: false
    }, options);
    var $ = cheerio.load(page_content);

    function parseClasses(jobj,prop){
      if(jobj.attr('data-cke-saved-'+prop)) jobj.attr('data-cke-saved-'+prop, null);
      var cssClassString = jobj.attr('class');
      var cssClasses = cssClassString.split(' ');
      for(var i=0;i<cssClasses.length;i++){
        var cssClass = cssClasses[i].trim();
        if(cssClass.indexOf('media_key_')==0){
          var media_key = parseInt(cssClass.substr(10));
          if(cssClass.substr(10)==(media_key||0).toString()){
            //Apply Media Key
            var media_url = options.getMediaURL(media_key);
            jobj.attr(prop, media_url);
            if(options.removeClass) jobj.removeClass('media_key_'+media_key);
          }
        }
        else if(cssClass.indexOf('page_key_')==0){
          var page_key = parseInt(cssClass.substr(9));
          if(cssClass.substr(9)==(page_key||0).toString()){
            //Apply Page Key
            var page_url = options.getPageURL(page_key);
            jobj.attr(prop, page_url);
            if(options.removeClass) jobj.removeClass('page_key_'+page_key);
          }
        }
      }
    }

    $('a').each(function(obj_i,obj){
      parseClasses($(obj),'href');
    });
    $('img').each(function(obj_i,obj){
      parseClasses($(obj),'src');
    });
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

      var baseurl = req.baseurl;
      if(baseurl.indexOf('//')<0) baseurl = req.protocol + '://' + req.get('host') + baseurl;
      
      //Globally accessible
      if(template.remote_template && template.remote_template.editor){
        var referer = req.get('Referer');
        if(referer){
          var urlparts = urlparser.parse(referer, true);
          var remote_domain = urlparts.protocol + '//' + (urlparts.auth?urlparts.auth+'@':'') + urlparts.hostname + (urlparts.port?':'+urlparts.port:'');
          res.setHeader('Access-Control-Allow-Origin', remote_domain);
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
          res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With, Content-Type, Accept');
          res.setHeader('Access-Control-Allow-Credentials', true);
        }
      }
      
      if (verb == 'get'){
        //Validate parameters
        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        var page_role = '';
        if(Helper.HasRole(req, 'PUBLISHER')) page_role = 'PUBLISHER';
        else if(Helper.HasRole(req, 'AUTHOR')) page_role = 'AUTHOR';
        else if(Helper.HasRole(req, 'VIEWER')) page_role = 'VIEWER';

        
        //Get authors
        if(Helper.HasRole(req, 'PUBLISHER')){
          sql = "select sys_user_id code_val,concat(sys_user_fname,' ',sys_user_lname) code_txt from jsharmony.sys_user where sys_user_id in (select sys_user_id from jsharmony.sys_user_role where sys_role_name in ('PUBLISHER','AUTHOR')) order by code_txt";
        }
        else {
          sql = "select sys_user_id code_val,concat(sys_user_fname,' ',sys_user_lname) code_txt from jsharmony.sys_user where sys_user_id = (select page_author from "+(module.schema?module.schema+'.':'')+"v_my_page where page_key=@page_key) order by code_txt";
        }
        appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
          if(!rslt || !rslt.length || !rslt[0]){ return Helper.GenError(req, res, -4, 'Invalid Page ID'); }
          var authors = rslt[0];

          //Return page
          funcs.getClientPage(page, function(err, clientPage){
            if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }
            if(clientPage.page.body){
              clientPage.page.body = funcs.replaceBranchURLs(clientPage.page.body, {
                getMediaURL: function(media_key){
                  return baseurl+'_funcs/media/'+media_key+'/';
                },
                getPageURL: function(page_key){
                  return baseurl+'_funcs/pages/'+page_key+'/';
                }
              });
            }
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

  return exports;
};
