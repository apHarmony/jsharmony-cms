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

  this.componentTemplates = null;
  this.components = {};
  this.isInitialized = false;
  this.lastComponentId = 0;

  this.load = function(onComplete){
    var url = '../_funcs/templates/component/'+cms.branch_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.componentTemplates = rslt.components;
        async.eachOf(_this.componentTemplates, function(component, key, cb) {
          var loadObj = {};
          cms.loader.StartLoading(loadObj);
          _this.loadTemplate(component, function(err){
            cms.loader.StopLoading(loadObj);
            _this.parseTemplate(component);
            cb(err)
          });
        }, function(error){
          _this.isInitialized = true;
        });
      }
      else{
        if(onComplete) onComplete(new Error('Error Loading Components'));
        XExt.Alert('Error loading components');
      }
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  };

  this.render = function(container){

    $('.jsharmony_cms_component').not('.initialized').each(function(){

      var jobj = $(this);

      var component_id = jobj.data('id');
      var isCmsComponent = !component_id && jobj.closest('[data-component]').length > 0;
      if (isCmsComponent) return;

      jobj.addClass('initialized mceNonEditable');
      var component_content = '';
      if(!component_id) component_content = '*** COMPONENT MISSING data-id ATTRIBUTE ***';
      else if(!(component_id in _this.componentTemplates)) component_content = '*** MISSING CONTENT FOR COMPONENT ID ' + component_id+' ***';
      else{
        var component = _this.componentTemplates[component_id];
        var templates = component != undefined ? component.templates : undefined
        var editorTemplate = (templates || {}).editor;
        component_content = ejs.render(editorTemplate || '', cms.controller.getComponentRenderParameters(component_id));
      }
      jobj.html(component_content);
    });

    if(container){
      $(container).find('[data-component]').not('.initialized').addClass('initialized').each(function() {
        $(this).attr('data-component-id', _this.getNextComponentId());
        _this.renderComponent(this);
      });
    }
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

  this.loadTemplate = function(componentTemplate, complete_cb) {
    var url = (componentTemplate.remote_template || {}).editor;
    if (!url) return complete_cb();

    _this.loadRemoteTemplate(url, function(error, data){
      if (error) {
        complete_cb(error);
      } else {
        componentTemplate.templates = componentTemplate.templates || {};
        var template = (componentTemplate.templates.editor || '');
        data = data && template ? '\n' + data : data || '';
        componentTemplate.templates.editor = (template + data) || '*** COMPONENT NOT FOUND ***';
        _this.renderTemplateStyles(componentTemplate.id, componentTemplate);
        complete_cb();
      }
    });
  }

  this.loadRemoteTemplate = function(templateUrl, complete_cb) {
    $.ajax({
      type: 'GET',
      cache: false,
      url: templateUrl,
      xhrFields: { withCredentials: true },
      success: function(data){
        return complete_cb(undefined, data);
      },
      error: function(xhr, status, err){
        return complete_cb(err, undefined);
      }
    });
  }

  this.getNextComponentId = function() {
    return 'jsharmony_cms_component_' + this.lastComponentId++;
  }

  this.renderComponent = function(element) {

    var componentType = $(element).attr('data-component');
    var componentTemplate = componentType ? _this.componentTemplates[componentType] : undefined;
    if (!componentTemplate) return;

    componentTemplate.id = componentTemplate.id || componentType;
    var componentId = $(element).attr('data-component-id') || '';
    if (componentId.length < 1) { console.error(new Error('Component is missing [data-component-id] attribute.')); return; }

    //Default component instance
    var component = {
      create: function(componentConfig, element) {
        component = _.extend(new JsHarmonyCMSComponent(componentId, element, cms, jsh, componentConfig.id), component);
        component.render();
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
      element.scrollIntoView(false);
      _this.components[componentId].openDataEditor();
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
    var id = 'jsharmony_cms_component_' + componentType;
    cms.util.removeStyle(id);
    cms.util.addStyle(id, cssParts.join('\n'));
  }
}