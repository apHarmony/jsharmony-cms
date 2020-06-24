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

  exports.getClientPage = function(page, sitemaps, cb){
    var appsrv = this;

    var page_file_id = page.page_file_id;
    var page_template_id = page.page_template_id;
    if(!page_template_id) page_template_id = module.defaultPageTemplate;
    var template = module.PageTemplates[page_template_id];

    if(!template) return cb(new Error('Invalid page template: '+page_template_id));

    //Load Page Content from disk
    module.jsh.ParseJSON(funcs.getPageFile(page_file_id), module.name, 'Page File ID#'+page_file_id, function(err, page_file){
      //If an error occurs loading the file, ignore it and load the default template instead

      var page_file_content = {};
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
        template: client_template,
        sitemap: funcs.getPageSitemapInfo(sitemaps, page.page_key)
      });
    });
  }

  exports.getPageSitemapInfo = function(sitemaps, page_key){
    if(!sitemaps || !sitemaps.PRIMARY || !page_key) return {};
    var sitemap = sitemaps.PRIMARY;
    var sitemap_items = sitemap.sitemap_items || [];
    page_key = page_key.toString();

    function parseSitemapBool(val){
      if(typeof val == 'undefined') return false;
      if(val === '1') return true;
      if(val === true) return true;
      return false;
    }

    var sitemap_items_by_id = {};
    for(var i=0;i<sitemap_items.length;i++){
      var sitemap_item = sitemap_items[i];
      sitemap_item.sitemap_item_id = (sitemap_item.sitemap_item_id||'').toString();
      sitemap_item.sitemap_item_link_dest = (sitemap_item.sitemap_item_link_dest||'').toString();
      sitemap_item.sitemap_item_parent_id = (sitemap_item.sitemap_item_parent_id||'').toString();
      sitemap_items_by_id[sitemap_item.sitemap_item_id.toString()] = sitemap_item;
      sitemap_item.sitemap_item_exclude_from_breadcrumbs = parseSitemapBool(sitemap_item.sitemap_item_exclude_from_breadcrumbs);
      sitemap_item.sitemap_item_exclude_from_parent_menu = parseSitemapBool(sitemap_item.sitemap_item_exclude_from_parent_menu);
      sitemap_item.sitemap_item_hide_menu_parents = parseSitemapBool(sitemap_item.sitemap_item_hide_menu_parents);
      sitemap_item.sitemap_item_hide_menu_siblings = parseSitemapBool(sitemap_item.sitemap_item_hide_menu_siblings);
      sitemap_item.sitemap_item_hide_menu_children = parseSitemapBool(sitemap_item.sitemap_item_hide_menu_children);
    }

    function getParents(sitemap_item){
      var rslt = [];
      var curParent = sitemap_items_by_id[sitemap_item.sitemap_item_parent_id];
      while(curParent){
        curParent.sitemap_item_siblings = [];
        rslt.unshift(curParent);
        curParent = sitemap_items_by_id[curParent.sitemap_item_parent_id];
      }
      return rslt;
    }

    //Get sitemap item
    var item = null;
    var matching_items = [];
    for(var i=0;i<sitemap_items.length;i++){
      var sitemap_item = sitemap_items[i];
      if((sitemap_item.sitemap_item_link_type=='PAGE') && (sitemap_item.sitemap_item_link_dest==page_key)){ matching_items.push(sitemap_item); }
    }
    if(matching_items.length == 1) item = matching_items[0];
    else if(matching_items.length > 1){
      var matching_items_hierarchy = [];
      for(var i=0;i<matching_items.length;i++){
        var sitemap_item_parents = getParents(matching_items[i]);
        var sitemap_item_hierarchy = [matching_items[i].sitemap_item_id];
        _.each(sitemap_item_parents, function(parent){ sitemap_item_hierarchy.push(parent.sitemap_item_id); });
        matching_items_hierarchy.push(sitemap_item_hierarchy);
      }
      while(
          (matching_items.length > 1) &&
          (matching_items[1].sitemap_item_parent_id && _.includes(matching_items_hierarchy[0], matching_items[1].sitemap_item_parent_id))
        ){ matching_items.shift(); matching_items_hierarchy.shift(); }
      item = matching_items[0];
    }

    var parents = null;
    var children = null;
    if(item){
      item.sitemap_item_siblings = [];
      //Get parents
      parents = getParents(item);

      children = [];
      for(var i=0;i<sitemap_items.length;i++){
        var sitemap_item = sitemap_items[i];

        //Get children
        if(sitemap_item.sitemap_item_parent_id==item.sitemap_item_id){ children.push(sitemap_item); }

        function parseSibling(sitemap_item){
          sitemap_item = _.clone(sitemap_item);
          delete sitemap_item.sitemap_item_siblings;
          return sitemap_item;
        }

        //Get siblings
        if(!sitemap_item.sitemap_item_exclude_from_parent_menu && (sitemap_item.sitemap_item_parent_id==item.sitemap_item_parent_id)){ item.sitemap_item_siblings.push(parseSibling(sitemap_item)); }
        for(var j=0;j<parents.length;j++){
          if(!sitemap_item.sitemap_item_exclude_from_parent_menu && (sitemap_item.sitemap_item_parent_id==parents[j].sitemap_item_parent_id)){ parents[j].sitemap_item_siblings.push(parseSibling(sitemap_item)); }
        }
      }

      if(item.sitemap_item_hide_menu_children) children = [];
      if(item.sitemap_item_hide_menu_siblings || !item.sitemap_item_siblings.length) item.sitemap_item_siblings = [parseSibling(item)];
      for(var i=0;i<parents.length;i++){
        var parent = parents[i];
        if(parent.sitemap_item_hide_menu_siblings || !parent.sitemap_item_siblings.length) parent.sitemap_item_siblings = [parseSibling(parent)];
      }
      if(item.sitemap_item_hide_menu_parents) parents = [];
      for(var i=parents.length-1;i>=0;i--){
        var parent = parents[i];
        if(parent.sitemap_item_hide_menu_parents){
          parents.splice(0, i);
          break;
        }
      }

    }

    var rslt = {
      item: item,
      parents: parents,
      children: children
    };
    return rslt;
  }

  exports.replaceBranchURLs = function(content, options){
    options = _.extend({
      getMediaURL: function(media_key, branchData, getLinkContent){ return ''; },
      getPageURL: function(page_key, branchData, getLinkContent){ return ''; },
      onError: function(err){ },
      removeClass: false,
      HTMLParser: false,
      branchData: {}
    }, options);

    function replaceURL(url, getLinkContent){
      if(!url) return url;
      if(module.Config.onReplaceBranchURL){
        var customURL = module.Config.onReplaceBranchURL(url, options.branchData, getLinkContent, options);
        if(typeof customURL != 'undefined') return customURL;
      }
      var urlparts = urlparser.parse(url, true);
      if(!urlparts.path) return url;
      var patharr = (urlparts.path||'').split('/');

      if((urlparts.path.indexOf('/_funcs/media/')==0) && (patharr.length>=4)){
        var media_key = patharr[3];
        if(parseInt(media_key).toString()==media_key){
          try{
            var media_url = options.getMediaURL(media_key, options.branchData, getLinkContent);
          }
          catch(ex){
            if(options.onError) options.onError(ex);
            else throw ex;
            return '';
          }
          return media_url;
        }
      }
      if((urlparts.path.indexOf('/_funcs/page/')==0) && (patharr.length>=4)){
        var page_key = patharr[3];
        if(parseInt(page_key).toString()==page_key){
          try{
            var page_url = options.getPageURL(page_key, options.branchData, getLinkContent);
          }
          catch(ex){
            if(options.onError) options.onError(ex);
            else throw ex;
            return '';
          }
          return page_url;
        }
      }

      return url;
    }

    function parseURLs(jobj,prop){
      if(jobj.attr('data-cke-saved-'+prop)) jobj.attr('data-cke-saved-'+prop, null);
      if(jobj.hasClass('cms-no-replace-url')) return;
      var url = jobj.attr(prop);
      var newURL = replaceURL(url, function(){ return jobj.html(); });
      if(newURL && (newURL!=url)) jobj.attr(prop, newURL);
    }

    if(options.HTMLParser){
      var $ = cheerio.load(content, { xmlMode: true });
      $('a').each(function(obj_i,obj){
        parseURLs($(obj),'href');
      });
      $('img').each(function(obj_i,obj){
        parseURLs($(obj),'src');
      });
      //Prevent auto-closing HTML elements
      $('div,iframe,span,script').filter(function(idx,elem){ return !elem.children.length; }).text('');

      content = $.html();
    }

    var rtag = '#@JSHCMS';
    var rtagidx = content.indexOf(rtag);
    while(rtagidx >= 0){
      var startofstr = rtagidx;
      var endofstr = rtagidx;
      var urlchar = /[a-zA-Z0-9\/_#\-:=?@%&]/;
      do{ if(!urlchar.test(content[startofstr])) break; } while(--startofstr >= 0);
      do{ if(!urlchar.test(content[endofstr])) break; } while(++endofstr < content.length);
      startofstr++;
      endofstr--;
      var url = content.substr(startofstr, endofstr - startofstr + 1);
      var newURL = replaceURL(url, function(){
        //Get start of link
        var startOfLine = startofstr - 1;
        var startchar = /[\n<]/;
        do{ if(startchar.test(content[startOfLine])) break; } while((--startOfLine >= 0) && ((startofstr - startOfLine) < 50));

        //Get end of link
        var endOfLine = endofstr;
        var endchar = /[\n]/;
        do{ if(endchar.test(content[endOfLine]) || (content.substr(Math.max(0,endOfLine-2), 3)=='/a>')) break; } while((++endOfLine < content.length) && ((endOfLine - endofstr) < 50));

        return content.substr(startOfLine, endOfLine - startOfLine + 1);
      });
      if(true || newURL && (newURL!=url)){
        content = content.substr(0, startofstr) + newURL + content.substr(endofstr + 1);
        rtagidx = endofstr;
      }
      rtagidx = content.indexOf(rtag, rtagidx + 1);
    }

    return content;
  }

  exports.templates_component = function(req, res, next){
    var verb = req.method.toLowerCase();

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var XValidate = jsh.XValidate;
    var cms = jsh.Modules['jsHarmonyCMS'];

    if(!req.params || !req.params.branch_id) return next();
    var branch_id = req.params.branch_id;

    var referer = req.get('Referer');
    if(referer){
      var urlparts = urlparser.parse(referer, true);
      var remote_domain = urlparts.protocol + '//' + (urlparts.auth?urlparts.auth+'@':'') + urlparts.hostname + (urlparts.port?':'+urlparts.port:'');
      res.setHeader('Access-Control-Allow-Origin', remote_domain);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With, Content-Type, Accept');
      res.setHeader('Access-Control-Allow-Credentials', true);
    }

    var model = jsh.getModel(req, module.namespace + 'Page_Editor');
    if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    //Get page
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { 'branch_id': branch_id };
    var validate = new XValidate();
    var verrors = {};
    validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);

    var deployment_target_params = '';

    if (verb == 'get'){

      var components = JSON.parse(JSON.stringify(module.Components));

      async.waterfall([

        //Check if branch exists
        function(cb){
          var sql = "select branch_desc from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc where branch_id=@branch_id";
          appsrv.ExecScalar(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(!rslt || !rslt[0]){ return Helper.GenError(req, res, -4, 'No access to this branch'); }
            return cb();
          });
        },

        //Get deployment_target_params for branch
        function(cb){
          var sql = "select deployment_target_params from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = v_my_branch_desc.site_id where branch_id=@branch_id";
          appsrv.ExecScalar(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) deployment_target_params = rslt[0];
            return cb();
          });
        },

        //Generate components
        function(cb){
          var publish_params = {
            timestamp: (Date.now()).toString()
          };
          try{
            if(deployment_target_params) publish_params = _.extend(publish_params, JSON.parse(deployment_target_params));
          }
          catch(ex){
            return cb('Publish Target has invalid deployment_target_params: '+deployment.deployment_target_params);
          }
          publish_params = _.extend({}, cms.Config.deployment_target_params, publish_params);

          _.each(components, function(component){
              if(component.remote_template && component.remote_template.editor){
                for(var key in publish_params){
                  component.remote_template.editor = Helper.ReplaceAll(component.remote_template.editor, '%%%' + key + '%%%', publish_params[key]);
                }
              }
            });

          return cb();
        },
      ], function(err){
        if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }

        res.end(JSON.stringify({
          '_success': 1,
          'components': components
        }));
      });
    }
    else return next();
  }

  exports.templates_menu = function(req, res, next){
    var verb = req.method.toLowerCase();

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var XValidate = jsh.XValidate;
    var cms = jsh.Modules['jsHarmonyCMS'];

    if(!req.params || !req.params.branch_id) return next();
    var branch_id = req.params.branch_id;

    var referer = req.get('Referer');
    if(referer){
      var urlparts = urlparser.parse(referer, true);
      var remote_domain = urlparts.protocol + '//' + (urlparts.auth?urlparts.auth+'@':'') + urlparts.hostname + (urlparts.port?':'+urlparts.port:'');
      res.setHeader('Access-Control-Allow-Origin', remote_domain);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With, Content-Type, Accept');
      res.setHeader('Access-Control-Allow-Credentials', true);
    }

    var model = jsh.getModel(req, module.namespace + 'Page_Editor');
    if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    //Get page
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { 'branch_id': branch_id };
    var validate = new XValidate();
    var verrors = {};
    validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);

    var deployment_target_params = '';

    if (verb == 'get'){

      var menuTemplates = {};

      async.waterfall([

        //Check if branch exists
        function(cb){
          var sql = "select branch_desc from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc where branch_id=@branch_id";
          appsrv.ExecScalar(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(!rslt || !rslt[0]){ return Helper.GenError(req, res, -4, 'No access to this branch'); }
            return cb();
          });
        },

        //Get deployment_target_params for branch
        function(cb){
          var sql = "select deployment_target_params from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = v_my_branch_desc.site_id where branch_id=@branch_id";
          appsrv.ExecScalar(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) deployment_target_params = rslt[0];
            return cb();
          });
        },

        //Generate menu templates
        function(cb){
          var publish_params = {
            timestamp: (Date.now()).toString()
          };
          try{
            if(deployment_target_params) publish_params = _.extend(publish_params, JSON.parse(deployment_target_params));
          }
          catch(ex){
            return cb('Publish Target has invalid deployment_target_params: '+deployment.deployment_target_params);
          }
          publish_params = _.extend({}, cms.Config.deployment_target_params, publish_params);

          //Parse menu templates
          for(var tmplname in module.MenuTemplates){
            var tmpl = module.MenuTemplates[tmplname];
            var front_tmpl = {
              title: tmpl.title,
              content_elements: {},
            };

            for(var key in tmpl.content_elements){
              var content_element = tmpl.content_elements[key];
              front_tmpl.content_elements[key] = {};
              var rslt_content_element = front_tmpl.content_elements[key];
              if('template' in content_element) rslt_content_element.template = content_element.template['editor'] || '';
              if('remote_template' in content_element) rslt_content_element.remote_template = content_element.remote_template['editor'] || '';

              //Resolve Remote Templates
              if(rslt_content_element.remote_template){
                for(var key in publish_params){
                  rslt_content_element.remote_template = Helper.ReplaceAll(rslt_content_element.remote_template, '%%%' + key + '%%%', publish_params[key]);
                }
              }
            }
            menuTemplates[tmplname] = front_tmpl;
          }

          return cb();
        },
      ], function(err){
        if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }

        res.end(JSON.stringify({
          '_success': 1,
          'menuTemplates': menuTemplates
        }));
      });
    }
    else return next();
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
    else{
      sql += ',(select '+(module.schema?module.schema+'.':'')+'my_current_branch_id()) branch_id';
      sql += ' from '+(module.schema?module.schema+'.':'')+'v_my_page where page_key=@page_key';
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

    appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Page ID'); }
      var page = rslt[0][0];

      //Get Page Template
      var page_template_id = page.page_template_id;
      var page_template = module.PageTemplates[page_template_id];

      var baseurl = req.baseurl;
      if(baseurl.indexOf('//')<0) baseurl = req.protocol + '://' + req.get('host') + baseurl;

      if(!Q.page_id){
        if(Q.branch_id){
          if(Q.branch_id.toString()!=(page.branch_id||'').toString()){ return Helper.GenError(req, res, -4, 'Please close and reopen editor.  The branch has changed.'); }
        }
        if(Q.page_template_id){
          if(Q.page_template_id.toString()!=(page.page_template_id||'').toString()){ return Helper.GenError(req, res, -4, 'Please close and reopen editor.  The template has changed.'); }
        }
      }

      if (verb == 'get'){
        if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

        //Validate parameters
        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, ['|page_id','|branch_id','|page_template_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        var authors = null;
        var clientPage = null;
        var media_file_ids = {};
        var sitemaps = {};
        var menus = {};

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

          //Get sitemaps
          function(cb){
            appsrv.ExecRecordset(req._DBContext, "select sitemap_key, sitemap_file_id, sitemap_type from "+(module.schema?module.schema+'.':'')+"v_my_sitemap where (sitemap_file_id is not null)", [], {}, function (err, rslt) {
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
            appsrv.ExecRecordset(req._DBContext, "select menu_key, menu_file_id, menu_name, menu_tag, menu_template_id, menu_path from "+(module.schema?module.schema+'.':'')+"v_my_menu where (menu_file_id is not null)", [], {}, function (err, rslt) {
              if (err != null) { err.sql = sql; err.model = model; return cb(err); }
              if(!rslt || !rslt.length || !rslt[0]){ return cb(); }
              _.each(rslt[0], function(menu){
                menus[menu.menu_tag] = menu;
              });
              async.eachOfSeries(menus, function(menu, menu_tag, menu_cb){
                funcs.getClientMenu(menu, { }, function(err, menu_content){
                  if(err) return menu_cb(err);
                  if(!menu_content) return menu_cb(null);
                  menu.menu_items = menu_content.menu_items;

                  //Generate tree
                  menu.menu_item_tree = funcs.createMenuTree(menu.menu_items);

                  return menu_cb();
                });
              }, cb);
            });
          },

          //Get page
          function(cb){

            function replaceURLs(content, options){
              var rslt = funcs.replaceBranchURLs(content, _.extend({}, options, {
                getMediaURL: function(media_key){
                  return baseurl+'_funcs/media/'+media_key+'/?media_file_id='+media_file_ids[media_key]+'#@JSHCMS';
                },
                getPageURL: function(page_key){
                  return baseurl+'_funcs/page/'+page_key+'/#@JSHCMS';
                }
              }));
              return rslt;
            }

            funcs.getClientPage(page, sitemaps, function(err, _clientPage){
              if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }
              clientPage = _clientPage;
              if(!clientPage.page.content || _.isString(clientPage.page.content)) { Helper.GenError(req, res, -99999, 'page.content must be a data structure'); return; }
              if(!clientPage.template.raw){
                if(clientPage.page.content) for(var key in clientPage.page.content){ clientPage.page.content[key] = replaceURLs(clientPage.page.content[key]); }
                _.each(['css','header','footer'], function(key){
                  if(clientPage.page[key]) clientPage.page[key] = replaceURLs(clientPage.page[key], { HTMLParser: false });
                });
              }
              else if(clientPage.template.raw) {
                if(clientPage.page.content && clientPage.page.content.body) clientPage.page.content.body = replaceURLs(clientPage.page.content.body);
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
            'sitemap': clientPage.sitemap,
            'menus': menus,
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
        if (!appsrv.ParamCheck('Q', Q, ['|branch_id','|page_template_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

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

  exports.getPageEditorUrl = function(req, res, next){
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var XValidate = jsh.XValidate;

    var model = jsh.getModel(req, module.namespace + 'Page_Tree');

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    //Validate parameters
    if (!appsrv.ParamCheck('Q', Q, ['&page_template_id', '|page_key', '|page_id', '|branch_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

    validate = new XValidate();
    verrors = {};
    validate.AddValidator('_obj.page_template_id', 'Page Template ID', 'B', [ XValidate._v_Required(), XValidate._v_MaxLength(255) ]);
    validate.AddValidator('_obj.page_key', 'Page Key', 'B', [ XValidate._v_IsNumeric() ]);
    validate.AddValidator('_obj.page_id', 'Page ID', 'B', [ XValidate._v_IsNumeric() ]);
    validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [ XValidate._v_IsNumeric() ]);
    verrors = _.merge(verrors, validate.Validate('B', Q));
    if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

    //Check to see if page template id exists
    if(!(Q.page_template_id in module.PageTemplates)) { Helper.GenError(req, res, -1, 'Page Template not found'); return; }

    var page_template = module.PageTemplates[Q.page_template_id];
    if(!page_template || !page_template.remote_template || !page_template.remote_template.editor) { Helper.GenError(req, res, -9, 'Page Template does not have an editor defined'); return; }

    if (verb == 'get') {
      var sql = "select deployment_target_params from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = v_my_branch_desc.site_id where branch_id="+(module.schema?module.schema+'.':'')+"my_current_branch_id()";
      appsrv.ExecRow(req._DBContext, sql, [], {}, function (err, rslt) {
        if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }

        var deployment_target_params = '';
        if(rslt && rslt[0] && rslt[0].deployment_target_params){
          deployment_target_params = rslt[0].deployment_target_params;
        }

        var url = page_template.remote_template.editor;

        var dtparams = {
          timestamp: (Date.now()).toString(),
          branch_id: (Q.branch_id||'')
        };

        if(deployment_target_params){
          try{
            dtparams = _.extend(dtparams, JSON.parse(deployment_target_params));
          }
          catch(ex){
            Helper.GenError(req, res, -9, 'Error reading deployment_target_params.  Please make sure the JSON syntax is correct');
            return;
          }
        }

        dtparams = _.extend(dtparams, {
          page_template_id: Q.page_template_id,
          page_key: (Q.page_key||''),
          page_id: (Q.page_id||'')
        });

        for(var key in dtparams){
          url = Helper.ReplaceAll(url, '%%%' + key + '%%%', dtparams[key]);
        }

        res.end(JSON.stringify({ '_success': 1, editor: url }));
      });
      return;
    }
    return next();
  }

  return exports;
};
