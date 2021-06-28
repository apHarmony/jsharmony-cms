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

  this.localComponents = [];
  this.localWebSnippets = [];

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
    if(cms.token) params.jshcms_token = cms.token;

    XExt.CallAppFunc(url, 'get', params, function (rslt) { //On Success
      if (!rslt || !('_success' in rslt)) {
        onComplete(new Error('Error Loading Dev Mode'));
        XExt.Alert('Error loading dev mode');
        return;
      }

      if (!rslt.site_id) {
        onComplete(new Error('Please checkout a site in the CMS to use Dev Mode'));
        XExt.Alert('Please checkout a site in the CMS to use Dev Mode');
        return;
      }

      cms.branch_id = rslt.branch_id;
      async.parallel([
        function(cb){ cms.componentManager.load(cb); },
      ], function(err){
        if(err){
          if(onComplete) onComplete(err);
          else alert(err.toString());
        }
      });

      XExt.waitUntil(
        function(){ return (cms.componentManager.isInitialized); },
        function(){
          //Populate arrays + create editor
          _this.hasChanges = false;
          var pageTitle = document.title || '';
          if($('[cms-title]').length) pageTitle = $($('[cms-title]')[0]).text();
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
          _.each(_this.menus, function(menu){ cms.controllerExtensions.createMenuTree(menu); });
          if(_this.sitemap) cms.controllerExtensions.createSitemapTree(_this.sitemap);
          XExt.execif(!cms.isInitialized, function(f){
            async.waterfall([
              function(init_cb){ _this.initTemplate(init_cb); },
              function(init_cb){ _this.createWorkspace(init_cb); },
            ], f);
          }, function(){
            _this.render();
            if(!cms.isInitialized){
              cms.onTemplateLoaded(function(){
                cms.editor.onEditorInitialized();
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
  }

  this.load = function(onComplete){
    var url = '../_funcs/page/'+_this.page_key;

    //Add querystring parameters
    var qs = {};
    if(_this.page_id) qs.page_id = _this.page_id;
    if(cms.branch_id) qs.branch_id = cms.branch_id;
    if(_this.page_template_id) qs.page_template_id = _this.page_template_id;
    if(cms.token) qs.jshcms_token = cms.token;
    if(!_.isEmpty(qs)) url += '?' + $.param(qs);

    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      XExt.waitUntil(
        function(){ return (cms.componentManager.isInitialized); },
        function(){
          if ('_success' in rslt) {
            //Populate arrays + create editor
            _this.hasChanges = false;
            $('#jsharmony_cms_page_toolbar a.jsharmony_cms_button.save').toggleClass('hasChanges', false);
            _this.page = rslt.page;
            if(!cms.isInitialized) _this.template = rslt.template;
            _this.sitemap = rslt.sitemap;
            _this.menus = rslt.menus||{};
            _this.authors = rslt.authors;
            _this.role = rslt.role;
            cms.views = _.extend(cms.views, rslt.views);
            cms.readonly = (_this.role=='VIEWER')||(_this.page_id);
            _.each(_this.menus, function(menu){ cms.controllerExtensions.createMenuTree(menu, _this.page_key); });
            if(_this.sitemap) cms.controllerExtensions.createSitemapTree(_this.sitemap);
            XExt.execif(!cms.isInitialized, function(f){
              async.waterfall([
                function(init_cb){ _this.initTemplate(init_cb); },
                function(init_cb){ _this.createWorkspace(init_cb); },
              ], f);
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

  this.initTemplate = function(cb){
    var errors = [];

    $('script[type="text/cms-page-config"],cms-page-config').each(function(){
      var config = $(this).html();
      try{
        config = JSON.parse(config);
        if(config){
          if(_this.page_template_location=='REMOTE'){
            if('title' in config) errors.push('The "title" template config property is not supported for REMOTE templates.  Please set the REMOTE template title using the Site -> Page Templates grid.');
          }
          if(_.isString(config.remote_templates)) errors.push('Invalid syntax for template config.remote_templates.  Please use remote_templates.publish property');
          else if(config.remote_templates && config.remote_templates.editor) errors.push('Cannot define config.remote_templates.editor within an editor template.  Only config.remote_templates.publish is supported');
        }
        _.merge(_this.template, config);
      }
      catch(ex){
        XExt.Alert('Error parsing cms-page-config: \r\n' + ex.toString());
      }
      $(this).remove();
    });

    //Extract Inline Component Templates
    $('script[type="text/cms-component-template"]').each(function(){
      var jobj = $(this);
      var componentContent = this.innerHTML;
      if(this.nodeName.toLowerCase() != 'script'){
        errors.push('Component Template "'+componentId+'" should be defined using a "script" tag instead of a '+this.nodeName.toLowerCase()+' tag, ex: <script cms-component-template="componentId"></script>');
      }
      _this.localComponents.push(componentContent.trim());
      jobj.remove();
    });

    //Extract Inline Websnippet Templates
    $('script[type="text/cms-websnippet-template"]').each(function(){
      var jobj = $(this);
      if(jobj.find('[cms-websnippet-template]').length){
        errors.push('Web Snippet Template (attr: cms-websnippet-template) cannot be inside of another Web Snippet Template (attr:cms-websnippet-template)');
      }
      if(this.nodeName.toLowerCase() != 'script'){
        errors.push('Inline Web Snippet Template should be defined using a "script" tag instead of a '+this.nodeName.toLowerCase()+' tag, ex: <script cms-websnippet-template></script>');
      }

      var webSnippetContent = this.innerHTML;
      try{
        var contentElements = $('<div>'+webSnippetContent+'</div>');
        var webSnippetConfig = {};
        contentElements.find('cms-websnippet-config').each(function(){
          _.extend(webSnippetConfig, JSON.parse(this.innerHTML));
          $(this).remove();
        });
        webSnippetConfig.content = (webSnippetConfig.content||'') + contentElements.html().trim();
        if(!webSnippetConfig.title){
          webSnippetConfig.title = 'Inline Web Snippet #'+(_this.localWebSnippets.length+1);
          errors.push({
            message: 'Inline Web Snippet Template should have a title defined, by adding a config section to the script tag, ex: <br/>' +
            '<pre>'+XExt.escapeHTML([
              '<script type="text/cms-websnippet-template">',
               '<cms-websnippet-config>',
              '  {',
              '    "title": "Web Snippet Title",',
              '    "description": "Web Snippet Description"',
              '  }',
              '</cms-websnippet-config>',
              'Web Snippet Content',
              '</script>',
            ].join('\n'))+'</pre>',
            type: 'html'
          });
        }
        _this.localWebSnippets.push(webSnippetConfig);
      }
      catch(ex){
        errors.push('Error processing Inline Web Snippet Template: '+ex.toString());
      }
      jobj.remove();
    });

    if(_this.template.properties){
      _this.processModelFields(_this.template.properties, _this.page.properties);
    }

    if(!('content_elements' in _this.template)){
      _this.template.content_elements = {
        body: { type: "htmleditor", title: "Body" }
      };
    }

    $('script').each(function(){
      var url = ($(this).attr('src')||'').toString();
      if(XExt.endsWith(url, '/jsHarmonyCMS.js')){
        if(!$(this).hasClass('removeOnPublish') && !$(this).hasClass('keepOnPublish')){
          errors.push({
            message: 'jsHarmony CMS Editor script tag for "'+XExt.escapeHTML(url)+'" should have a "removeOnPublish" class so that it will not be deployed on publish.  If this is a different script that you do want to publish, please add the "keepOnPublish" class to the script tag instead to hide this message.<br/>' +
            '<pre>&lt;script type="text/javascript" class="removeOnPublish" src="'+XExt.escapeHTML(url)+'"&gt;&lt;/script&gt;</pre>',
            type: 'html'
          });
        }
      }
    });

    if(!$('[cms-title]').length){
      if(_this.template.options && ('title_element_required' in _this.template.options) && !_this.template.options.title_element_required){ /* Do nothing - not required */ }
      else {
        errors.push({
          message: 'Missing Heading / Title Element.  Please add an HTML element with the "cms-title" attribute:<br/>' +
          '<pre>&lt;h1 cms-title&gt;&lt;/h1&gt;</pre>' +
          'If the page does not have a title tag, add:<br/>'+
          '<pre>&lt;cms-page-config&gt;{ "options": { "title_element_required": false } }&lt;/cms-page-config&gt;</pre>',
          type: 'html'
        });
      }
    }
    if($('[cms-title]').closest('[cms-content-editor]').length){
      errors.push('Title Element (attr: cms-title) cannot be inside of a Content Element (attr:cms-content-editor)');
    }
    if($('[cms-title]').length >= 2){
      errors.push('Multiple Title Elements found (attr: cms-title).  Only one cms-title element is supported');
    }
    var foundContent = {};
    $('[cms-content-editor]').each(function(){
      var jobj = $(this);
      var contentId = jobj.attr('cms-content-editor');
      if(!contentId){ errors.push('HTML element with "cms-content-editor" attribute missing value.  The value is required to define the name of the content area, ex: <div cms-content-editor="page.content.body"></div>'); return; }
      var fullContentId = _this.getFullPageContentId(contentId);
      if(fullContentId in foundContent){ errors.push('Duplicate "cms-content-editor" element with same editable area: "'+contentId+'"'); return }
      foundContent[fullContentId] = jobj;
      if(jobj.parent().closest('[cms-content-editor]').length){ errors.push('The "'+contentId+'" cms-content-editor element cannot be inside of another Content Element (attr:cms-content-editor)'); }
      var pageContentId = _this.getPageContentId(fullContentId);
      if(!(pageContentId in _this.template.content_elements)){ errors.push('The "'+contentId+'" cms-content-editor element is not defined in template.content_elements.  Please add it to the cms-page-config definition.'); }
    });
    for(var pageContentId in _this.template.content_elements){
      var contentId = 'page.content.'+pageContentId;
      if(!(contentId in foundContent)) errors.push({
        message: 'Missing Editor for Content Element "'+contentId+'".  Please add an HTML element with the "cms-content-editor" attribute, and set to the target content id:<br/>' +
        '<pre>&lt;div cms-content-editor="'+contentId+'"&gt;&lt;/div&gt;</pre>',
        type: 'html'
      });
    }
    if(cms.devMode){
      if(errors.length){
        cms.toolbar.showError({ message: '<b>Errors were found in the jsHarmony template:</b>', type: 'html' });
        for(var i=0;i<errors.length;i++) cms.toolbar.showError(errors[i]);
      }
    }

    XExt.execif(_this.localComponents.length,
      function(f){
        cms.componentManager.compileTemplates(_this.localComponents, function(err, components){
          if(err) return cms.fatalError(err.toString());
          for(var componentId in components){
            cms.componentManager.addTemplate(componentId, components[componentId]);
          }
          return f();
        });
      },
      cb
    );
  }

  this.loadProperties = function(){
    if(_this.template.properties && _this.template.properties.onecolumn){
      XPage.LayoutOneColumn($('.jsharmony_cms_page_settings_properties'), { reset: true });
    }
  }

  this.hasProperties = function(){
    return !_.isEmpty(_this.template.properties && _this.template.properties.fields);
  }

  this.getPageContentId = function(contentId){
    return (XExt.beginsWith(contentId, 'page.content.') ? contentId.substr(('page.content.').length) : '');
  }

  this.getFullPageContentId = function(contentId){
    if(!contentId) return '';
    if(contentId.indexOf('page.content.')!=0) return 'page.content.'+contentId;
    return contentId;
  }

  this.createWorkspace = function(cb){
    if(!_this.page && !cms.devMode) return;

    //Initialize Page Toolbar
    cms.toolbar.render();
    cms.toolbar.setDockPosition(_this.template && _this.template.options && _this.template.options.page_toolbar && _this.template.options.page_toolbar.dock);
    if(cms.devMode){
      $('#jsharmony_cms_page_toolbar a.jsharmony_cms_button.save').hide();
      $('#jsharmony_cms_page_toolbar a.jsharmony_cms_button.template_tips').removeClass('jsharmony_cms_button_hidden');
    }

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
    _.each(['tags','author','css','header','footer'], function(key){ $('#jsharmony_cms_page_toolbar .page_settings').find('.page_settings_'+key).on('input keyup',function(){ if(!_this.hasChanges) cms.controller.getValues(); }); });
    _.each(['keywords','metadesc','canonical_url'], function(key){ $('#jsharmony_cms_page_toolbar .page_settings').find('.page_settings_seo_'+key).on('input keyup',function(){ if(!_this.hasChanges) cms.controller.getValues(); }); });
    $('#jsharmony_cms_page_toolbar .page_settings .page_settings_title').on('input keyup', function(){ _this.onTitleUpdate(this); });
    $('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_title').on('input keyup', function(){ _this.onTitleUpdate(this); });
    $('#jsharmony_cms_page_toolbar .actions .jsharmony_cms_button.template_tips').on('click', function(){ cms.toolbar.toggleSlideoutButton('template_tips'); });
    $('#jsharmony_cms_page_toolbar .actions .jsharmony_cms_button.settings').on('click', function(){ cms.toolbar.toggleSlideoutButton('settings'); });
    $('#jsharmony_cms_page_toolbar .actions .jsharmony_cms_button.save').on('click', function(){ _this.save(); });
    $('#jsharmony_cms_page_toolbar .actions .jsharmony_cms_button.autoHideEditorBar').on('click', function(){ cms.toolbar.toggleAutoHide(); });

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
          jsh.App[_this.template.properties.id]._sys_fileSelector_onGetValue = cms.editor.picker.fileSelector_onGetValue;
          jsh.App[_this.template.properties.id]._sys_fileSelector_render = cms.editor.picker.fileSelector_render;
          jsh.App[_this.template.properties.id]._sys_fileSelector_browse = cms.editor.picker.fileSelector_browse;
          jsh.App[_this.template.properties.id]._sys_fileSelector_reset = cms.editor.picker.fileSelector_reset;
          f();
        });
      },
      function(){
        //Initialize Tag Control
        XExt.TagBox_Render($('#jsharmony_cms_page_toolbar .page_settings_tags_editor'), $('#jsharmony_cms_page_toolbar .page_settings_tags'));
    
        $(window).on('resize', function(){ cms.refreshLayout(); });
        $(window).on('scroll', function(){ cms.refreshLayout(); });
        cms.refreshLayout();
    
        _.each($('[cms-content-editor]'), function(obj){
          var jobj = $(obj);
          var contentId = jobj.attr('cms-content-editor');
          if(!contentId) XExt.Alert('cms-content-editor missing content area id');
          //Can use "body" or "page.content.body"
          if((contentId in _this.page.content) || (_this.template && _this.template.content_elements && (contentId in _this.template.content_elements))){
            contentId = 'page.content.'+contentId;
            jobj.attr('cms-content-editor', contentId);
          }
          if(!obj.id) obj.id = 'jsharmony_cms_content_' + XExt.escapeCSSClass(contentId, { nodash: true });
          var pageContentId = _this.getPageContentId(contentId);
          if(!(pageContentId in _this.page.content)){
            _this.page.content[pageContentId] = jobj.html().trim();
            if(_this.template && _this.template.default_content && _this.template.default_content[pageContentId]){
              _this.page.content[pageContentId] = _this.template.default_content[pageContentId];
            }
          }
        });
    
        if(cms.readonly){
          $('[cms-content-editor]').prop('contenteditable', false);
          if(cb) return cb();
        }
        else {
          cms.editor.init(function(){
            async.eachSeries($('[cms-content-editor]'), function(elem, editor_cb){
              var contentId = $(elem).attr('cms-content-editor');
              var pageContentId = _this.getPageContentId(contentId);
              var config_id = 'full';
              if(pageContentId && pageContentId in _this.template.content_elements){
                config_id = _this.template.content_elements[pageContentId].type;
              }
              if(!config_id || !(config_id in cms.editor.editorConfig)) config_id = 'full';
              cms.editor.attach(config_id, elem.id, {}, function(err){ return editor_cb(err); });
            }, function(err){
              if(err) return cms.fatalError(err);
              //Initialize the title editor
              if(!$('[cms-title]').length) return cb();
              $('[cms-title]').not(':visible').addClass('hidden');
              $('[cms-title]')[0].id = 'jsharmony_cms_title_editor';
              cms.editor.attach('text', 'jsharmony_cms_title_editor', {}, function(){
                //All editors initialized
                return cb();
              });
            });
          });
    
          $('[cms-content-editor]').on('focus input keyup',function(){ if(!_this.hasChanges) _this.getValues(); });
          $('[cms-title]').on('input keyup',function(){ _this.onTitleUpdate(this); });
    
          $(window).bind('beforeunload', function(){
            if(cms.devMode) return;
            _this.getValues();
            if(_this.hasChanges) return 'You have unsaved changes.  Are you sure you want to leave this page?';
          });
        }
      }
    );
  }

  this.processModelFields = function(model, data){
    _.each(model.fields, function(field){
      //Set default value in data based on field default value
      if(field && field.name){
        if(!(field.name in data)){
          data[field.name] = ('default' in field) ? field.default : '';
        }
      }

      //Handle media_browser / link_browser controls
      if(field && ((field.control=='media_browser') || (field.control=='link_browser'))){
        var fileSelectorType = field.control;
        field.control = 'label';
        field.ongetvalue = 'return _this._sys_fileSelector_onGetValue(val, field, xmodel, jctrl, parentobj);';
        field.value = '<#-_this._sys_fileSelector_render('+JSON.stringify(fileSelectorType)+', xmodel, xmodel.fields['+JSON.stringify(field.name)+'], val)#>';
      }
    });
  }

  this.render = function(){
    if(!_this.page) return;
    var jeditorbar = $('#jsharmony_cms_page_toolbar');

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
      cms.editor.setContent('page.content.'+key, _this.page.content[key] || '');

      if(!cms.readonly){
        _this.page.content[key] = cms.editor.getContent('page.content.'+key);
        cms.editor.setToolbarOptions('page.content.'+key, _this.template.content_elements[key].editor_toolbar);
      }
    }

    cms.componentManager.renderPageComponents();

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

    var lastStyle = {};
    try{
      lastStyle = JSON.parse(jobj.data('jsharmony_cms_properties_lastStyle')||'{}');
    }
    catch(ex){}

    for(var key in lastStyle){
      this.style[key] = lastStyle[key];
    }

    var origStyleText = jobj.attr('style')||'';
    origStyleText += (XExt.endsWith(origStyleText.trim(),';')?'':';');
    origStyleText += strStyle;

    var origStyle = {};
    for(var i=0;i<this.style.length;i++){
      var key = this.style[i];
      var val = this.style[key];
      origStyle[key] = val;
    }

    jobj.attr('style', origStyleText + (strStyle||''));
    jobj.attr('style', this.style.cssText);

    var lastStyle = {};
    for(var i=0;i<this.style.length;i++){
      var key = this.style[i];
      var val = this.style[key];
      if(!(key in origStyle)) lastStyle[key] = null;
      else if(val != origStyle[key]){
        lastStyle[key] = origStyle[key];
      }
    }

    jobj.data('jsharmony_cms_properties_lastStyle', JSON.stringify(lastStyle))
  };
  this.renderFunctions.setStyle = this.renderFunctions.addStyle;

  this.renderHooks = function(){
    $("[cms-onRender]").each(function(){
      var obj = this;
      var jobj = $(this);
      var renderParams = {
        page: _this.page,
      };
      for(var key in _this.renderFunctions){
        renderParams[key] = _this.renderFunctions[key].bind(obj);
      }
      XExt.JSEval(jobj.attr('cms-onRender'), obj, renderParams);
    });
    if(cms.onRender) cms.onRender(_this.page);
  }

  this.renderTitle = function(src){
    var jsrc = $(src);
    if(!src || (src.id != 'jsharmony_cms_title_editor')){
      if($('[cms-title]').length){
        if(cms.readonly) $('[cms-title]').text(_this.page.title);
        else window.tinymce.get('jsharmony_cms_title_editor').setContent(_this.page.title);
      }
    }
    if(!src || !jsrc.hasClass('page_settings_title')) $('#jsharmony_cms_page_toolbar .page_settings .page_settings_title').val(_this.page.title);
    if(!src || !jsrc.hasClass('page_settings_seo_title')) $('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_title').val(_this.page.seo.title);
    $('#jsharmony_cms_page_toolbar').find('.title').html('<b>Title:</b> '+XExt.escapeHTML(_this.page.title)+(cms.devMode ? ' &nbsp;<b>(Dev Mode)</b>' : ''));
    document.title = (_this.page.seo.title ? _this.page.seo.title : _this.page.title);
    if($('[cms-title]').length && !$('[cms-title]').hasClass('hidden')){
      var titleIsVisible = $('[cms-title]').is(':visible');
      var titleIsHiddenByProperties = ($('[cms-title]').data('jsharmony_cms_properties_toggle_hidden') == '1');
      if(!titleIsHiddenByProperties){
        if(titleIsVisible && !_this.page.title) $('[cms-title]').hide();
        else if(!titleIsVisible && _this.page.title) $('[cms-title]').show();
      }
    }
  }

  this.onTitleUpdate = function(src, val){
    if(cms.readonly) return;
    var prev_hasChanges = _this.hasChanges;
    var new_page_title = _this.page.title;
    var new_seo_title = _this.page.seo.title;
    var jsrc = $(src);
    if(src.id=='jsharmony_cms_title_editor'){
      if($('[cms-title]').length) new_page_title = window.tinymce.get('jsharmony_cms_title_editor').getContent();
    }
    else if(jsrc.hasClass('page_settings_title')) new_page_title = $('#jsharmony_cms_page_toolbar .page_settings .page_settings_title').val();
    else if(jsrc.hasClass('page_settings_seo_title')) new_seo_title = $('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_title').val();
    if(new_page_title != _this.page.title){ _this.page.title = new_page_title; _this.hasChanges = true; }
    if(new_seo_title != _this.page.seo.title){ _this.page.seo.title = new_seo_title; _this.hasChanges = true; }
    _this.renderTitle(src);
    if(_this.hasChanges && !prev_hasChanges) _this.getValues();
  }

  this.getValues = function(){
    if(cms.readonly) return;

    for(var key in _this.template.content_elements){
      var editorContent = cms.editor.getContent('page.content.'+key);
      if(editorContent != _this.page.content[key]){
        _this.page.content[key] = editorContent;
        _this.hasChanges = true;
      }
    }
    _.each(['tags','author','css','header','footer'], function(key){
      var val = $('#jsharmony_cms_page_toolbar .page_settings').find('.page_settings_'+key).val();
      if(val != (_this.page[key]||'')){ _this.page[key] = val; _this.hasChanges = true; }
    });
    _.each(['keywords','metadesc','canonical_url'], function(key){
      var val = $('#jsharmony_cms_page_toolbar .page_settings').find('.page_settings_seo_'+key).val();
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
      $('#jsharmony_cms_page_toolbar a.jsharmony_cms_button.save').toggleClass('hasChanges', true);
      _this.renderHooks();
    }
  }

  this.validate = function(){
    //Get updated page data
    _this.getValues();

    //Validate
    var validation = new XValidate(jsh);
    validation.AddControlValidator('#jsharmony_cms_page_toolbar .page_settings .page_settings_title', '_obj.title', 'Page Title', 'U', [ XValidate._v_MaxLength(1024) ]);
    validation.AddControlValidator('#jsharmony_cms_page_toolbar .page_settings .page_settings_tags', '_obj.tags', 'Tags', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_page_toolbar .page_settings .page_settings_author', '_obj.author', 'Author', 'U', [ XValidate._v_Required() ]);
    validation.AddControlValidator('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_title', '_obj.seo.title', 'SEO Title Tag', 'U', [ XValidate._v_MaxLength(2048) ]);
    validation.AddControlValidator('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_keywords', '_obj.seo.keywords', 'SEO Meta Keywords', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_metadesc', '_obj.seo.metadesc', 'SEO Meta Description', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_canonical_url', '_obj.seo.canonical_url', 'SEO Canonical URL', 'U', [ XValidate._v_MaxLength(2048) ]);

    if(_this.hasPropertiesError){
      cms.toolbar.showSlideoutButton('settings');
      $('#jsharmony_cms_page_toolbar .xtab[for=jsharmony_cms_page_settings_properties]').click();
      return false;
    }
    if(!validation.ValidateControls('U', _this.page)){
      //Open settings if settings have an error
      var settings_error = false;
      _.each(['title','tags','author'], function(key){ if($('#jsharmony_cms_page_toolbar .page_settings').find('.page_settings_'+key).hasClass('xinputerror')){ settings_error = true; $('#jsharmony_cms_page_toolbar .xtab[for=jsharmony_cms_page_settings_overview]').click(); } });
      if(!settings_error) _.each(['title','keywords','metadesc','canonical_url'], function(key){ if($('#jsharmony_cms_page_toolbar .page_settings').find('.page_settings_seo_'+key).hasClass('xinputerror')){ settings_error = true; $('#jsharmony_cms_page_toolbar .xtab[for=jsharmony_cms_page_settings_seo]').click(); } });
      if(settings_error){
        cms.toolbar.showSlideoutButton('settings');
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
    if(cms.token) qs.jshcms_token = cms.token;
    if(!_.isEmpty(qs)) url += '?' + $.param(qs);

    cms.toolbar.hideSlideoutButton('settings', true);
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

  this.getComponentRenderParameters = function(component, renderOptions, additionalRenderParams){
    additionalRenderParams = _.extend({}, additionalRenderParams, {
      //Additional parameters for static render
      page: _this.page,
      template: _this.template,
      sitemap: _this.sitemap,
      getSitemapURL: function(sitemap_item){ return '#'; },
      menu: null,
      getMenuURL: function(menu_item){ return '#'; },
    }, additionalRenderParams);

    if(!renderOptions) renderOptions = {};
    if(renderOptions.menu_tag){
      if(renderOptions.menu_tag in _this.menus){
        additionalRenderParams.menu = _this.menus[renderOptions.menu_tag];
      }
      else {
        additionalRenderParams.menu = {
          allItems: [],
          currentItem: null,
          items: [],
          menu_file_id: null,
          menu_item_tree: [],
          menu_items: [],
          menu_key: null,
          menu_name: renderOptions.menu_tag,
          menu_tag: renderOptions.menu_tag,
          tag: renderOptions.menu_tag,
          topItems: [],
          tree: [],
        };
      }
      delete renderOptions.menu_tag;
    }
    if(!('renderType' in renderOptions)) renderOptions.renderType = 'page';
    
    return cms.componentManager.getComponentRenderParameters(component, renderOptions, additionalRenderParams);
  }

  cms.controller = this;

})(jsHarmonyCMSInstance));
