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

/* global jsHarmonyCMSInstance */

(new (function(cms){
  var _this = this;
  var jsh = cms.jsh;
  var XExt = jsh.XExt;
  var XValidate = jsh.XValidate;
  var XPage = jsh.XPage;
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
  };

  this.initDevMode = function(onComplete){
    onComplete = onComplete || function(err){};

    if(jsh._GET['page_template_id']) _this.page_template_id = jsh._GET['page_template_id'];
    if(jsh._GET['page_template_location']) _this.page_template_location = jsh._GET['page_template_location'];

    if(_this.page_template_id == '<Standalone>'){
      onComplete(new Error('Error Loading Dev Mode'));
      XExt.Alert('Please open Standalone templates from the Sitemap View or Folder View');
      return;
    }

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
          if(jsh.XDom('[cms-title]').length) pageTitle = jsh.XDom('[cms-title]').text;
          if(!pageTitle) pageTitle = 'Page Title';
          _this.page = {
            title: pageTitle,
            seo: {},
            content: {},
            properties: {},
            footer: '',
            author: ' ',
            page_template_id: _this.page_template_id,
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
              function(init_cb){ XExt.execif(cms.onBeforeTemplateInit, function(f){ cms.onBeforeTemplateInit(f); }, init_cb); },
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
  };

  this.load = function(onComplete){
    var url = '../_funcs/page/'+_this.page_key;

    //Add querystring parameters
    var qs = {};
    if(_this.page_id) qs.page_id = _this.page_id;
    if(cms.branch_id) qs.branch_id = cms.branch_id;
    if(_this.page_template_id) qs.page_template_id = _this.page_template_id;
    if(cms.token) qs.jshcms_token = cms.token;
    if(!_.isEmpty(qs)) url += '?' + jsh.XExt.escapeQuery(qs);

    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      XExt.waitUntil(
        function(){ return (cms.componentManager.isInitialized); },
        function(){
          if ('_success' in rslt) {
            //Populate arrays + create editor
            _this.hasChanges = false;
            jsh.XDom.class.remove('#jsharmony_cms_page_toolbar a.jsharmony_cms_button.save', 'hasChanges');
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
                function(init_cb){ XExt.execif(cms.onBeforeTemplateInit, function(f){ cms.onBeforeTemplateInit(f); }, init_cb); },
                function(init_cb){ _this.initTemplate(init_cb); },
                function(init_cb){ _this.createWorkspace(init_cb); },
              ], f);
            }, function(){
              _this.render();
              if(!cms.isInitialized){
                cms.onTemplateLoaded(function(){
                  cms.isInitialized = true;
                  if(cms.onRendered) cms.onRendered(_this.page);
                  if(onComplete) onComplete();
                });
              }
              else{
                if(cms.onRendered) cms.onRendered(_this.page);
                if(onComplete) onComplete();
              }
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

    if(_this.template.standalone){
      var foundContentAreas = [];
      jsh.XDom('[cms-content-editor]').elements.forEach(function(obj){
        foundContentAreas.push(_this.getPageContentId(obj.getAttribute('cms-content-editor')));
      });
      if(foundContentAreas.length){
        _this.template.content_elements = {};
        _.each(foundContentAreas, function(contentId){ _this.template.content_elements[contentId] = { type: 'htmleditor', title: contentId }; });
      }
    }

    jsh.XDom('[cms-template]').elements.forEach(function(obj){
      var templateCond = obj.getAttribute('cms-template');
      if(_this.page_template_id && !_this.evalBoolAttr(templateCond, function(val){ return val == _this.page_template_id; })){
        obj.remove();
      }
    });

    jsh.XDom('script[type="text/cms-page-config"],cms-page-config').elements.forEach(function(obj){
      var config = obj.innerHTML;
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
      obj.remove();
    });

    //Extract Inline Component Templates
    jsh.XDom('script[type="text/cms-component-template"]').elements.forEach(function(obj){
      var componentContent = obj.innerHTML;
      if(obj.nodeName.toLowerCase() != 'script'){
        errors.push('Component Template should be defined using a "script" tag instead of a '+obj.nodeName.toLowerCase()+' tag, ex: <script cms-component-template="componentId"></script>');
      }
      _this.localComponents.push(componentContent.trim());
      obj.remove();
    });

    //Extract Inline Websnippet Templates
    jsh.XDom('script[type="text/cms-websnippet-template"]').elements.forEach(function(obj){
      if(obj.querySelector('[cms-websnippet-template]')){
        errors.push('Web Snippet Template (attr: cms-websnippet-template) cannot be inside of another Web Snippet Template (attr:cms-websnippet-template)');
      }
      if(obj.nodeName.toLowerCase() != 'script'){
        errors.push('Inline Web Snippet Template should be defined using a "script" tag instead of a '+obj.nodeName.toLowerCase()+' tag, ex: <script cms-websnippet-template></script>');
      }

      var webSnippetContent = obj.innerHTML;
      try{
        var contentElements = jsh.XDom.render('<div>'+webSnippetContent+'</div>');
        var webSnippetConfig = {};
        jsh.XDom(contentElements).get('cms-websnippet-config').elements.forEach(function(el){
          _.extend(webSnippetConfig, JSON.parse(el.innerHTML));
          el.remove();
        });
        webSnippetConfig.content = (webSnippetConfig.content||'') + contentElements.innerHTML.trim();
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
      obj.remove();
    });

    if(_this.template.properties){
      _this.processModelFields(_this.template.properties, _this.page.properties);
    }

    if(!('content_elements' in _this.template)){
      _this.template.content_elements = {
        body: { type: 'htmleditor', title: 'Body' }
      };
    }

    jsh.XDom('script').items.forEach(function(xdobj){
      var url = (xdobj.attr.src||'').toString();
      if(XExt.endsWith(url, '/jsHarmonyCMS.js')){
        if(!xdobj.class.contains('removeOnPublish') && !xdobj.class.contains('keepOnPublish')){
          errors.push({
            message: 'jsHarmony CMS Editor script tag for "'+XExt.escapeHTML(url)+'" should have a "removeOnPublish" class so that it will not be deployed on publish.  If this is a different script that you do want to publish, please add the "keepOnPublish" class to the script tag instead to hide this message.<br/>' +
            '<pre>&lt;script type="text/javascript" class="removeOnPublish" src="'+XExt.escapeHTML(url)+'"&gt;&lt;/script&gt;</pre>',
            type: 'html'
          });
        }
      }
    });

    if(!jsh.XDom('[cms-title]').length){
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
    if(jsh.XDom('[cms-title]').parent('[cms-content-editor]').length){
      errors.push('Title Element (attr: cms-title) cannot be inside of a Content Element (attr:cms-content-editor)');
    }
    if(jsh.XDom('[cms-title]').length >= 2){
      errors.push('Multiple Title Elements found (attr: cms-title).  Only one cms-title element is supported');
    }
    var foundContent = {};
    jsh.XDom('[cms-content-editor]').elements.forEach(function(obj){
      var contentId = obj.getAttribute('cms-content-editor');
      if(!contentId){ errors.push('HTML element with "cms-content-editor" attribute missing value.  The value is required to define the name of the content area, ex: <div cms-content-editor="page.content.body"></div>'); return; }
      var fullContentId = _this.getFullPageContentId(contentId);
      if(fullContentId in foundContent){ errors.push('Duplicate "cms-content-editor" element with same editable area: "'+contentId+'"'); return; }
      foundContent[fullContentId] = obj;
      if(jsh.XDom(obj).parent().parent('[cms-content-editor]').length){ errors.push('The "'+contentId+'" cms-content-editor element cannot be inside of another Content Element (attr:cms-content-editor)'); }
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
  };

  this.loadProperties = function(){
    if(_this.template.properties && _this.template.properties.onecolumn){
      XPage.LayoutOneColumn(jsh.XDom('.jsharmony_cms_page_settings_properties').element, { reset: true });
    }
  };

  this.hasProperties = function(){
    return !_.isEmpty(_this.template.properties && _this.template.properties.fields);
  };

  this.getPageContentId = function(contentId){
    return (XExt.beginsWith(contentId, 'page.content.') ? contentId.substr(('page.content.').length) : contentId);
  };

  this.getFullPageContentId = function(contentId){
    if(!contentId) return '';
    if(contentId.indexOf('page.content.')!=0) return 'page.content.'+contentId;
    return contentId;
  };

  this.evalBoolAttr = function(expr, f){
    expr = _.map(expr.split('||'), function(val){ return val.split('&&'); });
    var rsltOr = false;
    for(var i=0;i<expr.length;i++){
      var exprOr = expr[i];
      var rsltAnd = true;
      for(var j=0;j<exprOr.length;j++){
        var exprAnd=exprOr[j].trim();
        rsltAnd = rsltAnd && (exprAnd && (exprAnd[0]=='!')) ? !f(exprAnd.substr(1)) : !!f(exprAnd);
      }
      rsltOr = rsltOr || rsltAnd;
    }
    return rsltOr;
  };

  this.createWorkspace = function(cb){
    if(!_this.page && !cms.devMode) return;

    //Initialize Page Toolbar
    cms.toolbar.render();
    cms.toolbar.setDockPosition(_this.template && _this.template.options && _this.template.options.page_toolbar && _this.template.options.page_toolbar.dock);
    if(cms.devMode){
      jsh.XDom.style.display('#jsharmony_cms_page_toolbar a.jsharmony_cms_button.save', false);
      jsh.XDom.class.remove('#jsharmony_cms_page_toolbar a.jsharmony_cms_button.template_tips', 'jsharmony_cms_button_hidden');
    }

    //Add "jsharmony_cms_editor" class to body if it does not exist
    jsh.XDom('body').omit(function(el) {return jsh.XDom.class.contains(el, '.jsharmony_cms_editor');}).class.add('jsharmony_cms_editor');

    //Add "jsharmony_cms_footer" to bottom of body if it does not exist
    if(!jsh.XDom('.jsharmony_cms_footer').length){
      jsh.XDom.append('body', '<script type="text/jsharmony-cms-block" id="jsharmony_cms_footer_start"></script>');
      jsh.XDom.append('body', '<script type="text/jsharmony-cms-block" id="jsharmony_cms_footer_end"></script>');
    }

    //Template JS
    var js = (_this.template.js||'');
    if(js) _this.appendHTML('head', '<script type="text/javascript">'+js+'</script>');

    //Initialize Settings Controls
    _.each(['tags','author','css','header','footer'], function(key){ jsh.XDom.on('#jsharmony_cms_page_toolbar .page_settings .page_settings_'+key, 'input keyup',function(){ if(!_this.hasChanges) cms.controller.getValues(); }); });
    _.each(['keywords','metadesc','canonical_url'], function(key){ jsh.XDom.on('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_'+key, 'input keyup',function(){ if(!_this.hasChanges) cms.controller.getValues(); }); });
    jsh.XDom.on('#jsharmony_cms_page_toolbar .page_settings .page_settings_title', 'input keyup', function(el){ _this.onTitleUpdate(el); });
    jsh.XDom.on('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_title', 'input keyup', function(el){ _this.onTitleUpdate(el); });
    jsh.XDom.on('#jsharmony_cms_page_toolbar .actions .jsharmony_cms_button.template_tips', 'click', function(){ cms.toolbar.toggleSlideoutButton('template_tips'); });
    jsh.XDom.on('#jsharmony_cms_page_toolbar .actions .jsharmony_cms_button.settings', 'click', function(){ cms.toolbar.toggleSlideoutButton('settings'); });
    jsh.XDom.on('#jsharmony_cms_page_toolbar .actions .jsharmony_cms_button.save', 'click', function(){ _this.save(); });
    jsh.XDom.on('#jsharmony_cms_page_toolbar .actions .jsharmony_cms_button.autoHideEditorBar', 'click', function(){ cms.toolbar.toggleAutoHide(); });

    //Initialize Properties
    XExt.execif(_this.hasProperties(),
      function(f){
        //Properties Button
        var xdtabbutton = jsh.XDom('.jsharmony_cms_page_settings_properties_button');
        xdtabbutton.style.display = true;
        xdtabbutton.data.ontabselected = cms._instance + '.controller.loadProperties();';

        //Initialize Properties Model
        _this.template.properties = _.extend({
          'id': 'PageProperties',
          'layout': 'form',
          'unbound': true,
        }, _this.template.properties);
        _this.template.properties.id = 'jsharmony_cms_page_properties';
        if(cms.readonly) _this.template.properties.actions = 'B';
        _this.template.properties.onchange = 'var cms = '+cms._instance+'; if(cms.isInitialized){ cms.controller.getValues(); cms.controller.renderHooks(); cms.componentManager.renderPageComponents(); }'+(_this.template.properties.onchange||'');
        XPage.LoadVirtualModel(jsh.XDom('.jsharmony_cms_page_settings_properties').element, _this.template.properties, function(){
          jsh.App[_this.template.properties.id]._sys_fileSelector_onGetValue = cms.editor.picker.fileSelector_onGetValue;
          jsh.App[_this.template.properties.id]._sys_fileSelector_render = cms.editor.picker.fileSelector_render;
          jsh.App[_this.template.properties.id]._sys_fileSelector_browse = cms.editor.picker.fileSelector_browse;
          jsh.App[_this.template.properties.id]._sys_fileSelector_reset = cms.editor.picker.fileSelector_reset;
          f();
        });
      },
      function(){
        //Initialize Tag Control
        XExt.TagBox_Render(jsh.XDom('#jsharmony_cms_page_toolbar .page_settings_tags_editor').element, jsh.XDom('#jsharmony_cms_page_toolbar .page_settings_tags').element);
    
        jsh.XDom.on(window, 'resize', function(){ cms.refreshLayout(); });
        jsh.XDom.on(window, 'scroll', function(){ cms.refreshLayout(); });
        cms.refreshLayout();
    
        _.each(jsh.XDom('[cms-content-editor]').elements, function(obj){
          var contentId = obj.getAttribute('cms-content-editor');
          if(!contentId) XExt.Alert('cms-content-editor missing content area id');
          //Can use "body" or "page.content.body"
          if((contentId in _this.page.content) || (_this.template && _this.template.content_elements && (contentId in _this.template.content_elements))){
            contentId = 'page.content.'+contentId;
            obj.setAttribute('cms-content-editor', contentId);
          }
          if(!obj.id) obj.id = 'jsharmony_cms_content_' + XExt.escapeCSSClass(contentId, { nodash: true });
          var pageContentId = _this.getPageContentId(contentId);
          if(!(pageContentId in _this.page.content)){
            _this.page.content[pageContentId] = obj.innerHTML.trim();
            if(_this.template && _this.template.default_content && _this.template.default_content[pageContentId]){
              _this.page.content[pageContentId] = _this.template.default_content[pageContentId];
            }
          }
        });
    
        if(cms.readonly){
          jsh.XDom('[cms-content-editor]').attr.contenteditable = false;
          if(cb) return cb();
        }
        else {
          cms.editor.init(function(){
            // slice: processing uses an exception based feature check which fails on NodeList, interrupting pause-on-exception debugging.
            async.eachSeries(Array.prototype.slice.apply(jsh.XDom('[cms-content-editor]').elements), function(elem, editor_cb){
              var contentId = elem.getAttribute('cms-content-editor');
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
              if(!jsh.XDom('[cms-title]').length) return cb();
              jsh.XDom('[cms-title]').omit(jsh.XDom.isVisible).class.add('hidden');
              jsh.XDom('[cms-title]').element.id = 'jsharmony_cms_title_editor';
              cms.editor.attach('text', 'jsharmony_cms_title_editor', {}, function(){
                //All editors initialized
                return cb();
              });
            });
          });
    
          jsh.XDom.on('[cms-content-editor]', 'focus input keyup',function(){
            var checkForUpdate = function(){ if(!_this.hasChanges) _this.getValues(); };
            checkForUpdate();
            setTimeout(checkForUpdate, 100);
          });

          jsh.XDom.on('[cms-title]', 'input keyup',function(el){ _this.onTitleUpdate(el); });
    
          jsh.XDom.on(window, 'beforeunload', function(){
            if(cms.devMode) return;
            _this.getValues();
            if(_this.hasChanges) return 'You have unsaved changes.  Are you sure you want to leave this page?';
          });
        }
      }
    );
  };

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
        field.ongetvalue = 'return _this._sys_fileSelector_onGetValue(val, field, xmodel, ctrl, parentobj);';
        field.value = '<#-_this._sys_fileSelector_render('+JSON.stringify(fileSelectorType)+', xmodel, xmodel.fields['+JSON.stringify(field.name)+'], val)#>';
      }
    });
  };

  this.render = function(){
    if(!_this.page) return;
    var xdeditorbar = jsh.XDom('#jsharmony_cms_page_toolbar');

    //Get list of content components
    var contentComponents = [];
    var componentContentAreas = {};
    jsh.XDom('[cms-component-content]').elements.forEach(function(el){ contentComponents.push(el); });
    for(let key in cms.componentManager.containerlessComponents) contentComponents.push(cms.componentManager.containerlessComponents[key]);
    _.each(contentComponents, function(component){
      var contentArea = (component.getAttribute('cms-component-content')||'').toString();
      if(contentArea.indexOf('page.content.')==0) contentArea = contentArea.substr(('page.content.').length);
      componentContentAreas[contentArea] = true;
    });

    //Delete extra content areas
    _.each(_.keys(_this.page.content), function(contentId){
      if(!(contentId in _this.template.content_elements) && !(contentId in componentContentAreas) && (!_this.template.content || !(contentId in _this.template.content))){
        var ignoreExcessContentArea = false;
        if(_this.template.sys_options && _this.template.sys_options.component_content_elements && (contentId in  _this.template.sys_options.component_content_elements)) ignoreExcessContentArea = true;
        if(!ignoreExcessContentArea) console.log('Deleting excess content area: '+contentId); // eslint-disable-line no-console
        delete _this.page.content[contentId];
      }
    });

    //Page Settings
    var authors = [].concat(_this.authors);
    if(_this.role=='PUBLISHER') authors.unshift({ code_val: '', code_txt: 'Please select...' });
    XExt.RenderLOV(null, xdeditorbar.get('.page_settings_author').element, authors);
    _.each(['title','tags','author','css','header','footer'], function(key){ xdeditorbar.get('.page_settings').get('.page_settings_'+key).value = (_this.page[key]||''); });
    _.each(['title','keywords','metadesc','canonical_url'], function(key){ xdeditorbar.get('.page_settings').get('.page_settings_seo_'+key).value = (_this.page.seo[key]||''); });
    XExt.TagBox_Refresh(xdeditorbar.get('.page_settings_tags_editor').element, xdeditorbar.get('.page_settings_tags').element);

    //Properties
    if(_this.hasProperties()){
      jsh.XModels['jsharmony_cms_page_properties'].controller.Render(_this.page.properties);
    }

    //Event Hooks
    _this.renderHooks();

    //Title
    _this.renderTitle();

    //Content
    for(let key in _this.template.content_elements){
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
    if(header) cms.util.appendHTML('head', header);

    //Footer
    var footerHtml = (_this.template.footer||'')+(_this.page.footer||'');
    if(jsh.XDom('#jsharmony_cms_footer').length){
      cms.util.setHTML(jsh.XDom('#jsharmony_cms_footer').element, footerHtml);
    }
    else if(jsh.XDom('#jsharmony_cms_footer_start').length){
      //Delete everything between start and end
      var footerContainer = jsh.XDom('#jsharmony_cms_footer_start').parent().element;
      var footerFoundStart = false;
      if(footerContainer) for(var i=0;i<footerContainer.childNodes.length;i++){
        var node = footerContainer.childNodes[i];
        if(!node) continue;
        var nodeId = node.id;
        if(!footerFoundStart){
          if(nodeId == ('jsharmony_cms_footer_start')) footerFoundStart = true;
          continue;
        }
        if(footerFoundStart){
          if(nodeId == ('jsharmony_cms_footer_end')) break;
          footerContainer.removeChild(node);
          i--;
        }
      }
      try{
        jsh.XDom('#jsharmony_cms_footer_start').element.after(jsh.XDom.render(footerHtml));
      }
      catch(ex){
        console.log(ex); // eslint-disable-line no-console
      }
    }

    if(cms.readonly){
      xdeditorbar.get('.save').style.display = false;
      xdeditorbar.get('.readonly').style.display = true;
      xdeditorbar.get('.page_settings_ctrl,textarea,select').elements.forEach(function(el){ cms.util.disableControl(el); });
    }
  };

  //showIf, toggle
  this.renderFunctions.showIf = function(show){
    var xdobj = jsh.XDom(this);
    if(show){
      //De-initialize page components, if they were previously hidden
      if(xdobj.attr['data-jsharmony_cms_properties_toggle_hidden']=='1'){
        xdobj.filter(function(el) {return el.matches('.jsharmony_cms_component,[cms-component]');}).elements.forEach(function(el){
          cms.componentManager.resetPageComponent(el);
        });
        xdobj.get('.jsharmony_cms_component,[cms-component]').elements.forEach(function(el){
          cms.componentManager.resetPageComponent(el);
        });
      }

      xdobj.display = true;
      xdobj.attr['data-jsharmony_cms_properties_toggle_hidden'] = '0';
    }
    else {
      xdobj.display = false;
      xdobj.attr['data-jsharmony_cms_properties_toggle_hidden'] = '1';
      //Reset containerless components on hide
      var containerlessComponentId = cms.componentManager.getContainerlessComponentKey(this);
      if(containerlessComponentId){
        cms.componentManager.restoreContainerlessComponent(containerlessComponentId);
      }
    }
  };
  this.renderFunctions.toggle = this.renderFunctions.showIf;

  //setText
  this.renderFunctions.setText = function(val){
    val = (val||'').toString();
    this.innerText = val;
  };

  //setHTML
  this.renderFunctions.setHTML = function(val){
    val = (val||'').toString();
    this.innerHTML = val;
  };

  //addClass, setClass
  this.renderFunctions.addClass = function(strClass){
    var xdobj = jsh.XDom(this);
    strClass = strClass||'';

    var lastClass = xdobj.data['jsharmony_cms_properties_lastClass'];
    if (lastClass) xdobj.class.remove(lastClass);
    if (strClass) xdobj.class.add(strClass);
    xdobj.data['jsharmony_cms_properties_lastClass'] = strClass;
  };
  this.renderFunctions.setClass = this.renderFunctions.addClass;

  //addStyle, setStyle
  this.renderFunctions.addStyle = function(strStyle){
    var xdobj = jsh.XDom(this);

    var lastStyle = {};
    try{
      lastStyle = JSON.parse(xdobj.data['jsharmony_cms_properties_lastStyle']||'{}');
    }
    catch(ex){ /* Do nothing */ }

    for(let key in lastStyle){
      this.style[key] = lastStyle[key];
    }

    var origStyleText = xdobj.attr.style||'';
    origStyleText += (XExt.endsWith(origStyleText.trim(),';')?'':';');

    var origStyle = {};
    for(let i=0;i<this.style.length;i++){
      let key = this.style[i];
      let val = this.style[key];
      origStyle[key] = val;
    }

    xdobj.attr.style = origStyleText + (strStyle||'');
    xdobj.attr.style = this.style.cssText;

    lastStyle = {};
    for(let i=0;i<this.style.length;i++){
      let key = this.style[i];
      let val = this.style[key];
      if(!(key in origStyle)) lastStyle[key] = null;
      else if(val != origStyle[key]){
        lastStyle[key] = origStyle[key];
      }
    }

    xdobj.data['jsharmony_cms_properties_lastStyle'] = JSON.stringify(lastStyle);
  };
  this.renderFunctions.setStyle = this.renderFunctions.addStyle;

  this.renderHooks = function(){
    var renderElements = [];
    jsh.XDom('[cms-onRender]').elements.forEach(function(el){ renderElements.push(el); });
    _.each(_.keys(cms.componentManager.containerlessComponents), function(key){
      if(cms.componentManager.containerlessComponents[key].hasAttribute('cms-onrender')){
        renderElements.push(cms.componentManager.containerlessComponents[key]);
      }
    });
    _.each(renderElements, function(obj){
      var renderParams = {
        page: _this.page,
      };
      for(var key in _this.renderFunctions){
        renderParams[key] = _this.renderFunctions[key].bind(obj);
      }
      XExt.JSEval(obj.getAttribute('cms-onRender'), obj, renderParams);
    });
    if(cms.onRender) cms.onRender(_this.page);
  };

  this.renderTitle = function(src){
    if(!src || (src.id != 'jsharmony_cms_title_editor')){
      if(jsh.XDom('[cms-title]').length){
        if(cms.readonly) jsh.XDom('[cms-title]').text = _this.page.title;
        else window.tinymce.get('jsharmony_cms_title_editor').setContent(_this.page.title, { jsHarmonyCmsSource: 'title' });
      }
    }
    if(!src || !jsh.XDom.class.contains(src, 'page_settings_title')) jsh.XDom.setValue('#jsharmony_cms_page_toolbar .page_settings .page_settings_title', _this.page.title);
    if(!src || !jsh.XDom.class.contains(src, 'page_settings_seo_title')) jsh.XDom.setValue('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_title', _this.page.seo.title);
    jsh.XDom('#jsharmony_cms_page_toolbar').get('.title').html = ('<b>Title:</b> '+XExt.escapeHTML(_this.page.title)+(cms.devMode ? ' &nbsp;<b>(Dev Mode)</b>' : ''));
    document.title = (_this.page.seo.title ? _this.page.seo.title : _this.page.title);
    if(jsh.XDom('[cms-title]').length && !jsh.XDom('[cms-title]').class.contains('hidden')){
      var titleIsVisible = jsh.XDom('[cms-title]').isVisible();
      var titleIsHiddenByProperties = (jsh.XDom('[cms-title]').attr['data-jsharmony_cms_properties_toggle_hidden'] == '1');
      if(!titleIsHiddenByProperties){
        if(titleIsVisible && !_this.page.title) jsh.XDom('[cms-title]').style.display = false;
        else if(!titleIsVisible && _this.page.title) jsh.XDom('[cms-title]').style.display = true;
      }
    }
  };

  this.onTitleUpdate = function(src, val){
    if(cms.readonly) return;
    var prev_hasChanges = _this.hasChanges;
    var new_page_title = _this.page.title;
    var new_seo_title = _this.page.seo.title;
    if(src.id=='jsharmony_cms_title_editor'){
      if(jsh.XDom('[cms-title]').length) new_page_title = window.tinymce.get('jsharmony_cms_title_editor').getContent();
    }
    else if(jsh.XDom.class.contains(src, 'page_settings_title')) new_page_title = jsh.XDom.getValue('#jsharmony_cms_page_toolbar .page_settings .page_settings_title');
    else if(jsh.XDom.class.contains(src, 'page_settings_seo_title')) new_seo_title = jsh.XDom.getValue('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_title');
    if(new_page_title != _this.page.title){ _this.page.title = new_page_title; _this.hasChanges = true; }
    if(new_seo_title != _this.page.seo.title){ _this.page.seo.title = new_seo_title; _this.hasChanges = true; }
    _this.renderTitle(src);
    if(_this.hasChanges && !prev_hasChanges) _this.getValues();
  };

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
      var val = jsh.XDom.getValue('#jsharmony_cms_page_toolbar .page_settings .page_settings_'+key);
      if(val != (_this.page[key]||'')){ _this.page[key] = val; _this.hasChanges = true; }
    });
    _.each(['keywords','metadesc','canonical_url'], function(key){
      var val = jsh.XDom.getValue('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_'+key);
      if(val != (_this.page.seo[key]||'')){ _this.page.seo[key] = val; _this.hasChanges = true; }
    });
    _this.hasPropertiesError = false;
    if(_this.hasProperties()){
      _this.hasChanges = _this.hasChanges || (!!XPage.GetChanges('jsharmony_cms_page_properties').length);
      if(!jsh.XModels['jsharmony_cms_page_properties'].controller.Commit(_this.page.properties, 'U')){
        _this.hasChanges = true;
        _this.hasPropertiesError = true;
      }
    }
    if(_this.hasChanges){
      jsh.XDom.class.add('#jsharmony_cms_page_toolbar a.jsharmony_cms_button.save', 'hasChanges');
      _this.renderHooks();
      cms.componentManager.renderPageComponents();
    }
  };

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
      jsh.XDom.emit('#jsharmony_cms_page_toolbar .xtab[for=jsharmony_cms_page_settings_properties]', 'click');
      return false;
    }
    if(!validation.ValidateControls('U', _this.page)){
      //Open settings if settings have an error
      var settings_error = false;
      _.each(['title','tags','author'], function(key){ if(jsh.XDom.class.contains('#jsharmony_cms_page_toolbar .page_settings .page_settings_'+key, 'xinputerror')){ settings_error = true; jsh.XDom.emit('#jsharmony_cms_page_toolbar .xtab[for=jsharmony_cms_page_settings_overview]', 'click'); } });
      if(!settings_error) _.each(['title','keywords','metadesc','canonical_url'], function(key){ if(jsh.XDom.class.contains('#jsharmony_cms_page_toolbar .page_settings .page_settings_seo_'+key, 'xinputerror')){ settings_error = true; jsh.XDom.emit('#jsharmony_cms_page_toolbar .xtab[for=jsharmony_cms_page_settings_seo]', 'click'); } });
      if(settings_error){
        cms.toolbar.showSlideoutButton('settings');
      }
      return false;
    }
    return true;
  };

  this.getSaveData = function(){
    if(_this.page_template_id != '<Standalone>') return _this.page;

    var pageData = _.extend({}, _this.page);
    pageData.content = _.extend({}, _this.template && _this.template.content, pageData.content);
    var contentComponents = [];
    jsh.XDom('[cms-component-content]').elements.forEach(function(el){ contentComponents.push(el); });
    for(var key in cms.componentManager.containerlessComponents) contentComponents.push(cms.componentManager.containerlessComponents[key]);
    _.each(contentComponents, function(component){
      var contentArea = (component.getAttribute('cms-component-content')||'').toString();
      if(contentArea.indexOf('page.content.')==0) contentArea = contentArea.substr(('page.content.').length);
      if(contentArea){
        var componentObj = component.cloneNode();
        jsh.XDom.class.remove(componentObj, 'mceNonEditable initialized');
        if(componentObj.hasAttribute('class') && !componentObj.getAttribute('class').trim()) componentObj.removeAttribute('class');
        componentObj.removeAttribute('cms-component-content');
        componentObj.setAttribute('cms-component-remove-container','');
        pageData.content[contentArea] = componentObj.outerHTML;
      }
    });
    return pageData;
  };

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
    if(!_.isEmpty(qs)) url += '?' + jsh.XExt.escapeQuery(qs);

    cms.toolbar.hideSlideoutButton('settings', true);
    XExt.CallAppFunc(url, 'post', _this.getSaveData(), function (rslt) { //On Success
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
  };

  this.getComponentRenderParameters = function(component, renderOptions, additionalRenderParams){
    additionalRenderParams = _.extend({}, additionalRenderParams, {
      //Additional parameters for static render
      page: _this.page,
      template: _this.template,
      sitemap: _this.sitemap,
      getSitemapURL: function(sitemap_item){ return '#'; },
      menu: null,
      getMenuURL: function(menu_item){ return '#'; },
      getMenuImageURL: function(menu_item){ return '#'; },
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
  };

  cms.controller = this;

})(jsHarmonyCMSInstance));
