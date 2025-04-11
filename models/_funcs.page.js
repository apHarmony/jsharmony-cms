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
var async = require('async');
var path = require('path');
var fs = require('fs');
var urlparser = require('url');
var crypto = require('crypto');
var querystring = require('querystring');

module.exports = exports = function(module, funcs){
  var exports = {};
  var _t = module._t;

  exports.getPageFile = function(page_file_id){
    if(!page_file_id) throw new Error('Invalid page_file_id');
    return path.join(path.join(module.jsh.Config.datadir,'page'),page_file_id.toString()+'.json');
  };

  exports.getClientPage = function(dbcontext, page, sitemaps, site_id, options, cb){
    options = _.extend({ includeAllExtraContent: false, includeExtraRemoteContent: false, pageTemplates: null, ignoreInvalidPageTemplate: false }, options);
    var page_file_id = page.page_file_id;
    var page_template_id = page.page_template_id;
    if(!page_template_id) return cb(new Error('Page template: '+page_template_id));

    var template = null;

    if(options.pageTemplates) template = options.pageTemplates[page_template_id];

    Helper.execif(!options.pageTemplates && (options.pageTemplates !== false),
      function(f){
        funcs.getPageTemplate(dbcontext, site_id, page_template_id, {}, function(err, pageTemplate){
          if(err) return cb(err);
          template = pageTemplate;
          return f();
        });
      },
      function(){
        if(!template && options.ignoreInvalidPageTemplate) template = {};
        if(!template) return cb(new Error('Invalid page template "'+page_template_id+'" in page '+page.page_path));

        //Load Page Content from disk
        module.jsh.ParseJSON(funcs.getPageFile(page_file_id), module.name, 'Page File ID#'+page_file_id, function(err, page_file){
          if(err && !HelperFS.fileNotFound(err)) return cb(err);
        
          //Template options
          template.options = _.extend({
            title_element_required: true,
          }, template.options);
  
          template.options.page_toolbar = _.extend({
            dock: 'top_offset'
          }, template.options.page_toolbar);

          template.sys_options = {
            component_content_elements: {},
          };

          //Add content elements if they do not exist
          var template_content_elements = template.content_elements;
          if(!template_content_elements){
            if(!options.pageTemplates && (template.location == 'REMOTE')){ /* Do nothing */ }
            else {
              template_content_elements = { body: { type: 'htmleditor', title: 'Body' } };
            }
          }
          for(let key in template_content_elements){
            template_content_elements[key] = _.extend({
              type: 'htmleditor',
            }, template_content_elements[key]);
            
            template_content_elements[key].editor_toolbar = _.extend({
              dock: 'auto',
              show_menu: true,
              show_toolbar: true,
            }, template_content_elements[key].editor_toolbar);
          }

          //Parse content
          var page_file_content = {};
          try{
            page_file_content = JSON.parse(JSON.stringify(template.default_content||'')) || {};
          }
          catch(ex){
            module.jsh.Log.error('Error parsing JSON: '+ex.toString()+' :: '+template.default_content);
          }
          for(let key in template.content){
            if(template.content[key] && template.content[key].component){
              page_file_content[key] = '<div cms-component-remove-container cms-component='+JSON.stringify(template.content[key].component)+'></div>';
              template.sys_options.component_content_elements[key] = template.content[key].component;
            }
            else{
              page_file_content[key] = template.content[key];
            }
          }
          page_file = page_file || { };
          if(!('content' in page_file)) page_file.content = {};
          for(let key in template_content_elements){
            if(key in page_file.content) page_file_content[key] = page_file.content[key];
          }
          var extraContent = !!options.includeAllExtraContent;
          if(template.standalone){
            extraContent = true;
          }
          else if(template.location == 'REMOTE'){
            //Add extra content_areas that are not defined in template (if using in-template script config)
            if(options.includeExtraRemoteContent) extraContent = true;
          }
          if(extraContent){
            for(let key in page_file.content){
              if(!(key in page_file_content)) page_file_content[key] = page_file.content[key];
            }
          }
          page_file.content = page_file_content;

          //Parse properties
          var default_properties = {};
          try{
            default_properties = _.extend(default_properties, JSON.parse(JSON.stringify(template.default_properties||'')) || {});
          }
          catch(ex){
            module.jsh.Log.error('Error parsing JSON: '+ex.toString()+' :: '+template.default_properties);
          }
          if(template.properties){
            _.each(template.properties.fields, function(field){
              if(field && field.name){
                if(!(field.name in default_properties)){
                  default_properties[field.name] = ('default' in field) ? field.default : '';
                }
              }
            });
          }
          
          if(!page_file.seo) page_file.seo = {};
          var client_page = {
            title: page.page_title||'',
            css: page_file.css||'',
            header: page_file.header||'',
            footer: page_file.footer||'',
            properties: _.extend({}, default_properties, page_file.properties||{}),
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
            page_template_id: page_template_id,
          };
          var client_template = {
            title: template.title||'',
            css: template.css||'',
            header: template.header||'',
            footer: template.footer||'',
            properties: template.properties||{},
            default_properties: default_properties||{},
            js: template.js||'',
            content_elements: template_content_elements,
            raw: template.raw||false,
            standalone: template.standalone||false,
            options: template.options||{},
            components: template.components||{},
            sys_options: template.sys_options||{},
          };


          return cb(null,{
            page: client_page,
            template: client_template,
            sitemap: funcs.getPageSitemapRelatives((sitemaps||{}).PRIMARY, page.page_key)
          });
        }, { fatalError: false });
      }
    );
  };

  exports.replaceBranchURLs = function(content, options){
    return funcs.replaceURLs('#@JSHCMS', content, options, function(rtag, url, getLinkContent){
      if(!url) return url;
      var orig_url = url;

      function addUrlSuffix(url){
        if(!url  || (url==orig_url)) return url;
        var orig_urlparts = urlparser.parse(orig_url, true);
        var suffix = '';
        if(Helper.beginsWith(orig_urlparts.hash || '', rtag)){
          suffix = orig_urlparts.hash.substr(rtag.length);
        }
        if(!suffix) return url;
        var urlparts = urlparser.parse(url, true);
        if(urlparts.hash) return url + suffix;
        if(urlparts.search){
          if(suffix[0]=='?') return url + '&' + suffix.substr(1);
        }
        return url + suffix;
      }

      if(module.Config.onReplaceBranchURL){
        var customURL = module.Config.onReplaceBranchURL(url, options.branchData, getLinkContent, addUrlSuffix, options);
        if(typeof customURL != 'undefined') return customURL;
      }
      var urlparts = urlparser.parse(url, true);
      if(!urlparts.path) return url;
      var patharr = (urlparts.pathname||'').split('/');

      if((urlparts.path.indexOf('/_funcs/media/')==0) && (patharr.length>=4)){
        var media_key = patharr[3];
        if(parseInt(media_key).toString()==media_key){
          try{
            var thumbnail_id = ((patharr.length >= 5) ? patharr[4] : '');
            var media_url = options.getMediaURL(media_key, thumbnail_id, options.branchData, getLinkContent, urlparts);
          }
          catch(ex){
            if(options.onError) options.onError(ex);
            else throw ex;
            return '';
          }
          return addUrlSuffix(media_url);
        }
      }
      if((urlparts.path.indexOf('/_funcs/page/')==0) && (patharr.length>=4)){
        var page_key = patharr[3];
        if(parseInt(page_key).toString()==page_key){
          try{
            var page_url = options.getPageURL(page_key, options.branchData, getLinkContent, urlparts);
          }
          catch(ex){
            if(options.onError) options.onError(ex);
            else throw ex;
            return '';
          }
          return addUrlSuffix(page_url);
        }
      }

      return url;
    });
  };

  exports.replaceURLs = function(rtag, content, options, replaceURL /* function(rtag, url, getLinkContent){ return url; } */){
    options = _.extend({
      getMediaURL: function(media_key, thumbnail_id, branchData, getLinkContent, thumbnail, urlparts){ return ''; },
      getPageURL: function(page_key, branchData, getLinkContent, urlparts){ return ''; },
      onError: function(err){ },
      onComponentData: null, //function(content){ return content; },
      onComponentProperties: null, //function(content){ return content; },
      removeClass: false,
      replaceComponents: false,
      branchData: {}
    }, options);

    var rtagidx = content.indexOf(rtag);
    while(rtagidx >= 0){
      var startofstr = rtagidx;
      var endofstr = rtagidx;
      var urlchar = /[a-zA-Z0-9/_#\-:=?@%&.~[\]!$*+,;]/;
      do{ if(!urlchar.test(content[startofstr])) break; } while(--startofstr >= 0);
      do{ if(!urlchar.test(content[endofstr])) break; } while(++endofstr < content.length);
      startofstr++;
      endofstr--;
      var url = content.substr(startofstr, endofstr - startofstr + 1);
      var lowerurl = url.toLowerCase();

      //Remove &quot; + shift startofstr / endofstr
      var quotstr = '&quot;';
      if(lowerurl.indexOf(quotstr) >= 0){
        var relrtagidx = rtagidx - startofstr;
        var endquotidx = lowerurl.indexOf(quotstr, relrtagidx);
        var startquotidx = lowerurl.lastIndexOf(quotstr, relrtagidx);
        if(endquotidx >= 0) endofstr -= (url.length - endquotidx);
        if(startquotidx >= 0) startofstr += startquotidx + quotstr.length;

        url = content.substr(startofstr, endofstr - startofstr + 1);
        lowerurl = url.toLowerCase();
      }

      var newURL = url;
      
      //Decode HTML entities
      var escapeHtmlEntities = ((lowerurl.indexOf('&#x2f;') >= 0) || (lowerurl.indexOf('&#47;') >= 0));
      if(escapeHtmlEntities){
        newURL = Helper.unescapeHTMLEntity(newURL);
      }

      newURL = replaceURL(rtag, newURL, function(){
        //Get start of link
        var startOfLine = startofstr - 1;
        var startchar = /[\n<]/;
        do{ if(startchar.test(content[startOfLine])) break; } while((--startOfLine > 0) && ((startofstr - startOfLine) < 50));

        //Get end of link
        var endOfLine = endofstr;
        var endchar = /[\n]/;
        do{ if(endchar.test(content[endOfLine]) || (content.substr(Math.max(0,endOfLine-2), 3)=='/a>')) break; } while((++endOfLine < content.length) && ((endOfLine - endofstr) < 50));

        return content.substr(startOfLine, endOfLine - startOfLine + 1);
      });

      newURL = Helper.ReplaceAll(newURL, ' ', '%20');

      //Re-encode HTML entities
      if(escapeHtmlEntities){
        newURL = Helper.escapeHTML(newURL);
      }

      if(newURL!=url){
        content = content.substr(0, startofstr) + newURL + content.substr(endofstr + 1);
        rtagidx = endofstr + (newURL.length - url.length);
      }
      rtagidx = content.indexOf(rtag, rtagidx + 1);
    }

    function parseAttribute(content, attrs, f){
      if(!_.isArray(attrs)) attrs = [attrs];
      _.each(attrs, function(attr){
        var idx = 0;
        var attrIdx = content.indexOf(attr);
        while(attrIdx >= 0){
          idx = attrIdx + attr.length;
          var chr = content[idx];
          while((idx < content.length)&&((chr=='\t')||(chr=='\n')||(chr=='\r')||(chr=='\f')||(chr==' '))) chr = content[++idx];
          var delim = '';
          var validAttr = (chr == '=');

          var firstChar = true;
          var isEscaped = false;
          if(validAttr){
            chr = content[++idx];
            while((idx < content.length)&&((chr=='\t')||(chr=='\n')||(chr=='\r')||(chr=='\f')||(chr==' '))) chr = content[++idx];

            if(firstChar){
              firstChar = false;
              isEscaped = (chr == '\\');
              if(isEscaped){
                chr = content[++idx];
              }
            }

            if(chr=='"'){ delim = '"'; chr = content[++idx]; }
            else if(chr=="'"){ delim = "'"; chr = content[++idx]; }
            else if(chr=='>'){ validAttr = false; }

            //Read attribute value
            if(validAttr){
              var startPos = idx;
              var endPos = idx;
              var atEnd = false;

              while(!atEnd && (idx < content.length)){
                chr = content[idx];
                if(isEscaped && (chr == '\\')) chr = content[++idx];

                if(delim == '"'){
                  if(chr == '"') atEnd = true;
                  else endPos++;
                }
                else if(delim == "'"){
                  if(chr == "'") atEnd = true;
                  else endPos++;
                }
                else {
                  if(chr == '>') atEnd = true;
                  else endPos++;
                }
                idx++;
              }

              if(f){
                var oldVal = content.substr(startPos, endPos - startPos);
                var newVal = f(oldVal);
                content = content.substr(0, startPos) + newVal + content.substr(endPos);
              }
            }
          }
          attrIdx = content.indexOf(attr, idx);
        }
      });
      return content;
    }

    function replaceBase64Attribute(content, attr, onReplace){
      return parseAttribute(content, attr, function(val){
        if(!val) return val;
        var strval = val;
        try{
          strval = Buffer.from(strval,'base64').toString();
        }
        catch(ex){
          throw new Error('Error parsing base 64 data: '+ex);
        }
        strval = funcs.replaceURLs(rtag, strval, options, replaceURL);
        if(onReplace) strval = onReplace(strval);
        return Buffer.from(strval).toString('base64');
      });
    }

    if(options.replaceComponents){
      try{
        if(options.branchData && options.branchData.component_templates){
          parseAttribute(content, ['data-component'],function(val){
            var componentType = val;
            if(!(componentType in options.branchData.component_templates)){
              var err = new Error('Undefined component "' + componentType + '" used in page');
              if(options.onError) options.onError(err);
              else throw err;
            }
            return val;
          });
        }
        content = replaceBase64Attribute(content, 'data-component-data', options.onComponentData);
        content = replaceBase64Attribute(content, 'data-component-properties', options.onComponentProperties);
      }
      catch(ex){
        if(options.onError) options.onError(ex);
        else throw ex;
      }
    }

    return content;
  };

  exports.parseDeploymentUrl = function(url, template_variables, baseUrl){
    var rslt = funcs.replaceTemplateVariables(template_variables, url || '');
    try{
      if(baseUrl) rslt = new urlparser.URL(rslt, baseUrl).toString();
    }
    catch(ex){ /* Do nothing */ }
    return rslt;
  };

  exports.replacePageContent = function(page, options, replaceFunc){ /* replaceFunc: function(content){ return newContent; } */
    options = _.extend({ isRaw: false, replaceHeaderFooterCSS: true }, options);
    if(options.isRaw) {
      if(page.content && page.content.body) page.content.body = replaceFunc(page.content.body);
    }
    else {
      if(page.content) for(var key in page.content){ page.content[key] = replaceFunc(page.content[key]); }
      if(options.replaceHeaderFooterCSS){
        _.each(['css','header','footer'], function(key){
          if(page[key]) page[key] = replaceFunc(page[key]);
        });
      }
    }
  };

  exports.localizePageURLs = function(page, baseurl, isRaw, branch_id, media_files){

    function replaceURLs(content, options){
      var rslt = funcs.replaceBranchURLs(content, _.extend({ replaceComponents: true }, options, {
        getMediaURL: function(media_key, thumbnail_id, branchData, getLinkContent, urlparts){
          if(!media_files){
            return baseurl + urlparts.pathname.substr(1) + '#@JSHCMS';
          }
          return baseurl+'_funcs/media/'+media_key+(thumbnail_id?'/'+thumbnail_id:'')+'/?media_id='+media_files[media_key].media_id+'#@JSHCMS';
        },
        getPageURL: function(page_key, branchData, getLinkContent, urlparts){
          if(branch_id) return baseurl+'_funcs/page/'+page_key+'/?branch_id='+branch_id+'&view=1#@JSHCMS';
          return baseurl+'_funcs/page/'+page_key+'/#@JSHCMS';
        }
      }));
      return rslt;
    }

    funcs.replacePageContent(page, { isRaw: isRaw }, function(content){
      return replaceURLs(content);
    });
  };

  exports.page = function (req, res, next) {
    var verb = req.method.toLowerCase();

    var Q = req.query;
    var P = req.body;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var XValidate = jsh.XValidate;
    var sql = '';
    var sql_ptypes = [];
    var sql_params = {};
    var verrors = {};
    var dbtypes = appsrv.DB.types;
    var validate = null;
    var model = jsh.getModel(req, module.namespace + 'Page_Editor');

    if(!req.params || !req.params.page_key) return next();
    var page_key = req.params.page_key;

    var validateKeys = (verb == 'get') ?
      { page_template_id: Q.page_template_id } :
      { page_key: req.params.page_key, page_id: Q.page_id, page_template_id: Q.page_template_id };

    funcs.validateClientToken(req, res, next, ['get','post'], validateKeys, function(){
      if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

      //Get page
      sql_ptypes = [dbtypes.BigInt];
      sql_params = { 'page_key': page_key };
      validate = new XValidate();
      verrors = {};
      validate.AddValidator('_obj.page_key', 'Page Key', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      sql = 'select page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_seo_keywords,page_review_sts,page_lang';

      if(Q.page_id && Q.branch_id){
        sql_ptypes.push(dbtypes.BigInt);
        sql_params.page_id = Q.page_id;
        validate.AddValidator('_obj.page_id', 'Page ID', 'B', [XValidate._v_IsNumeric()]);
        sql_ptypes.push(dbtypes.BigInt);
        sql_params.branch_id = Q.branch_id;
        validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric()]);
        sql += ',@branch_id branch_id from {schema}.page where page_key=@page_key and page_id=@page_id and site_id={schema}.my_current_site_id()';
      }
      else if(Q.branch_id && Q.view){
        sql_ptypes.push(dbtypes.BigInt);
        sql_params.branch_id = Q.branch_id;
        validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric()]);
        sql += ',branch_id from (select page.*,branch_page.branch_id from {schema}.page inner join {schema}.branch_page on branch_page.branch_id=@branch_id and branch_page.page_id=page.page_id where page.page_key=@page_key and site_id={schema}.my_current_site_id()) page';
      }
      else if(Q.page_id) return Helper.GenError(req, res, -4, 'Invalid parameters - missing branch_id');
      else{
        sql += ',(select {schema}.my_current_branch_id()) branch_id';
        sql += ' from {schema}.v_my_page where page_key=@page_key';
      }

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

      appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
        if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
        if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){
          if(Q.page_id || Q.view) return Helper.GenError(req, res, -4, 'Page not found in revision');
          return Helper.GenError(req, res, -4, 'Page not found in current site revision');
        }
        var page = rslt[0][0];

        var baseurl = req.baseurl;
        if(baseurl.indexOf('//')<0) baseurl = req.protocol + '://' + req.get('host') + baseurl;

        if(!Q.page_id){
          if(Q.branch_id){
            if(Q.branch_id.toString()!=(page.branch_id||'').toString()){ return Helper.GenError(req, res, -4, 'Please close and reopen editor.  The revision has changed.'); }
          }
          if(Q.page_template_id){
            if(Q.page_template_id.toString()!=(page.page_template_id||'').toString()){ return Helper.GenError(req, res, -4, 'Please close and reopen editor.  The template has changed.'); }
          }
        }

        if (verb == 'get'){
          if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

          //Validate parameters
          if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
          if (!appsrv.ParamCheck('Q', Q, ['|page_id','|branch_id','|page_template_id','|view','|jshcms_token'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

          var authors = null;
          var clientPage = null;
          var media_files = {};
          var sitemaps = {};
          var menus = {};
          var site_id = null;
          var branch_id = page.branch_id;

          if(!branch_id){ return Helper.GenError(req, res, -4, 'Invalid Parameters'); }

          async.waterfall([

            //Get site
            function(cb){
              sql = "select v_my_branch_access.branch_id,branch_name,site_id from {schema}.v_my_branch_access inner join {schema}.branch_page on branch_page.branch_id=v_my_branch_access.branch_id where v_my_branch_access.branch_id=@branch_id and branch_access like 'R%' and (branch_page.page_key=(select page_key from {schema}.page where page_id=@page_id))";
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt,dbtypes.BigInt], { page_id: page.page_id, branch_id: branch_id }, function (err, rslt) {
                if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
                if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length){ return Helper.GenError(req, res, -12, 'Could not access Site Revision or Page'); }
                site_id = rslt[0][0].site_id;
                return cb();
              });
            },

            //Get authors
            function(cb){
              if(Helper.HasRole(req, 'PUBLISHER')){
                sql = "select sys_user_id code_val,concat(sys_user_fname,' ',sys_user_lname) code_txt from jsharmony.sys_user where sys_user_id in (select sys_user_id from {schema}.v_sys_user_site_access where site_id=@site_id and sys_user_site_access in ('WEBMASTER','PUBLISHER','AUTHOR')) order by code_txt";
              }
              else {
                sql = "select sys_user_id code_val,concat(sys_user_fname,' ',sys_user_lname) code_txt from jsharmony.sys_user where sys_user_id = (select page_author from "+(module.schema?module.schema+'.':'')+'page where page_id=@page_id) order by code_txt';
              }

              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt, dbtypes.BigInt], { page_id: page.page_id, site_id: site_id }, function (err, rslt) {
                if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
                if(!rslt || !rslt.length || !rslt[0]){ return Helper.GenError(req, res, -4, 'Invalid Page ID'); }
                authors = rslt[0];
                return cb();
              });
            },

            //Get media
            function(cb){
              var sql = 'select media.media_key, media.media_id, media_file_id from {schema}.media inner join {schema}.branch_media on branch_media.branch_id=@branch_id and branch_media.media_id=media.media_id where (media_file_id is not null) and (media_is_folder = 0)';
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], {branch_id: branch_id}, function (err, rslt) {
                if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
                if(!rslt || !rslt.length || !rslt[0]){ return cb(); }
                _.each(rslt[0], function(media){
                  media_files[media.media_key] = media;
                });
                return cb();
              });
            },

            //Get sitemaps
            function(cb){
              var sql = 'select sitemap.sitemap_key, sitemap_file_id, sitemap_type from {schema}.sitemap inner join {schema}.branch_sitemap on branch_sitemap.branch_id=@branch_id and branch_sitemap.sitemap_id=sitemap.sitemap_id where (sitemap_file_id is not null)';
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], {branch_id: branch_id}, function (err, rslt) {
                if (err != null) { err.sql = sql; err.model = model; return cb(err); }
                if(!rslt || !rslt.length || !rslt[0]){ return cb(); }
                _.each(rslt[0], function(sitemap){
                  sitemaps[sitemap.sitemap_type] = sitemap;
                });
                async.eachOfSeries(sitemaps, function(sitemap, sitemap_type, sitemap_cb){
                  funcs.getClientSitemap(sitemap, function(err, sitemap_content){
                    if(err) return sitemap_cb(err);
                    if(!sitemap_content) return sitemap_cb(null);
                    sitemap.sitemap_items = sitemap_content.sitemap_items;
                    return sitemap_cb();
                  });
                }, cb);
              });
            },

            //Get menus
            function(cb){
              var sql = 'select menu.menu_key, menu_file_id, menu_name, menu_tag from {schema}.menu inner join {schema}.branch_menu on branch_menu.branch_id=@branch_id and branch_menu.menu_id=menu.menu_id where (menu_file_id is not null)';
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], {branch_id: branch_id}, function (err, rslt) {
                if (err != null) { err.sql = sql; err.model = model; return cb(err); }
                if(!rslt || !rslt.length || !rslt[0]){ return cb(); }
                _.each(rslt[0], function(menu){
                  menus[menu.menu_tag] = menu;
                });
                async.eachOfSeries(menus, function(menu, menu_tag, menu_cb){
                  funcs.getClientMenu(menu, function(err, menu_content){
                    if(err) return menu_cb(err);
                    if(!menu_content) return menu_cb(null);
                    menu.menu_items = menu_content.menu_items;

                    return menu_cb();
                  });
                }, cb);
              });
            },

            //Get page
            function(cb){

              funcs.getClientPage(req._DBContext, page, sitemaps, site_id, { includeExtraRemoteContent: true }, function(err, _clientPage){
                if(err) { Helper.GenError(req, res, -9, err.toString()); return; }
                clientPage = _clientPage;
                if(!clientPage.page.content || _.isString(clientPage.page.content)) { Helper.GenError(req, res, -99999, 'page.content must be a data structure'); return; }
                funcs.localizePageURLs(clientPage.page, baseurl, !!clientPage.template.raw, ((Q.page_id || Q.view) ? branch_id : undefined), media_files);
                return cb();
              });
            }
          ], function(err){
            if(err){ Helper.GenError(req, res, -9, err.toString()); return; }

            res.type('json');
            res.end(JSON.stringify({
              _success: 1,
              page: clientPage.page,
              template: clientPage.template,
              sitemap: clientPage.sitemap,
              menus: menus,
              authors: authors,
              role: page_role,
              views: {
                'jsh_cms_editor.css': (jsh.getEJS('jsh_cms_editor.css')||'')+(jsh.getEJS('jsh_cms_editor.css.ext')||''),
                'jsh_cms_editor': jsh.getEJS('jsh_cms_editor')
              }
            }));
          });
        }
        else if(verb == 'post'){
          if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }
          /*
            var client_page = {
              title: page.page_title||'',
              css: page_file.css||'',
              header: page_file.header||'',
              footer: page_file.footer||'',
              properties: page_file.properties||{},
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
          if(!('properties' in P)) P.properties = {};
          if (!appsrv.ParamCheck('P', P, ['&title','&css','&header','&footer','&properties','&content','&seo','&lang','&tags','&author','|page_template_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
          if (!appsrv.ParamCheck('Q', Q, ['|branch_id','|page_template_id','|jshcms_token'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

          //XValidate
          var client_page = P;
          P.page_template_id = page.page_template_id;
          validate = new XValidate();
          verrors = {};
          validate.AddValidator('_obj.title', 'Title', 'B', [XValidate._v_MaxLength(1024)]);
          validate.AddValidator('_obj.css', 'CSS', 'B', []);
          validate.AddValidator('_obj.header', 'Header', 'B', []);
          validate.AddValidator('_obj.footer', 'Footer', 'B', []);
          validate.AddValidator('_obj.properties', 'Properties', 'B', []);
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
            page_seo_keywords: client_page.seo.keywords,
            page_lang: client_page.lang
          };
          sql = 'update '+(module.schema?module.schema+'.':'')+'v_my_page set page_file_id=null,'+_.map(sql_params, function(val, key){ return key + '=@' + key; }).join(',')+' where page_key=@page_key;';
          sql += 'select page_file_id, page_path, page_folder from '+(module.schema?module.schema+'.':'')+'v_my_page where page_key=@page_key;';
          sql_params.page_key = page_key;

          fields = [];
          datalockstr = '';
          verrors = {};
          appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
          sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
          if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

          //Run updates in a transaction
          var db = jsh.getDB('default');
          var dbtasks = {};

          //Create new branch (test error on duplicate, etc)
          dbtasks['page_create'] = function (dbtrans, db_callback, transtbl) {
            db.Recordset(req._DBContext, sql, sql_ptypes, sql_params, dbtrans, function (err, rslt) {
              if (err != null) { err.sql = sql; return db_callback(err); }
              if(!rslt || !rslt.length || !rslt[0]) return db_callback(new Error('Invalid database result'));

              page.page_file_id = rslt[0].page_file_id;
              page.page_folder = rslt[0].page_folder;
              
              return db_callback();
            });
          };

          funcs.getSiteConfig(req._DBContext, null, { continueOnConfigError: true }, function(err, siteConfig){
            var mediaId = 1;
            funcs.replacePasteImages(req._DBContext, db, dbtasks, function(){ return 'page_media_'+(mediaId++); }, baseurl, siteConfig, client_page, funcs.replacePageContent);

            db.ExecTransTasks(dbtasks, function (err, rslt) {
              if (err != null) { return appsrv.AppDBError(req, res, err); }

              //Write file
              fs.writeFile(funcs.getPageFile(page.page_file_id), JSON.stringify(client_page), 'utf8', function(err){
                if(err) return Helper.GenError(req, res, -99999, err.toString());
                res.type('json');
                res.end(JSON.stringify({ '_success': 1, page_folder: page.page_folder }));
              });
            });
          });
          return;
        }
        else return Helper.GenError(req, res, -4, 'Invalid Operation');
      });
    });
  };

  exports.pageDev = function (req, res, next) {
    var verb = req.method.toLowerCase();

    var Q = req.query;
    var P = req.body;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var XValidate = jsh.XValidate;
    var sql = '';
    var sql_ptypes = [];
    var sql_params = {};
    var verrors = {};
    var validate = null;
    var model = jsh.getModel(req, module.namespace + 'Page_Editor');

    funcs.validateClientToken(req, res, next, ['get'], { page_template_id: Q.page_template_id }, function(){
      if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

      //Get Branch ID
      sql_ptypes = [];
      sql_params = { };
      validate = new XValidate();
      verrors = {};
      sql = 'select {schema}.my_current_branch_id() branch_id, {schema}.my_current_site_id() site_id';

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

      appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
        if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
        if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -9, 'Please checkout a site to use Dev Mode'); }

        var devInfo = rslt[0][0];

        if (verb == 'get'){
          if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

          //Validate parameters
          if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
          if (!appsrv.ParamCheck('Q', Q, ['|page_template_id','|jshcms_token'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

          var menus = {};
          var page_template = {};

          async.waterfall([

            //Get menus
            function(cb){
              appsrv.ExecRecordset(req._DBContext, 'select menu_key, menu_file_id, menu_name, menu_tag from '+(module.schema?module.schema+'.':'')+'v_my_menu where (menu_file_id is not null)', [], {}, function (err, rslt) {
                if (err != null) { err.sql = sql; err.model = model; return cb(err); }
                if(!rslt || !rslt.length || !rslt[0]){ return cb(); }
                _.each(rslt[0], function(menu){
                  menus[menu.menu_tag] = menu;
                });
                async.eachOfSeries(menus, function(menu, menu_tag, menu_cb){
                  funcs.getClientMenu(menu, function(err, menu_content){
                    if(err) return menu_cb(err);
                    if(!menu_content) return menu_cb(null);
                    menu.menu_items = menu_content.menu_items;

                    return menu_cb();
                  });
                }, cb);
              });
            },

            //Get page template
            function(cb){
              if(!Q.page_template_id) return cb();
              funcs.getPageTemplate(req._DBContext, devInfo.site_id, Q.page_template_id, {}, function(err, template){
                if(err) return cb(err);
                if (!template) return cb();
                page_template = template;
                return cb();
              });
            },

          ], function(err){
            if(err){ Helper.GenError(req, res, -9, err.toString()); return; }

            res.type('json');
            res.end(JSON.stringify({
              '_success': 1,
              'branch_id': devInfo.branch_id,
              'site_id': devInfo.site_id,
              'sitemap': funcs.getSampleSitemap(),
              'menus': menus,
              'role': page_role,
              'template': page_template,
              'views': {
                'jsh_cms_editor.css': (jsh.getEJS('jsh_cms_editor.css')||'')+(jsh.getEJS('jsh_cms_editor.css.ext')||''),
                'jsh_cms_editor': jsh.getEJS('jsh_cms_editor')
              }
            }));
          });
        }
        else return Helper.GenError(req, res, -4, 'Invalid Operation');
      });
    });
  };

  exports.getPageEditorUrl = function(req, res, next){
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var cms = module;
    var dbtypes = appsrv.DB.types;
    var XValidate = jsh.XValidate;

    var model = jsh.getModel(req, module.namespace + 'Page_Tree');

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

    //Validate parameters
    if (!appsrv.ParamCheck('Q', Q, ['&page_template_id', '|page_key', '|page_id', '|branch_id', '|devMode', '|site_id', '|render', '|page_template_path'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

    var validate = new XValidate();
    var verrors = {};
    validate.AddValidator('_obj.page_template_id', 'Page Template ID', 'B', [ XValidate._v_Required(), XValidate._v_MaxLength(255) ]);
    validate.AddValidator('_obj.page_key', 'Page Key', 'B', [ XValidate._v_IsNumeric() ]);
    validate.AddValidator('_obj.page_id', 'Page ID', 'B', [ XValidate._v_IsNumeric() ]);
    validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [ XValidate._v_IsNumeric() ]);
    validate.AddValidator('_obj.site_id', 'Site ID', 'B', [ XValidate._v_IsNumeric() ]);
    verrors = _.merge(verrors, validate.Validate('B', Q));
    if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

    //Only dev mode uses devMode and site_id parameters

    if (verb == 'get') {
      var sql = 'select site_id current_site_id,site_id,deployment_target_template_variables,deployment_target_id from {schema}.v_my_site where site_id={schema}.my_current_site_id()';
      var sql_ptypes = [];
      var sql_params = {};

      if(Q.devMode){
        if(!Q.site_id) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        sql = 'select {schema}.my_current_site_id() current_site_id,v_my_site.site_id,v_my_site.deployment_target_template_variables,deployment_target_publish_config,deployment_target.deployment_target_id from {schema}.v_my_site left outer join {schema}.deployment_target on deployment_target.deployment_target_id = v_my_site.deployment_target_id where v_my_site.site_id=@site_id';
        sql_ptypes = [dbtypes.BigInt];
        sql_params = { site_id: Q.site_id };
      }
      appsrv.ExecRow(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
        if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
        if (!rslt || !rslt.length || !rslt[0]) {
          if(Q.devMode) Helper.GenError(req, res, -1, 'Site not found');
          else Helper.GenError(req, res, -1, 'Site not checked out');
          return;
        }

        var site_id = rslt[0].site_id || null;
        var current_site_id = rslt[0].current_site_id || null;
        var deployment_target_template_variables_str = rslt[0].deployment_target_template_variables || '';
        var deployment_target_publish_config = {};
        try{
          deployment_target_publish_config = funcs.parseDeploymentTargetPublishConfig(site_id, rslt[0].deployment_target_publish_config, 'publish');
        }
        catch(ex){
          return Helper.GenError(req, res, -99999, ex.toString());
        }
        var deployment_target_id = rslt[0].deployment_target_id;

        if(!site_id) { Helper.GenError(req, res, -1, 'Site not found'); return; }

        funcs.getPageTemplate(req._DBContext, site_id, Q.page_template_id, { continueOnConfigError: true }, function(err, page_template){
          if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }
          if (!page_template) { Helper.GenError(req, res, -9, 'Page Template not found'); return; }

          if(page_template.raw){
            res.type('json');
            return res.end(JSON.stringify({ '_success': 1, raw: true }));
          }

          var url = '';
          if(page_template.location == 'LOCAL'){
            if(!cms.PreviewServer) return Helper.GenError(req, res, -9, 'LOCAL Templates require a Preview Server to be running.  Set configCMS.preview_server.enabled = true in app.config.js');
            url = cms.PreviewServer.getURL((req.headers.host||'').split(':')[0]) + page_template.path;
            //Generate an error if the preview server revision is not checked out
            if(current_site_id != site_id) return Helper.GenError(req, res, -9, 'Please checkout this site to preview the template');
          }
          if(page_template.standalone && Q.page_template_path){
            url = Q.page_template_path;
          }
          if(page_template.remote_templates && page_template.remote_templates.editor) {
            url = page_template.remote_templates.editor;
          }

          var deployment_target_template_variables = {
            branch_id: (Q.branch_id||'')
          };

          if(deployment_target_template_variables_str){
            try{
              deployment_target_template_variables = _.extend(deployment_target_template_variables, JSON.parse(deployment_target_template_variables_str));
            }
            catch(ex){
              Helper.GenError(req, res, -9, 'Error reading deployment_target_template_variables.  Please make sure the JSON syntax is correct');
              return;
            }
          }

          deployment_target_template_variables = _.extend(deployment_target_template_variables, {
            page_template_id: Q.page_template_id,
            page_key: (Q.page_key||''),
            page_id: (Q.page_id||'')
          });

          funcs.parseTemplateVariables('editor', req._DBContext, site_id, undefined, deployment_target_template_variables, deployment_target_publish_config, function(err, template_variables){
            if(err){ Helper.GenError(req, res, -99999, err.toString()); return; }

            if(!url){
              if(page_template.templates && page_template.templates.editor){
                //Return full page
                if(Q.render){
                  var cmsBaseUrl = cms.getCmsBaseUrlFromReq(req);
                  var content = '';
                  try{
                    content = funcs.generateEditorTemplate(page_template.templates.editor, { cmsBaseUrl: cmsBaseUrl, template_variables: template_variables });
                  }
                  catch(ex){
                    res.end('Error loading template: '+ex.toString());
                    return;
                  }
                  return res.end(content);
                }
                //Append render=1 to current URL
                url = req.protocol + '://' + req.get('host') + req.originalUrl + '&render=1';
                res.type('json');
                return res.end(JSON.stringify({ '_success': 1, editor: url }));
              }
              else return Helper.GenError(req, res, -9, 'Page Template does not have an editor defined');
            }

            funcs.genClientToken(req, template_variables.timestamp, _.pick(template_variables, ['page_id','page_key','page_template_id']), function(err, jshcms_client_token){
              if(err){ Helper.GenError(req, res, -99999, err.toString()); return; }

              url = funcs.parseDeploymentUrl(url, template_variables);

              //Read URL and querystring
              var parsedUrl = null;
              try{
                parsedUrl = new urlparser.URL(url, req.protocol + '://' + req.get('host'));
                template_variables._ = template_variables.timestamp;
                if(Q.devMode) template_variables.page_template_location = page_template.location;
                var changedUrl = false;
                //Add any missing items to the querystring
                _.each(['branch_id','page_id','page_key','page_template_id','_','page_template_location'], function(key){
                  if(parsedUrl.searchParams.has(key)) return;
                  if(template_variables[key]){
                    parsedUrl.searchParams.set(key, template_variables[key]);
                    changedUrl = true;
                  }
                });
                if(Q.devMode){
                  _.each(['branch_id','page_id','page_key'], function(key){
                    if(parsedUrl.searchParams.has(key)){
                      parsedUrl.searchParams.delete(key);
                      changedUrl = true;
                    }
                  });
                }

                //Add token
                parsedUrl.searchParams.set('jshcms_token', jshcms_client_token);
                changedUrl = true;

                if(changedUrl) url = parsedUrl.toString();
              }
              catch(ex){
                jsh.Log.error(ex);
                return Helper.GenError(req, res, -9, 'Error parsing Editor URL: '+url);
              }

              Helper.execif(deployment_target_id || page_template.standalone,
                function(next){
                  //Throw error if no deployment_target_id selected
                  if(!deployment_target_id) return Helper.GenError(req, res, -9, 'Editing a Standalone template requires a Deployment Target to be defined.  Configure Deployment Target in the Sites tab.');
                  
                  //Get Access Key
                  var jshcms_url = cms.getCmsBaseUrlFromReq(req);
                  cms.funcs.getAccessKey(req._DBContext, deployment_target_id, jshcms_url, { timestamp: template_variables.timestamp }, function(err, jshcms_access_key){
                    if(err) return Helper.GenError(req, res, -99999, err.toString());

                    parsedUrl.searchParams.set('jshcms_url', jshcms_url);
                    parsedUrl.searchParams.set('jshcms_access_key', jshcms_access_key);
                    url = parsedUrl.toString();
                    return next();
                  });
                },
                function(){
                  res.type('json');
                  res.end(JSON.stringify({ '_success': 1, editor: url }));
                }
              );
            });
          });
        });
      });
      return;
    }
    return next();
  };

  exports.genClientToken = function(req, timestamp, keys, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var jshcms_client_token = '';
    var sys_user_token_ext = null;

    var sys_user_token_keys = JSON.stringify(keys);
    if(sys_user_token_keys.length > 1024) return callback(new Error('Key length cannot exceed 1KB'));

    var insert_success = false;
    
    async.until(function(){ return insert_success; }, function(insert_cb){
      //Generate token
      var base_token = (req.user_id||'').toString() + '-' + (timestamp||(new Date())).toString() + '-' + _.map(keys, function(val){ return(val||'').toString(); }).join('-') + '-' + (sys_user_token_ext||'').toString();
      jshcms_client_token = crypto.createHash('sha256').update(base_token + '-' + jsh.Config.frontsalt).digest('hex');

      //Write to database
      var sql = '{schema}.insert_token(@sys_user_token_hash,@sys_user_token_ext,@sys_user_token_keys)';
      var sql_ptypes = [dbtypes.NVarChar(256),dbtypes.NVarChar(32),dbtypes.NVarChar(1024)];
      var sql_params = { sys_user_token_hash: jshcms_client_token, sys_user_token_ext: (sys_user_token_ext||'').toString(), sys_user_token_keys: sys_user_token_keys };
      appsrv.ExecMultiRecordset(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
        if(err) return insert_cb(err);
        if(rslt && rslt.length && rslt[0] && rslt[0].length && rslt[0][0] && rslt[0][0].length && rslt[0][0][0].token_collision){
          //Hash collision
          sys_user_token_ext = (Math.round(Math.random()*10000000000)).toString();
          return insert_cb();
        }
        insert_success = true;
        return insert_cb();
      });
    }, function(err){
      if(err) return callback(err);
      return callback(null, jshcms_client_token);
    });
  };

  exports.validateClientToken = function(req, res, next, verbs, keys, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var Q = req.query || {};
    var verb = req.method.toLowerCase();

    if(!_.includes(verbs, verb)) return next();

    //If token not passed in querystring, return
    if(!Q.jshcms_token) return callback();

    var jshcms_client_token = Q.jshcms_token.toString();

    var sql = 'jsHarmonyCMS_validate_token';
    var sql_ptypes = [dbtypes.NVarChar(256)];
    var sql_params = { sys_user_token_hash: jshcms_client_token };
    appsrv.ExecRow(req._DBContext||'token', funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if(err){ err.sql = sql; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt.length || !rslt[0] || !rslt[0].sys_user_token_hash) return Helper.GenError(req, res, -10, 'Session timed out.  Any unsaved changes will be lost.');
      var sys_user_token_keys = rslt[0].sys_user_token_keys;
      var token_keys = {};
      try{
        if(sys_user_token_keys) token_keys = JSON.parse(sys_user_token_keys) || {};
      }
      catch(ex){
        if(ex) return Helper.GenError(req, res, -99999, ex.toString());
      }
      //Validate keys
      for(var key in keys){
        if(typeof keys[key] != 'undefined'){
          if(token_keys[key] !== keys[key]) return Helper.GenError(req, res, -11, 'Session token not authorized to perform this operation.');
        }
      }

      var referer = req.get('Referer');
      if(referer){
        var urlparts = urlparser.parse(referer, true);
        var remote_domain = urlparts.protocol + '//' + (urlparts.auth?urlparts.auth+'@':'') + urlparts.hostname + (urlparts.port?':'+urlparts.port:'');
        res.setHeader('Access-Control-Allow-Origin', remote_domain);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With, Content-Type, Accept');
        res.setHeader('Access-Control-Allow-Credentials', true);
      }

      return callback();
    });
  };

  exports.getPageSiteConfig = function(req, res, next){
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var cms = module;
    var dbtypes = appsrv.DB.types;
    var XValidate = jsh.XValidate;

    var model = jsh.getModel(req, module.namespace + 'Page_Tree');

    funcs.validateClientToken(req, res, next, ['get'], { }, function(){
      if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }
      
      //Validate parameters
      if (!appsrv.ParamCheck('Q', Q, ['|site_id','|jshcms_token'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.site_id', 'Site ID', 'B', [ XValidate._v_IsNumeric() ]);
      verrors = _.merge(verrors, validate.Validate('B', Q));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      //Only dev mode uses devMode and site_id parameters

      if (verb == 'get') {
        var sql = 'select site_id from {schema}.v_my_site where site_id={schema}.my_current_site_id()';
        var sql_ptypes = [];
        var sql_params = {};

        if(Q.devMode){
          if(!Q.site_id) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
          sql = 'select site_id from {schema}.v_my_site where site_id=@site_id';
          sql_ptypes = [dbtypes.BigInt];
          sql_params = { site_id: Q.site_id };
        }
        appsrv.ExecRow(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
          if (!rslt || !rslt.length || !rslt[0]) {
            if(Q.devMode) Helper.GenError(req, res, -1, 'Site not found');
            else Helper.GenError(req, res, -1, 'Site not checked out');
            return;
          }

          var site_id = rslt[0].site_id || null;

          if(!site_id) { Helper.GenError(req, res, -1, 'Site not found'); return; }

          funcs.getSiteConfig(req._DBContext, site_id, { continueOnConfigError: true }, function(err, siteConfig){
            if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }
            if(!siteConfig) siteConfig = {};
            var pageSiteConfig = {
              defaultEditorConfig: siteConfig.defaultEditorConfig||{},
              media_thumbnails: {},
            };
            if(typeof pageSiteConfig.defaultEditorConfig.webSnippetsPath == 'undefined'){
              if(cms.PreviewServer){
                var webSnippetPath = cms.PreviewServer.getURL((req.headers.host||'').split(':')[0]) + '/templates/websnippets/';
                if(Q.jshcms_token) webSnippetPath += '?' + querystring.stringify({ jshcms_token: Q.jshcms_token });
                pageSiteConfig.defaultEditorConfig.webSnippetsPath = webSnippetPath;
              }
            }
            _.each(siteConfig.media_thumbnails, function(thumbnail_config, thumbnail_id){
              if(!thumbnail_config || !thumbnail_config.export) return;
              pageSiteConfig.media_thumbnails[thumbnail_id] = true;
            });
            res.type('json');
            res.end(JSON.stringify({ '_success': 1, siteConfig: pageSiteConfig }));
          });
        });
        return;
      }
      return Helper.GenError(req, res, -4, 'Invalid Operation');
    });
  };

  return exports;
};
