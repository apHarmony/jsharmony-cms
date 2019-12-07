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
  var XValidate = undefined;
  var $ = undefined;

  //Load jsHarmony
  this._baseurl = <%-JSON.stringify(baseurl)%>;
  this._cookie_suffix = <%-JSON.stringify(cookie_suffix)%>;
  this.page = null;
  this.page_key = null;
  this.template = null;
  this.views = {};
  this.authors = [];
  this.role = '';
  this.readonly = false;
  this.origMarginTop = undefined;
  this.editorBarDocked = false;
  this.hasChanges = false;
  this.isInitialized = false;
  this.isLoading = false;
  this.loadQueue = [];
  this.loadObj = {main:1};

  this.StartLoading = function(obj){
    var foundObj = false;
    for(var i=0;i<this.loadQueue.length;i++){ if(obj===this.loadQueue[i]) foundObj = true; }
    if(!foundObj) this.loadQueue.push(obj);

    if(this.isLoading) return;
    this.isLoading = true;

    var loader_obj = document.getElementById('jsHarmonyCMSLoading')

    if(loader_obj){
      if(this.isInitialized) loader_obj.style.backgroundColor = 'rgba(0,0,0,0.2)';
      if($) $('#jsHarmonyCMSLoading').fadeIn();
      else loader_obj.style.display = 'block';
    }
    else {
      var loader_obj = document.createElement('div');
      loader_obj.id = 'jsHarmonyCMSLoading';
      //loader_obj.style.backgroundColor = 'rgba(0,0,0,0.5)';
      loader_obj.style.backgroundColor = 'rgba(255,255,255,1)';
      loader_obj.style.position = 'fixed';
      loader_obj.style.top = '0px';
      loader_obj.style.left = '0px';
      loader_obj.style.bottom = '0px';
      loader_obj.style.width = '100%';
      loader_obj.style.zIndex = 2147483641;
      loader_obj.style.cursor = 'wait';
      document.body.appendChild(loader_obj);

      var loader_img_container = document.createElement('div');
      loader_img_container.style.position = 'absolute';
      loader_img_container.style.top = '50%';
      loader_img_container.style.left = '50%';
      loader_obj.appendChild(loader_img_container);

      var loader_img = document.createElement('img');
      loader_img.src = _this._baseurl + 'images/loading-cms.svg';
      loader_img.style.height = '100px';
      loader_img.style.width = '100px';
      loader_img.style.position = 'relative';
      loader_img.style.top = '-50px';
      loader_img.style.left = '-50px';
      loader_img_container.appendChild(loader_img);
    }
  }

  this.StopLoading = function(obj){
    for(var i=0;i<this.loadQueue.length;i++){ if(obj===this.loadQueue[i]){ this.loadQueue.splice(i, 1); i--; } }
    if(this.loadQueue.length) return;

    this.isLoading = false;
    if(jsh) $('#jsHarmonyCMSLoading').stop(true).fadeOut();
    else document.getElementById('jsHarmonyCMSLoading').style.display = 'none';
  }

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
    _this.StartLoading(_this.loadObj);
    _this.loadScript(_this._baseurl+'js/jsHarmony.js', function(){
      jsh = window.jshInstance = new jsHarmony({
        _debug: true,
        _BASEURL: _this._baseurl,
        _PUBLICURL: _this._baseurl,
        forcequery: {},
        home_url: _this._baseurl,
        uimap: {"code_val":"code_val","code_txt":"code_txt","code_parent_id":"code_parent_id","code_icon":"code_icon","code_id":"code_id","code_parent":"code_parent","code_seq":"code_seq","code_type":"code_type"},
        _instance: "jshInstance",
        cookie_suffix: _this._cookie_suffix,
        isAuthenticated: true,
        dev: 1,
        onInit: function(){ _this.onready(); }
      });
      jsh.xLoader = _this;
      _this.loadScript(_this._baseurl+'application.js');
      _this.loadScript(_this._baseurl+'js/site.js');
      XExt = jsh.XExt;
      XForm = jsh.XForm;
      XValidate = jsh.XValidate;
      $ = jsh.$;
    });
    _this.loadCSS(_this._baseurl+'jsharmony.css');
    _this.loadCSS(_this._baseurl+'application.css?rootcss=.jsharmony_cms');
    _this.loadScript('http://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js', function(){
      WebFont.load({ google: { families: ['PT Sans', 'Roboto', 'Roboto:bold', 'Material Icons'] } }); 
    });
    window.addEventListener('message', this.onmessage);
  }

  this.onready = function(){
    $('.jsharmony_cms_content').prop('contenteditable','true');
    if(jsh._GET['page_key']){
      this.loadPage(jsh._GET['page_key'], jsh._GET['page_id'], function(err){ _this.StopLoading(_this.loadObj); });
    }
    else{
      _this.StopLoading(_this.loadObj);
      XExt.Alert('Page Key not defined');
    }
  }

  this.onmessage = function(event){
    var data = (event.data || '').toString();
    if(data.indexOf('ckeditor:')==0){
      data = data.substr(9);
      var jdata = JSON.parse(data);
      if(jdata.media_key){
        var newClass = 'media_key_'+jdata.media_key;
        window.CKEDITOR.tools.callFunction( jdata.CKEditorFuncNum, _this._baseurl+'_funcs/media/'+jdata.media_key+'/?media_file_id='+jdata.media_file_id, function(){
          var dialog = this.getDialog();
          var element = dialog.getContentElement('advanced', 'advCSSClasses' );
          if(!element) element = dialog.getContentElement('advanced', 'txtGenClass');
          if(element){
            var cssClassString = (element.getValue()||'');
            var cssClasses = cssClassString.split(' ');
            var foundClass = false;
            for(var i=0;i<cssClasses.length;i++){
              var cssClass = cssClasses[i].trim();
              if(cssClass==newClass) foundClass = true;
            }
            if(!foundClass) element.setValue((cssClassString.trim()+' '+newClass).trim());
          }
        });
      }
      else if(jdata.page_key){
        var newClass = 'page_key_'+jdata.page_key;
        window.CKEDITOR.tools.callFunction( jdata.CKEditorFuncNum, _this._baseurl+'_funcs/pages/'+jdata.page_key+'/', function(){
          var dialog = this.getDialog();
          var element = dialog.getContentElement('advanced', 'advCSSClasses' );
          if(element){
            var cssClassString = (element.getValue()||'');
            var cssClasses = cssClassString.split(' ');
            var foundClass = false;
            for(var i=0;i<cssClasses.length;i++){
              var cssClass = cssClasses[i].trim();
              if(cssClass==newClass) foundClass = true;
            }
            if(!foundClass) element.setValue((cssClassString.trim()+' '+newClass).trim());
          }
        });
      }
      else XExt.Alert('Invalid response from File Browser: '+JSON.stringify(jdata));
    }
  }

  this.loadPage = function(page_key, page_id, onComplete){
    _this.page_key = page_key;
    var url = '../_funcs/page/'+_this.page_key;
    if(page_id) url += '?page_id=' + page_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        //Populate arrays + create editor
        _this.hasChanges = false;
        $('#jsharmony_cms_editor_bar a.button.save').toggleClass('hasChanges', false);
        _this.page = rslt.page;
        _this.template = rslt.template;
        _this.views = rslt.views;
        _this.authors = rslt.authors;
        _this.role = rslt.role;
        _this.readonly = (_this.role=='VIEWER')||(page_id);
        if(!_this.isInitialized) _this.createEditor();
        _this.renderEditor();
        if(!_this.isInitialized){
          _this.onEditorContentLoaded(function(){ if(onComplete) onComplete(); });
          _this.isInitialized = true;
        }
        else{ if(onComplete) onComplete(); }
      }
      else{
        if(onComplete) onComplete(new Error('Error Loading Page'));
        XExt.Alert('Error loading page');
      }
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  };

  this.renderEditor = function(){
    if(!_this.page) return;
    document.title = _this.page.title;
    var jeditorbar = $('#jsharmony_cms_editor_bar');

    //Title
    $('#jsharmony_cms_title').html(_this.page.title);
    jeditorbar.find('.title').html('<b>Title:</b> '+XExt.escapeHTML(_this.page.title));

    //Content
    for(var key in _this.template.content_elements){
      _this.setEditorContent(key, _this.page.content[key])
      _this.page.content[key] = _this.getEditorContent(key);
    }

    //CSS
    _this.removeStyle('jsharmony_cms_template_style');
    _this.removeStyle('jsharmony_cms_page_style');
    _this.addStyle('jsharmony_cms_template_style',_this.template.css);
    _this.addStyle('jsharmony_cms_page_style',_this.page.css);
    
    //Header
    var header = (_this.template.header||'')+(_this.page.header||'');
    if(header) $('head').append(header);
    
    //Footer
    $('#jsharmony_cms_footer').html((_this.template.footer||'')+(_this.page.footer||''));

    //Page Settings
    var authors = [].concat(_this.authors);
    if(_this.role=='PUBLISHER') authors.unshift({ code_val: '', code_txt: 'Please select...' });
    jsh.XExt.RenderLOV(null, jeditorbar.find('.page_settings_author'), authors);
    _.each(['title','tags','author','css','header','footer'], function(key){ jeditorbar.find('.page_settings').find('.page_settings_'+key).val(_this.page[key]||''); });
    _.each(['title','keywords','metadesc','canonical_url'], function(key){ jeditorbar.find('.page_settings').find('.page_settings_seo_'+key).val(_this.page.seo[key]||''); });
    XExt.TagBox_Refresh(jeditorbar.find('.page_settings_tags_editor'), jeditorbar.find('.page_settings_tags'));

    
    if(_this.readonly){
      jeditorbar.find('.save').hide();
      jeditorbar.find('.readonly').show();
      jeditorbar.find('.page_settings_ctrl,textarea,select').each(function(){ _this.disableControl($(this)); });
    }
  }

  this.disableControl = function(jctrl){
    jctrl.removeClass('editable');
    jctrl.addClass('uneditable');

    if (jctrl.hasClass('dropdown')) jctrl.prop('disabled', true);
    else if (jctrl.hasClass('checkbox')) jctrl.prop('disabled', true);
    else if(jctrl.hasClass('xtagbox_base')){
      jctrl.prev().addClass('uneditable');
      jctrl.prev().find('input').prop('disabled', true);
    }
    else jctrl.prop('readonly', true);
  }

  this.setEditorContent = function(id, val){
    $('.jsharmony_cms_content[data-id='+id+']').html(val);
  }

  this.getEditorContent = function(id){
    return $('.jsharmony_cms_content[data-id='+id+']').html();
  }

  this.createEditor = function(){
    if(!_this.page) return;

    if(_this.readonly){
      $('.jsharmony_cms_content').prop('contenteditable', false);
    }
    else {
      $('<div id="jsharmony_cms_content_editor_toolbar"></div>').prependTo('body');

      //Initialize Editor
      XExt.CKEditor('', undefined, function(){
        window.CKEDITOR.disableAutoInline = true;
        //window.CKEDITOR.config.startupFocus = true;
        window.CKEDITOR.disableAutoInline = true;
        window.CKEDITOR.config.allowedContent = true;
        window.CKEDITOR.config.disableNativeSpellChecker = false;
        window.CKEDITOR.config.filebrowserBrowseUrl = _this._baseurl+'jsHarmonyCMS/Link_Browser';
        window.CKEDITOR.config.filebrowserImageBrowseUrl = _this._baseurl+'jsHarmonyCMS/Media_Browser';
        window.CKEDITOR.config.removeDialogTabs = 'link:upload;image:Upload;image:Link';
        window.CKEDITOR.config.skin = 'moono-lisa';
        window.CKEDITOR.on('instanceCreated', function(event){
          var editor = event.editor;
          editor.on('configLoaded', function(){
          });
          editor.on('focus', function(){
            $('#jsharmony_cms_content_editor_toolbar').stop(true).fadeIn(300);
            _this.refreshLayout();
          });
          editor.on('blur', function(){
            $('#jsharmony_cms_content_editor_toolbar').stop(true).fadeOut(300);
          });
          editor.on('contentDom', function(){
            if(this.name.indexOf('jsharmony_cms_content_') != 0) return;
            var id = this.name.substr(22);
            var curbody = _this.getEditorContent(id);
            if(_this.page && _this.page.content && _this.page.content[id] && curbody) _this.page.content[id] = curbody;
          });
          editor.on('dialogHide', function(){
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            var restoreScroll = function(){ window.scrollTo(scrollLeft, scrollTop); };
            $(window).on('scroll', restoreScroll);
            window.setTimeout(function(){ $(window).off('scroll', restoreScroll); }, 250);
          });
        });
        var ckeditorConfig = {
          extraPlugins: 'sharedspace,sourcedialog,dragresize,pastetext,youtube',
          removePlugins: 'floatingspace,maximize,resize',
          sharedSpaces: {
            top: 'jsharmony_cms_content_editor_toolbar'
          },
          toolbar: [
            ['Format'],
            ['Bold', 'Italic', 'Underline', '-', 'Undo', 'Redo', '-', 'Cut', 'Copy', 'Paste', 'PasteText', 'Find', 'Replace', '-', 'Outdent', 'Indent', '-', 'Print'],
            ['NumberedList', 'BulletedList', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock'],
            ['Link', 'Image', 'Youtube', 'Table', 'Styles'],
            ['Sourcedialog']
          ]
        };
        $('.jsharmony_cms_content').each(function(){
          var jobj = $(this);
          if(!jobj.data('id')) XExt.Alert('jsharmony_cms_content area missing data-id attribute');
          if(!this.id) this.id = 'jsharmony_cms_content_' + jobj.data('id');
          window.CKEDITOR.inline(this.id, _.extend({}, ckeditorConfig));
        });
      });
      $('.jsharmony_cms_content').on('input',function(){ if(!_this.hasChanges) _this.getValues(); });

      $(window).bind('beforeunload', function(){
        _this.getValues();
        if(_this.hasChanges) return 'You have unsaved changes.  Are you sure you want to leave this page?';
      });
    }

    //Initialize Page Toolbar
    this.createEditorBar();

    //Template JS
    var js = (_this.template.js||'');
    if(js) $('head').append('<script type="text/javascript">'+js+'</script>');

    //Initialize Settings Controls
    _.each(['title','tags','author','css','header','footer'], function(key){ $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).on('input',function(){ if(!_this.hasChanges) _this.getValues(); }); });
    _.each(['title','keywords','metadesc','canonical_url'], function(key){ $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_seo_'+key).on('input',function(){ if(!_this.hasChanges) _this.getValues(); }); });

    //Initialize Tag Control
    XExt.TagBox_Render($('#jsharmony_cms_editor_bar .page_settings_tags_editor'), $('#jsharmony_cms_editor_bar .page_settings_tags'));

    $(window).on('resize', function(){ _this.refreshLayout(); });
    $(window).on('scroll', function(){ _this.refreshLayout(); });
    _this.refreshLayout();
  }

  this.refreshLayout = function(){ 
    var ww = $(window).width();
    var wh = $(window).height();
    var sleft = $(window).scrollLeft();
    var stop = $(window).scrollTop();
    var docw = $(document).width();
    var doch = $(document).height();
    var pw = ((docw > ww) ? docw : ww);
    var ph = ((doch > wh) ? doch : wh);
    var barh = $('#jsharmony_cms_editor_bar .actions').outerHeight();
    $('#jsharmony_cms_editor_bar .page_settings').css('max-height', (wh-barh)+'px');

    /*
    var contentTop = $('#jsharmony_cms_title').offset().top;
    var toolbarHeight = $('#jsharmony_cms_content_editor_toolbar').height();
    var toolbarTop = (contentTop-toolbarHeight)-10;
    var toolbarMinTop = 37;
    if(stop > (toolbarTop-toolbarMinTop)) toolbarTop = toolbarMinTop;
    else toolbarTop -= stop;
    */
   var toolbarTop = 37;
    $('#jsharmony_cms_content_editor_toolbar').css('top', toolbarTop+'px');
  }

  this.onEditorContentLoaded = function(f){
    $(document).ready(f);
  }

  this.createEditorBar = function(){
    _this.addStyle('jsharmony_cms_editor_css',_this.views['jsh_cms_editor.css']);
    jsh.root.append(_this.views['jsh_cms_editor']);
    this.origMarginTop = $('body').css('margin-top');
    this.toggleEditorBarAutoHide(false);
    jsh.InitControls();
  }

  this.toggleEditorBarAutoHide = function(val){
    if(typeof val =='undefined') val = !this.editorBarDocked;
    this.editorBarDocked = !!val;

    if(this.editorBarDocked){
      $('body').css('margin-top', this.origMarginTop);
    }
    else {
      var barHeight = $('#jsharmony_cms_editor_bar .actions').outerHeight();
      $('body').css('margin-top', barHeight+'px');
    }
    $('#jsharmony_cms_editor_bar .autoHideEditorBar').toggleClass('enabled',!val);
  }

  this.getValues = function(){
    for(var key in _this.template.content_elements){
      var editorContent = _this.getEditorContent(key);
      if(editorContent != _this.page.content[key]){
        _this.page.content[key] = editorContent;
        _this.hasChanges = true;
      }
    }
    _.each(['title','tags','author','css','header','footer'], function(key){
      var val = $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).val();
      if(val != (_this.page[key]||'')){ _this.page[key] = val; _this.hasChanges = true; }
    });
    _.each(['title','keywords','metadesc','canonical_url'], function(key){
      var val = $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_seo_'+key).val();
      if(val != (_this.page.seo[key]||'')){ _this.page.seo[key] = val; _this.hasChanges = true; }
    });
    if(_this.hasChanges){
      $('#jsharmony_cms_editor_bar a.button.save').toggleClass('hasChanges', true);
    }
  }

  this.validate = function(){
    //Get updated page data
    this.getValues();

    //Validate
    var validation = new XValidate(jsh);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_title', '_obj.title', 'Page Title', 'U', [ XValidate._v_MaxLength(1024) ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_tags', '_obj.tags', 'Tags', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_author', '_obj.author', 'Author', 'U', [ XValidate._v_Required() ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title', '_obj.seo.title', 'SEO Title Tag', 'U', [ XValidate._v_MaxLength(2048) ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_keywords', '_obj.seo.keywords', 'SEO Meta Keywords', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_metadesc', '_obj.seo.metadesc', 'SEO Meta Description', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_canonical_url', '_obj.seo.canonical_url', 'SEO Canonical URL', 'U', [ XValidate._v_MaxLength(2048) ]);

    if(!validation.ValidateControls('U', _this.page)){
      //Open settings if settings have an error
      var settings_error = false;
      _.each(['title','tags','author'], function(key){ if($('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).hasClass('xinputerror')){ settings_error = true; $('#jsharmony_cms_editor_bar .xtab[for=jsharmony_cms_page_settings_overview]').click(); } });
      if(!settings_error) _.each(['title','keywords','metadesc','canonical_url'], function(key){ if($('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_seo_'+key).hasClass('xinputerror')){ settings_error = true; $('#jsharmony_cms_editor_bar .xtab[for=jsharmony_cms_page_settings_seo]').click(); } });
      if(settings_error){
        _this.showSettings();
      }
      return false;
    }
    return true;
  }

  this.refreshParent = function(page_folder){
    if(window.opener) window.opener.postMessage('jsharmony-cms:refresh:'+page_folder, '*');
  }

  this.save = function(){
    //Validate
    if(!this.validate()) return;

    //Execute the save function
    var startTime = Date.now();
    _this.StartLoading(_this.loadObj);
    var url = '../_funcs/page/'+_this.page_key;
    _this.hideSettings(true);
    XExt.CallAppFunc(url, 'post', _this.page, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.hasChanges = false;
        _this.loadPage(_this.page_key, null, function(err){
          var timeLeft = 500-(Date.now()-startTime);
          if(timeLeft > 0) window.setTimeout(function(){ _this.StopLoading(_this.loadObj); }, timeLeft);
          else _this.StopLoading(_this.loadObj);
        });
        _this.refreshParent(rslt.page_folder);
      }
      else{
        _this.StopLoading(_this.loadObj);
        XExt.Alert('Error loading page');
      }
    }, function (err) {
      _this.StopLoading(_this.loadObj);
      //Optionally, handle errors
    });
  }

  this.toggleSettings = function(display, noSlide){
    var jbutton = $('#jsharmony_cms_editor_bar .button.settings');
    var prevdisplay = !!jbutton.hasClass('selected');
    if(typeof display == 'undefined') display = !prevdisplay;
    
    if(prevdisplay==display) return;
    else {
      var jsettings = $('#jsharmony_cms_editor_bar .page_settings');
      if(display){
        //Open
        jbutton.addClass('selected');
        jsettings.stop(true);
        if(noSlide) jsettings.show();
        else jsettings.slideDown();
      }
      else {
        //Close
        if(!this.validate()) return;
        jbutton.removeClass('selected');
        jsettings.stop(true);
        if(noSlide) jsettings.hide();
        else jsettings.slideUp();
      }
    }
  }

  this.showSettings = function(noSlide){ this.toggleSettings(true, noSlide); }

  this.hideSettings = function(noSlide){ this.toggleSettings(false, noSlide); }

})();
window.jsHarmonyCMS.init();
