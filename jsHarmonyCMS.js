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
      editor: '/page_editor/%%%page_id%%%',
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

  _this.jsh.Modules['jsHarmonyFactory'].onCreateServer.push(function(server){
    server.app.use(jsHarmonyRouter.PublicRoot(path.join(__dirname, 'public')));
  });

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
        '/_funcs/page/:page_id': _this.funcs.page,
        '/_funcs/publish': _this.funcs.publish,
      },
      {
        //Page Editor
        '/page_editor/*': function(req, res, next){
          var jshrouter = this;
          var verb = req.method.toLowerCase();
          var jsh = _this.jsh;
          var appsrv = jsh.AppSrv;
          var XValidate = jsh.XValidate;
          var sql = '';
          var sql_ptypes = [];
          var sql_params = {};
          var dbtypes = appsrv.DB.types;

          //Check if user has access to page editor model
          var model = jsh.getModel(req, _this.namespace + 'Page_Editor');
          if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }
          if (!('_DBContext' in req) || (req._DBContext == '') || (req._DBContext == null)) { return Helper.GenError(req, res, -30, 'Invalid request.'); }
          
          if(!req.params || !req.params[0]) return next();
          var page_id = req.params[0];

          if(verb == 'get') {
            //Check if tutorial exists
            sql = 'select page_id,page_key,page_title,page_path,page_tags,page_author,template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang from '+(_this.schema?_this.schema+'.':'')+'page where page_id=@page_id';
            sql_ptypes = [dbtypes.BigInt];
            sql_params = { 'page_id': page_id };

            //Validate Parameters
            var validate = new XValidate();
            validate.AddValidator('_obj.page_id', 'page_id', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
            var verrors = _.merge(verrors, validate.Validate('B', sql_params));
            if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

            appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
              if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
              else {
                if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Page ID'); }
                var page = rslt[0][0];
                //Get Page Template
                var template_id = page['template_id'];
                var template_body = _this.Templates[template_id].body||'';

                //Load Page Content from disk
                var page_file = path.join(path.join(jsh.Config.datadir,'page'),page_id.toString()+'.json');
                var content = jsh.ParseJSON(page_file, _this.name, 'Page ID#'+page_id);

                //Resolve EJS
                var ejsparams = {
                  page: content
                };
                var page_html = ejs.render(template_body, ejsparams);

                Helper.execif(_this.Config.onRender, function(render_cb){
                  _this.Config.onRender('editor', page_html, function(rslt){ page_html = rslt; return render_cb(); });
                }, function(){
                  //Render Page Template
                  //  Inject jsHarmony Code + Editor Code
                  //Inject CKEditor
                  //Override Renderer - Handle Includes onPageRender('edit'/'publish', cb)
                  //Add bar on top (Save / Save & Close / Pin icon / Properties icon with popup for page settings)
                  //Add elements / layouts

                  res.end(page_html);
                });
              }
            });
            return;

            var filepath = _this.tutfolder+'/'+tutorial;
            if(!(tutorial in _this.tutorials)){
              if(tutorial in _this.tutids){
                return Helper.Redirect302(res,'/tutorials/'+_this.tutids[tutorial]);
              }
              return next();
            }
            HelperRender.reqGet(req, res, jshrouter.jsh, 'tutorials_home', 'jsHarmony Tutorials',
              { basetemplate: 'tutorials', params: { req: req, menu: _this.tutmenu, tutids: _this.tutids, tutorials: _this.tutorials, popups: jshrouter.jsh.Popups } }, function(){});

          }
        }
      }
    ]
  }
}

module.exports = exports = jsHarmonyCMS;