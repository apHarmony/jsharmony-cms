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

var jsHarmony = require('jsharmony');
var jsHarmonyModule = require('jsharmony/jsHarmonyModule');
var jsHarmonyFactory = require('jsharmony-factory');
var jsHarmonyCMSConfig = require('./jsHarmonyCMSConfig.js');
var express = require('jsharmony/lib/express');
var Helper = require('jsharmony/Helper');
var HelperFS = require('jsharmony/HelperFS');
var path = require('path');
var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var ejs = require('ejs');
var funcs = require('./models/_funcs.js');
var jsHarmonyRouter = require('jsharmony/jsHarmonyRouter');

var jsHarmonyCMSTransform = require('./jsHarmonyCMSTransform.js');


function jsHarmonyCMS(name, options){
  options = _.extend({
    schema: 'cms'
  }, options);

  var _this = this;
  jsHarmonyModule.call(this, name);
  _this.Config = new jsHarmonyCMSConfig();
  _this.typename = 'jsHarmonyCMS';
  _this.basepath = path.dirname(module.filename);
  _this.schema = options.schema;

  _this.SystemPageTemplates = {};
  _this.SystemComponentTemplates = {};
  _this.SystemSiteConfig = {};
  _this.Layouts = {};
  _this.Elements = {};
  _this.BranchItems = this.getDefaultBranchItems();
  _this.DeploymentJobReady = false;
  _this.DeploymentJobPending = false;

  _this.SFTPServer = null;
  _this.PreviewServer = null;

  _this.funcs = new funcs(_this);
  _this.transform = new jsHarmonyCMSTransform(_this);
}

jsHarmonyCMS.prototype = new jsHarmonyModule();

jsHarmonyCMS.prototype.Application = function(){
  var _this = this;
  var jsh = new jsHarmony();
  var factory = new jsHarmonyFactory();
  jsh.AddModule(factory);
  jsh.AddModule(this);
  jsh.Sites[factory.mainSiteID] = _.extend(this.getFactoryConfig(),jsh.Sites[factory.mainSiteID]);
  jsh.Config.valid_extensions.push('.js');
  jsh.Config.valid_extensions.push('.pem');
  jsh.Config.debug_params.ignore_globals.push('d3');
  jsh.Config.onConfigLoaded.push(function(cb){
    _this.LoadTemplates();
    _this.LoadClientJS();
    return cb();
  });
  jsh.Config.onDBDriverLoaded.push(function(cb){
    _this.initBranchItems(cb);
  });
  jsh.Config.onQueueSubscribe.push(function(cb, req, res, queueid){
    _this.funcs.deployment_target_queue_onSubscribe(cb, req, res, queueid);
  });
  return jsh;
}

jsHarmonyCMS.Application = function(){ return (new jsHarmonyCMS()).Application(); }

jsHarmonyCMS.prototype.Init = function(cb){
  var _this = this;
  var jsh = _this.jsh;

  HelperFS.createFolderIfNotExistsSync(path.join(jsh.Config.datadir,'page'));
  HelperFS.createFolderIfNotExistsSync(path.join(jsh.Config.datadir,'media'));
  HelperFS.createFolderIfNotExistsSync(path.join(jsh.Config.datadir,'menu'));
  HelperFS.createFolderIfNotExistsSync(path.join(jsh.Config.datadir,'sitemap'));
  HelperFS.createFolderIfNotExistsSync(path.join(jsh.Config.datadir,'publish_log'));
  HelperFS.createFolderIfNotExistsSync(path.join(jsh.Config.datadir,'site'));
  HelperFS.createFolderIfNotExistsSync(path.join(jsh.Config.datadir,'deployment_target'));

  if(!_.isEmpty(_this.Config.media_thumbnails)){
    jsh.Extensions.logDependency('image', 'jsHarmonyCMS > Media Thumbnails');
  }

  jsh.AppSrv.modelsrv.srcfiles['jsHarmonyCMS.EditorSelection'] = jsh.getEJS('jsHarmonyCMS.EditorSelection');
  jsh.AppSrv.modelsrv.srcfiles['jsHarmonyCMS.ComponentPlaceholder'] = jsh.getEJS('jsHarmonyCMS.ComponentPlaceholder');
  jsh.AppSrv.modelsrv.srcfiles['jsHarmonyCMS.SiteSelection'] = jsh.getEJS('jsHarmonyCMS.SiteSelection');

  jsh.Config.onServerReady.push(function (cb, servers){
    async.parallel([

      //Reset failed deployments
      function(ready_cb){
        var sql = "update "+(_this.schema?_this.schema+'.':'')+"deployment set deployment_sts='FAILED' where deployment_sts='RUNNING';";
        if(_this.Config.debug_params.auto_restart_failed_publish){
          sql = "insert into "+(_this.schema?_this.schema+'.':'')+"deployment(deployment_tag, branch_id, deployment_date, deployment_target_id) select concat(deployment_tag,'#'), branch_id, deployment_date, deployment_target_id from "+(_this.schema?_this.schema+'.':'')+"deployment where deployment_sts='RUNNING';" + sql;
        }
        jsh.AppSrv.ExecCommand('system', sql, [], { }, function (err, rslt) {
          if (err) { jsh.Log.error(err); }
          _this.DeploymentJobReady = true;
          return ready_cb();
        });
      },

      //Start SFTP
      function(ready_cb){
        if(!_this.Config.sftp || !_this.Config.sftp.enabled) return ready_cb();
        var jsHarmonyCMSSFTPServer = require('./jsHarmonyCMSSFTPServer.js');
        _this.SFTPServer = new jsHarmonyCMSSFTPServer(_this);
        _this.SFTPServer.Run(ready_cb);
      },

      //Start Preview Server
      function(ready_cb){
        if(!_this.Config.preview_server || !_this.Config.preview_server.enabled) return ready_cb();
        var jsHarmonyCMSPreviewServer = require('./jsHarmonyCMSPreviewServer.js');
        _this.PreviewServer = new jsHarmonyCMSPreviewServer(_this);
        _this.PreviewServer.Run(ready_cb);
      },
    ], function(err){
      if (err) { jsh.Log.error(err); }
      return cb();
    });
  });

  return cb();
}

