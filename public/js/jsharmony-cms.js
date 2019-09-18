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

window.jsHarmonyCMS = new (function(){
  var _this = this;
  var jsh = undefined;
  var XExt = undefined;
  var XForm = undefined;

  //Load jsHarmony
  this._baseurl = 'http://localhost:3500/';
  this.page = null;
  this.page_key = null;
  this.template = null;
  this.views = {};
  this.origMarginTop = undefined;
  this.editorBarDocked = false;
  this.hasChanges = false;

  this.loadScript = function(url, cb){
    var script = document.createElement('script');
    if(cb) script.onload = cb;
    script.src = url;
    document.head.appendChild(script);
  }

  this.loadCSS = function(url, cb){
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.media = 'all';
    document.head.appendChild(link);
  }

  this.addStyle = function(id, css){
    var style = document.createElement('style');
    style.type = 'text/css';
    style.media = 'all';
    style.id = id;
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  this.removeStyle = function(id){
    var elem = document.getElementById(id);
    if(elem) elem.parentNode.removeChild(elem);
  }

  this.init = function(){
    _this.loadScript(_this._baseurl+'js/jsHarmony.js', function(){
      jsh = window.jshInstance = new jsHarmony({
        _debug: true,
        _BASEURL: _this._baseurl,
        forcequery: {},
        home_url: _this._baseurl,
        uimap: {"code_val":"code_val","code_txt":"code_txt","code_parent_id":"code_parent_id","code_icon":"code_icon","code_id":"code_id","code_parent":"code_parent","code_seq":"code_seq","code_type":"code_type"},
        _instance: "jshInstance",
        cookie_suffix: "_3500_main",
        isAuthenticated: true,
        dev: 1,
        onInit: function(){ _this.onready(); }
      });
      XExt = jsh.XExt;
      XForm = jsh.XForm;
    });
    _this.loadScript(_this._baseurl+'js/site.js');
    _this.loadScript(_this._baseurl+'application.js');
    _this.loadCSS(_this._baseurl+'jsharmony.css');
    _this.loadCSS(_this._baseurl+'jsharmony.css');
    _this.loadScript('http://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js', function(){
      WebFont.load({ google: { families: ['PT Sans', 'Roboto', 'Material Icons'] } }); 
    });
  }

  this.onready= function(){
    $('#jsharmony_cms_body').prop('contenteditable','true');
    if(jsh._GET['page_key']){
      this.loadPage(jsh._GET['page_key']);
    }
    else XExt.Alert('Page Key not defined');
  }

  this.loadPage = function(page_key){
    _this.page_key = page_key;
    var url = '../_funcs/page/'+_this.page_key;
    //Execute the C_CUSTOM_GET_C model
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        //Populate arrays + create editor
        _this.page = rslt.page;
        _this.template = rslt.template;
        _this.views = rslt.views;
        _this.createEditor();
      }
      else XExt.Alert('Error loading page');
    }, function (err) {
      //Optionally, handle errors
    });
  }

  this.createEditor = function(){
    if(!_this.page) return;
    document.title = (_this.page.seo && _this.page.seo.title ? _this.page.seo.title : _this.page.title);
    $('#jsharmony_cms_body').html(_this.page.body);
    _this.page.body = $('#jsharmony_cms_body').html();

    //CSS
    _this.removeStyle('jsharmony_cms_template_style');
    _this.removeStyle('jsharmony_cms_page_style');
    _this.addStyle('jsharmony_cms_template_style',_this.template.css);
    _this.addStyle('jsharmony_cms_page_style',_this.page.css);

    //JS
    var js = (_this.template.js||'')+(_this.page.js||'');
    if(js) $('head').append('<script type="text/javascript">'+js+'</script>');

    //HEADER
    var header = (_this.template.header||'')+(_this.page.header||'');
    if(header) $('head').append(header);
    
    //FOOTER
    $('#jsharmony_cms_footer').html((_this.template.footer||'')+(_this.page.footer||''));

    //CKEDITOR.disableAutoInline = true;
    //CKEDITOR.inline( 'editor1' );
    //config.startupFocus
    XExt.CKEditor('', undefined, function(){
      //window.CKEDITOR.config.startupFocus = true;
    });

    this.createEditorBar();
    $('#jsharmony_cms_editor_bar .title').html('<b>Title:</b> '+XExt.escapeHTML(_this.page.title));
    $(window).bind('beforeunload', function(){
      _this.getValues();
      if(_this.hasChanges) return 'You have unsaved changes.  Are you sure you want to leave this page?';
    });
  }

  this.createEditorBar = function(){
    _this.addStyle('jsharmony_cms_editor_css',_this.views['jsh_cms_editor.css']);
    jsh.root.append(_this.views['jsh_cms_editor']);
    this.origMarginTop = $('body').css('margin-top');
    this.toggleEditorBarAutoHide(false);
  }

  this.toggleEditorBarAutoHide = function(val){
    if(typeof val =='undefined') val = !this.editorBarDocked;
    this.editorBarDocked = !!val;

    if(this.editorBarDocked){
      $('body').css('margin-top', this.origMarginTop);
    }
    else {
      var barHeight = $('#jsharmony_cms_editor_bar').outerHeight();
      $('body').css('margin-top', barHeight+'px');
    }
    $('#jsharmony_cms_editor_bar .autoHideEditorBar').toggleClass('enabled',!val);
  }

  this.getValues = function(){
    var editorContent = $('#jsharmony_cms_body').html();
    if(editorContent != _this.page.body){
      _this.page.body = editorContent;
      _this.hasChanges = true;
    }
  }

  this.save = function(){
    //Get new body
    this.getValues();

    //Execute the save function
    var url = '../_funcs/page/'+_this.page_key;
    XExt.CallAppFunc(url, 'post', _this.page, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.page.body = $('#jsharmony_cms_body').html();
        _this.hasChanges = false;
        window.location.reload(true);
      }
      else XExt.Alert('Error loading page');
    }, function (err) {
      //Optionally, handle errors
    });
  }

})();
window.jsHarmonyCMS.init();