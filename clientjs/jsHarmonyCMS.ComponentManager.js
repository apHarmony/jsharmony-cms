/*
Copyright 2020 apHarmony

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

var JsHarmonyCMSComponent = require('./jsHarmonyCMS.Component');

exports = module.exports = function(jsh, cms){
  var _this = this;
  var _ = jsh._;
  var $ = jsh.$;
  var XExt = jsh.XExt;
  var async = jsh.async;
  var ejs = jsh.ejs;

  this.componentTemplates = {};
  this.components = {};
  this.isInitialized = false;
  this.lastComponentId = 0;
  this.containerlessComponents = {};
  this.cntContainerlessComponents = 0;

  var maxUniqueId = 0;

  this.load = function(onError){
    _this.loadSystemComponentTemplates(onError);
  }

  this.loadSystemComponentTemplates = function(onError){
    var url = '../_funcs/templates/components/'+(cms.branch_id||'');
    var qs = { };
    if(cms.token) qs.jshcms_token = cms.token;
    XExt.CallAppFunc(url, 'get', qs, function (rslt) { //On Success
      if ('_success' in rslt) {
        async.eachOf(rslt.components, function(component, componentId, cb) {
          var loadObj = {};
          cms.loader.StartLoading(loadObj, 'CMS Components');
          _this.downloadRemoteTemplate(component, function(err){
            cms.loader.StopLoading(loadObj);
            _this.addTemplate(componentId, component);
            cb(err)
          });
        }, function(error){
          _this.isInitialized = true;
        });
      }
      else{
        if(onError) onError(new Error('Error Loading Components'));
        XExt.Alert('Error loading components');
      }
    }, function (err) {
      if(onError) onError(err);
    });
  };

  this.addTemplate = function(componentId, componentTemplate){
    if(componentId in _this.componentTemplates) return cms.fatalError('Could not add duplicate Component Template "'+componentId+'" - it has already been added');
    _this.componentTemplates[componentId] = componentTemplate;
    _this.parseTemplate(componentTemplate);
    _this.renderTemplateStyles(componentTemplate.id, componentTemplate);
  }

  this.downloadRemoteTemplate = function(componentTemplate, complete_cb) {
    var url = (componentTemplate.remote_templates || {}).editor;
    if (!url) return complete_cb();

    $.ajax({
      type: 'GET',
      cache: false,
      url: url,
      xhrFields: { withCredentials: true },
      success: function(data){
        componentTemplate.templates = componentTemplate.templates || {};
        var template = (componentTemplate.templates.editor || '');
        data = data && template ? '\n' + data : data || '';
        componentTemplate.templates.editor = (template + data) || _this.formatComponentError('COMPONENT '+(componentTemplate.id||'').toUpperCase()+' NOT FOUND');
        complete_cb();
      },
      error: function(xhr, status, err){
        complete_cb(err);
      }
    });
  }

  this.compileTemplates = function(componentTemplates, cb) {
    var url = '../_funcs/templates/compile_components';
    var qs = { };
    if(cms.token) qs.jshcms_token = cms.token;
    if(!_.isEmpty(qs)) url += '?' + $.param(qs);
    XExt.CallAppFunc(url, 'post', { components: JSON.stringify(componentTemplates) }, function (rslt) { //On Success
      if ('_success' in rslt) {
        var components = rslt.components;
        return cb(null, components);
      }
      else{
        return cb(new Error('Error Compiling Inline Components'));
      }
    }, function (err) {
      if(err.Message) return cb(new Error('Error Compiling Inline Components - ' + err.Message));
      return cb(new Error('Error Compiling Inline Components'));
    });
  }

  this.formatComponentError = function(errmsg){
    return '<span style="color:red;font-weight:bold;font-size:25px;white-space: pre-wrap;">*** '+XExt.escapeHTML(errmsg)+' ***</span>';
  }

  this.renderPageComponents = function(){
    $('.jsharmony_cms_component,[cms-component]').not('.initialized').each(function(){
      var jobj = $(this);
      if(jobj.closest('[cms-content-editor]').length) return; //Do not render page components in content editor
      if(jobj.closest('[data-jsharmony_cms_properties_toggle_hidden=1]').length) return; //Do not render page components if hidden by cms-onRender function
      var component_id = jobj.attr('cms-component');
      if(!component_id){
        component_id = jobj.data('id');
        jobj.attr('cms-component', component_id);
      }

      var removeContainer = (typeof jobj.attr('cms-component-remove-container') != 'undefined')
      var isContentComponent = !component_id && jobj.closest('[data-component]').length > 0;
      if (isContentComponent) return;

      jobj.addClass('initialized mceNonEditable');
      var component_content = '';
      if(!component_id) component_content = _this.formatComponentError('*** COMPONENT MISSING data-id ATTRIBUTE ***');
      else if(!(component_id in _this.componentTemplates)) component_content = _this.formatComponentError('*** MISSING TEMPLATE FOR COMPONENT "' + component_id+'" ***');
      else{
        var component = _this.componentTemplates[component_id];
        var templates = component != undefined ? component.templates : undefined
        var editorTemplate = (templates || {}).editor;
        var renderOptions = {};
        //Parse component properties
        var props = {
          'cms-menu-tag': { renderOption: 'menu_tag', type: 'string'},
          'cms-component-properties': { renderOption: 'properties', type: 'json'},
          'cms-component-data': { renderOption: 'data', type: 'json'},
        }
        var renderOptions = {};
        var hasError = false;
        for(var propName in props){
          var prop = props[propName];
          var propVal = jobj.attr(propName);
          if(typeof propVal != 'undefined'){
            if(prop.type=='json'){
              if(propVal === '') propVal = '{}';
              try{
                propVal = JSON.parse(propVal);
              }
              catch(ex){
                component_content = _this.formatComponentError('*** INVALID JSON IN COMPONENT "' + component_id+'", property "'+propName+'": '+ex.toString()+' *** ');
                hasError = true;
              }
            }
            renderOptions[prop.renderOption] = propVal;
          }
        }
        //Render component
        try{
          if(!hasError) component_content = ejs.render(editorTemplate || '', cms.controller.getComponentRenderParameters(component, renderOptions));
        }
        catch(ex){
          cms.fatalError('Error rendering component "' + component_id + '": '+ex.toString());
        }
      }
      if(removeContainer){
        var containerlessComponentId = ++_this.cntContainerlessComponents;
        _this.containerlessComponents[containerlessComponentId] = jobj[0];
        jobj[0].insertAdjacentHTML('beforebegin', '<script id="jshcms-component-containerless-'+containerlessComponentId+'-start"></script>');
        jobj[0].insertAdjacentHTML('afterend', '<script id="jshcms-component-containerless-'+containerlessComponentId+'-end"></script>');
        jobj.replaceWith(component_content);
      }
      else {
        jobj.html(component_content);
      }
    });
  }

  this.getContainerlessComponentKey = function(obj){
    for(var key in _this.containerlessComponents){
      if(_this.containerlessComponents[key]==obj) return key;
    }
    return null;
  }

  this.restoreContainerlessComponent = function(containerlessComponentId){
    if(!(containerlessComponentId in _this.containerlessComponents)) throw new Error('Containerless component not found');
    var startNode = $('#jshcms-component-containerless-'+containerlessComponentId.toString()+'-start');
    if(!startNode.length) throw new Error('Containerless start node not found');
    var foundEnd = false;
    var childNodes = [startNode[0]];
    var curNode = startNode;
    while(!foundEnd && (curNode = curNode.next())){
      if(!curNode.length) break;
      childNodes.push(curNode[0]);
      if(curNode[0].id=='jshcms-component-containerless-'+containerlessComponentId.toString()+'-end'){
        foundEnd = true;
      }
    }
    if(!foundEnd) throw new Error('Containerless end node not found');
    childNodes[0].replaceWith(_this.containerlessComponents[containerlessComponentId]);
    for(var i=1;i<childNodes.length;i++){
      $(childNodes[i]).remove();
    }
    _this.resetPageComponent(_this.containerlessComponents[containerlessComponentId]);
    delete _this.containerlessComponents[containerlessComponentId];
  }

  this.resetPageComponent = function(obj){
    if($(obj).hasClass('initialized')) $(obj).removeClass('initialized mceNonEditable').empty();
  }

  this.getDefaultValues = function(model){
    var rslt = {};
    if(model) _.each(model.fields, function(field){
      if(field && field.name && ('default' in field)){
        rslt[field.name] = field.default;
      }
    });
    return rslt;
  }

  this.parseTemplate = function(componentTemplate) {
    componentTemplate.templates = componentTemplate.templates || {};
    var componentRawEjs = componentTemplate.templates.editor || '';

    /**********
     * If there is a wrapper element with the "componentTemplate" class
     * then the wrapper's inner HTML is the componentEJS template.
     * It also means that the data EJS template might be in there as well.
     *
     * If the wrapper does not exist then the entire EJS string is the template
     **********/

     //Preview template
    var hasComponentSubTemplate = false;
     if(componentRawEjs.indexOf('componentTemplate')>=0){
      var $componentTemplateWrapper = $('<div>'+componentRawEjs+'</div>', document.implementation.createHTMLDocument('virtual')).find('.componentTemplate');
      hasComponentSubTemplate = !!$componentTemplateWrapper.length;
      if (hasComponentSubTemplate){
        componentTemplate.templates.editor = $componentTemplateWrapper.html();
      }
    }

    //Parse data model
    if(!_.isEmpty(componentTemplate.data)){

      //Data model EJS
      if(!componentTemplate.data.ejs) componentTemplate.data.ejs = '';
      
      var $componentPreviewTemplate = null;
      if(componentRawEjs.indexOf('componentPreviewTemplate')>=0){
        $componentPreviewTemplate = $('<div>'+componentRawEjs+'</div>', document.implementation.createHTMLDocument('virtual')).find('.componentPreviewTemplate');
        if ($componentPreviewTemplate.length){
          componentTemplate.data.ejs += '\n' + $componentPreviewTemplate.html();
        }
        else $componentPreviewTemplate = null;
      }
      if(!$componentPreviewTemplate && !hasComponentSubTemplate) {
        //For grid_preview and form layouts, use the component template as the preview template
        if(componentTemplate.data && _.includes(['grid_preview','form'], componentTemplate.data.layout)){
          componentTemplate.data.ejs += '\n' + componentRawEjs;
        }
      }
    }
  }

  this.getNextComponentId = function() {
    return 'jsharmony_cms_component_' + this.lastComponentId++;
  }

  this.renderContainerContentComponents = function(container, callback){
    var items = $(container).find('[data-component]').not('.initialized').addClass('initialized');
    async.each(items, function(item, item_cb){
      $(item).attr('data-component-id', _this.getNextComponentId());
      _this.renderContentComponent(item, undefined, item_cb);
    }, callback);
  }

  this.renderContentComponent = function(element, options, callback) {
    if(!callback) callback = function(){};
    options = _.extend({ init: false }, options);

    var componentType = $(element).attr('data-component');
    var componentTemplate = componentType ? _this.componentTemplates[componentType] : undefined;
    if (!componentTemplate) return callback();

    componentTemplate.id = componentTemplate.id || componentType;
    var componentId = $(element).attr('data-component-id') || '';
    if (componentId.length < 1) { console.error(new Error('Component is missing [data-component-id] attribute.')); return callback(); }

    //Default component instance
    var component = {
      create: function(componentConfig, element) {
        component = _.extend(new JsHarmonyCMSComponent(componentId, element, cms, jsh, componentConfig.id), component);
        component.render(callback);
        _this.components[componentId] = component;
      },
      onBeforeRender: undefined,
      onRender: undefined,
    };

    //Execute componentTemplate.js to set additional properties on component
    XExt.JSEval('\r\n' + (componentTemplate.js || '') + '\r\n', component, {
      _this: component,
      cms: cms,
      jsh: jsh,
      component: component
    });

    //Initialize component
    component.create(componentTemplate, element);
    if ($(element).attr('data-is-insert')) {
      $(element).attr('data-is-insert', null);
      if(!options.init){
        element.scrollIntoView(false);
        _this.components[componentId].openDefaultEditor();
      }
    }
  }

  this.renderTemplateStyles = function(componentType, componentConfig) {
    this.renderedComponentTypeStyles = this.renderedComponentTypeStyles || {};
    if (this.renderedComponentTypeStyles[componentType]) return;
    this.renderedComponentTypeStyles[componentType] = true;
    var cssParts = [];
    if (componentConfig.css) {
      cssParts.push(componentConfig.css);
    }
    if (componentConfig.properties && componentConfig.properties.css) {
      cssParts.push(componentConfig.properties.css);
    }
    if (componentConfig.data && componentConfig.data.css) {
      cssParts.push(componentConfig.data.css);
    }
    var id = 'jsharmony_cms_component_' + (componentConfig.className || jsh.XExt.escapeCSSClass(componentConfig.id, { nodash: true }));
    cms.util.removeStyle(id);
    cms.util.addStyle(id, cssParts.join('\n'));
  }

  this.getComponentRenderParameters = function(component, renderOptions, additionalRenderParams){
    additionalRenderParams = additionalRenderParams || {};
    renderOptions = _.extend({ data: null, properties: null, renderType: 'component', templateName: null }, renderOptions);
    var defaultProperties = {};
    var defaultData = {};
    if(component){
      var defaultProperties = cms.componentManager.getDefaultValues(component.properties);
      var defaultData = cms.componentManager.getDefaultValues(component.data);
    }
    var properties = _.extend({}, defaultProperties, renderOptions.properties);
    var data = { items: [], item: _.extend({}, defaultData) };
    var rslt = _.extend({
      baseUrl: '',
      data: data,
      properties: properties,
      renderType: renderOptions.renderType,
      _: _,
      escapeHTML: XExt.xejs.escapeHTML,
      escapeRegEx: XExt.escapeRegEx,
      stripTags: XExt.StripTags,
      isNullUndefinedEmpty: XExt.isNullUndefinedEmpty,
      isNullUndefined: XExt.isNullUndefined,
      iif: XExt.xejs.iif,
      isInEditor: true,
      isInPageEditor: false,
      isInComponentEditor: false,
      componentRenderClass: 'jsharmony_cms_componentRender_'+XExt.escapeCSSClass((component&&component.id)||'')+'_'+cms.componentManager.getUniqueId().toString(),
      getMediaThumbnails: function(url){ return cms.componentManager.getMediaThumbnails(url); },
      items: data.items,
      item: data.item,
      component: properties,
      renderPlaceholder: function(){ return ''; },
      renderTemplate: function(locals, templateName, items){
        if(!items || (_.isArray(items) && !items.length)) return '';
        templateName = templateName || '';
        if(!locals.jsh_render_templates || !(templateName in locals.jsh_render_templates)) throw new Error('renderTemplate Error: Template not found: "'+templateName+'"');
        return locals.jsh_render_templates[templateName](items||[]);
      },
    }, additionalRenderParams);

    if(renderOptions.data){
      if(_.isArray(renderOptions.data)){
        data.items = _.map(renderOptions.data, function(item){ return _.extend({}, defaultData, item); });
        data.item = new Proxy(new Object(), { get: function(target, prop, receiver){ throw new Error('Since component data is an array, assuming this is a multiple_items component.  Please add a "jsh-foreach-item" attribute to the container HTML element, to iterate over the items array.  For example:\r\n<div jsh-foreach-item><%=item.name%></div>'); } });
      }
      else {
        data.item = _.extend(data.item, renderOptions.data);
        data.items = [data.item];
      }
      rslt.items = data.items;
      rslt.item = data.item;
    }
    return rslt;
  }

  this.getUniqueId = function(){ return ++maxUniqueId; }

  this.getMediaThumbnails = function(url){
    if(!cms.site_config || !cms.site_config.media_thumbnails) return {};
    if(!url || (url.indexOf('#@JSHCMS') < 0)) return {};
    
    var urlparts = document.createElement('a');
    urlparts.href = url;
    var patharr = (urlparts.pathname||'').split('/');
    var rslt = {};
    if(((urlparts.pathname||'').indexOf('/_funcs/media/')==0) && (patharr.length>=4)){
      for(var thumbnail_id in cms.site_config.media_thumbnails){
        if((patharr.length >= 5) && patharr[4]) patharr[4] = thumbnail_id;
        else patharr.splice(4,0,thumbnail_id);
        rslt[thumbnail_id] = urlparts.protocol + '//' + urlparts.host + patharr.join('/') + (urlparts.search||'') + (urlparts.hash||'');
      }
    }
    return rslt;
  }
}