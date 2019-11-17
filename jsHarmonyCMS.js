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

  _this.Templates = {};
  _this.DefaultTemplate = undefined;
  _this.Layouts = {};
  _this.Elements = {};
  _this.funcs = new funcs(_this);
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

  HelperFS.createFolderIfNotExistsSync(path.join(this.jsh.Config.datadir,'page'));
  HelperFS.createFolderIfNotExistsSync(path.join(this.jsh.Config.datadir,'media'));
  HelperFS.createFolderIfNotExistsSync(path.join(this.jsh.Config.datadir,'menu'));

  if(!_.isEmpty(_this.Config.media_thumbnails)){
    _this.jsh.TestImageMagick('jsHarmonyCMS > Media Thumbnails');
  }
  
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

  function LoadTemplatesFolder(dpath){
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
        _this.jsh.LogInit_INFO('Loading ' + tmplname);
        var tmpl = _this.jsh.ParseJSON(fpath, _this.name, 'Template ' + tmplname);
        prependPropFile(tmpl, 'body', tmplbasepath + '.ejs');
        prependPropFile(tmpl, 'header', tmplbasepath + '.header.ejs');
        prependPropFile(tmpl, 'footer', tmplbasepath + '.footer.ejs');
        prependPropFile(tmpl, 'css', tmplbasepath + '.css');
        prependPropFile(tmpl, 'js', tmplbasepath + '.js');
        if(!tmpl.title) tmpl.title = tmplname;
        _this.Templates[tmplname] = tmpl;
      }
    }
  }

  var modeldirs = this.jsh.getModelDirs();
  for (var i = 0; i < modeldirs.length; i++ ) {
    var dpath = path.normalize(modeldirs[i].path + '../views/templates/');
    LoadTemplatesFolder(dpath);
  }
  _this.Templates['<Raw Text>'] = {
    title: '<Raw Text>'
  };

  this.jsh.Config.macros.CMS_TEMPLATES = [];
  var client_templates = {};
  for(var tmplname in this.Templates){
    var tmpl = this.Templates[tmplname];
    if(typeof _this.DefaultTemplate == 'undefined') _this.DefaultTemplate = tmplname;
    var tmpl_lov = { "code_val": tmplname, "code_txt": tmpl.title };
    this.jsh.Config.macros.CMS_TEMPLATES.push(tmpl_lov);

    var client_template = {
      editor: undefined,
      publish: undefined
    };
    if(tmpl.remote_template){
      if('editor' in tmpl.remote_template) client_template.editor = tmpl.remote_template.editor;
      if('publish' in tmpl.remote_template) client_template.publish = tmpl.remote_template.publish;
    }
    client_templates[tmplname] = client_template;
  }
  this.jsh.Sites['main'].globalparams.templates = client_templates;
  this.jsh.Sites['main'].globalparams.default_template = _this.DefaultTemplate;
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
    when: function (curdt, lastdt) {  //return true if the job should run
      return (curdt.getTime() - lastdt.getTime() > _this.Config.deploymentJobDelay);
    }
  };

  return {
    globalparams: {
      'templates': {}
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
        '/_funcs/media/:media_key/:thumbnail': _this.funcs.media,
        '/_funcs/media/:media_key/': _this.funcs.media,
        '/_funcs/media/': _this.funcs.media,
        '/_funcs/menu/:menu_key/': _this.funcs.menu,
        '/_funcs/deploy': _this.funcs.deploy_req,
        '/_funcs/diff': _this.funcs.diff,
      }
    ]
  }
}

module.exports = exports = jsHarmonyCMS;