var ComponentConfig = require('./componentModel/componentConfig');
var DataGridPreviewEditor = require('./editors/dataGridPreviewEditor');
var PropertyFormEditor = require('./editors/propertyFormEditor');
var DataFormEditor = require('./editors/dataFormEditor');
var DomSerializer = require('./utils/domSerializer');

/**
 * @typedef {Object} RenderConfig
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {string} template - the template being rendered
 */

/**
 * @callback BasicComponentController~beforeRender
 * @param {RenderConfig} renderConfig
 */

 /**
 * @callback BasicComponentController~render
 * @param {HTMLElement} element
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 */

/**
 * @class
 * @param {(HTMLElement | JQuert)} element
 * @param {Object} cms
 * @param {Object} jsh
 * @param {string} componentConfigId
 */
function BasicComponentController (element, cms, jsh, componentConfigId) {

  /** @private @type {JQuery} */
  this._$element = $(element);

  /** @private @type {Object} */
  this.cms = cms;

  /** @private @type {Object} */
  this.jsh = jsh;

  /** @private @type {string} */
  this._componentConfigId = componentConfigId;

  /** @private @type {ComponentConfig} */
  this._componentConfig = new ComponentConfig(cms.componentController.components[componentConfigId], jsh);

  /** @private @type {Object} */
  this._$element[0]._componentInterface = undefined;

  /** @public @type {BasicComponentController~beforeRender} */
  this.onBeforeRender = undefined;

  /** @public @type {BasicComponentController~render} */
  this.onRender = undefined;



  // This interface is used by the TinyMce plugin to handle editor events
  var self = this;
  this._$element[0]._componentInterface = {
    openDataEditor: function() { self.openDataEditor(); },
    openPropertiesEditor: function() { self.openPropertiesEditor(); }
  }
}

/**
 * Get the component configuration
 * @private
 * @returns {(Object | undefined)}
 */
BasicComponentController.prototype.getComponentConfig = function() {
  return this.cms.componentController.components[this._componentConfigId];
}

/**
 * Get the data from the element's serialized data attribute value.
 * @private
 * @return {Object}
 */
BasicComponentController.prototype.getData = function() {
  return DomSerializer.getAttr(this._$element, 'data-component-data');
}

/**
 * Get the properties from the element's serialized property attribute value.
 * @private
 * @return {Object}
 */
BasicComponentController.prototype.getProperties = function() {
  return DomSerializer.getAttr(this._$element, 'data-component-properties');
}

/**
 * Check to see if the component is readonly.
 * @private
 * @returns {boolean} - true if the model is readonly.
 */
BasicComponentController.prototype.isReadOnly = function() {
  return !!this.cms.readonly;
}

/**
 * Open the data editor form.
 * @public
 */
BasicComponentController.prototype.openDataEditor = function() {
  var editorType = this._componentConfig.getDataEditorType();
  if (editorType === 'grid') {
    throw new Error('Not Implemented');
  } else if (editorType === 'grid_preview') {
    this.openDataGridPreviewEditor();
  } else if (editorType === 'form') {
    this.openDataFormEditor();
  } else if (editorType != undefined) {
    throw new  Error('Unknown editor type "' + editorType  + '"');
  }
}

/**
 * @private
 * @param {object} modelInstance - the model instance to render (model will be mutated).
 */
BasicComponentController.prototype.openDataFormEditor = function() {
  var self = this;
  var dataFormEditor = new DataFormEditor(this._componentConfig, this.isReadOnly(), this.cms, this.jsh);

  var data = this.getData() || {};
  dataFormEditor.open(data.item || {}, this.getProperties() || {}, function(updatedData) {
    data.item = updatedData;
    self.saveData(data);
    self.render();
  });
}

/**
 * @private
 */
BasicComponentController.prototype.openDataGridPreviewEditor = function() {
  var self = this;
  var dataGridPreviewEditor = new DataGridPreviewEditor(this._componentConfig, this.cms, this.jsh);

  dataGridPreviewEditor.open(this.getData(), this.getProperties() || {}, function(updatedData) {
    self.saveData(updatedData);
    self.render();
  });
}

/**
 * Open the property editor form.
 * @public
 */
BasicComponentController.prototype.openPropertiesEditor = function() {

  var self = this;
  var propertyFormEditor = new PropertyFormEditor(this._componentConfig, this.cms, this.jsh);

  propertyFormEditor.open(this.getProperties() || {}, function(data) {
    self.saveProperties(data);
    self.render();
  });
}

/**
 * Render the component
 * @public
 */
BasicComponentController.prototype.render = function() {

  var self = this;
  var config = this.getComponentConfig() || {};
  var template = (config.templates || {}).editor || '';

  var data = this.getData();
  var props = this.getProperties();

  var renderOptions = {
    template: template,
    data: data,
    properties: props
  }

  if (_.isFunction(this.onBeforeRender)) this.onBeforeRender(renderOptions);

  var templateData = { data: renderOptions.data, properties: renderOptions.properties };
  var rendered = '';
  try {
    rendered = this.jsh.ejs.render(renderOptions.template || '', templateData);
  } catch (error) {
    console.error(error);
  }

  this._$element.empty().append(rendered);

  this._$element.off('dblclick.cmsComponent').on('dblclick.cmsComponent', function() {
    self.openDataEditor();
  });

  if (_.isFunction(this.onRender)) this.onRender(this._$element[0], data, props);

  setTimeout(function() {
    _.forEach(self._$element.find('[data-component]'), function(el) {
      self.cms.componentController.renderComponent(el);
    });
  });
}

/**
 * Call anytime the data is changed in the view (i.e.,
 * by the user). This will update the component's data
 * on the page.
 * @private
 * @param {(Object | undefined)} data
 */
BasicComponentController.prototype.saveData = function(data) {
  DomSerializer.setAttr(this._$element, 'data-component-data', data);
}

/**
 * Call anytime the properties are changed in the view (i.e.,
 * by the user). This will save the properties for the components
 * @private
 * @param {(Object | undefined)} props
 */
BasicComponentController.prototype.saveProperties = function(props) {
  DomSerializer.setAttr(this._$element, 'data-component-properties', props);
}

exports = module.exports = BasicComponentController;
