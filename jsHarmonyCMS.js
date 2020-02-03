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

  _this.PageTemplates = {};
  _this.MenuTemplates = {};
  _this.Components = {};
  _this.defaultPageTemplate = undefined;
  _this.defaultMenuTemplate = undefined;
  _this.Layouts = {};
  _this.Elements = {};
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
  jsh.Config.onConfigLoaded.push(function(cb){
    _this.LoadTemplates();
    _this.LoadClientJS();
    return cb();
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

  if(!_.isEmpty(_this.Config.media_thumbnails)){
    jsh.TestImageMagick('jsHarmonyCMS > Media Thumbnails');
  }

  jsh.Config.onServerReady.push(function (cb, servers){
    jsh.AppSrv.ExecCommand('system', "update "+(_this.schema?_this.schema+'.':'')+"deployment set deployment_sts='FAILED' where deployment_sts='RUNNING'", [], { }, function (err, rslt) {
      if (err) { jsh.Log.error(err); }
      return cb();
    });
  });
  
  return cb();
}

//Load Client JS
jsHarmonyCMS.prototype.LoadClientJS = function(){
  var _this = this;
  var editorjs = fs.readFileSync(path.join(_this.basepath, 'public/js/jsharmony-cms.js'), 'utf8');
  var modeldirs = _this.jsh.getModelDirs();
  for (var i = 0; i < modeldirs.length; i++) {
    var jspath = path.join(modeldirs[i].path, '../public/js/jsharmony-cms.local.js');
    if (fs.existsSync(jspath)) editorjs += '\r\n' + fs.readFileSync(jspath);
  }
  _this.jsh.Cache['js/jsharmony-cms.js'] = editorjs;
}

//Load Templates
jsHarmonyCMS.prototype.LoadTemplates = function(){
  var _this = this;

  function prependPropFile(obj, prop, path){
    if (fs.existsSync(path)) {
      var fcontent = fs.readFileSync(path, 'utf8');
      if (prop in obj) fcontent += '\r\n' + obj[prop];
      obj[prop] = fcontent;
    }
  }

  function LoadTemplatesFolder(templateType, dpath){
    if (!fs.existsSync(dpath)) return;
    var files = fs.readdirSync(dpath);
    for (var i = 0; i < files.length; i++) {
      var fext = '';
      var fpath = dpath + files[i];
      var idx_lastdot = files[i].lastIndexOf('.');
      if(idx_lastdot >= 0) fext = files[i].substr(idx_lastdot+1);
      var tmplname = files[i].substr(0,idx_lastdot);
      var tmplbasepath = dpath + tmplname;
      if(fext=='json'){
        _this.jsh.LogInit_INFO('Loading ' + templateType + ' template: ' + tmplname);
        var tmpl = _this.jsh.ParseJSON(fpath, _this.name, templateType + ' template ' + tmplname);
        if(!tmpl.title) tmpl.title = tmplname;
        if(templateType=='page'){
          prependPropFile(tmpl, 'header', tmplbasepath + '.header.ejs');
          prependPropFile(tmpl, 'footer', tmplbasepath + '.footer.ejs');
          prependPropFile(tmpl, 'css', tmplbasepath + '.css');
          prependPropFile(tmpl, 'js', tmplbasepath + '.js');
          if(!tmpl.content_elements) tmpl.content_elements = { body: { type: 'htmleditor', title: 'Body' } };
          if(!tmpl.content) tmpl.content = {};
          var reserved_content_element_names = ['header', 'footer', 'css', 'js'];
          for(var content_element_name in tmpl.content_elements){
            if(_.includes(reserved_content_element_names, content_element_name)) _this.jsh.LogInit_ERROR('Template '+tmplname+' content_element ' + content_element_name + ': Invalid content_element name, cannot be any of the following: '+reserved_content_element_names.join(', '));
            if(content_element_name != Helper.escapeCSSClass(content_element_name)) _this.jsh.LogInit_ERROR('Template '+tmplname+' content_element ' + content_element_name + ': Invalid content_element name, can only contain alpha-numeric characters, underscores, or dashes');
            else prependPropFile(tmpl.content, content_element_name, tmplbasepath + '.' + content_element_name + '.ejs');
            if(!('title' in tmpl.content_elements[content_element_name])) tmpl.content_elements[content_element_name].title = content_element_name;
          }
          _this.PageTemplates[tmplname] = tmpl;
        }
        else if(templateType=='menu'){
          if(!tmpl.content) tmpl.content = {};
          prependPropFile(tmpl.content, 'body', tmplbasepath + '.ejs');
          _this.MenuTemplates[tmplname] = tmpl;
        }
        else if(templateType=='component'){
          if(!tmpl.content) tmpl.content = '';
          prependPropFile(tmpl, 'content', tmplbasepath + '.ejs');
          _this.Components[tmplname] = tmpl;
        }
      }
    }
  }

  var modeldirs = this.jsh.getModelDirs();
  for (var i = 0; i < modeldirs.length; i++ ) {
    LoadTemplatesFolder('page', path.normalize(modeldirs[i].path + '../views/templates/page/'));
    LoadTemplatesFolder('menu', path.normalize(modeldirs[i].path + '../views/templates/menu/'));
    LoadTemplatesFolder('component', path.normalize(modeldirs[i].path + '../views/templates/component/'));
  }
  _this.PageTemplates['<Raw Text>'] = {
    title: '<Raw Text>',
    raw: true,
    content_elements: { body: { type: 'texteditor', title: 'Body' } },
    content: {}
  };

  this.jsh.Config.macros.CMS_PAGE_TEMPLATES = [];
  var frontend_PageTemplates = {};
  for(var tmplname in this.PageTemplates){
    var tmpl = this.PageTemplates[tmplname];
    if(typeof _this.defaultPageTemplate == 'undefined') _this.defaultPageTemplate = tmplname;
    this.jsh.Config.macros.CMS_PAGE_TEMPLATES.push({ "code_val": tmplname, "code_txt": tmpl.title });

    var frontend_template = {
      editor: undefined,
      publish: undefined
    };
    if(tmpl.remote_template){
      if('editor' in tmpl.remote_template) frontend_template.editor = tmpl.remote_template.editor;
      if('publish' in tmpl.remote_template) frontend_template.publish = tmpl.remote_template.publish;
    }
    frontend_PageTemplates[tmplname] = frontend_template;
  }
  this.jsh.Sites['main'].globalparams.PageTemplates = frontend_PageTemplates;
  this.jsh.Sites['main'].globalparams.defaultPageTemplate = _this.defaultPageTemplate;

  this.jsh.Config.macros.CMS_MENU_TEMPLATES = [];
  var frontend_MenuTemplates = {};
  for(var tmplname in this.MenuTemplates){
    var tmpl = this.MenuTemplates[tmplname];
    if(typeof _this.defaultMenuTemplate == 'undefined') _this.defaultMenuTemplate = tmplname;
    this.jsh.Config.macros.CMS_MENU_TEMPLATES.push({ "code_val": tmplname, "code_txt": tmpl.title });

    var frontend_template = {
      publish: undefined
    };
    if(tmpl.remote_template){
      if('publish' in tmpl.remote_template) frontend_template.publish = tmpl.remote_template.publish;
    }
    frontend_MenuTemplates[tmplname] = frontend_template;
  }
  this.jsh.Sites['main'].globalparams.MenuTemplates = frontend_MenuTemplates;
  this.jsh.Sites['main'].globalparams.defaultMenuTemplate = _this.defaultMenuTemplate;
}

jsHarmonyCMS.prototype.getFactoryConfig = function(){
  var _this = this;
  var jsh = _this.jsh;

  var configFactory = jsh.Modules['jsHarmonyFactory'].Config;

  jsh.Modules['jsHarmonyFactory'].onCreateServer.push(function(server){
    server.app.use('/js/jsharmony-cms.js', function(req, res){
      if(_this.Config.debug_params.no_cache_client_js) _this.LoadClientJS();
      req.jshsite = jsh.Sites['main'];
      var baseurl = req.jshsite.baseurl||'';
      if(baseurl.indexOf('//')<0) baseurl = req.protocol + '://' + req.get('host') + baseurl;
      var cookie_suffix = Helper.GetCookieSuffix(req, jsh);
      var editorjs = ejs.render(jsh.Cache['js/jsharmony-cms.js'], { jsh: jsh, req: req, baseurl: baseurl, cookie_suffix: cookie_suffix, _: _ });
      return res.end(editorjs);
    });
    server.app.use(jsHarmonyRouter.PublicRoot(path.join(__dirname, 'public')));
  });

  /**********************
  *** TASK SCHEDULER ***
  **********************/
  configFactory.scheduled_tasks['deploy'] = {
    action: configFactory.Helper.JobProc.ExecuteSQL("jsHarmonyCMS_GetNextDeployment", function(rslt){
      if(rslt && rslt.length && rslt[0] && rslt[0].length){
        var deployment = rslt[0][0];
        _this.funcs.deploy.call(_this.jsh.AppSrv, deployment.deployment_id);
      }
    }),
    options: {
      quiet: true
    },
    when: function (curdt, lastdt) {  //return true if the job should run
      return (curdt.getTime() - lastdt.getTime() > _this.Config.deploymentJobDelay);
    }
  };

  return {
    globalparams: {
      'PageTemplates': {},
      'MenuTemplates': {}
    },
    public_apps: [
      { '*':  express.static(path.join(_this.basepath, 'public')) },
      { 
        '/jsharmony.css': function (req, res) {
          //Concatenate jsh css with system css
          _this.jsh.getSystemCSS(function(systemCSS){
            HelperFS.outputContent(req, res, ejs.render(systemCSS, { req: req, rootcss: req.jshsite.rootcss, _: _ }),'text/css');
          });
        }
      }
    ],
    private_apps: [
      {
        '/_funcs/page/:page_key': _this.funcs.page,
        '/_funcs/components/:branch_id': _this.funcs.components,
        '/_funcs/editor_url': _this.funcs.getPageEditorUrl,
        '/_funcs/media/:media_key/:thumbnail': _this.funcs.media,
        '/_funcs/media/:media_key/': _this.funcs.media,
        '/_funcs/media/': _this.funcs.media,
        '/_funcs/menu/:menu_key/': _this.funcs.menu,
        '/_funcs/sitemap/:sitemap_key/': _this.funcs.sitemap,
        '/_funcs/deploy': _this.funcs.deploy_req,
        '/_funcs/deployment_log/:deployment_id': _this.funcs.deployment_log,
        '/_funcs/diff': _this.funcs.diff,
        '/_funcs/validate': _this.funcs.validate_req,
        '/_funcs/conflict': _this.funcs.conflict,
        '/_funcs/merge/:merge_type': _this.funcs.req_merge,
        '/_funcs/begin_merge': _this.funcs.req_begin_merge,
      }
    ]
  }
}

module.exports = exports = jsHarmonyCMS;