//Load Client JS
jsHarmonyCMS.prototype.LoadClientJS = function(){
  var _this = this;
  var editorjs = fs.readFileSync(path.join(_this.basepath, 'public/js/jsHarmonyCMS.js'), 'utf8');
  var editorjsEJS = fs.readFileSync(path.join(_this.basepath, 'public/js/jsHarmonyCMS.js.ejs'), 'utf8');
  var editorjsLocal = '';
  var modeldirs = _this.jsh.getModelDirs();
  for (var i = 0; i < modeldirs.length; i++) {
    var jspath = path.join(modeldirs[i].path, '../public/js/jsHarmonyCMS.local.js');
    if (fs.existsSync(jspath)) editorjsLocal += '\r\n' + fs.readFileSync(jspath);
  }
  _this.jsh.Cache['js/jsHarmonyCMS.js'] = editorjs;
  _this.jsh.Cache['js/jsHarmonyCMS.js.ejs'] = editorjsEJS;
  _this.jsh.Cache['js/jsHarmonyCMS.local.js'] = editorjsLocal;
}

//Load Templates
jsHarmonyCMS.prototype.LoadTemplates = function(){
  var _this = this;

  //Prepend file content to property.  Add property if it does not exist and content exists
  function prependPropFile(obj, prop, path){
    if (fs.existsSync(path)) {
      var fcontent = fs.readFileSync(path, 'utf8');
      if(_.isString(prop)){
        if (prop in obj) fcontent += '\r\n' + obj[prop];
        obj[prop] = fcontent;
      }
      else if(_.isArray(prop)){
        _.each(prop, function(key){
          if (key in obj) fcontent += '\r\n' + obj[key];
          obj[key] = fcontent;
        });
      }
    }
  }

  function LoadTemplatesFolder(templateType, dpath, prefix){
    if(!prefix) prefix = '';
    if (!fs.existsSync(dpath)) return;
    var files = fs.readdirSync(dpath, { withFileTypes: true });
    for (var i = 0; i < files.length; i++) {
      var fname = files[i].name;
      var fext = '';
      var fpath = path.join(dpath, fname);
      var frootname = fname;
      var idx_lastdot = fname.lastIndexOf('.');
      if(idx_lastdot >= 0){
        fext = fname.substr(idx_lastdot+1);
        frootname = fname.substr(0,idx_lastdot);
      }
      if(files[i].isDirectory()){
        if(templateType=='component') LoadTemplatesFolder(templateType, path.join(dpath, fname), prefix + fname + '/');
      }
      else if(fext=='json'){
        var tmplname = prefix + frootname;
        var tmplbasepath = path.join(dpath, frootname);
        _this.jsh.LogInit_INFO('Loading ' + templateType + ' template: ' + tmplname);
        try{
          var tmpl = _this.jsh.ParseJSON(fpath, _this.name, templateType + ' template "' + tmplname + '"', undefined, { fatalError: false });
          if(!tmpl.title) tmpl.title = tmplname;
          if(templateType=='page'){
            //Load page template files
            prependPropFile(tmpl, 'header', tmplbasepath + '.header.ejs');
            prependPropFile(tmpl, 'footer', tmplbasepath + '.footer.ejs');
            prependPropFile(tmpl, 'css', tmplbasepath + '.css');
            prependPropFile(tmpl, 'js', tmplbasepath + '.js');
            tmpl.templates = tmpl.templates || {};
            prependPropFile(tmpl.templates, 'editor', tmplbasepath + '.templates.editor.ejs');
            prependPropFile(tmpl.templates, 'publish', tmplbasepath + '.templates.publish.ejs');
            if(!tmpl.content_elements) tmpl.content_elements = { body: { type: 'htmleditor', title: 'Body' } };
            if(!tmpl.content) tmpl.content = {};
            var reserved_content_element_names = ['header', 'footer', 'css', 'js'];
            for(var content_element_name in tmpl.content_elements){
              if(_.includes(reserved_content_element_names, content_element_name)) _this.jsh.LogInit_ERROR('Template '+tmplname+' content_element ' + content_element_name + ': Invalid content_element name, cannot be any of the following: '+reserved_content_element_names.join(', '));
              if(content_element_name != Helper.escapeCSSClass(content_element_name)) _this.jsh.LogInit_ERROR('Template '+tmplname+' content_element ' + content_element_name + ': Invalid content_element name, can only contain alpha-numeric characters, underscores, or dashes');
              else prependPropFile(tmpl.content, content_element_name, tmplbasepath + '.' + content_element_name + '.ejs');
              if(!('title' in tmpl.content_elements[content_element_name])) tmpl.content_elements[content_element_name].title = content_element_name;
            }
            _this.SystemPageTemplates[tmplname] = tmpl;
          }
          else if(templateType=='component'){
            prependPropFile(tmpl, 'css', tmplbasepath + '.css');
            prependPropFile(tmpl, 'js', tmplbasepath + '.js');
            tmpl.templates = tmpl.templates || {};
            prependPropFile(tmpl.templates, 'editor', tmplbasepath + '.templates.editor.ejs');
            prependPropFile(tmpl.templates, 'publish', tmplbasepath + '.templates.publish.ejs');
            tmpl.properties = tmpl.properties || {};
            prependPropFile(tmpl.properties, 'ejs', tmplbasepath + '.properties.ejs');
            prependPropFile(tmpl.properties, 'css', tmplbasepath + '.properties.css');
            prependPropFile(tmpl.properties, 'js', tmplbasepath + '.properties.js');
            tmpl.data = tmpl.data || {};
            prependPropFile(tmpl.data, 'ejs', tmplbasepath + '.data.ejs');
            prependPropFile(tmpl.data, 'css', tmplbasepath + '.data.css');
            prependPropFile(tmpl.data, 'js', tmplbasepath + '.data.js');
            _this.SystemComponentTemplates[tmplname] = tmpl;
          }
        }
        catch(ex){
          _this.jsh.LogInit_ERROR(ex.toString());
        }
      }
    }
  }

  var modeldirs = this.jsh.getModelDirs();
  for (var i = 0; i < modeldirs.length; i++ ) {
    LoadTemplatesFolder('page', path.normalize(modeldirs[i].path + '../views/templates/pages/'));
    LoadTemplatesFolder('component', path.normalize(modeldirs[i].path + '../views/templates/components/'));

    var systemSiteConfigPath = path.normalize(modeldirs[i].path + '../views/templates/site_config.json');
    if(fs.existsSync(systemSiteConfigPath)){
      try{
        var systemSiteConfig = _this.jsh.ParseJSON(systemSiteConfigPath, _this.name, 'System site_config.json', undefined, { fatalError: false });
        _this.SystemSiteConfig = _this.funcs.mergeSiteConfig(_this.SystemSiteConfig, systemSiteConfig);
      }
      catch(ex){
        _this.jsh.LogInit_ERROR(ex.toString());
      }
    }
  }
  _this.SystemPageTemplates['<Raw Text>'] = {
    title: '<Raw Text>',
    raw: true,
    content_elements: { body: { type: 'texteditor', title: 'Body' } },
    content: {}
  };
  _this.SystemPageTemplates['<Standalone>'] = {
    title: '<Standalone>',
    standalone: true,
    templates: { publish: 'format:json' },
    content_elements: { body: { type: 'htmleditor', title: 'Body' } },
    content: {}
  };

  
  //List of Values for Page Templates
  this.jsh.Config.macros.LOV_CMS_PAGE_TEMPLATES = {
    "sql":"select "+(this.schema?this.schema+'.':'')+"my_current_site_id() code_val,'site_id' code_txt",
    "post_process":"return jsh.Modules['"+this.name+"'].funcs.getCurrentPageTemplatesLOV(req._DBContext, values, {}, callback);",
  };
  this.jsh.Config.macros.LOV_CMS_PAGE_TEMPLATES_BLANK = _.extend({ "blank": "(None)" }, this.jsh.Config.macros.LOV_CMS_PAGE_TEMPLATES);
  this.jsh.Config.macros.LOV_CMS_PAGE_TEMPLATES_BLANK.post_process = "return jsh.Modules['"+this.name+"'].funcs.getCurrentPageTemplatesLOV(req._DBContext, values, { blank: true }, callback);";
  
  this.jsh.Sites['main'].globalparams.isWebmaster = function (req) { return Helper.HasRole(req, 'WEBMASTER'); }
  this.jsh.Sites['main'].globalparams.site_id = function (req) { return req.gdata.site_id; }
  this.jsh.Sites['main'].globalparams.site_name = function (req) { return req.gdata.site_name; }
  this.jsh.Sites['main'].globalparams.branch_items = function(req){
    var branch_items = {};
    _.each(_this.BranchItems, function(branch_item, branch_item_name){
      branch_items[branch_item_name] = {
        name: branch_item.name,
        caption: branch_item.caption,
        editor_url: (branch_item.getEditorUrl ? branch_item.getEditorUrl(req) : undefined),
      };
    });
    return branch_items;
  }

  //Chain to onAuthComplete
  if(!this.jsh.Sites['main'].auth) this.jsh.Sites['main'].auth = {};
  this.jsh.Sites['main'].auth.onAuthComplete = Helper.chainToEnd(this.jsh.Sites['main'].auth.onAuthComplete, function(req, user_info, jsh){
    if(!req.gdata) req.gdata = {};
    req.gdata.site_id = user_info.site_id;
    req.gdata.site_name = user_info.site_name;
  });

  //Add defaultEditorConfig to client-side variables
  this.jsh.Sites['main'].globalparams.defaultEditorConfig = _this.Config.defaultEditorConfig;
}

