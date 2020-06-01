var FieldModel = require('./fieldModel');

/**
 * @class
 * @classdesc Use for working with models for editing component
 * properties in a form
 * @param {Object} modelConfig - the base model config as defined
 * in the component config.
 */
function FormPropertiesModel(modelConfig) {

  /** @private @type {FieldModel} */
  this._itemFields;

  /** @private @type {Object} */
  this._modelConfig = modelConfig;

  this.init(modelConfig);
}

/**
 * @public
 * @returns {FieldModel}
 */
FormPropertiesModel.prototype.getItemFields = function() {
  return this._itemFields;
}

/**
 * Return the raw model configuration.
 * @public
 * @returns {Object}
 */
FormPropertiesModel.prototype.getModelConfig = function() {
  return this._modelConfig;
}

/**
 * Ensure the model is configured according to conventions
 * and setup for standard form operation.
 * @private
 */
FormPropertiesModel.prototype.init = function(modelConfig) {

  modelConfig.unbound = true;
  modelConfig.layout = 'form';
  modelConfig.onecolumn = true;


  this._itemFields = new FieldModel(modelConfig.fields)
}


exports = module.exports = FormPropertiesModel;
