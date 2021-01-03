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

(new (function(cms){
  var _this = this;
  var jsh = cms.jsh;
  var XExt = jsh.XExt;
  var XValidate = jsh.XValidate;
  var XPage = jsh.XPage;
  var $ = jsh.$;
  var _ = jsh._;
  var async = jsh.async;

  this.page_key = undefined;
  this.page_id = undefined;
  this.page_template_id = undefined;
  this.page_template_location = undefined;

  this.type = 'page';
  this.hasChanges = false;
  this.hasPropertiesError = false;
  this.page = null;
  this.template = null;
  this.sitemap = {};
  this.menus = {};
  this.authors = [];
  this.role = '';
  this.renderFunctions = {};

  this.init = function(onComplete){
    if(jsh._GET['page_key']) _this.page_key = jsh._GET['page_key'];
    if(jsh._GET['page_id']) _this.page_id = jsh._GET['page_id'];
    if(jsh._GET['page_template_id']) _this.page_template_id = jsh._GET['page_template_id'];

    if(_this.page_key){
      this.load(function(err){
        cms.loader.StopLoading();
        if(onComplete) onComplete(err);
      });
    }
    else{
      cms.loader.StopLoading();
      XExt.Alert('Page Key not defined in querystring');
      if(onComplete) onComplete(new Error('Page Key not defined in querystring'));
    }
  }

  this.initDevMode = function(onComplete){
    onComplete = onComplete || function(err){};

    if(jsh._GET['page_template_id']) _this.page_template_id = jsh._GET['page_template_id'];
    if(jsh._GET['page_template_location']) _this.page_template_location = jsh._GET['page_template_location'];

    var url = '../_funcs/pageDev';
    var params = { };
    if(_this.page_template_id) params.page_template_id = _this.page_template_id;

    XExt.CallAppFunc(url, 'get', params, function (rslt) { //On Success
      if (!rslt || !('_success' in rslt)) {
        onComplete(new Error('Error Loading Dev Mode'));
        XExt.Alert('Error loading dev mode');
        return;
      }

      if (!rslt.branch_id) {
        onComplete(new Error('Please check out a branch in the CMS to use Dev Mode'));
        XExt.Alert('Please check out a branch in the CMS to use Dev Mode');
        return;
      }

      cms.branch_id = rslt.branch_id;
      cms.componentManager.load();
      cms.menuController.load();

      XExt.waitUntil(
        function(){ return (cms.componentManager.isInitialized && cms.menuController.isInitialized); },
        function(){
          //Populate arrays + create editor
          _this.hasChanges = false;
          var pageTitle = document.title || '';
          if($('#jsharmony_cms_title').length) pageTitle = $($('#jsharmony_cms_title')[0]).text();
          if(!pageTitle) pageTitle = 'Page Title';
          _this.page = {
            title: pageTitle,
            seo: {},
            content: {},
            properties: {},
            footer: '',
            author: ' ',
          };
          _this.template = _.extend({}, rslt.template);
          _this.sitemap = rslt.sitemap;
          _this.menus = rslt.menus||{};
          _this.role = rslt.role;
          _this.authors = [{ code_val: ' ', code_txt: ' ' }];
          cms.views = _.extend(cms.views, rslt.views);
          cms.readonly = false;
          XExt.execif(!cms.isInitialized, function(f){
            _this.initTemplate();
            _this.createWorkspace(f);
            $('#jsharmony_cms_editor_bar a.jsharmony_cms_button.save').hide();
          }, function(){
            _this.render();
            if(!cms.isInitialized){
              cms.onTemplateLoaded(function(){
                cms.isInitialized = true;
                if(onComplete) onComplete();
              });
            }
            else{ if(onComplete) onComplete(); }
          });
        }
      );
    }, function (err) {
      if(onComplete) onComplete(err);
    });

    //xxxxx
    //4. Dynamically load templates from JSON in site
    //5. Make sure "edit" works
    //6. Make sure "publish" works
    //7. Menu / sidebar (using DIV for content, "src" for remote definition)
    //  a. Initially define inline, as EJS inside div
    //  b. Then, move to separate files
    //8. Components
    //  a. Dynamically load from JSON in site
    //  b. Dynamically generate form based on HTML tags
    //9. Web Snippets
    //  a. Option to render inline instead of in iframe
    //9. "Hints" in Developer Mode on how to add editable areas, configure menus, etc.
  }

  this.load = function(onComplete){
    var url = '../_funcs/page/'+_this.page_key;

    //Add querystring parameters
    var qs = {};
    if(_this.page_id) qs.page_id = _this.page_id;
    if(cms.branch_id) qs.branch_id = cms.branch_id;
    if(_this.page_template_id) qs.page_template_id = _this.page_template_id;
    if(!_.isEmpty(qs)) url += '?' + $.param(qs);

    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      XExt.waitUntil(
        function(){ return (cms.componentManager.isInitialized && cms.menuController.isInitialized); },
        function(){
          if ('_success' in rslt) {
            //Populate arrays + create editor
            _this.hasChanges = false;
            $('#jsharmony_cms_editor_bar a.jsharmony_cms_button.save').toggleClass('hasChanges', false);
            _this.page = rslt.page;
            _this.template = rslt.template;
            _this.sitemap = rslt.sitemap;
            _this.menus = rslt.menus||{};
            _this.authors = rslt.authors;
            _this.role = rslt.role;
            cms.views = _.extend(cms.views, rslt.views);
            cms.readonly = (_this.role=='VIEWER')||(_this.page_id);
            XExt.execif(!cms.isInitialized, function(f){
              _this.initTemplate();
              _this.createWorkspace(f);
            }, function(){
              _this.render();
              if(!cms.isInitialized){
                cms.onTemplateLoaded(function(){
                  cms.isInitialized = true;
                  if(onComplete) onComplete();
                });
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

  this.initTemplate = function(){
    var errors = [];

    var jTemplateConfig = $('script[type="text/jsharmony-cms-template-config"]');
    jTemplateConfig.each(function(){
      var config = $(this).html();
      try{
        config = JSON.parse(config);
        if(config){
          if(_this.page_template_location=='REMOTE'){
            if('title' in config) errors.push('The "title" template config property is not supported for REMOTE templates.  Please set the REMOTE template title using the Site -> Page Templates grid.');
          }
          if(_.isString(config.remote_template)) errors.push('Invalid syntax for template config.remote_template.  Please use remote_template.publish property');
          else if(config.remote_template && config.remote_template.editor) errors.push('Cannot define config.remote_template.editor within an editor template.  Only config.remote_template.publish is supported');
        }
        _.merge(_this.template, config);
      }
      catch(ex){
        console.log(ex);
      }
    });

    if(_this.template.properties){
      _.each(_this.template.properties.fields, function(field){
        if(field && field.name){
          if(!(field.name in _this.page.properties)){
            _this.page.properties[field.name] = ('default' in field) ? field.default : '';
          }
        }
      });
    }

    if(!('content_elements' in _this.template)){
      _this.template.content_elements = {
        body: { type: "htmleditor", title: "Body" }
      };
    }

    if(!$('#jsharmony_cms_title').length){
      errors.push({
        message: 'Missing Heading / Title Element.  Please add an HTML element with the "jsharmony_cms_title" id:<br/>' +
        '<pre>&lt;h1 id="jsharmony_cms_title"&gt;&lt;/h1&gt;</pre>',
        type: 'html'
      });
    }
    if($('#jsharmony_cms_title').closest('.jsharmony_cms_content').length){
      errors.push('Title Element (id: jsharmony_cms_title) cannot be inside of a Content Element (class:jsharmony_cms_content)');
    }
    if($('#jsharmony_cms_title').length >= 2){
      errors.push('Multiple Title Elements found (id: jsharmony_cms_title)');
    }
    var foundContent = {};
    $('.jsharmony_cms_content').each(function(){
      var jobj = $(this);
      var contentId = jobj.data('id');
      if(!contentId){ errors.push('HTML element with "jsharmony_cms_content" class missing data-id attribute.  This attribute is required to define the name of the content area.'); return; }
      if(contentId in foundContent){ errors.push('Duplicate "jsharmony_cms_content" element with same data-id: "'+contentId+'"'); return }
      foundContent[contentId] = jobj;
      if(jobj.parent().closest('.jsharmony_cms_content').length){ errors.push('The "'+contentId+'" jsharmony_cms_content element cannot be inside of another Content Element (class:jsharmony_cms_content)'); }
      if(!(contentId in _this.template.content_elements)){ errors.push('The "'+contentId+'" jsharmony_cms_content element is not defined in template.content_elements.  Please add it to the jsharmony-cms-template-config definition.'); }
    });
    for(var contentId in _this.template.content_elements){
      if(!(contentId in foundContent)) errors.push({
        message: 'Missing Content Element "'+contentId+'".  Please add an HTML element with the "jsharmony_cms_content" class, and data-id set to the content id:<br/>' +
        '<pre>&lt;div class="jsharmony_cms_content" data-id="'+XExt.escapeHTML(contentId)+'"&gt;&lt;/div&gt;</pre>',
        type: 'html'
      });
    }
    if(cms.devMode){
      if(errors.length){
        cms.toolbar.showError({ message: '<b>Errors were found in the jsHarmony template:</b>', type: 'html' });
        for(var i=0;i<errors.length;i++) cms.toolbar.showError(errors[i]);
      }
    }
  }

  this.loadProperties = function(){
    if(_this.template.properties && _this.template.properties.onecolumn){
      XPage.LayoutOneColumn($('.jsharmony_cms_page_settings_properties'), { reset: true });
    }
  }

  this.hasProperties = function(){
    return !_.isEmpty(_this.template.properties && _this.template.properties.fields);
  }

  this.createWorkspace = function(cb){
    if(!_this.page && !cms.devMode) return;

    //Initialize Page Toolbar
    cms.toolbar.render();

    //Add "jsharmony_cms_editor" class to body if it does not exist
    $('body').not('.jsharmony_cms_editor').addClass('jsharmony_cms_editor');

    //Add "jsharmony_cms_footer" to bottom of body if it does not exist
    if(!$('.jsharmony_cms_footer').length){
      $('body').append($('<script type="text/jsharmony-cms-block" id="jsharmony_cms_footer_start"></script>'));
      $('body').append($('<script type="text/jsharmony-cms-block" id="jsharmony_cms_footer_end"></script>'));
    }

    //Template JS
    var js = (_this.template.js||'');
    if(js) _this.appendHTML($('head'), '<script type="text/javascript">'+js+'</script>');

    //Initialize Settings Controls
    _.each(['tags','author','css','header','footer'], function(key){ $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).on('input keyup',function(){ if(!_this.hasChanges) cms.controller.getValues(); }); });
    _.each(['keywords','metadesc','canonical_url'], function(key){ $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_seo_'+key).on('input keyup',function(){ if(!_this.hasChanges) cms.controller.getValues(); }); });
    $('#jsharmony_cms_editor_bar .page_settings .page_settings_title').on('input keyup', function(){ _this.onTitleUpdate(this); });
    $('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title').on('input keyup', function(){ _this.onTitleUpdate(this); });
    $('#jsharmony_cms_editor_bar .actions .jsharmony_cms_button.settings').on('click', function(){ cms.toolbar.toggleSettings(); });
    $('#jsharmony_cms_editor_bar .actions .jsharmony_cms_button.save').on('click', function(){ _this.save(); });
    $('#jsharmony_cms_editor_bar .actions .jsharmony_cms_button.autoHideEditorBar').on('click', function(){ cms.toolbar.toggleAutoHide(); });

    //Initialize Properties
    XExt.execif(_this.hasProperties(),
      function(f){
        //Properties Button
        var jtabbutton = $('.jsharmony_cms_page_settings_properties_button');
        jtabbutton.show()
        jtabbutton.data('ontabselected', cms._instance + ".controller.loadProperties();");

        //Initialize Properties Model
        _this.template.properties = _.extend({
          "id": "PageProperties",
          "layout": "form",
          "unbound": true,
        }, _this.template.properties);
        _this.template.properties.id = 'jsharmony_cms_page_properties';
        if(cms.readonly) _this.template.properties.actions = 'B';
        _this.template.properties.onchange = 'var cms = '+cms._instance+'; if(cms.isInitialized){ cms.controller.getValues(); cms.controller.renderHooks(); }'+(_this.template.properties.onchange||'');
        XPage.LoadVirtualModel($('.jsharmony_cms_page_settings_properties')[0], _this.template.properties, function(){
          f();
        });
      },
      function(){
        //Initialize Tag Control
        XExt.TagBox_Render($('#jsharmony_cms_editor_bar .page_settings_tags_editor'), $('#jsharmony_cms_editor_bar .page_settings_tags'));
    
        $(window).on('resize', function(){ cms.refreshLayout(); });
        $(window).on('scroll', function(){ cms.refreshLayout(); });
        cms.refreshLayout();
    
        _.each($('.jsharmony_cms_content'), function(obj){
          var jobj = $(obj);
          if(!jobj.data('id')) XExt.Alert('jsharmony_cms_content area missing data-id attribute');
          var contentId = jobj.data('id');
          if(!obj.id) obj.id = 'jsharmony_cms_content_' + contentId;
          if(!(contentId in _this.page.content)){
            _this.page.content[contentId] = jobj.html();
            if(_this.template && _this.template.default_content && _this.template.default_content[contentId]){
              _this.page.content[contentId] = _this.template.default_content[contentId];
            }
          }
        });
    
        if(cms.readonly){
          $('.jsharmony_cms_content').prop('contenteditable', false);
          if(cb) return cb();
        }
        else {
          cms.editor.init(function(){
            async.eachSeries($('.jsharmony_cms_content'), function(elem, editor_cb){
              var contentId = $(elem).data('id');
              var config_id = 'full';
              if(contentId && contentId in _this.template.content_elements){
                config_id = _this.template.content_elements[contentId].type;
              }
              if(!config_id || !(config_id in cms.editor.editorConfig)) config_id = 'full';
              cms.editor.attach(config_id, elem.id, {}, function(){ return editor_cb(); });
            }, function(err){
              //Initialize the title editor
              if(!$('#jsharmony_cms_title').length) return cb();
              $('#jsharmony_cms_title').not(':visible').addClass('hidden');
              cms.editor.attach('text', 'jsharmony_cms_title', {}, function(){ return cb(); });
            });
          });
    
          $('.jsharmony_cms_content').on('focus input keyup',function(){ if(!_this.hasChanges) _this.getValues(); });
          $('#jsharmony_cms_title').on('input keyup',function(){ _this.onTitleUpdate(this); });
    
          $(window).bind('beforeunload', function(){
            if(cms.devMode) return;
            _this.getValues();
            if(_this.hasChanges) return 'You have unsaved changes.  Are you sure you want to leave this page?';
          });
        }
      }
    );
  }

  this.render = function(){
    if(!_this.page) return;
    var jeditorbar = $('#jsharmony_cms_editor_bar');

    //Delete extra content areas
    _.each(_.keys(_this.page.content), function(contentId){
      if(!(contentId in _this.template.content_elements)){
        console.log('Deleting excess content area: '+contentId);
        delete _this.page.content[contentId];
      }
    });

    //Page Settings
    var authors = [].concat(_this.authors);
    if(_this.role=='PUBLISHER') authors.unshift({ code_val: '', code_txt: 'Please select...' });
    XExt.RenderLOV(null, jeditorbar.find('.page_settings_author'), authors);
    _.each(['title','tags','author','css','header','footer'], function(key){ jeditorbar.find('.page_settings').find('.page_settings_'+key).val(_this.page[key]||''); });
    _.each(['title','keywords','metadesc','canonical_url'], function(key){ jeditorbar.find('.page_settings').find('.page_settings_seo_'+key).val(_this.page.seo[key]||''); });
    XExt.TagBox_Refresh(jeditorbar.find('.page_settings_tags_editor'), jeditorbar.find('.page_settings_tags'));

    //Properties
    if(_this.hasProperties()){
      jsh.XModels['jsharmony_cms_page_properties'].controller.Render(_this.page.properties);
    }

    //Event Hooks
    _this.renderHooks();

    //Title
    _this.renderTitle();

    //Content
    for(var key in _this.template.content_elements){
      cms.editor.setContent(key, _this.page.content[key] || '')
      if(!cms.readonly) _this.page.content[key] = cms.editor.getContent(key);
    }

    cms.componentManager.render();
    cms.menuController.render();

    //CSS
    cms.util.removeStyle('jsharmony_cms_template_style');
    cms.util.removeStyle('jsharmony_cms_page_style');
    cms.util.addStyle('jsharmony_cms_template_style',_this.template.css);
    cms.util.addStyle('jsharmony_cms_page_style',_this.page.css);

    //Header
    var header = (_this.template.header||'')+(_this.page.header||'');
    if(header) cms.util.appendHTML($('head'), header);

    //Footer
    var footerHtml = (_this.template.footer||'')+(_this.page.footer||'');
    if($('#jsharmony_cms_footer').length){
      cms.util.setHTML($('#jsharmony_cms_footer'), footerHtml);
    }
    else if($('#jsharmony_cms_footer_start').length){
      //Delete everything between start and end
      $('#jsharmony_cms_footer_start').nextUntil('#jsharmony_cms_footer_end').remove();
      try{
        $('#jsharmony_cms_footer_start').after(footerHtml);
      }
      catch(ex){
        console.log(ex);
      }
    }

    if(cms.readonly){
      jeditorbar.find('.save').hide();
      jeditorbar.find('.readonly').show();
      jeditorbar.find('.page_settings_ctrl,textarea,select').each(function(){ cms.util.disableControl($(this)); });
    }
  }

  //showIf, toggle
  this.renderFunctions.showIf = function(show){
    var jobj = $(this);
    if(show){
      jobj.show();
      jobj.data('jsharmony_cms_properties_toggle_hidden', '0');
    }
    else {
      jobj.hide();
      jobj.data('jsharmony_cms_properties_toggle_hidden', '1');
    }
  };
  this.renderFunctions.toggle = this.renderFunctions.showIf;

  //addClass, setClass
  this.renderFunctions.addClass = function(strClass){
    var jobj = $(this);
    var strClass = strClass||'';

    jobj.removeClass(jobj.data('jsharmony_cms_properties_lastClass')).addClass(strClass);
    jobj.data('jsharmony_cms_properties_lastClass', strClass)
  };
  this.renderFunctions.setClass = this.renderFunctions.addClass;

  //addStyle, setStyle
  this.renderFunctions.addStyle = function(strStyle){
    var jobj = $(this);
    var origStyle = jobj.data('jsharmony_cms_properties_origStyle');
    if(!origStyle){
      origStyle = jobj.attr('style') + ';';
      jobj.data('jsharmony_cms_properties_origStyle', origStyle);
    }
    jobj.attr('style', origStyle + (strStyle||''))
  };
  this.renderFunctions.setStyle = this.renderFunctions.addStyle;

  this.renderHooks = function(){
    $("[data-jsharmony_cms_onApplyProperties],[data-jsharmony_cms_onRender]").each(function(){
      var obj = this;
      var jobj = $(this);
      var renderParams = {
        page: _this.page,
      };
      for(var key in _this.renderFunctions){
        renderParams[key] = _this.renderFunctions[key].bind(obj);
      }
      XExt.JSEval(jobj.attr('data-jsharmony_cms_onApplyProperties'), obj, renderParams);
      XExt.JSEval(jobj.attr('data-jsharmony_cms_onRender'), obj, renderParams);
    });
    if(cms.onApplyProperties) cms.onApplyProperties(_this.page);
    if(cms.onRender) cms.onRender(_this.page);
  }

  this.renderTitle = function(src){
    var jsrc = $(src);
    if(!src || (src.id != 'jsharmony_cms_title')){
      if($('#jsharmony_cms_title').length){
        if(cms.readonly) $('#jsharmony_cms_title').text(_this.page.title);
        else window.tinymce.get('jsharmony_cms_title').setContent(_this.page.title);
      }
    }
    if(!src || !jsrc.hasClass('page_settings_title')) $('#jsharmony_cms_editor_bar .page_settings .page_settings_title').val(_this.page.title);
    if(!src || !jsrc.hasClass('page_settings_seo_title')) $('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title').val(_this.page.seo.title);
    $('#jsharmony_cms_editor_bar').find('.title').html('<b>Title:</b> '+XExt.escapeHTML(_this.page.title));
    document.title = (_this.page.seo.title ? _this.page.seo.title : _this.page.title);
    if(!$('#jsharmony_cms_title').hasClass('hidden')){
      var titleIsVisible = $('#jsharmony_cms_title').is(':visible');
      var titleIsHiddenByProperties = ($('#jsharmony_cms_title').data('jsharmony_cms_properties_toggle_hidden') == '1');
      if(!titleIsHiddenByProperties){
        if(titleIsVisible && !_this.page.title) $('#jsharmony_cms_title').hide();
        else if(!titleIsVisible && _this.page.title) $('#jsharmony_cms_title').show();
      }
    }
  }

  this.onTitleUpdate = function(src, val){
    if(cms.readonly) return;
    var prev_hasChanges = _this.hasChanges;
    var new_page_title = _this.page.title;
    var new_seo_title = _this.page.seo.title;
    var jsrc = $(src);
    if(src.id=='jsharmony_cms_title'){
      if($('#jsharmony_cms_title').length) new_page_title = window.tinymce.get('jsharmony_cms_title').getContent();
    }
    else if(jsrc.hasClass('page_settings_title')) new_page_title = $('#jsharmony_cms_editor_bar .page_settings .page_settings_title').val();
    else if(jsrc.hasClass('page_settings_seo_title')) new_seo_title = $('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title').val();
    if(new_page_title != _this.page.title){ _this.page.title = new_page_title; _this.hasChanges = true; }
    if(new_seo_title != _this.page.seo.title){ _this.page.seo.title = new_seo_title; _this.hasChanges = true; }
    _this.renderTitle(src);
    if(_this.hasChanges && !prev_hasChanges) _this.getValues();
  }

  this.getValues = function(){
    if(cms.readonly) return;

    for(var key in _this.template.content_elements){
      var editorContent = cms.editor.getContent(key);
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
    _this.hasChanges = _this.hasChanges;
    _this.hasPropertiesError = false;
    if(_this.hasProperties()){
      _this.hasChanges = _this.hasChanges || (!!XPage.GetChanges('jsharmony_cms_page_properties').length);
      if(!jsh.XModels['jsharmony_cms_page_properties'].controller.Commit(_this.page.properties, 'U')){
        _this.hasChanges = true;
        _this.hasPropertiesError = true;
      }
    }
    if(_this.hasChanges){
      $('#jsharmony_cms_editor_bar a.jsharmony_cms_button.save').toggleClass('hasChanges', true);
      _this.renderHooks();
    }
  }

  this.validate = function(){
    //Get updated page data
    _this.getValues();

    //Validate
    var validation = new XValidate(jsh);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_title', '_obj.title', 'Page Title', 'U', [ XValidate._v_MaxLength(1024) ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_tags', '_obj.tags', 'Tags', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_author', '_obj.author', 'Author', 'U', [ XValidate._v_Required() ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title', '_obj.seo.title', 'SEO Title Tag', 'U', [ XValidate._v_MaxLength(2048) ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_keywords', '_obj.seo.keywords', 'SEO Meta Keywords', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_metadesc', '_obj.seo.metadesc', 'SEO Meta Description', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_canonical_url', '_obj.seo.canonical_url', 'SEO Canonical URL', 'U', [ XValidate._v_MaxLength(2048) ]);

    if(_this.hasPropertiesError){
      cms.toolbar.showSettings();
      $('#jsharmony_cms_editor_bar .xtab[for=jsharmony_cms_page_settings_properties]').click();
      return false;
    }
    if(!validation.ValidateControls('U', _this.page)){
      //Open settings if settings have an error
      var settings_error = false;
      _.each(['title','tags','author'], function(key){ if($('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).hasClass('xinputerror')){ settings_error = true; $('#jsharmony_cms_editor_bar .xtab[for=jsharmony_cms_page_settings_overview]').click(); } });
      if(!settings_error) _.each(['title','keywords','metadesc','canonical_url'], function(key){ if($('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_seo_'+key).hasClass('xinputerror')){ settings_error = true; $('#jsharmony_cms_editor_bar .xtab[for=jsharmony_cms_page_settings_seo]').click(); } });
      if(settings_error){
        cms.toolbar.showSettings();
      }
      return false;
    }
    return true;
  }

  this.save = function(){
    //Validate
    if(!_this.validate()) return;

    //Execute the save function
    var startTime = Date.now();
    cms.loader.StartLoading(undefined, 'CMS Save');
    var url = '../_funcs/page/'+_this.page_key;

    //Add querystring parameters
    var qs = {};
    if(cms.branch_id) qs.branch_id = _this.branch_id;
    if(_this.page_template_id) qs.page_template_id = _this.page_template_id;
    if(!_.isEmpty(qs)) url += '?' + $.param(qs);

    cms.toolbar.hideSettings(true);
    XExt.CallAppFunc(url, 'post', _this.page, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.hasChanges = false;
        _this.load(function(err){
          var timeLeft = 500-(Date.now()-startTime);
          if(timeLeft > 0) window.setTimeout(function(){ cms.loader.StopLoading(); }, timeLeft);
          else cms.loader.StopLoading();
        });
        cms.util.refreshParentPageTree(rslt.page_folder, _this.page_key);
      }
      else{
        cms.loader.StopLoading();
        XExt.Alert('Error loading page');
      }
    }, function (err) {
      cms.loader.StopLoading();
      //Optionally, handle errors
    });
  }

  this.getComponentRenderParameters = function(component_id){
    return {
      _: _,
      escapeHTML: XExt.xejs.escapeHTML,
      stripTags: XExt.StripTags,
      page: _this.page,
      template: _this.template,
      sitemap: _this.sitemap,
      getSitemapURL: function(sitemap_item){ return '#'; },
      isInEditor: true,
    }
  }

  this.getMenuRenderParameters = function(menu_tag){
    return {
      _: _,
      escapeHTML: XExt.xejs.escapeHTML,
      stripTags: XExt.StripTags,
      page: _this.page,
      template: _this.template,
      sitemap: _this.sitemap,
      getSitemapURL: function(sitemap_item){ return '#'; },
      menu: _this.menus[menu_tag],
      getMenuURL: function(menu_item){ return '#'; },
      isInEditor: true,
    }
  }

  cms.controller = this;

})(jsHarmonyCMSInstance));
