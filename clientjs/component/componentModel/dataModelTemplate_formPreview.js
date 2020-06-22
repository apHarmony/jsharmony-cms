var Cloner = require('../utils/cloner');
var FieldModel = require('./fieldModel');

/** @typedef {DataModelTemplate_FormPreview} DataModelTemplate_FormPreview */


/**
 * @class
 * @classdesc Normalizes the model for use in the form preview
 * editor. Creates a model template that can then be used to generate
 * unique instances of the model for editing.
 * @param {import('./componentTemplate').ComponentTemplate} componentTemplate
 * @param {object} dataModel - the raw data model from the component config
 */
function DataModelTemplate_FormPreview(componentTemplate, dataModel) {

  /** @private @type {string} */
  this._componentTemplateId = componentTemplate.getTemplateId();

  /** @private @type {string} */
  this._itemTemplate = '';

  /** @private @type {object} */
  this._modelTemplate = {};

  /** @private @type {string} */
  this._rawOriginalJs = '';


  this.buildTemplate(componentTemplate, dataModel);
}

/**
 * @private
 * @param {import('./componentTemplate').ComponentTemplate} componentTemplate
 * @param {object} dataModel - the raw data model from the component config
 */
DataModelTemplate_FormPreview.prototype.buildTemplate = function(componentTemplate, dataModel) {

  var modelConfig = Cloner.deepClone(dataModel || {});
  if (modelConfig.layout !== 'grid_preview' && modelConfig.layout !== 'form') return undefined;

  this._rawOriginalJs = '\r\n' + (modelConfig.js || '') + '\r\n';

  var fields = modelConfig.fields || [];
  _.forEach(fields, function(field) {
    if (field.type != undefined && field.mediaBrowserControlInfo == undefined) {
      field.onchange = '(function() { var m = jsh.App[modelid]; if (m && m.onChangeData) m.onChangeData();  })()';
    }
  });

  fields.push({
    caption: '', control:'html', value:'<div class="jsharmony_cms_preview_editor" data-id="previewWrapper"></div>', 'block':true
  });

  var model = _.extend({}, modelConfig);
  this._modelTemplate = model;
  model.title = modelConfig.title ? modelConfig.title : 'Edit ' + componentTemplate.getCaptions()[1];
  model.fields = fields;
  model.layout = 'form';
  model.unbound = true;
  model.onecolumn = true;
  model.ejs = '';
  model.js = this._rawOriginalJs;

  var $templates = $('<div>' + modelConfig.ejs + '</div>');
  var itemTemplateSelector = (modelConfig.templates || {}).itemPreview;
  var itemTemplateElement = itemTemplateSelector ? $templates.find(itemTemplateSelector) : undefined;
  if (itemTemplateElement.length !== 1) {
    throw new Error('Item template must contain a single root element. Found ' + itemTemplateElement.length + ' elements');
  }
  this._itemTemplate = itemTemplateElement ? itemTemplateElement.html() : undefined;
}

/**
 * Get the link browser field info (if exists) for the link field with
 * the given field name.
 * @public
 * @param {string} fieldName
 * @returns {(import('./componentTemplate').MediaBrowserControlInfo | undefined)}
 */
DataModelTemplate_FormPreview.prototype.getBrowserFieldInfo = function(fieldName) {
  var field = _.find(this._modelTemplate.fields, function(field) {
    return field.mediaBrowserControlInfo && field.mediaBrowserControlInfo.dataFieldName === fieldName;
  });
  return field ? field.mediaBrowserControlInfo : undefined;
}

/**
 * Get the link browser field infos
 * @public
 * @returns {import('./componentTemplate').MediaBrowserControlInfo[]]}
 */
DataModelTemplate_FormPreview.prototype.getBrowserFieldInfos = function() {
  var retVal = [];
  _.forEach(this._modelTemplate.fields, function(field) {
    if (field.mediaBrowserControlInfo) {
      retVal.push(field.mediaBrowserControlInfo);
    }
  });
  return retVal;
}

/**
 * Get the EJS string used to render the item preview
 * @public
 * @returns {string}
 */
DataModelTemplate_FormPreview.prototype.getItemTemplate = function() {
  return this._itemTemplate || '';
}

/**
 * @public
 */
DataModelTemplate_FormPreview.prototype.getModelInstance = function() {
  var model = Cloner.deepClone(this._modelTemplate);
  model.id = DataModelTemplate_FormPreview.getNextInstanceId(this._componentTemplateId);

  return model;
}

/**
 * Return the raw model JavaScript.
 * @public
 * @returns {Object}
 */
DataModelTemplate_FormPreview.prototype.getModelJs = function() {
  return this._rawOriginalJs;
}

/**
 * Get a unique ID for the model instance
 * @private
 * @returns {string}
 */
DataModelTemplate_FormPreview.getNextInstanceId = function(componentType ) {
  if (DataModelTemplate_FormPreview._id == undefined) DataModelTemplate_FormPreview._id = 0;
  var id = DataModelTemplate_FormPreview._id++;
  return 'DataModel_FormPreview' + componentType + '_' + id;
}

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
DataModelTemplate_FormPreview.prototype.makePristineCopy = function(dataInstance) {
  return FieldModel.makePristineCopy(dataInstance, this._modelTemplate.fields);
}

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
DataModelTemplate_FormPreview.prototype.populateDataInstance = function(dataInstance) {
  return FieldModel.populateDataInstance(dataInstance, this._modelTemplate.fields || []);
}

exports = module.exports = DataModelTemplate_FormPreview;
