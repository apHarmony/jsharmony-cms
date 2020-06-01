var Cloner = require('../utils/cloner');
var GridPreviewDataModel = require('./gridPreviewDataModel');
var FormDataModel = require('./formDataModel');
var FormPropertiesModel = require('./formPropertiesModel');

/**
 * @class
 * @param {Object} componentConfig - the component configuration as defined by the component JSON.
 * @param {Object} jsh
 */
function ComponentConfig(componentConfig, jsh) {

  /** @private @type {Object} */
  this._componentConfig = componentConfig;

  /** @private @type {Object} */
  this._jsh = jsh;
}

/**
 * Get the ID specified for the component configuration.
 * This is NOT an instance id.
 * @public
 * @returns {(string | undefined)}
 */
ComponentConfig.prototype.getComponentConfigId = function() {
  return this._componentConfig.id;
}

/**
 * Return the editor type
 * @public
 * @returns {('grid'| | 'grid_preview' | 'form' | undefined)}
 */
ComponentConfig.prototype.getDataEditorType = function() {
  if (this._componentConfig.data) {
    return this._componentConfig.data.layout;
  }
  return undefined;
}

/**
 * Get a model instance configured for the grid preview data editor.
 * @public
 * @returns {(GridPreviewDataModel | undefined)}
 */
ComponentConfig.prototype.getGridPreviewDataModelInstance = function() {

  var model = this.getModelInstance('data');
  if (model === undefined) return undefined;
  return new GridPreviewDataModel(model);
}

/**
 * Get a model instance configured for the form data editor.
 * @public
 * @returns {(FormDataModel | undefined)}
 */
ComponentConfig.prototype.getFormDataModelInstance = function() {

  var model = this.getModelInstance('data');
  if (model === undefined) return undefined;
  return new FormDataModel(model);
}

/**
 * Get a model instance configured for the form properties editor.
 * @public
 * @returns {(FormPropertiesModel | undefined)}
 */
ComponentConfig.prototype.getFormPropertiesModelInstance = function() {

  var model = this.getModelInstance('properties');
  if (model === undefined) return undefined;
  return new FormPropertiesModel(model);
}

/**
 * Create a unique model from the component configuration.
 * @private
 * @param {('data' | 'props')} key - the type of model instance to get.
 * @returns {(Object | undefined)} - if model is found, return a unique instance of the model
 * from the component configuration. Model can be mutated without side effects.
 */
ComponentConfig.prototype.getModelInstance = function(key) {

  var model;
  if (key === 'data') {
    model = this._componentConfig.data;
  } else if (key === 'properties') {
    model = this._componentConfig.properties;
  } else {
    throw new Error('Mode key is not valid: "'+ key +'"');
  }

  // jsHarmony will mutate the model. We have to have a DEEP
  // clone to keep things isolated (since models need to be reused for nested components).
  model = Cloner.deepClone(model);
  model.id = this.createInstanceId();

  return model;
}

/**
 * Create a unique ID to use for model instance
 * @returns {string}
 */
ComponentConfig.prototype.createInstanceId = function() {
  var id = undefined;
  do {
    id = 'jsharmony_cms_component_model_' + Math.random().toString().replace('.', '');
    id = this._jsh.XModels[id] ? undefined : id;
  } while (!id);
  return id;
}


exports = module.exports = ComponentConfig;
