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
  
  return cb();
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

  this.jsh.Config.macros.CMS_TEMPLATES = [];
  var client_templates = {};
  for(var tmplname in this.Templates){
    var tmpl = this.Templates[tmplname];
    var tmpl_lov = { "code_val": tmplname, "code_txt": tmpl.title };
    this.jsh.Config.macros.CMS_TEMPLATES.push(tmpl_lov);

    var client_template = {
      editor: '/page_editor/%%%page_key%%%',
      publish: undefined
    };
    if(tmpl.remote_template){
      if('editor' in tmpl.remote_template) client_template.editor = tmpl.remote_template.editor;
      if('publish' in tmpl.remote_template) client_template.publish = tmpl.remote_template.publish;
    }
    client_templates[tmplname] = client_template;
  }
  this.jsh.Sites['main'].globalparams.templates = client_templates;
}

jsHarmonyCMS.prototype.getFactoryConfig = function(){
  var _this = this;

  var configFactory = _this.jsh.Modules['jsHarmonyFactory'].Config;

  _this.jsh.Modules['jsHarmonyFactory'].onCreateServer.push(function(server){
    server.app.use(jsHarmonyRouter.PublicRoot(path.join(__dirname, 'public')));
  });

  /**********************
  *** TASK SCHEDULER ***
  **********************/
  configFactory.scheduled_tasks['deploy'] = {
    action: configFactory.Helper.JobProc.ExecuteSQL("select deployment_id from "+_this.schema+".deployment where deployment_sts='PENDING' and strftime('%Y-%m-%dT%H:%M:%f',deployment_date) <= strftime('%Y-%m-%dT%H:%M:%f',%%%%%%jsh.map.timestamp%%%%%%) order by deployment_date asc;", function(rslt){
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
        '/_funcs/deploy': _this.funcs.deploy_req,
        '/_funcs/diff': _this.funcs.diff,
      }
    ]
  }
}

module.exports = exports = jsHarmonyCMS;