jsHarmonyCMS.prototype.getCmsBaseUrlFromReq = function(req){
  var _this = this;
  var jsh = _this.jsh;

  var mainBaseUrl = jsh.Sites['main'].baseurl;
  if(mainBaseUrl){
    if(mainBaseUrl.indexOf('://') >= 0) return mainBaseUrl;
    if(mainBaseUrl.indexOf('//')==0) return mainBaseUrl;
  }
  return jsh.Servers['default'].getURLFromReq(req)+mainBaseUrl;
}

jsHarmonyCMS.prototype.initBranchItems = function(cb){
  var _this = this;
  var sql_branch_items = [];
  for(var key in _this.BranchItems){
    var branchItem = _this.BranchItems[key];
    sql_branch_items.push({
      item: branchItem.name,
      tbl_branch_item: branchItem.tbl_branch_item,
      tbl_item: branchItem.tbl_item,
      item_caption_1: branchItem.caption[1],
      item_caption_2: branchItem.caption[2],
    });
  }
  _this.jsh.DB['default'].SQLExt.Funcs[_this.schema+'.branch_items'] = JSON.stringify(sql_branch_items);
  return cb();
}

jsHarmonyCMS.prototype.getDefaultBranchItems = function(){
  var _this = this;
  var jsh = _this.jsh;
  return {
    'page': {
      name: 'page',
      caption: ['','Page','Pages'],
      getEditorUrl: function(req){ return req.baseurl+_this.namespace+'Sitemap_Listing_Redirect' },
      tbl_branch_item: (_this.schema?_this.schema+'.':'')+'branch_page',
      tbl_item: (_this.schema?_this.schema+'.':'')+'page',
      diff: {
        columns: ['page_path','page_title','page_tags','page_file_id','page_filename','page_template_id','page_template_path'],
        sqlwhere: "(old_page.page_is_folder=0 or new_page.page_is_folder=0)",
        onBeforeDiff: function(branch_data, callback){
          async.parallel([
            function(page_cb){
              _this.funcs.getPageTemplates('deployment', branch_data.site_id, { continueOnConfigError: true }, function(err, pageTemplates){
                if(err) return page_cb(err);
                branch_data.page_templates = pageTemplates;
                return page_cb();
              });
            },
            function(page_cb){ return _this.funcs.diff_getPages(branch_data, page_cb); }
          ], callback);
        },
        onDiff: function(branch_items, branch_data, callback){ return _this.funcs.diff_page(branch_items, branch_data, callback); },
        field_mapping: {
          page_seo: {
            'title' : 'Title',
            'keywords': 'Keywords',
            'metadesc': 'Meta Description',
            'canonical_url': 'Canonical URL'
          },
          page: {
            'css': 'CSS',
            'header': 'Header Code',
            'footer': 'Footer Code',
            'page_title': 'Page Title',
            'page_tags': 'Page Tags',
            'properties': 'Page Properties',
            'template_title': 'Template',
            'page_template_path': 'Template URL',
          }
        }
      },
      conflicts: {
        columns: ['page_path','page_title','page_tags','page_file_id','page_filename','page_template_id','page_template_path'],
        sqlwhere: "(src_orig_{item}.{item}_is_folder=0 or dst_orig_{item}.{item}_is_folder=0 or src_{item}.{item}_is_folder=0 or dst_{item}.{item}_is_folder=0)",
        onBeforeConflicts: function(branch_data, callback){
          async.parallel([
            function(page_cb){
              _this.funcs.getPageTemplates('deployment', branch_data.site_id, { continueOnConfigError: true }, function(err, pageTemplates){
                if(err) return page_cb(err);
                branch_data.page_templates = pageTemplates;
                return page_cb();
              });
            },
            function(page_cb){ return _this.funcs.conflicts_getPages(branch_data, page_cb); }
          ], callback);
        },
        onConflicts: function(branch_items, branch_data, callback){ return _this.funcs.conflicts_page(branch_items, branch_data, callback); },
      },
      validate: {
        error_columns: ['page_id','page_key','page_title','page_path','page_template_id','page_template_path','page_filename'],
        onBeforeValidate: function(item_errors, branchData, callback){
          _this.funcs.webRequestGate(branchData.deployment.deployment_target_publish_path, branchData.publish_params, function(addWebRequest, performWebRequests, gate, downloadTemplates){
            var onRemoteTemplatesReady = [];
            var remoteTemplatesTrigger = new Helper.triggerCounter(2);

            async.parallel([
              //CMS Deployment Host Request
              function(cb){
                remoteTemplatesTrigger.action = (function(){
                  performWebRequests(function(err){
                    if(err) return cb(err);
                    Helper.trigger(onRemoteTemplatesReady);
                    gate.close();
                    return cb();
                  });
                });
              },
              //Page Templates
              function(page_cb){
                async.waterfall([
                  //Get page templates
                  function(page_template_cb){
                    _this.funcs.getPageTemplates('deployment', branchData.site_id, { }, function(err, pageTemplates){
                      if(err) return page_template_cb(err);
                      branchData.page_templates = pageTemplates;
                      return page_template_cb();
                    });
                  },
                  //Download local template definitions
                  function(page_template_cb){ _this.funcs.downloadLocalTemplates(branchData, branchData.page_templates, {}, {}, page_template_cb); },
                  //Download remote template definitions
                  function(page_template_cb){ _this.funcs.downloadRemoteTemplates(branchData, branchData.page_templates, {}, { addWebRequest: addWebRequest }, page_template_cb); },
                  //Wait for Remote Template Milestone
                  function(page_template_cb){ onRemoteTemplatesReady.push(page_template_cb); remoteTemplatesTrigger.increment(); },
                ], page_cb);
              },
              //Component Templates
              function(cb){
                async.waterfall([
                  //Get component templates
                  function(component_template_cb){
                    _this.funcs.getComponentTemplates('deployment', branchData.site_id, {}, function(err, componentTemplates){
                      if(err) return component_template_cb(err);
                      branchData.component_templates = componentTemplates;
                      return component_template_cb();
                    });
                  },
                  //Download local template definitions
                  function(component_template_cb){ _this.funcs.downloadLocalTemplates(branchData, branchData.component_templates, {}, { templateType: 'COMPONENT', exportTemplates: {} }, component_template_cb); },
                  //Download remote template definitions
                  function(component_template_cb){ _this.funcs.downloadRemoteTemplates(branchData, branchData.component_templates, {}, { templateType: 'COMPONENT', exportTemplates: {}, addWebRequest: addWebRequest }, component_template_cb); },
                  //Wait for Remote Template Milestone
                  function(component_template_cb){ onRemoteTemplatesReady.push(component_template_cb); remoteTemplatesTrigger.increment(); },
                ], cb);
              },
              //Get all branch pages from the database
              function(page_cb){ return _this.funcs.validate_getPages(item_errors, branchData, page_cb); }
            ], callback);
          });
        },
        onValidate: function(item_errors, branchData, callback){ return _this.funcs.validate_page(item_errors, branchData, callback); },
      },
      deploy: {
        onBeforeDeploy: function(jsh, branchData, publish_params, callback){
          _this.funcs.webRequestGate(branchData.deployment.deployment_target_publish_path, publish_params, function(addWebRequest, performWebRequests, gate, downloadTemplates){
            var ops = {};

            var onRemoteTemplatesReady = [];
            var onPublishTemplatesReady = [];
            var remoteTemplatesTrigger = new Helper.triggerCounter(2);
            var publishTemplatesTrigger = new Helper.triggerCounter(2);

            async.parallel([
              //CMS Deployment Host Request
              function(cb){
                remoteTemplatesTrigger.action = (function(){
                  performWebRequests(function(err){
                    if(err) return cb(err);
                    gate.close();
                    Helper.trigger(onRemoteTemplatesReady);
                  });
                });

                publishTemplatesTrigger.action = (function(){
                  performWebRequests(function(err){
                    if(err) return cb(err);
                    gate.close();
                    Helper.trigger(onPublishTemplatesReady);
                    return cb();
                  });
                });
              },
              //Page Templates
              function(cb){
                async.waterfall([
                  //Get page templates
                  function(page_template_cb){
                    _this.funcs.getPageTemplates('deployment', branchData.site_id, {}, function(err, pageTemplates){
                      if(err) return page_template_cb(err);
                      branchData.page_templates = pageTemplates;
                      return page_template_cb();
                    });
                  },
                  //Download local template definitions
                  function(page_template_cb){ _this.funcs.downloadLocalTemplates(branchData, branchData.page_templates, branchData.page_template_html, {}, page_template_cb); },
                  //Download remote template definitions
                  function(page_template_cb){ _this.funcs.downloadRemoteTemplates(branchData, branchData.page_templates, branchData.page_template_html, { addWebRequest: addWebRequest }, page_template_cb); },
                  //Wait for Remote Template Milestone
                  function(page_template_cb){ onRemoteTemplatesReady.push(page_template_cb); remoteTemplatesTrigger.increment(); },
                  //Download remote template content
                  function(page_template_cb){ _this.funcs.downloadPublishTemplates(branchData, branchData.page_templates, branchData.page_template_html, { addWebRequest: addWebRequest }, page_template_cb); },
                  //Wait for Publish Template Milestone
                  function(page_template_cb){ onPublishTemplatesReady.push(page_template_cb); publishTemplatesTrigger.increment(); },
                ], cb);
              },
              //Component Templates
              function(cb){
                async.waterfall([
                  //Get component templates
                  function(component_template_cb){
                    _this.funcs.getComponentTemplates('deployment', branchData.site_id, { withContent: true, includeLocalPath: true }, function(err, componentTemplates){
                      if(err) return component_template_cb(err);
                      branchData.component_templates = componentTemplates;
                      return component_template_cb();
                    });
                  },
                  //Download local template definitions
                  function(component_template_cb){ _this.funcs.downloadLocalTemplates(branchData, branchData.component_templates, branchData.component_template_html, { templateType: 'COMPONENT', exportTemplates: branchData.component_export_template_html }, component_template_cb); },
                  //Download remote template definitions
                  function(component_template_cb){ _this.funcs.downloadRemoteTemplates(branchData, branchData.component_templates, branchData.component_template_html, { templateType: 'COMPONENT', exportTemplates: branchData.component_export_template_html, addWebRequest: addWebRequest }, component_template_cb); },
                  //Wait for Remote Template Milestone
                  function(component_template_cb){ onRemoteTemplatesReady.push(component_template_cb); remoteTemplatesTrigger.increment(); },
                  //Download remote template content
                  function(component_template_cb){ _this.funcs.downloadPublishTemplates(branchData, branchData.component_templates, branchData.component_template_html, { templateType: 'COMPONENT', exportTemplates: branchData.component_export_template_html, addWebRequest: addWebRequest }, component_template_cb); },
                  //Wait for Publish Template Milestone
                  function(component_template_cb){ onPublishTemplatesReady.push(component_template_cb); publishTemplatesTrigger.increment(); },
                  //Generate templates
                  function(component_template_cb){ _this.funcs.generateComponentDeploymentTemplates(branchData, component_template_cb); },
                ], cb);
              },
              //Get all branch pages from the database
              function(cb){ _this.funcs.deploy_getPages(jsh, branchData, publish_params, cb); },
            ], callback);
          });
        },
        onDeploy: function(jsh, branchData, publish_params, callback){ return _this.funcs.deploy_page(jsh, branchData, publish_params, callback); },
        onDeploy_PostBuild: function(jsh, branchData, publish_params, callback){
          async.waterfall([
            function(build_cb){ _this.funcs.deploy_exportComponents(jsh, branchData, publish_params, build_cb); },
            function(build_cb){ _this.funcs.deploy_pageIncludes(jsh, branchData, publish_params, build_cb); },
          ], callback);
        },
      },
      download: {
        columns: ['page_path','page_is_folder','page_title','page_tags','page_file_id','page_template_id','page_template_path','page_seo_title','page_seo_canonical_url','page_seo_metadesc','page_seo_keywords','page_lang'],
        onGenerate: function(branch_items, branch_data, callback){
          _.each(branch_items, function(branch_item){ if(branch_item.page_file_id) branch_data.data_files.push('page/'+branch_item.page_file_id+'.json'); });
          return callback();
        },
      },
      upload: {
        onValidate: function(errors, branchItems, branchData, callback){ return _this.funcs.branch_upload_validatePage(errors, branchItems, branchData, callback); },
        onImportDB: function(dbtasks, branchItems, branchData, callback){ return _this.funcs.branch_upload_importPage(dbtasks, branchItems, branchData, callback); },
      },
      search: {
        columns: ['page_path','page_is_folder','page_title','page_tags','page_file_id','page_template_id','page_template_path','page_filename','page_seo_title','page_seo_canonical_url','page_seo_metadesc','page_seo_keywords'],
        onBeforeSearch: function(searchItems, searchData, callback){ _this.funcs.search_getPages(searchItems, searchData, callback); },
        onSearch: function(searchItems, searchData, callback){ return _this.funcs.search_pages(searchItems, searchData, callback); },
      },
    },
    'media': {
      name: 'media',
      caption: ['','Media','Media'],
      getEditorUrl: function(req){ return req.baseurl+_this.namespace+'Media_Tree' },
      tbl_branch_item: (_this.schema?_this.schema+'.':'')+'branch_media',
      tbl_item: (_this.schema?_this.schema+'.':'')+'media',
      diff: {
        columns: ['media_path','media_file_id','media_ext','media_width','media_height','media_desc','media_tags','media_type'],
        sqlwhere: "(old_{item}.{item}_is_folder=0 or new_{item}.{item}_is_folder=0)",
        onBeforeDiff: function(branch_data, callback){ return _this.funcs.diff_getMedia(branch_data, callback); },
        onDiff: function(branch_items, branch_data, callback){ return _this.funcs.diff_media(branch_items, branch_data, callback); },
        field_mapping: {
          media: {
            'media_desc': 'Media Desc',
            'media_tags': 'Media Tags',
            'media_type': 'Media Type',
          }
        }
      },
      conflicts: {
        columns: ['media_path','media_file_id','media_ext','media_width','media_height','media_desc','media_tags','media_type'],
        sqlwhere: "(src_orig_{item}.{item}_is_folder=0 or dst_orig_{item}.{item}_is_folder=0 or src_{item}.{item}_is_folder=0 or dst_{item}.{item}_is_folder=0)",
        onBeforeConflicts: function(branch_data, callback){ return _this.funcs.conflicts_getMedia(branch_data, callback); },
        onConflicts: function(branch_items, branch_data, callback){ return _this.funcs.conflicts_media(branch_items, branch_data, callback); },
      },
      validate: {
        error_columns: ['media_id','media_key','media_desc','media_path','media_ext','media_width','media_height'],
        onBeforeValidate: function(item_errors, branchData, callback){ return _this.funcs.validate_getMedia(item_errors, branchData, callback); },
        onValidate: function(item_errors, branchData, callback){ return _this.funcs.validate_media(item_errors, branchData, callback); },
      },
      deploy: {
        onBeforeDeploy: function(jsh, branchData, publish_params, callback){ _this.funcs.deploy_getMedia(jsh, branchData, publish_params, callback); },
        onDeploy: function(jsh, branchData, publish_params, callback){ return _this.funcs.deploy_media(jsh, branchData, publish_params, callback); },
      },
      download: {
        columns: ['media_path','media_is_folder','media_file_id','media_ext','media_size','media_width','media_height','media_desc','media_tags','media_type','media_lang'],
        onGenerate: function(branch_items, branch_data, callback){
          _.each(branch_items, function(branch_item){ if(branch_item.media_file_id) branch_data.data_files.push('media/'+branch_item.media_file_id.toString()+branch_item.media_ext); });
          return callback();
        },
      },
      upload: {
        onValidate: function(errors, branchItems, branchData, callback){ return _this.funcs.branch_upload_validateMedia(errors, branchItems, branchData, callback); },
        onImportDB: function(dbtasks, branchItems, branchData, callback){ return _this.funcs.branch_upload_importMedia(dbtasks, branchItems, branchData, callback); },
      },
      search: {
        columns: ['media_path','media_is_folder','media_file_id','media_ext','media_width','media_height','media_desc','media_tags','media_type'],
        onBeforeSearch: function(searchItems, searchData, callback){ _this.funcs.search_getMedia(searchItems, searchData, callback); },
        onSearch: function(searchItems, searchData, callback){ return _this.funcs.search_media(searchItems, searchData, callback); },
      },
    },
    'menu': {
      name: 'menu',
      caption: ['','Menu','Menus'],
      getEditorUrl: function(req){ return req.baseurl+_this.namespace+'Menu_Listing' },
      tbl_branch_item: (_this.schema?_this.schema+'.':'')+'branch_menu',
      tbl_item: (_this.schema?_this.schema+'.':'')+'menu',
      diff: {
        columns: ['menu_name','menu_tag','menu_file_id'],
        onDiff: function(branch_items, branch_data, callback){ return _this.funcs.diff_menu(branch_items, branch_data, callback); },
        field_mapping: {
          menu: {
            'menu_name': 'Menu Name',
            'menu_items': 'Menu Items'
          }
        }
      },
      conflicts: {
        columns: ['menu_name','menu_tag','menu_file_id'],
        onConflicts: function(branch_items, branch_data, callback){ return _this.funcs.conflicts_menu(branch_items, branch_data, callback); },
      },
      validate: {
        error_columns: ['menu_id','menu_key','menu_name','menu_tag'],
        onValidate: function(item_errors, branchData, callback){ return _this.funcs.validate_menu(item_errors, branchData, callback); },
      },
      deploy: {
        onDeploy: function(jsh, branchData, publish_params, callback){ return _this.funcs.deploy_menu(jsh, branchData, publish_params, callback); },
        onDeploy_seq: -100,
      },
      download: {
        columns: ['menu_name','menu_tag','menu_file_id','menu_notes','menu_lang'],
        onGenerate: function(branch_items, branch_data, callback){
          _.each(branch_items, function(branch_item){ if(branch_item.menu_file_id) branch_data.data_files.push('menu/'+branch_item.menu_file_id+'.json'); });
          return callback();
        },
      },
      upload: {
        onImportDB: function(dbtasks, branchItems, branchData, callback){ return _this.funcs.branch_upload_importMenu(dbtasks, branchItems, branchData, callback); },
      },
    },
    'redirect': {
      name: 'redirect',
      caption: ['','Redirect','Redirects'],
      getEditorUrl: function(req){ return req.baseurl+_this.namespace+'Redirect_Listing' },
      tbl_branch_item: (_this.schema?_this.schema+'.':'')+'branch_redirect',
      tbl_item: (_this.schema?_this.schema+'.':'')+'redirect',
      diff: {
        columns: ['redirect_url','redirect_dest']
      },
      conflicts: {
        columns: ['redirect_url','redirect_dest']
      },
      deploy: {
        onDeploy: function(jsh, branchData, publish_params, callback){ return _this.funcs.deploy_redirect(jsh, branchData, publish_params, callback); },
      },
      download: {
        columns: ['redirect_url','redirect_url_type','redirect_seq','redirect_dest','redirect_http_code']
      },
      upload: {
        onValidate: function(errors, branchItems, branchData, callback){ return _this.funcs.branch_upload_validateRedirect(errors, branchItems, branchData, callback); },
        onImportDB: function(dbtasks, branchItems, branchData, callback){ return _this.funcs.branch_upload_importRedirect(dbtasks, branchItems, branchData, callback); },
      },
    },
    'sitemap': {
      name: 'sitemap',
      caption: ['','Sitemap','Sitemaps'],
      getEditorUrl: function(req){ return req.baseurl+_this.namespace+'Sitemap_Listing' },
      tbl_branch_item: (_this.schema?_this.schema+'.':'')+'branch_sitemap',
      tbl_item: (_this.schema?_this.schema+'.':'')+'sitemap',
      diff: {
        columns: ['sitemap_name','sitemap_type','sitemap_file_id'],
        onDiff: function(branch_items, branch_data, callback){ return _this.funcs.diff_sitemap(branch_items, branch_data, callback); },
        field_mapping: {
          sitemap: {
            'sitemap_name': 'Sitemap Name',
            'sitemap_items': 'Sitemap Items'
          }
        },
      },
      conflicts: {
        columns: ['sitemap_name','sitemap_type','sitemap_file_id'],
        onConflicts: function(branch_items, branch_data, callback){ return _this.funcs.conflicts_sitemap(branch_items, branch_data, callback); },
      },
      validate: {
        error_columns: ['sitemap_id','sitemap_key','sitemap_name','sitemap_type'],
        onValidate: function(item_errors, branchData, callback){ return _this.funcs.validate_sitemap(item_errors, branchData, callback); },
      },
      deploy: {
        onBeforeDeploy: function(jsh, branchData, publish_params, callback){ return _this.funcs.deploy_getSitemaps(jsh, branchData, publish_params, callback); },
      },
      download: {
        columns: ['sitemap_name','sitemap_type','sitemap_file_id','sitemap_notes','sitemap_lang'],
        onGenerate: function(branch_items, branch_data, callback){
          _.each(branch_items, function(branch_item){ if(branch_item.sitemap_file_id) branch_data.data_files.push('sitemap/'+branch_item.sitemap_file_id+'.json'); });
          return callback();
        },
      },
      upload: {
        onValidate: function(errors, branchItems, branchData, callback){ return _this.funcs.branch_upload_validateSitemap(errors, branchItems, branchData, callback); },
        onImportDB: function(dbtasks, branchItems, branchData, callback){ return _this.funcs.branch_upload_importSitemap(dbtasks, branchItems, branchData, callback); },
      },
    },
  };
}

