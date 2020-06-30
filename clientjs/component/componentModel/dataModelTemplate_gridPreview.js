var Cloner = require('../utils/cloner');
var FieldModel = require('./fieldModel');


/** @typedef {DataModelTemplate_GridPreview} DataModelTemplate_GridPreview */

/**
 * @class
 * @classdesc Normalizes the model for use in the grid preview
 * editor. Creates a model template that can then be used to generate
 * unique instances of the model for editing.
 * @param {import('./componentTemplate').ComponentTemplate} componentTemplate
 * @param {object} dataModel - the raw data model from the component config
 */
function DataModelTemplate_GridPreview(componentTemplate, dataModel) {

  /** @private @type {string} */
  this._componentTemplateId = componentTemplate.getTemplateId();

  /** @private @type {string} */
  this._idFieldName = '';

  /** @private @type {object} */
  this._modelTemplate = {};

  /** @private @type {string} */
  this._rawOriginalJs = '';

  /** @private @type {string} */
  this._rowTemplate = '';

  /** @private @type {string} */
  this._sequenceFieldName = '';

  this.buildTemplate(componentTemplate, dataModel);
}

/**
 * @private
 * @param {import('./componentTemplate').ComponentTemplate} componentTemplate
 * @param {object} dataModel - the raw data model from the component config
 */
DataModelTemplate_GridPreview.prototype.buildTemplate = function(componentTemplate, dataModel) {

  var modelConfig = Cloner.deepClone(dataModel || {});
  if (modelConfig.layout !== 'grid_preview') return undefined;

  this._rawOriginalJs = '\r\n' + (modelConfig.js || '') + '\r\n';

  var popup = _.isArray(modelConfig.popup) ? modelConfig.popup : [];

  var fields = modelConfig.fields || [];
  this._idFieldName = this.ensureIdField(fields);
  this._sequenceFieldName = this.ensureSequenceField(fields);

  _.forEach(fields, function(field) {
    field.control = 'hidden';
  });

  fields.push({
    name: 'cust_field', control: 'label', caption: '', unbound: true, controlstyle: 'vertical-align:baseline;',
    value: '<div tabindex="0" data-component-template="gridRow"></div>',
    ongetvalue: 'return;'
  });


  var model = {};
  this._modelTemplate = model;
  model.title = 'Edit ' + componentTemplate.getCaptions()[0];
  model.popup = [ _.isNumber(popup[0]) ? popup[0] : 400, _.isNumber(popup[1]) ? popup[1] : 200 ];
  model.fields = fields;
  model.layout = 'grid';
  model.unbound = true;
  model.newrowposition = 'last';
  model.commitlevel= 'page';
  model.hide_system_buttons = ['export', 'search', 'save'];
  model.sort = [];
  model.buttons = [
    {link: 'js:_this.close()', icon: 'ok', actions: 'IU', text: 'Done' }
  ];
  model.getapi =   'return _this.getDataApi(xmodel, apitype)';
  model.onrowbind =   '_this.onRowBind(xmodel,jobj,datarow);';
  model.oncommit =  '_this.onCommit(xmodel, rowid, callback);';
  model.ejs =  '';
  model.sort = { [this._sequenceFieldName]: 'asc' };

  //--------------------------------------------------
  // Get templates
  //--------------------------------------------------
  var $templates = $('<div>' + (modelConfig.ejs || '') + '</div>');
  var rowTemplateSelector = (modelConfig.templates || {}).gridRowPreview;
  var rowTemplateElement = rowTemplateSelector ? $templates.find(rowTemplateSelector) : undefined;
  if (rowTemplateElement.length !== 1) {
    throw new Error('Row template must contain a single root element. Found ' + rowTemplateElement.length + ' elements');
  }

  this._rowTemplate = rowTemplateElement ? rowTemplateElement.html() : undefined;

  return  model;
}

/**
 * Ensure that an ID field exists.
 * If no ID field exists then one will be added.
 * An error will be thrown if more than one ID field exists.
 * @private
 * @param {Object[]} fields
 * @returns {string} the name of the ID field
 */
DataModelTemplate_GridPreview.prototype.ensureIdField = function(fields) {
  var idFields = _.filter(fields, function(field) { return field.key; });
  if (idFields.length > 1) throw new Error('Expected a single ID field. Found ' + idFields.length);
  if (idFields.length < 1) {
    var idField = { name: '_jsh_auto_id', type: 'varchar', control: 'hidden', key: true, caption: '', isAutoAddedField: true };
    idFields = [idField];
    fields.push(idField);
  }

  return idFields[0].name;
}

/**
 * Ensure that a sequence field exists.
 * If no sequence field exists then one will be added.
 * @private
 * @param {Object[]} fields
 * @returns {string} the name of the sequence field
 */
DataModelTemplate_GridPreview.prototype.ensureSequenceField = function(fields) {

  var seqFieldName = 'sequence'; //This is by convention!!!
  var hasSeqField = _.some(fields, function(field) { return field.name === seqFieldName; })
  if (!hasSeqField) {
    var idField = { name: seqFieldName, type: 'int', control: 'hidden', caption: '', isAutoAddedField: true };
    fields.push(idField);
  }

  return seqFieldName
}

/**
 * Get the name of the field used for the data item ID.
 * @public
 * @returns {string}
 */
DataModelTemplate_GridPreview.prototype.getIdFieldName = function() {
  return this._idFieldName;
}

/**
 * @public
 */
DataModelTemplate_GridPreview.prototype.getModelInstance = function() {
  var model = Cloner.deepClone(this._modelTemplate);
  model.id = DataModelTemplate_GridPreview.getNextInstanceId(this._componentTemplateId);

  model.js =  function() {
    var gridApi = new jsh.XAPI.Grid.Static(modelid);
    var formApi = new jsh.XAPI.Form.Static(modelid);
    return  {
      getDataApi: function(xmodel, apiType) {
        if (apiType === 'grid') return gridApi;
        else if (apiType === 'form') return formApi;
      }
    }
  }

  return model;
}

/**
 * Return the raw model JavaScript.
 * @public
 * @returns {Object}
 */
DataModelTemplate_GridPreview.prototype.getModelJs = function() {
  return this._rawOriginalJs;
}

/**
 * Get a unique ID for the model instance
 * @private
 * @returns {string}
 */
DataModelTemplate_GridPreview.getNextInstanceId = function(componentType ) {
  if (DataModelTemplate_GridPreview._id == undefined) DataModelTemplate_GridPreview._id = 0;
  var id = DataModelTemplate_GridPreview._id++;
  return 'DataModel_GridPreview_' + componentType + '_' + id;
}

/**
 * Get the EJS string used to render the row item preview
 * @public
 * @returns {string}
 */
DataModelTemplate_GridPreview.prototype.getRowTemplate = function() {
  return this._rowTemplate || '';
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
 * @param {Object} isAutoAddedField - if true then the added fields (e.g., ID, sequence) will be removed.
  * @returns {Object} a copy of the dataInstance with type conversions done and extraneous
 * properties removed.
 */
DataModelTemplate_GridPreview.prototype.makePristineCopy = function(dataInstance, removeAutoAddedFields) {
  var fields = removeAutoAddedFields ?  _.filter(this._modelTemplate.fields, function(field) { return !field.isAutoAddedField; }) : this._modelTemplate.fields;
  return FieldModel.makePristineCopy(dataInstance, fields);
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
DataModelTemplate_GridPreview.prototype.populateDataInstance = function(dataInstance) {
  return FieldModel.populateDataInstance(dataInstance, this._modelTemplate.fields || []);
}


exports = module.exports = DataModelTemplate_GridPreview;