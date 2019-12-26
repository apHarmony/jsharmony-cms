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
  var async = undefined;
  var ejs = undefined;

  //Load jsHarmony
  this._baseurl = <%-JSON.stringify(baseurl)%>;
  this._cookie_suffix = <%-JSON.stringify(cookie_suffix)%>;
  this.page = null;
  this.page_key = null;
  this.template = null;
  this.sitemap = {};
  this.components = null;
  this.views = {};
  this.authors = [];
  this.role = '';
  this.readonly = false;
  this.origMarginTop = undefined;
  this.editorBarDocked = false;
  this.hasChanges = false;
  this.isInitialized = false;
  this.isComponentsInitialized = false;
  this.isLoading = false;
  this.loadQueue = [];
  this.loadObj = {main:1};

  this.filePickerCallback = null;

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
      async = jsh.async;
      ejs = jsh.ejs;
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
    if(jsh._GET['branch_id']){
      this.loadComponents(jsh._GET['branch_id']);
    }
    else{
      _this.StopLoading(_this.loadObj);
      XExt.Alert('Site ID not defined in querystring');
    }
    if(jsh._GET['page_key']){
      this.loadPage(jsh._GET['page_key'], jsh._GET['page_id'], function(err){ _this.StopLoading(_this.loadObj); });
    }
    else{
      _this.StopLoading(_this.loadObj);
      XExt.Alert('Page Key not defined in querystring');
    }
  }

  this.openLinkPicker = function(cb, value, meta){
    _this.filePickerCallback = cb;
    XExt.popupForm('jsHarmonyCMS/Link_Browser', 'browse', {}, { width: 1100, height: 600 });
  }

  this.openMediaPicker = function(cb, value, meta){
    _this.filePickerCallback = cb;
    XExt.popupForm('jsHarmonyCMS/Media_Browser', 'browse', {}, { width: 1100, height: 600 });
  }

  this.onmessage = function(event){
    var data = (event.data || '').toString();
    if(data.indexOf('cms_file_picker:')==0){
      if(!_this.filePickerCallback) return;
      data = data.substr(16);
      var jdata = JSON.parse(data);
      if(jdata.media_key){
        var newClass = 'media_key_'+jdata.media_key;
        _this.filePickerCallback(_this._baseurl+'_funcs/media/'+jdata.media_key+'/?media_file_id='+jdata.media_file_id+'#@JSHCMS');
      }
      else if(jdata.page_key){
        var newClass = 'page_key_'+jdata.page_key;
        _this.filePickerCallback(_this._baseurl+'_funcs/page/'+jdata.page_key+'/#@JSHCMS');
      }
      else XExt.Alert('Invalid response from File Browser: '+JSON.stringify(jdata));
      _this.filePickerCallback = null;
    }
  }

  this.loadComponents = function(branch_id, onComplete){
    var url = '../_funcs/components/'+branch_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.components = rslt.components;
        async.eachOf(_this.components, function(component, component_id, component_cb){
          if(component.remote_template && component.remote_template.publish){
            var loadObj = {};
            jsh.xLoader.StartLoading(loadObj);
            $.ajax({
              type: 'GET',
              cache: false,
              url: component.remote_template.publish,
              xhrFields: { withCredentials: true },
              success: function(data){
                jsh.xLoader.StopLoading(loadObj);
                component.content = data;
                return component_cb();
              },
              error: component_cb
            });
          }
          else return component_cb();
        }, function(err){
          _this.isComponentsInitialized = true;
        });
      }
      else{
        if(onComplete) onComplete(new Error('Error Loading Components'));
        XExt.Alert('Error loading components');
      }
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  }

  this.loadPage = function(page_key, page_id, onComplete){
    _this.page_key = page_key;
    var url = '../_funcs/page/'+_this.page_key;
    if(page_id) url += '?page_id=' + page_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      XExt.waitUntil(
        function(){ return (_this.isComponentsInitialized); },
        function(){
          if ('_success' in rslt) {
            //Populate arrays + create editor
            _this.hasChanges = false;
            $('#jsharmony_cms_editor_bar a.button.save').toggleClass('hasChanges', false);
            _this.page = rslt.page;
            _this.template = rslt.template;
            _this.sitemap = rslt.sitemap;
            _this.views = rslt.views;
            _this.authors = rslt.authors;
            _this.role = rslt.role;
            _this.readonly = (_this.role=='VIEWER')||(page_id);
            XExt.execif(!_this.isInitialized, function(f){
              _this.createEditor(f);
            }, function(){
              _this.renderEditor();
              if(!_this.isInitialized){
                _this.onEditorContentLoaded(function(){ if(onComplete) onComplete(); });
                _this.isInitialized = true;
              }
              else{ if(onComplete) onComplete(); }
            });
          }
          else{
            if(onComplete) onComplete(new Error('Error Loading Page'));
            XExt.Alert('Error loading page');
          }
        }
      );
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  };

  this.setHTML = function(jobj, html){
    try{
      jobj.html(html);
    }
    catch(ex){
      console.log(ex);
    }
  }

  this.appendHTML = function(jobj, html){
    try{
      jobj.append(html);
    }
    catch(ex){
      console.log(ex);
    }
  }

  this.renderComponents = function(){
    $('.jsharmony_cms_component').addClass('mceNonEditable').each(function(){
      var jobj = $(this);
      var component_id = jobj.data('id');
      var component_content = '';
      if(!component_id) component_content = '*** COMPONENT MISSING data-id ATTRIBUTE ***';
      else if(!(component_id in _this.components)) component_content = '*** MISSING CONTENT FOR COMPONENT ID ' + component_id+' ***';
      else{
        component_content = ejs.render(_this.components[component_id].content || '', {
          _: _,
          ejsext: XExt.xejs,
          page: _this.page,
          template: _this.template,
          sitemap: _this.sitemap,
          getSitemapURL: function(sitemap_item){ return '#'; },
          isInEditor: true,
        });
      }
      jobj.html(component_content);
    });
  }

  this.renderEditor = function(){
    if(!_this.page) return;
    var jeditorbar = $('#jsharmony_cms_editor_bar');

    //Title
    _this.renderTitle();

    //Content
    for(var key in _this.template.content_elements){
      _this.setEditorContent(key, _this.page.content[key])
      if(!_this.readonly) _this.page.content[key] = _this.getEditorContent(key);
    }

    _this.renderComponents();

    //CSS
    _this.removeStyle('jsharmony_cms_template_style');
    _this.removeStyle('jsharmony_cms_page_style');
    _this.addStyle('jsharmony_cms_template_style',_this.template.css);
    _this.addStyle('jsharmony_cms_page_style',_this.page.css);
    
    //Header
    var header = (_this.template.header||'')+(_this.page.header||'');
    if(header) _this.appendHTML($('head'), header);
    
    //Footer
    _this.setHTML($('#jsharmony_cms_footer'), (_this.template.footer||'')+(_this.page.footer||''));

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
    if(_this.readonly){
      //Delay load, so that errors in the HTML do not stop the page loading process
      window.setTimeout(function(){ $('#jsharmony_cms_content_'+id).html(val); },1);
    }
    else {
      var editor = window.tinymce.get('jsharmony_cms_content_'+id);
      if(!_this.isInitialized) editor.undoManager.clear();
      editor.setContent(val);
      if(!_this.isInitialized) editor.undoManager.add();
    }
  }

  this.getEditorContent = function(id){
    return window.tinymce.get('jsharmony_cms_content_'+id).getContent();
  }

  this.renderTitle = function(src){
    var jsrc = $(src);
    if(!src || (src.id != 'jsharmony_cms_title')){
      if(_this.readonly) $('#jsharmony_cms_title').text(_this.page.title);
      else window.tinymce.get('jsharmony_cms_title').setContent(_this.page.title);
    }
    if(!src || !jsrc.hasClass('page_settings_title')) $('#jsharmony_cms_editor_bar .page_settings .page_settings_title').val(_this.page.title);
    if(!src || !jsrc.hasClass('page_settings_seo_title')) $('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title').val(_this.page.seo.title);
    $('#jsharmony_cms_editor_bar').find('.title').html('<b>Title:</b> '+XExt.escapeHTML(_this.page.title));
    document.title = (_this.page.seo.title ? _this.page.seo.title : _this.page.title);
    var titleIsVisible = $('#jsharmony_cms_title').is(':visible');
    if(titleIsVisible && !_this.page.title) $('#jsharmony_cms_title').hide();
    else if(!titleIsVisible && _this.page.title) $('#jsharmony_cms_title').show();
  }

  this.onTitleUpdate = function(src, val){
    if(_this.readonly) return;
    var prev_hasChanges = _this.hasChanges;
    var new_page_title = _this.page.title;
    var new_seo_title = _this.page.seo.title;
    var jsrc = $(src);
    if(src.id=='jsharmony_cms_title') new_page_title = window.tinymce.get('jsharmony_cms_title').getContent();
    else if(jsrc.hasClass('page_settings_title')) new_page_title = $('#jsharmony_cms_editor_bar .page_settings .page_settings_title').val();
    else if(jsrc.hasClass('page_settings_seo_title')) new_seo_title = $('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title').val();
    if(new_page_title != _this.page.title){ _this.page.title = new_page_title; _this.hasChanges = true; }
    if(new_seo_title != _this.page.seo.title){ _this.page.seo.title = new_seo_title; _this.hasChanges = true; }
    _this.renderTitle(src);
    if(_this.hasChanges && !prev_hasChanges) _this.getValues();
  }

  this.createEditor = function(cb){
    if(!_this.page) return;

    //Initialize Page Toolbar
    this.createEditorBar();

    //Template JS
    var js = (_this.template.js||'');
    if(js) _this.appendHTML($('head'), '<script type="text/javascript">'+js+'</script>');

    //Initialize Settings Controls
    _.each(['tags','author','css','header','footer'], function(key){ $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).on('input keyup',function(){ if(!_this.hasChanges) _this.getValues(); }); });
    _.each(['keywords','metadesc','canonical_url'], function(key){ $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_seo_'+key).on('input keyup',function(){ if(!_this.hasChanges) _this.getValues(); }); });
    $('#jsharmony_cms_editor_bar .page_settings .page_settings_title').on('input keyup', function(){ _this.onTitleUpdate(this); });
    $('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title').on('input keyup', function(){ _this.onTitleUpdate(this); });

    //Initialize Tag Control
    XExt.TagBox_Render($('#jsharmony_cms_editor_bar .page_settings_tags_editor'), $('#jsharmony_cms_editor_bar .page_settings_tags'));

    $(window).on('resize', function(){ _this.refreshLayout(); });
    $(window).on('scroll', function(){ _this.refreshLayout(); });
    _this.refreshLayout();

    _.each($('.jsharmony_cms_content'), function(obj){
      var jobj = $(obj);
      if(!jobj.data('id')) XExt.Alert('jsharmony_cms_content area missing data-id attribute');
      if(!obj.id) obj.id = 'jsharmony_cms_content_' + jobj.data('id');
    });

    if(_this.readonly){
      $('.jsharmony_cms_content').prop('contenteditable', false);
      if(cb) return cb();
    }
    else {
      //Initialize Editor
      $('<div id="jsharmony_cms_content_editor_toolbar"></div>').prependTo('body');
      XExt.TinyMCE('', undefined, function(){

        //Change text labels
        tinymce.addI18n('en', {
          'Media...': 'Video...',
          'Insert / Edit': 'Video...',
          'Insert/edit media': 'Insert/edit video',
          'Insert/Edit Media': 'Insert/Edit Video',
        });

        //Initialize each content editor
        var editorConfig = {
          inline: true,
          branding: false,
          browser_spellcheck: true,
          valid_elements: '+*[*]',
          entity_encoding: 'numeric',
          plugins: [
            'advlist autolink autoresize lists link image charmap anchor',
            'searchreplace visualblocks code fullscreen wordcount template',
            'insertdatetime media table contextmenu paste code textcolor noneditable'
          ],
          toolbar: 'formatselect | forecolor backcolor | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link  image table fullscreen',
          removed_menuitems: 'newdocument',
          image_advtab: true,
          menu: {
            edit: { title: 'Edit', items: 'undo redo | cut copy paste | selectall | searchreplace' },
            view: { title: 'View', items: 'code | visualaid visualchars visualblocks | spellchecker | preview fullscreen' },
            insert: { title: 'Insert', items: 'image link media template codesample inserttable | charmap emoticons hr | pagebreak nonbreaking anchor toc | insertdatetime' },
            format: { title: 'Format', items: 'bold italic underline strikethrough superscript subscript codeformat | formats | forecolor backcolor | removeformat' },
            tools: { title: 'Tools', items: 'spellchecker spellcheckerlanguage | code wordcount' },
            table: { title: 'Table', items: 'inserttable tableprops deletetable row column cell' },
            help: { title: 'Help', items: 'help' }
          },
          templates: '/vcommon/cms/templates/content/index.html',
          file_picker_types: 'file image',
          file_picker_callback: function(cb, value, meta) {
            // Provide file and text for the link dialog
            if (meta.filetype == 'file') _this.openLinkPicker(cb, value, meta);
            else if (meta.filetype == 'image') _this.openMediaPicker(cb, value, meta);
          },
          relative_urls: false,
          urlconverter_callback: function(url, node, on_save, name){
            var urlparts = document.createElement('a');
            var urlparts_editor = document.createElement('a');
            urlparts.href = url;
            urlparts_editor.href = document.location;
            if(urlparts.host == urlparts_editor.host){
              url = url.replace(/^[^:]*\:\/{2}[^/]*\/(.*)/, '/$1');
            }
            url = url;
            return url;
          },
          fixed_toolbar_container: '#jsharmony_cms_content_editor_toolbar',
        };
        async.eachSeries($('.jsharmony_cms_content'), function(elem, editor_cb){
          window.tinymce.init(_.extend({
            selector: '#' + elem.id,
            init_instance_callback: function(editor){
              editor.on('focus', function(){
                $('#jsharmony_cms_content_editor_toolbar').stop(true).animate({ opacity:1 },300);
                _this.refreshLayout();
              });
              editor.on('blur', function(){
                $('#jsharmony_cms_content_editor_toolbar').stop(true).animate({ opacity:0 },300);
              });
              editor_cb();
            }
          }, editorConfig));
        }, function(){
          //Initialize the title editor
          window.tinymce.init({
            selector: '#jsharmony_cms_title',
            init_instance_callback: function(editor){ if(cb) cb(); },
            inline: true,
            branding: false,
            toolbar: '',
            valid_elements: '',
            valid_styles: {
              '*': ''
            },
            menubar: false,
            browser_spellcheck: true
          });
        });
      });

      $('.jsharmony_cms_content').on('input keyup',function(){ if(!_this.hasChanges) _this.getValues(); });
      $('#jsharmony_cms_title').on('input keyup',function(){ _this.onTitleUpdate(this); });

      $(window).bind('beforeunload', function(){
        _this.getValues();
        if(_this.hasChanges) return 'You have unsaved changes.  Are you sure you want to leave this page?';
      });
    }
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
    if(_this.readonly) return;

    for(var key in _this.template.content_elements){
      var editorContent = _this.getEditorContent(key);
      if(editorContent != _this.page.content[key]){
        _this.page.content[key] = editorContent;
        _this.hasChanges = true;
      }
    }
    _.each(['tags','author','css','header','footer'], function(key){
      var val = $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).val();
      if(val != (_this.page[key]||'')){ _this.page[key] = val; _this.hasChanges = true; }
    });
    _.each(['keywords','metadesc','canonical_url'], function(key){
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