jsHarmonyCMS.prototype.applyBranchItemSQL = function(item_type, sql){
  var _this = this;
  if(!(item_type in _this.BranchItems)) throw new Error('Branch item_type not defined: ' + item_type);
  var branchItem = _this.BranchItems[item_type];
  var keys = {
    item: branchItem.name,
    tbl_branch_item: branchItem.tbl_branch_item,
    tbl_item: branchItem.tbl_item,
  };
  for(var key in keys){
    sql = Helper.ReplaceAll(sql, '{' + key + '}', keys[key]);
  }
  return sql;
}

jsHarmonyCMS.prototype.getFactoryConfig = function(){
  var _this = this;
  var jsh = _this.jsh;

  var configFactory = jsh.Modules['jsHarmonyFactory'].Config;

  jsh.Modules['jsHarmonyFactory'].onCreateServer.push(function(server){
    server.app.use('/js/jsHarmonyCMS.js', function(req, res){
      if(_this.Config.debug_params.no_cache_client_js) _this.LoadClientJS();
      req.jshsite = jsh.Sites['main'];
      var baseurl = req.jshsite.baseurl||'';
      if(baseurl.indexOf('//')<0) baseurl = req.protocol + '://' + req.get('host') + baseurl;
      var cookie_suffix = Helper.GetCookieSuffix(req, jsh);
      var jsEJS = ejs.render(jsh.Cache['js/jsHarmonyCMS.js.ejs'], {
        jsh: jsh, 
        req: req, 
        baseurl: baseurl, 
        cookie_suffix: cookie_suffix, 
        _: _, 
        Helper: Helper
      });
      return res.end(jsh.Cache['js/jsHarmonyCMS.js'] + '\n' + jsEJS + '\n' + jsh.Cache['js/jsHarmonyCMS.local.js']);
    });
    server.app.use(jsHarmonyRouter.PublicRoot(path.join(__dirname, 'public')));
  });

  /**********************
  *** TASK SCHEDULER ***
  **********************/
  configFactory.scheduled_tasks['deploy'] = {
    action: configFactory.Helper.JobProc.ExecuteSQL("jsHarmonyCMS_GetNextDeployment", function(rslt){
      if(_this.funcs.deploymentQueue.length()) return;
      if(rslt && rslt.length && rslt[0] && rslt[0].length){
        var deployment = rslt[0][0];
        _this.funcs.deploy.call(_this.jsh.AppSrv, deployment.deployment_id);
      }
    }),
    options: {
      quiet: true
    },
    when: function (curdt, lastdt) {  //return true if the job should run
      //return false; //Debug - Disable deployment
      if(!_this.DeploymentJobReady) return false;
      if(_this.DeploymentJobPending){
        _this.DeploymentJobPending = false;
        return true;
      }
      return (curdt.getTime() - lastdt.getTime() > _this.Config.deploymentJobDelay);
    }
  };

  return {
    instance: 'jshInstance_CMS',
    cookie_samesite: 'none',
    globalparams: {},
    title: 'Content Management System',
    public_apps: [
      { '*':  express.static(path.join(_this.basepath, 'public')) },
      {
        '/jsharmony.css': function (req, res) {
          //Concatenate jsh css with system css
          _this.jsh.getSystemCSS(function(systemCSS){
            HelperFS.outputContent(req, res, ejs.render(systemCSS, { req: req, rootcss: req.jshsite.rootcss, _: _ }),'text/css');
          });
        },
        '/js/jsharmony-cms.js': function (req, res) { return Helper.Redirect302(res, '/js/jsHarmonyCMS.js'); },
      }
    ],
    private_apps: [
      {
        '/_funcs/page/:page_key': _this.funcs.page,
        '/_funcs/pageDev': _this.funcs.pageDev,
        '/_funcs/search': _this.funcs.search,
        '/_funcs/templates/components': _this.funcs.templates_components,
        '/_funcs/templates/components/:branch_id': _this.funcs.templates_components,
        '/_funcs/templates/compile_components': _this.funcs.templates_compile_components,
        '/_funcs/editor_url': _this.funcs.getPageEditorUrl,
        '/_funcs/site_config': _this.funcs.getPageSiteConfig,
        '/_funcs/media/:media_key/:thumbnail': _this.funcs.media,
        '/_funcs/media/:media_key/': _this.funcs.media,
        '/_funcs/media/': _this.funcs.media,
        '/_funcs/menu/:menu_key/': _this.funcs.menu,
        '/_funcs/sitemap/:sitemap_key/': _this.funcs.sitemap,
        '/_funcs/deployment_unique_tag': _this.funcs.deployment_unique_tag,
        '/_funcs/deployment_log/:deployment_id': _this.funcs.deployment_log,
        '/_funcs/deployment_host/:deployment_id/log': _this.funcs.deployment_host_log,
        '/_funcs/deployment_host/:deployment_id/download': _this.funcs.req_deployment_host_download,
        '/_funcs/deployment_host/:request_id/response': _this.funcs.deployment_host_response,
        '/_funcs/deployment_change_log/:deployment_id': _this.funcs.deployment_change_log,
        '/_funcs/deployment/download/:deployment_id': _this.funcs.req_deployment_download,
        '/_funcs/deployment/trigger': _this.funcs.req_deployment_trigger,
        '/_funcs/deployment_target/:deployment_target_id/public_key': _this.funcs.req_deployment_target_public_key,
        '/_funcs/deployment_target/:deployment_target_id/private_key': _this.funcs.req_deployment_target_private_key,
        '/_funcs/deployment_target/:deployment_target_id/regenerate_access_key': _this.funcs.req_deployment_target_regenerate_access_key,
        '/_funcs/deployment_target/parse_url': _this.funcs.req_parse_deployment_target_url,
        '/_funcs/deployment_target/defaults': _this.funcs.req_deployment_target_defaults,
        '/_funcs/diff': _this.funcs.diff,
        '/_funcs/validate': _this.funcs.validate_req,
        '/_funcs/conflicts': _this.funcs.req_conflicts,
        '/_funcs/conflicts/resolve': _this.funcs.req_conflicts_resolve,
        '/_funcs/merge/:merge_type': _this.funcs.req_merge,
        '/_funcs/begin_merge': _this.funcs.req_begin_merge,
        '/_funcs/branch/download/:branch_id': _this.funcs.branch_download,
        '/_funcs/branch/upload': _this.funcs.branch_upload,
        '/_funcs/site/checkout': _this.funcs.site_checkout,
      }
    ]
  }
}

module.exports = exports = jsHarmonyCMS;