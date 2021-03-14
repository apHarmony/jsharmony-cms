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

var _ = require('lodash');
var ComponentTemplate = require('./component/componentModel/componentTemplate');
var DataEditor_GridPreview = require('./component/editors/dataEditor_gridPreview');
var PropertyEditor_Form = require('./component/editors/propertyEditor_form');
var DataEditor_Form = require('./component/editors/dataEditor_form');
var DomSerializer = require('./component/utils/domSerializer');
var TemplateRenderer = require('./component/templateRenderer');


/** @typedef {import('./component/templateRenderer').RenderConfig} RenderConfig */

/**
 * @callback BasicComponentController~beforeRender
 * @param {RenderConfig} renderConfig
 */

/**
 * @callback BasicComponentController~render
 * @param {HTMLElement} element
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 * @param {Object} cms - the parent jsHarmonyCMSInstance
 * @param {Object} component - the parent component
 */

/**
 * @class
 * @param {string} componentId - the globally unique component instance ID
 * @param {(HTMLElement | JQuery)} element
 * @param {Object} cms
 * @param {Object} jsh
 * @param {string} componentConfigId
 */
exports = module.exports = function(componentId, element, cms, jsh, componentConfigId) {

  /** @type {JQuery} */
  var $element = jsh.$(element);

  /** @type {ComponentTemplate} */
  var componentTemplate = new ComponentTemplate(cms.componentManager.componentTemplates[componentConfigId], jsh);

  /** @public @type {BasicComponentController~beforeRender} */
  this.onBeforeRender = undefined;

  /** @public @type {BasicComponentController~render} */
  this.onRender = undefined;

  /** @public @type {Object} */
  this.template = undefined;
  Object.defineProperty(this, 'template', { get: function() { return componentTemplate.getComponentConfig() }});

  /** @public @type {string} */
  this.id = undefined;
  Object.defineProperty(this, 'id', { get: function() { return componentId }});

  /** @public @type {Object} */
  this.domSerializer = new DomSerializer(jsh);

  /**
   * Get the data from the element's serialized data attribute value.
   * @private
   * @return {Object}
   */
  this.getData = function() {
    return this.domSerializer.getAttr($element, 'data-component-data');
  }

  /**
   * Get the properties from the element's serialized property attribute value
   * and update from model definition.
   * @private
   * @return {Object}
   */
  this.getProperties = function() {
    var model = componentTemplate.getPropertiesModelTemplate_Form();
    var properties = this.domSerializer.getAttr($element, 'data-component-properties');
    return model.populateDataInstance(properties);
  }

  /**
   * Setup the default properties object
   * and save the object.
   * @private
   */
  this.initProperties = function() {
    this.saveProperties(this.getProperties());
  }

  /**
   * Check to see if the component is readonly.
   * @private
   * @returns {boolean} - true if the model is readonly.
   */
  this.isReadOnly = function() {
    return !!cms.readonly;
  }

  /**
   * Open the data editor form.
   * @public
   */
  this.openDataEditor = function() {
    var editorType = componentTemplate.getDataEditorType();
    if (editorType === 'grid') {
      throw new Error('Not Implemented');
    } else if (editorType === 'grid_preview') {
      this.openDataEditor_GridPreview();
    } else if (editorType === 'form') {
      this.openDataEditor_Form();
    } else if (editorType != undefined) {
      throw new  Error('Unknown editor type "' + editorType  + '"');
    }
  }

  /**
   * @private
   * @param {object} modelInstance - the model instance to render (model will be mutated).
   */
  this.openDataEditor_Form = function() {
    var _this = this;
    var dataEditor = new DataEditor_Form(componentTemplate, undefined, this.isReadOnly(), cms, jsh, _this);

    var data = this.getData() || {};
    dataEditor.open(data.item || {}, this.getProperties() || {}, function(updatedData) {
      data.item = updatedData;
      _this.saveData(data);
      _this.render();
    });
  }

  /**
   * @private
   */
  this.openDataEditor_GridPreview = function() {
    var _this = this;
    var dataEditor = new DataEditor_GridPreview(componentTemplate, cms, jsh, _this);

    dataEditor.open(this.getData(), this.getProperties() || {}, function(updatedData) {
      _this.saveData(updatedData);
      _this.render();
    });
  }

  /**
   * Open the property editor form.
   * @public
   */
  this.openPropertiesEditor = function() {

    var _this = this;
    var propertyEditor = new PropertyEditor_Form(componentTemplate, cms, jsh);

    propertyEditor.open(this.getProperties() || {}, function(data) {
      _this.saveProperties(data);
      _this.render();
    });
  }

  this.openDefaultEditor = function(){
    var _this = this;
    var config = componentTemplate.getComponentConfig()  || {};
    var hasData = ((config.data || {}).fields || []).length > 0;
    var hasProperties = ((config.properties || {}).fields || []).length > 0;
    if(hasData) _this.openDataEditor();
    else if(hasProperties) _this.openPropertiesEditor();
  }

  /**
   * Render the component
   * @public
   */
  this.render = function(callback) {
    if(!callback) callback = function(){};

    var _this = this;
    var config = componentTemplate.getComponentConfig()  || {};
    var template = (config.templates || {}).editor || '';

    var data = _.extend({}, this.getData(), { component_id: _this.id });
    var props = this.getProperties();

    var renderConfig = TemplateRenderer.createRenderConfig(template, data, props, cms);

    if (_.isFunction(this.onBeforeRender)) this.onBeforeRender(renderConfig);

    var rendered = TemplateRenderer.render(renderConfig, 'component', jsh, cms, config);

    if(!rendered){
      if(!template) rendered = '*** Component Rendering Error: Template Missing ***';
      else rendered = '*** Component Rendering Error: Empty Result ***';
    }

    $element.empty().append(rendered);

    $element.off('dblclick.cmsComponent').on('dblclick.cmsComponent', function(e){
      _this.openDefaultEditor();
    });

    if (_.isFunction(this.onRender)) this.onRender($element[0], data, props, cms, this);

    setTimeout(function() {
      jsh.async.each(
        $element.find('[data-component]'), 
        function(el, el_cb) {
          cms.componentManager.renderContentComponent(el, undefined, el_cb);
        },
        callback
      );
    });
  }

  /**
   * Call anytime the data is changed in the view (i.e.,
   * by the user). This will update the component's data
   * on the page.
   * @private
   * @param {(Object | undefined)} data
   */
  this.saveData = function(data) {
    this.domSerializer.setAttr($element, 'data-component-data', data);
  }

  /**
   * Call anytime the properties are changed in the view (i.e.,
   * by the user). This will save the properties for the components
   * @private
   * @param {(Object | undefined)} props
   */
  this.saveProperties = function(props) {
    this.domSerializer.setAttr($element, 'data-component-properties', props);
  }



  this.initProperties();


}