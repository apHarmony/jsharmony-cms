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

var jsHarmonyCMSUtil = require('./jsHarmonyCMS.Util.js');
var jsHarmonyCMSLoader = require('./jsHarmonyCMS.Loader.js');
var jsHarmonyCMSToolbar = require('./jsHarmonyCMS.Toolbar.js');
var jsHarmonyCMSController = require('./jsHarmonyCMS.Controller.js');
var jsHarmonyCMSEditor = require('./jsHarmonyCMS.Editor.js');
var jsHarmonyCMSComponentManager = require('./jsHarmonyCMS.ComponentManager.js');
var jsHarmonyCMSControllerExtensions = require('./jsHarmonyCMS.ControllerExtensions.js');

var jsHarmonyCMS = function(options){
  var _this = this;

  this._instance = '';
  this.App = {}; //Variable data store for implementations

  this.loader = new jsHarmonyCMSLoader(this);
  this.util = new jsHarmonyCMSUtil(this);
  this.toolbar = undefined; //Loaded after init
  this.controller = undefined; //Loaded after init
  this.controllerExtensions = undefined; // Loaded after init
  this.editor = undefined; //Loaded after init
  this.componentManager = undefined; // Loaded after init
  this.views = {
    'jsh_cms_editor.css': '',
    'jsh_cms_editor': '',
  };


  this.jsh = undefined;
  this._baseurl = jsHarmonyCMS._baseurl; //Populated by jsHarmonyCMS.js.ejs
  this._cookie_suffix = jsHarmonyCMS._cookie_suffix; //Populated by jsHarmonyCMS.js.ejs
  this.readonly = false;
  this.devMode = false;
  this.isInitialized = false;
  this.defaultControllerUrl = 'js/jsHarmonyCMS.Controller.page.js';

  this.branch_id = undefined;
  this.token = undefined;
  this.site_config = {};
  this.filePickerCallback = null;        //function(url)

  this.onInit = null;                    //function(jsh)
  this.onLoad = null;                    //function(jsh)
  this.onLoaded = null;                  //function(jsh)
  this.onGetControllerUrl = null;        //function() => url
  this.onFilePickerCallback = null;      //function(jdata)
  this.onGetFilePickerParameters = null; //function(filePickerType, url)
  this.onRender = null;                  //function(page)
  this.onRendered = null;                //function(page)
  this.onTemplateLoaded = function(f){ $(document).ready(f); };
  this.onBeforeTemplateInit = function(f){ return f(); };
  this.onBeforeInit = function(f){ return f(); };

  for(var key in options){
    if(key in _this) _this[key] = options[key];
  }


  var loader = _this.loader;
  var util = _this.util;
  var jsh = null;
  var XExt = null;
  var $ = null;
  var async = null;
  var loadErrors = [];


  this.init = function(){
    loader.StartLoading(undefined, 'CMS Init');
    //Load jsHarmony
    util.loadScript(_this._baseurl+'js/jsHarmony.js', function(){
      var jshInit = false;
      jsh = _this.jsh = window.jshInstance_CMS = new window.jsHarmony({
        _show_system_errors: true,
        _BASEURL: _this._baseurl,
        _PUBLICURL: _this._baseurl,
        forcequery: {},
        home_url: _this._baseurl,
        uimap: {'code_val':'code_val','code_txt':'code_txt','code_parent_id':'code_parent_id','code_icon':'code_icon','code_id':'code_id','code_parent':'code_parent','code_seq':'code_seq','code_type':'code_type'},
        _instance: 'jshInstance_CMS',
        _dialogBaseClass: 'jsharmony_cms_dialog',
        cookie_suffix: _this._cookie_suffix,
        isAuthenticated: true,
        dev: 1,
        urlrouting: false,
        onInit: function(){
          jshInit = true;
        }
      });
      $ = jsh.$;
      XExt = jsh.XExt;
      async = jsh.async;

      if(jsh._GET['jshcms_token']) _this.token = jsh._GET['jshcms_token'];

      _this.toolbar = new jsHarmonyCMSToolbar(jsh, _this);
      _this.controller = new jsHarmonyCMSController(jsh, _this);
      _this.editor = _this.createCoreEditor();
      _this.componentManager = new jsHarmonyCMSComponentManager(jsh, _this);
      _this.controllerExtensions = new jsHarmonyCMSControllerExtensions(jsh, _this);

      
      async.waterfall([
        function(init_cb){
          XExt.waitUntil(
            function(){ return !($('.jshCmsInitializing').length); },
            init_cb
          );
        },
        function(init_cb){ XExt.execif(_this.onBeforeInit, function(){ _this.onBeforeInit(init_cb); }, init_cb); },
        function(){
          _this.toolbar.saveOrigOffsets({ preload: true });
          if(_this.onInit) _this.onInit(jsh);

          var controllerUrl = '';
          if(_this.onGetControllerUrl) controllerUrl = _this.onGetControllerUrl();
          if(!controllerUrl) controllerUrl = _this._baseurl + _this.defaultControllerUrl;

          jsh.DefaultErrorHandler = XExt.chain(jsh.DefaultErrorHandler, function(num, txt){
            if(num==-10){
              XExt.Alert('Session token expired');
              return true;
            }
          });

          jsh.xLoader = loader;
          async.parallel([
            function(cb){ util.loadScript(_this._baseurl+'js/jsHarmony.render.js', function(){
              jsh.Config.debug_params.monitor_globals = false;
              cb();
            }); },
            function(cb){ util.loadScript(controllerUrl, function(){ return cb(); }); },
            function(cb){ XExt.waitUntil(function(){ return jshInit; }, function(){ cb(); }, undefined, 50); },
            function(cb){
              var qs = {};
              if(_this.token) qs.jshcms_token = _this.token;
              jsh.XForm.Get(_this._baseurl+'_funcs/site_config', qs, {}, function(rslt){
                if(rslt) _this.site_config = rslt.siteConfig || {};
                return cb();
              }, function(err){
                if(err && (err.Number==-10)) loadErrors.push('Session token expired.  Please re-open the page');
                else loadErrors.push(err);
                return cb();
              });
            },
          ], function(err){
            setTimeout(function(){ _this.load(); }, 1);
          });
        },
      ]);
    });
    util.loadCSS(_this._baseurl+'application.css?rootcss=.jsharmony_cms');
    util.loadScript('https://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js', function(){
      window.WebFont.load({ google: { api: 'https://fonts.googleapis.com/css', families: ['PT Sans', 'Roboto', 'Roboto:bold', 'Material Icons'] } });
    });
    window.addEventListener('message', this.onmessage);
  };

  this.load = function(){
    _this.toolbar.saveOrigOffsets({ refreshExisting: true });
    if(loadErrors.length){
      loader.StopLoading();
      return XExt.Alert((typeof loadErrors[0] == 'string') ? loadErrors[0] : JSON.stringify(loadErrors[0]));
    }
    if(_this.onLoad) _this.onLoad(jsh);
    $('[cms-content-editor]').prop('contenteditable','true');
    if(jsh._GET['branch_id']){
      _this.branch_id = jsh._GET['branch_id'];
      async.parallel([
        function(cb){ _this.componentManager.load(cb); },
      ], function(err){
        if(err){
          loader.StopLoading();
          return XExt.Alert(err.toString());
        }
      });
      _this.controller.init(function(err){
        if(!err){
          if(_this.onLoaded) _this.onLoaded(jsh);
        }
      });
    }
    else{
      if(jsh.globalparams.isWebmaster && _this.controller.initDevMode){
        _this.devMode = true;
        _this.controller.initDevMode(function(err){
          loader.StopLoading();
          if(!err){
            if(_this.onLoaded) _this.onLoaded(jsh);
          }
        });
      }
      else {
        loader.StopLoading();
        XExt.Alert('Branch ID not defined in querystring');
      }
    }
  };

  this.refreshLayout = function(){
    var wh = $(window).height();
    var barh = _this.toolbar.getHeight();
    $('#jsharmony_cms_page_toolbar .jsharmony_cms_tabcontrol_container').css('max-height', (wh-barh)+'px');
  };

  this.onmessage = function(event){
    var data = (event.data || '').toString();
    if(_this.editor && _this.editor.picker && _this.editor.picker.onmessage(event, data)) return;
  };

  this.fatalError = function(err){
    if(loader) loader.ClearLoading();
    if(_this.devMode && _this.toolbar && _this.toolbar.errors.length) _this.toolbar.showError(err.toString());
    else if(XExt) XExt.Alert(err.toString());
    else alert(err.toString());
    throw new Error(err);
  };

  this.createCoreEditor = function() {
    var el = $('<div id="jsharmony_cms_content_editor_toolbar"></div>').prependTo('body');
    return new jsHarmonyCMSEditor(jsh, _this, el[0]);
  };

  this.createJsHarmonyCMSEditor = function(toolbarElement) {
    return new jsHarmonyCMSEditor(jsh, _this, toolbarElement);
  };

  //Run Init
  _this.init();
};

global.jsHarmonyCMS = jsHarmonyCMS;
