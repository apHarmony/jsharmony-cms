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
var Cloner = require('../utils/cloner');
var FieldModel = require('./fieldModel');

/** @typedef {PropertiesModelTemplate_Form} PropertiesModelTemplate_Form */

/**
 * @class
 * @classdesc Normalizes the model for use in the property form
 * editor. Creates a model template that can then be used to generate
 * unique instances of the model for editing.
 * @param {import('./componentTemplate').ComponentTemplate} componentTemplate
 * @param {object} propertiesModel - the raw properties model from the component config
 */
function PropertiesModelTemplate_Form(componentTemplate, propertiesModel) {

  /** @private @type {Object} */
  this._jsh = componentTemplate._jsh;

  /** @private @type {Object} */
  this._cms = componentTemplate._cms;

  /** @private @type {Object} */
  this._componentTemplate = componentTemplate;

  /** @private @type {string} */
  this._componentTemplateId = componentTemplate.getTemplateId();

  /** @private @type {object} */
  this._modelTemplate = {};

  this.buildTemplate(componentTemplate, propertiesModel);
}

/**
 * @private
 * @param {import('./componentTemplate').ComponentTemplate} componentTemplate
 * @param {object} propertiesModel - the raw properties model from the component config
 */
PropertiesModelTemplate_Form.prototype.buildTemplate = function(componentTemplate, propertiesModel) {

  var modelConfig = Cloner.deepClone(propertiesModel || {});

  var model = _.extend({}, modelConfig);

  if(modelConfig.fields && modelConfig.fields.length){
    modelConfig.fields.unshift({ control:'html', value:'<div class="jsharmony_cms">',captionclass:'hidden'});
    modelConfig.fields.push({ control:'html', value:'</div>',captionclass:'hidden'});
  }

  this._modelTemplate = model;
  model.title = modelConfig.title ? modelConfig.title : 'Configure ' + componentTemplate.getCaptions()[0];
  model.unbound = true;
  model.layout = 'form';
  model.onecolumn = true;
  if(model.js && _.isString(model.js) && model.js.trim()) model.js = '(function(){ var cms = '+this._cms._instance+';' + model.js + ' })();';
  this._jsh.XPage.ParseModelDefinition(model, null, null, { ignoreErrors: true });
};

/**
 * @public
 */
PropertiesModelTemplate_Form.prototype.getModelInstance = function() {
  var model = Cloner.deepClone(this._modelTemplate);
  model.id = PropertiesModelTemplate_Form.getNextInstanceId(this._componentTemplate);

  return model;
};

/**
 * Get a unique ID for the model instance
 * @private
 * @returns {string}
 */
PropertiesModelTemplate_Form.getNextInstanceId = function(componentTemplate) {
  if (PropertiesModelTemplate_Form._id == undefined) PropertiesModelTemplate_Form._id = 0;
  var id = PropertiesModelTemplate_Form._id++;
  return 'PropertiesModel_Form_' + componentTemplate.getClassName() + '_' + id;
};

/**
 * Create a pristine copy of the data.
 * This will remove extraneous properties (that don't exist in the model)
 * and do data conversions. It will also add missing fields.
 * The returned value will match the field model exactly.
 *
 * NOTE: this does not set default values! If the value is not set in
 * dataInstance then the property will be set to undefined.
 *
 * @public
 * @param {Object} dataInstance - the existing field values.
  * @returns {Object} a copy of the dataInstance with type conversions done and extraneous
 * properties removed.
 */
PropertiesModelTemplate_Form.prototype.makePristineCopy = function(dataInstance) {
  return FieldModel.makePristineCopy(dataInstance, this._modelTemplate.fields);
};

/**
 * Iterates through the fieldModels
 * to look for fields with "type" property. If a field has the type property
 * then the field will be added to the new data instance object.
 *
 * Setting the field follows specific rules
 * 1. If the data instance does not contain the property key
 *    then the property is set to either undefined or the default value.
 * 2. If the data instance contains the property and the property value is
 *    defined then it is left as-is.
 * 3. If the data instance contains the property and the property value is
 *    null/undefined then the property is overridden if there is a default AND
 *    it is a required field. If it is not required then the value is left as
 *    null/undefined (which allows the user to clear default values that are
 *    not required fields).
 *
 * This will also correctly convert values as needed.
 *
 * This mutates the dataInstance.
 * @public
 * @param {Object} dataInstance - the data instance. Each property corresponds
 * to a field in the field array. This object will be mutated.
 * @returns {Object} the new or mutated data
 */
PropertiesModelTemplate_Form.prototype.populateDataInstance = function(dataInstance) {
  return FieldModel.populateDataInstance(dataInstance, this._modelTemplate.fields || []);
};

exports = module.exports = PropertiesModelTemplate_Form;
