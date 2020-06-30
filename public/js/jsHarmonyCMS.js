(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var DataModelTemplate_GridPreview = require('./dataModelTemplate_gridPreview');
var DataModelTemplate_FormPreview = require('./dataModelTemplate_formPreview');
var PropertiesModelTemplate_Form = require('./propertiesModelTemplate_form');

/**
  * @typedef {Object} MediaBrowserControlInfo
  * @property {string} dataFieldName
  * @property {string} titleFieldName
  * @property {('link' | 'media')} browserType
  */

/** @typedef {ComponentTemplate} ComponentTemplate */

/**
 * @class
 * @param {Object} componentConfig - the component configuration as defined by the component JSON.
 * @param {Object} jsh
 */
function ComponentTemplate(componentConfig, jsh) {

  /** @private @type {Object} */
  this._componentConfig = componentConfig;

  /** @private @type {Object} */
  this._jsh = jsh;

  /** @private @type {DataModelTemplate_GridPreview} */
  this._dataModelTemplate_GridPreview = undefined;

  /** @private @type {DataModelTemplate_FormPreview} */
  this._dataModelTemplate_FormPreview = undefined;

  /** @private @type {PropertiesModelTemplate_Form} */
  this._propertiesModelTemplate_Form = undefined;



  if (this._componentConfig.data) {
    this._componentConfig.data.fields = this.processBrowserFields(this._componentConfig.data.fields || []);
    this._dataModelTemplate_GridPreview = new DataModelTemplate_GridPreview(this, this._componentConfig.data);
    this._dataModelTemplate_FormPreview = new DataModelTemplate_FormPreview(this, this._componentConfig.data);
  }
  if (this._componentConfig.properties) {
    this._componentConfig.data.fields = this.processBrowserFields(this._componentConfig.data.fields || []);
    this._propertiesModelTemplate_Form = new PropertiesModelTemplate_Form(this, this._componentConfig.properties);
  }
}

/**
 * Get the component captions tuple as defined by the component JSON.
 * The first element is the title, the second element is the singular caption
 * (if exists), and the third element is the plural caption (if exists).
 * @public
 * @returns {[string, string, string]}
 */
ComponentTemplate.prototype.getCaptions = function() {
  var captions = [this._componentConfig.title];
  if (_.isArray(this._componentConfig.caption)) {
    captions.push(this._componentConfig.caption[0]);
    captions.push(this._componentConfig.caption[1]);
  } else {
    captions.push(this._componentConfig.caption);
    captions.push(this._componentConfig.caption);
  }
  return captions
}

/**
 * Get the component configuration as defined by the component JSON.
 * @public
 * @returns {Object}
 */
ComponentTemplate.prototype.getComponentConfig = function() {
  return this._componentConfig;
}

/**
 * Return the editor type
 * @public
 * @returns {('grid' | 'grid_preview' | 'form' | undefined)}
 */
ComponentTemplate.prototype.getDataEditorType = function() {
  if (this._componentConfig.data) {
    return this._componentConfig.data.layout;
  }
  return undefined;
}

/**
 * @public
 * @returns {(DataModelTemplate_FormPreview | undefined)}
 */
ComponentTemplate.prototype.getDataModelTemplate_FormPreview = function() {
  return this._dataModelTemplate_FormPreview;
}

/**
 * @public
 * @returns {(DataModelTemplate_GridPreview | undefined)}
 */
ComponentTemplate.prototype.getDataModelTemplate_GridPreview = function() {
  return this._dataModelTemplate_GridPreview;
}

/**
 * @public
 * @returns {(PropertiesModelTemplate_Form | undefined)}
 */
ComponentTemplate.prototype.getPropertiesModelTemplate_Form = function() {
  return this._propertiesModelTemplate_Form;
}

/**
 * Get the ID specified for the component configuration.
 * This is NOT an instance id.
 * @public
 * @returns {(string | undefined)}
 */
ComponentTemplate.prototype.getTemplateId = function() {
  return this._componentConfig.id;
}

/**
 * @private
 * @param {object[]} fields
 * @returns {object[]}
 */
ComponentTemplate.prototype.processBrowserFields = function(fields) {

  var retVal = [];

  _.forEach(fields, function(field) {
    retVal.push(field);
    if (field.control !== 'link_browser' &&  field.control !== 'media_browser') {
      return;
    }

    var browserType = { link_browser: 'link',   media_browser: 'media' }[field.control];

    /** @type {MediaBrowserControlInfo} */
    var info = {
      dataFieldName: field.name,
      titleFieldName: field.name + '_jsh_browserDataTitle',
      browserType: browserType
    }

    field.mediaBrowserControlInfo = info;
    field.name = info.titleFieldName;
    field.control = 'textbox';
    field.type = 'varchar';
    field.onchange = '(function() { var m = jsh.App[modelid]; if (m && m.onChangeBrowserTitleControl) m.onChangeBrowserTitleControl("' + info.dataFieldName + '");  })()';

    retVal.push({
      name: field.name + '_browserButton',
      caption: '',
      control: 'button',
      value: 'Browse',
      nl: false,
      onclick: '(function() { var m = jsh.App[modelid]; if (m && m.openEditorBrowser) m.openEditorBrowser("' + info.dataFieldName + '"); })()'
    });

    retVal.push({
      name: field.name + '_resetButton',
      controlclass: 'secondary',
      controlstyle: 'margin-left:10px;',
      caption: '',
      control: 'button',
      value: 'Reset',
      nl: false,
      onclick: '(function() { var m = jsh.App[modelid]; if (m && m.resetEditorBrowser) m.resetEditorBrowser("' + info.dataFieldName + '"); })()'
    });

    retVal.push({
      name: info.dataFieldName,
      caption: '',
      control: 'hidden',
      type: 'varchar'
    });
  });

  return retVal;
}


exports = module.exports = ComponentTemplate;

},{"./dataModelTemplate_formPreview":2,"./dataModelTemplate_gridPreview":3,"./propertiesModelTemplate_form":5}],2:[function(require,module,exports){
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
  return 'DataModel_FormPreview_' + componentType + '_' + id;
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

},{"../utils/cloner":19,"./fieldModel":4}],3:[function(require,module,exports){
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
},{"../utils/cloner":19,"./fieldModel":4}],4:[function(require,module,exports){
var Cloner = require('../utils/cloner');
var Convert = require('../utils/convert');

/**
 * @typedef {FieldModel} FieldModel
 */

/**
 * @class
 * @classdesc This class adds functionality for working with field models
 * defined in the JSH component JSON.
 */
function FieldModel() {

}

/**
 * JSH changes the types defined in the model.
 * This will convert the fields in dataInstance to the correct type
 * based on the fieldModel.
 * @public
 * @static
 * @param {Object} dataInstance - the data to operate on (will be mutated).
 * @param {Object[]} fields - the fields array from the model
 */
FieldModel.convertTypes = function(dataInstance, fields) {

  if (dataInstance == undefined) return;

  var numberTypeLut = {
    bigint: true,
    int: true,
    smallint: true,
    tinyint: true,
    decimal: true,
    float: true
  }

  dataInstance = dataInstance || {};
  _.forEach(fields || [], function(field) {
    var fieldName = field.name;
    var fieldType = field.type;
    if (fieldType == undefined) return;
    if (!(fieldName in dataInstance)) return;

    if (numberTypeLut[fieldType]) {
      dataInstance[fieldName] = Convert.toNumber(dataInstance[fieldName]);
    }
  });
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
 * @static
 * @param {Object} dataInstance - the existing field values.
 * @param {Object[]} fields - the fields array from the model
 * @returns {Object} a copy of the dataInstance with type conversions done and extraneous
 * properties removed.
 */
FieldModel.makePristineCopy = function(dataInstance, fields) {

  var pristineCopy = {};
  _.forEach(fields, function(field) {
    var fieldName = field.name;
    var fieldType = field.type;
    if (fieldType == undefined) return;

    pristineCopy[fieldName] = dataInstance[fieldName];
  });

  FieldModel.convertTypes(pristineCopy);
  return pristineCopy;
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
 * @static
 * @param {Object} dataInstance - the data instance. Each property corresponds
 * to a field in the fieldModels array. This object will not be mutated.
 * @param {Object[]} fields - the fields array from the model
 * @returns {Object} the new or mutated data
 */
FieldModel.populateDataInstance = function(dataInstance, fields) {

  dataInstance = dataInstance || {};
  _.forEach(fields || [], function(field) {
    var fieldName = field.name;
    var fieldType = field.type;
    if (fieldType == undefined) return;

    // Must follow the rules to ensure
    // required fields are set to default values while also
    // allowing default fields to be cleared by the user if they are
    // not required fields.
    if (dataInstance[fieldName] != undefined) {
      return;
    }
    var isRequired = _.some((field.validate || []), function(a) { return a === 'Required'; });
    var defaultValue= field.default;
    const propertyKeyExists = fieldName in dataInstance;

    if (propertyKeyExists && isRequired) {
      // The property has been set by the user
      // (since the key exists) but it is undefined/null
      // while being required. This means the undefined value needs
      // to be overridden with the default.
      dataInstance[fieldName] = defaultValue;
    } else if (!propertyKeyExists) {
      // The property has not been set by the user
      // (since the key does not exist) so must
      // default to the default value (even if undefined/null)
      dataInstance[fieldName] = defaultValue;
    }
  });
  FieldModel.convertTypes(dataInstance);
  // Must return in case original instance was null/undefined
  return dataInstance;
}

exports = module.exports = FieldModel;

},{"../utils/cloner":19,"../utils/convert":20}],5:[function(require,module,exports){
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
  this._modelTemplate = model;
  model.title = modelConfig.title ? modelConfig.title : 'Configure ' + componentTemplate.getCaptions()[0];
  model.unbound = true;
  model.layout = 'form';
  model.onecolumn = true;
}

/**
 * @public
 */
PropertiesModelTemplate_Form.prototype.getModelInstance = function() {
  var model = Cloner.deepClone(this._modelTemplate);
  model.id = PropertiesModelTemplate_Form.getNextInstanceId(this._componentTemplateId);

  return model;
}

/**
 * Get a unique ID for the model instance
 * @private
 * @returns {string}
 */
PropertiesModelTemplate_Form.getNextInstanceId = function(componentType ) {
  if (PropertiesModelTemplate_Form._id == undefined) PropertiesModelTemplate_Form._id = 0;
  var id = PropertiesModelTemplate_Form._id++;
  return 'PropertiesModel_Form_' + componentType + '_' + id;
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
PropertiesModelTemplate_Form.prototype.makePristineCopy = function(dataInstance) {
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
PropertiesModelTemplate_Form.prototype.populateDataInstance = function(dataInstance) {
  return FieldModel.populateDataInstance(dataInstance, this._modelTemplate.fields || []);
}

exports = module.exports = PropertiesModelTemplate_Form;

},{"../utils/cloner":19,"./fieldModel":4}],6:[function(require,module,exports){
var DialogResizer = require('./dialogResizer');
var OverlayService = require('./overlayService');

/**
 * @typedef {Object} DialogConfig
 * @property {(boolean | undefined)} closeOnBackdropClick - Set true to close the dialog
 * when the background is clicked
 * @property {(string | undefined)} dialogId - set this to override the assigned unique ID for the dialog.
 * There is no need to set this. If it is set, it must be globally unique among ALL dialogs.
 * @property {(number | undefined)} maxHeight - set the max height (pixels) of the form if defined
 * @property {(number | undefined)} maxWidth - set the max width (pixels) of the form if defined
 * @property {(number | undefined)} minHeight - set the min height (pixels) of the form if defined
 * @property {(number | undefined)} minWidth - set the min width (pixels) of the form if defined
 * @property {(number | undefined)} width - set the width (pixels) of the form if defined
 * @property {(number | undefined)} height - set the height (pixels) of the form if defined
 * @property {(string | undefined)} cssClass - space delimited list of classes to add to the dialog element
 */



  /**
  * Called when the dialog wants to accept/save the changes
  * @callback Dialog~acceptCallback
  * @param {Function} successFunc - Call this function if successfully accepted (e.g., no data errors; valid save).
  */

/**
 *  Called when the dialog is first opened
 * @callback Dialog~beforeOpenCallback
 * @param {Object} xModel - the JSH model instance
 * @param {Function} onComplete - Should be called by handler when complete
 */

/**
 * Called when the dialog wants to cancel/close without saving
 * @callback Dialog~cancelCallback
 * @param {Object} options
 * @returns {boolean}
 */

/**
 * Called when the dialog closes
 * @callback Dialog~closeCallback
 * @param {Object} options
 */

/**
 *  Called when the dialog is first opened
 * @callback Dialog~openedCallback
 * @param {JQuery} dialogWrapper - the dialog wrapper element
 * @param {Object} xModel - the JSH model instance
 * @param {Function} acceptFunc - Call this function to trigger accept logic
 * @param {Function} cancelFunc - Call this function to trigger cancel logic
 */

 /**
  * @class
  * @param {Object} jsh
  * @param {Object} model - the model that will be loaded into the virtual model
  * @param {DialogConfig} config - the dialog configuration
  */
function Dialog(jsh, model, config) {
  this._jsh = jsh;
  this._model = model;
  this._id = config.dialogId ? config.dialogId : this.getNextId();
  /** @type {DialogConfig} */
  this._config = config || {};
  this._$wrapper = this.makeDialog(this._id, this._config);
  this._destroyed = false;

  $('body').append(this._$wrapper)

  /**
   * @public
   * @type {Dialog~acceptCallback}
   */
  this.onAccept = undefined;

  /**
   * @public
   * @type {Dialog~beforeOpenCallback}
   */
  this.onBeforeOpen = undefined;

  /**
   * @public
   * @type {Dialog~cancelCallback}
   */
  this.onCancel = undefined;

  /**
   * @public
   * @type {Dialog~closeCallback}
   */
  this.onClose = undefined;

  /**
   * @public
   * @type {Dialog~openedCallback}
   */
  this.onOpened = undefined;
}

/**
 * Used to keep track of dialog IDs to
 * ensure IDs are unique.
 * @type {Object.<string, boolean>}
 */
Dialog._idLookup = {};

/**
 * Call when dialog is closed.
 * Dialog is no longer usable after this is called.
 * @private
 */
Dialog.prototype.destroy = function() {
  this._$wrapper.remove();
  if (this._$overlay) this._$overlay.remove();
  delete Dialog._idLookup[this._id];
  this._destroyed = true;
}

/**
 * Get a CSS selector that can be used to find
 * the wrapper element.
 * @public
 * @returns {string}
 */
Dialog.prototype.getFormSelector = function() {
  return  '.xdialogbox.' + this._id;
}

/**
 * Get a globally unique (W.R.T this dialog class)
 * ID to be used for the current dialog instance
 * @private
 * @returns {string}
 */
Dialog.prototype.getNextId = function() {
  var id = undefined;
  do {
    id = 'jsharmony_component_dialog_uid_' + Math.random().toString().replace('.', '');
    if (Dialog._idLookup[id]) {
      id = undefined;
    }
  } while (!id);
  Dialog._idLookup[id] = true;
  return id;
}

/**
 * Get the scroll top position for the page.
 * @private
 * @param {JQuery} $wrapper
 * @returns {number}
 */
Dialog.prototype.getScrollTop = function($wrapper) {
  return $wrapper.scrollParent().scrollTop();
}

/**
 * @private
 */
Dialog.prototype.load = function(callback) {
  var self = this;
  this._jsh.XPage.LoadVirtualModel($(self.getFormSelector()), this._model, function(xModel) {
    callback(xModel);
  });
}

/**
 * Create the dialog elements and append to the body DOM.
 * @private
 * @param {string} id - the ID that uniquely identifies the dialog
 * @param {DialogConfig} config
 */
Dialog.prototype.makeDialog = function(id, config) {

  var $form = $('<div class="xdialogbox"></div>')
    .addClass(this._id)
    .attr('id', this._id)
    .css('max-width', _.isNumber(config.maxWidth) ? config.maxWidth + 'px' : null)
    .css('max-height',  _.isNumber(config.maxHeight) ? config.maxHeight + 'px' : null)
    .css('min-width', _.isNumber(config.minWidth) ? config.minWidth + 'px' : null)
    .css('min-height',  _.isNumber(config.minHeight) ? config.minHeight + 'px' : null)
    .css('height',  _.isNumber(config.height) ? config.height + 'px' : null)
    .css('width',  _.isNumber(config.width) ? config.width + 'px' : null)
    .addClass(config.cssClass || '');

  var $wrapper = $('<div style="display: none;" class="xdialogbox-wrapper"></div>')
    .attr('id', id)
    .append($form);

  return $wrapper;
}

/**
 * @public
 */
Dialog.prototype.open = function() {

  if (this._destroyed) {
    throw new Error('Dialog ' + this._id + ' has already been destroyed.');
  }

  var self = this;
  var formSelector = this.getFormSelector();
  var oldActive = document.activeElement;
  this.load(function(xModel) {


    var $wrapper = $(formSelector);
    self.registerLovs(xModel);
    var lastScrollTop = 0
    self._jsh.XExt.execif(self.onBeforeOpen,
      function(f){
        self.onBeforeOpen(xModel, f);
      },
      function(){
        /** @type {DialogResizer} */
        var dialogResizer = undefined;

        self._jsh.XExt.CustomPrompt(formSelector, $(formSelector),
          function(acceptFunc, cancelFunc) {
            OverlayService.pushDialog($wrapper);
            lastScrollTop = self.getScrollTop($wrapper);
            dialogResizer = new DialogResizer($wrapper[0], self._jsh);
            if (_.isFunction(self.onOpened)) self.onOpened($wrapper, xModel, acceptFunc, cancelFunc);
          },
          function(success) {
            lastScrollTop = self.getScrollTop($wrapper);

            if (_.isFunction(self.onAccept)) self.onAccept(success);
          },
          function(options) {
            lastScrollTop = self.getScrollTop($wrapper);
            if (_.isFunction(self.onCancel)) return self.onCancel(options);
            return false;
          },
          function() {
            if (oldActive) oldActive.focus();
            self.setScrollTop(lastScrollTop, $wrapper);
            dialogResizer.closeDialog();
            if(_.isFunction(self.onClose)) self.onClose();
            self.destroy();
            OverlayService.popDialog();
          },
          { reuse: false, backgroundClose: self._config.closeOnBackdropClick, restoreFocus: false }
        );
      }
    );
  });
}

/**
 * Register the LOVs defined in the model.
 * @private
 * @param {Object} xModel
 */
Dialog.prototype.registerLovs = function(xModel) {
  _.forEach(this._model.fields, function(field) {
    if (field.type == undefined || field.lov == undefined) return;

    var lovs = undefined;

    if (_.isArray(field.lov.values)) {
      lovs = field.lov.values;
    } else if (_.isObject(field.lov.values)) {
      lovs = _.map(_.pairs(field.lov.values), function(kvp) {
        return { code_val: kvp[0], code_txt: kvp[1] };
      });
    }
    if (lovs) {
      xModel.controller.setLOV(field.name, lovs);
    }
  });
}

/**
 * Set the scroll top position for the page.
 * @private
 * @param {JQuery} $wrapper
 * @returns {number} position
 */
Dialog.prototype.setScrollTop = function(position, $wrapper) {
  $wrapper.scrollParent().scrollTop(position);
}

exports = module.exports = Dialog;

},{"./dialogResizer":7,"./overlayService":10}],7:[function(require,module,exports){
/**
 * @class
 * @classdesc Use to resize dialogs when content changes. Otherwise
 * dialogs will not be rendered with correct locations or sizes
 * (especially when content changes dynamically after opening).
 * @param {HTMLElement} wrapper
 * @param {Object} jsh
 */
function DialogResizer(wrapper, jsh) {

  /** @private @type {Object} */
  this._jsh = jsh;

  /** @private @type {Function} */
  this._execCleanUp = function() {};


  if (typeof ResizeObserver !== 'undefined') {
    // Using ResizeObserver is the absolute best way to do this.
    // But it is not available in IE.
    this.startResizeObserver(wrapper);
    // This works pretty well for IE 11.
  } else if (typeof MutationObserver !== 'undefined') {
    this.startMutationObserver(wrapper);
  } else {
    // Fallback of ResizeObserver and MutationObserver are not supported.
    // (Ideally, ResizeObserver would be pollyfilled by the build system or even manually)
    this.startIntervalResize(wrapper);
  }
}

/**
 * @private
 * @static
 * @param {Function} cb - called for each interval
 * @returns {Function} The return value is a function that must be called for cleanup.
 */
DialogResizer.addIntervalCallback = function(cb) {

  this._intervalCbId  = this._intervalCbId || 0;
  this._intervalCallbacks = this._intervalCallbacks || [];

  this._intervalCbId++;
  var id = this._intervalCbId;
  this._intervalCallbacks.push({ id: id, cb: cb });

  if (this._intervalCallbacks.length === 1) {
    if (this._intervalId != undefined) {
      clearInterval(this._intervalId);
    }
    this._intervalId = setInterval(function() {
      _.forEach(DialogResizer._intervalCallbacks, function(item) { item.cb(); });
    }, 100);
  };

  return function() {
    var index = DialogResizer._intervalCallbacks.findIndex(function(item) { return item.id === id; });
    if (index > -1) {
      DialogResizer._intervalCallbacks.splice(index, 1);
    }
    if (DialogResizer._intervalCallbacks.length < 1 && DialogResizer._intervalId != undefined) {
      clearInterval(DialogResizer._intervalId);
      DialogResizer._intervalId = undefined;
    }
  }
}

/**
 * This must be called when the dialog is closed
 * to ensure proper cleanup is executed
 * @public
 */
DialogResizer.prototype.closeDialog = function() {
  if (this._execCleanUp) {
    this._execCleanUp();
  }
}

/**
 * Perform the resize on the given element.
 * @private
 * @param {HTMLElement} wrapper
 */
DialogResizer.prototype.resize = function(wrapper) {
  this._jsh.XWindowResize();
}

/**
 * Use a interval resize strategy to resize the dialog.
 * This should be used as a last resort if ResizeObserver
 * or MutationObserver is not supported.
 * @private
 * @param {HTMLElement} wrapper
 */
DialogResizer.prototype.startIntervalResize = function(wrapper) {
  var self = this;
  this._execCleanUp = DialogResizer.addIntervalCallback(function() {
    self.resize(wrapper);
  });
}

/**
 * Use a MutationObserver resize strategy to resize the dialog.
 * This should be used only if ResizeObserver
 * not supported.
 * @private
 * @param {HTMLElement} wrapper
 */
DialogResizer.prototype.startMutationObserver = function(wrapper) {
  var self = this;
  var observer = new MutationObserver(function() {
    self.resize(wrapper);
  });
  observer.observe(wrapper, { childList: true, subtree: true });
  this._execCleanUp = function() {
    observer.disconnect();
  }
}

/**
 * Use a ResizeObserver resize strategy to resize the dialog.
 * This is the 100%, absolute best way to handle resize.
 * @private
 * @param {HTMLElement} wrapper
 */
DialogResizer.prototype.startResizeObserver = function(wrapper) {
  var self = this;
  var observer = new ResizeObserver(function() {
      self.resize(wrapper);
  });
  observer.observe(wrapper);
  this._execCleanUp = function() {
    observer.unobserve(wrapper);
  }
}

exports = module.exports = DialogResizer;
},{}],8:[function(require,module,exports){
var Dialog = require('./dialog');

/**
 * @typedef {Object} FormDialogConfig
 * @property {(boolean | undefined)} closeOnBackdropClick - Set true to close the dialog
 * when the background is clicked
 * @property {(string | undefined)} dialogId - set this to override the assigned unique ID for the dialog.
 * There is no need to set this. If it is set, it must be globally unique among ALL dialogs.
 * @property {(number | undefined)} maxHeight - set the max height (pixels) of the form if defined
 * @property {(number | undefined)} maxWidth - set the max width (pixels) of the form if defined
 * @property {(number | undefined)} width - set the width (pixels) of the form if defined
 * @property {(number | undefined)} height - set the height (pixels) of the form if defined
 * @property {(string | undefined)} cssClass - space delimited list of classes to add to the dialog element
 * @property {(string | undefined)} acceptButtonLabel - if set, this will add an accept button to the form
 * and will trigger the accept/save functionality on click.
 * @property {(string | undefined)} cancelButtonLabel - if set, this will add a cancel/close button to the form
 * and will trigger the cancel/close functionality on click.
 */

/**
 * Called when the dialog wants to accept/save the changes
 * @callback FormDialogConfig~acceptCallback
 * @param {JQuery} dialogWrapper - the dialog wrapper element
 * @param {Object} xModel - the JSH model instance
 * @returns {boolean} return true if accept/save was successful. A true return value will trigger modal close.
 */

/**
 *  Called when the dialog is first opened
 * @callback FormDialogConfig~beforeOpenCallback
 * @param {Object} xModel - the JSH model instance
 * @param {string} dialogSelector - the CSS selector that can be used to select the dialog component once opened.
 * @param {Function} onComplete - Should be called by handler when complete
 */

/**
 * Called when the dialog wants to cancel/close without saving
 * @callback FormDialogConfig~cancelCallback
 * @param {Object} options
 * @param {JQuery} dialogWrapper - the dialog wrapper element
 * @param {Object} xModel - the JSH model instance
 * @returns {boolean}
 */

/**
 * Called when the dialog closes
 * @callback FormDialogConfig~closeCallback
 * @param {JQuery} dialogWrapper - the dialog wrapper element
 * @param {Object} xModel - the JSH model instance
 */

/**
 * Called when the dialog is first opened
 * @callback FormDialogConfig~openedCallback
 * @param {JQuery} dialogWrapper - the dialog wrapper element
 * @param {Object} xModel - the JSH model instance
 */

/**
 * @class
 * @param {Object} jsh
 * @param {Object} model
 * @param {FormDialogConfig} config
 */
function FormDialog(jsh, model, config) {

  this.jsh = jsh;
  this._model = this.augmentModel(model, config);
  this._config = config;

  /**
   * @public
   * @type {FormDialog~acceptCallback}
   */
  this.onAccept = undefined;

  /**
   * @public
   * @type {FormDialogConfig~beforeOpenCallback}
   */
  this.onBeforeOpen = undefined;

  /**
   * @public
   * @type {FormDialog~cancelCallback}
   */
  this.onCancel = undefined;

  /**
   * @public
   * @type {FormDialog~closeCallback}
   */
  this.onClose = undefined;

  /**
   * @public
   * @type {FormDialog~openedCallback}
   */
  this.onOpened = undefined;
}

/**
 * Return a new model that has the save and cancel buttons added
 * to the field list. This does not mutate the given model.
 * @private
 * @param {Object} model
 * @param {FormDialogConfig} config
 * @returns {Object} A new model reference (original model is not mutated)
 */
FormDialog.prototype.augmentModel = function(model, config) {
  // Do not mutate the model!
  model = _.extend({}, model);
  var newFields = [];
  // Add cancel button first to maintain consistent
  // styles with TinyMce
  if (config.acceptButtonLabel) {
    newFields.push({
      name: 'save_button',
      control: 'button',
      value: config.acceptButtonLabel,
      controlstyle: 'margin-right:10px; margin-top:15px;',
    });
  }
  if (config.cancelButtonLabel) {
    newFields.push({
      name: 'cancel_button',
      control: 'button',
      value: config.cancelButtonLabel,
      controlclass: 'secondary',
      nl:false,
    });
  }
  // Don't mutate the model!
  model.fields = newFields.length > 0 ? (model.fields || []).concat(newFields) : model.fields;
  return model;
}

/**
 * Open the form  dialog
 * @public
 * @param {Object} data - the data to display in the dialog. This object will be mutated
 * as values are changed.
 */
FormDialog.prototype.open = function(data) {
  var self = this;

  /** @type {FormDialogConfig} */
  var config = this._config;

  var dialog = new Dialog(this.jsh, this._model, {
    closeOnBackdropClick: config.closeOnBackdropClick,
    cssClass: config.cssClass,
    dialogId: config.dialogId,
    height: config.height,
    maxHeight: config.maxHeight,
    maxWidth: config.maxWidth,
    minHeight: config.minHeight,
    minWidth: config.minWidth,
    width: config.width
  });

  var controller = undefined;
  var xModel = undefined;
  var $dialog = undefined;

  dialog.onBeforeOpen = function(_xModel, onComplete) {
    xModel = _xModel;
    controller = _xModel.controller;
    self.jsh.XExt.execif(self.onBeforeOpen,
      function(f){
        self.onBeforeOpen(xModel, dialog.getFormSelector(), f);
      },
      function(){
        controller.Render(data, undefined, onComplete);
      }
    );
  }


  dialog.onOpened = function(_$dialog, _xModel, acceptFunc, cancelFunc) {
    $dialog = _$dialog;
    controller.form.Prop.Enabled = true;
    $dialog.find('.save_button.xelem' + xModel.id).off('click').on('click', acceptFunc);
    $dialog.find('.cancel_button.xelem' + xModel.id).off('click').on('click', cancelFunc);
    if (_.isFunction(self.onOpened)) self.onOpened($dialog, xModel);
  }

  // This callback is called when trying to set/save the data.
  dialog.onAccept = function(success) {
    var isSuccess = _.isFunction(self.onAccept) && self.onAccept($dialog, xModel);
    if (isSuccess) success();
  }

  dialog.onCancel = function(options) {
    if (!options.force && xModel.controller.HasUpdates()) {
      self.jsh.XExt.Confirm('Close without saving changes?', function() {
        xModel.controller.form.ResetDataset();
        options.forceCancel();
      });
      return false;
    }
  }

  // This is the final callback to be called and is
  // called anytime (whether accepted or canceled) the
  // dialog closes.
  dialog.onClose = function() {
    controller.form.Prop.Enabled = false
    if (_.isFunction(self.onClose)) self.onClose($dialog, xModel);
  }

  dialog.open();
}


exports = module.exports = FormDialog;
},{"./dialog":6}],9:[function(require,module,exports){
var Dialog = require('./dialog');

/**
 * @typedef {Object} GridDialogConfig
 * @property {(boolean | undefined)} closeOnBackdropClick - Set true to close the dialog
 * when the background is clicked
 * @property {(string | undefined)} dialogId - set this to override the assigned unique ID for the dialog.
 * There is no need to set this. If it is set, it must be globally unique among ALL dialogs.
 * @property {(number | undefined)} maxHeight - set the max height (pixels) of the form if defined
 * @property {(number | undefined)} maxWidth - set the max width (pixels) of the form if defined
 * @property {(number | undefined)} minWidth - set min the width (pixels) of the form if defined
 * @property {(number | undefined)} minHeight - set min the height (pixels) of the form if defined
 * @property {(number | undefined)} width - set the width (pixels) of the form if defined
 * @property {(number | undefined)} height - set the height (pixels) of the form if defined
 * @property {(string | undefined)} cssClass - space delimited list of classes to add to the dialog element
 */

/**
 *  Called when the dialog is first opened
 * @callback GridDialog~beforeOpenCallback
 * @param {Object} xModel - the JSH model instance
 * @param {string} dialogSelector - the CSS selector that can be used to select the dialog component once opened.
 * @param {Function} onComplete - Should be called by handler when complete
 */

/**
  * Called when the dialog is first opened
  * @callback GridDialog~dialogOpenedCallback
  * @param {JQuery} dialogWrapper - the dialog wrapper element
  * @param {Object} xModel - the JSH model instance
  */

/**
 * Called when the dialog closes
 * @callback GridDialog~closeCallback
 * @param {JQuery} dialogWrapper - the dialog wrapper element
 * @param {Object} xModel - the JSH model instance
 */

/**
 * @class
 * @param {Object} jsh
 * @param {Object} model
 * @param {GridDialogConfig} config
 */
function GridDialog(jsh, model, config) {
  this.jsh = jsh;
  this._model = model;
  this._config = config || {};

  /**
   * @public
   * @type {GridDialog~beforeOpenCallback}
   */
  this.onBeforeOpen = undefined;

  /**
   * @public
   * @type {GridDialog~closeCallback}
   */
  this.onClose = undefined;

  /**
   * @public
   * @type {GridDialog~dialogOpenedCallback}
   */
  this.onOpened = undefined;
}

/**
 * Open the grid dialog
 * @public
 */
GridDialog.prototype.open = function() {
  var self = this;

  /** @type {GridDialogConfig} */
  var config = this._config;

  var dialog = new Dialog(this.jsh, this._model, {
    closeOnBackdropClick: config.closeOnBackdropClick,
    cssClass: config.cssClass,
    dialogId: config.dialogId,
    height: config.height,
    maxHeight: config.maxHeight,
    maxWidth: config.maxWidth,
    minHeight: config.minHeight,
    minWidth: config.minWidth,
    width: config.width
  });

  var controller = undefined;
  var xModel = undefined;
  var $dialog = undefined;

  dialog.onBeforeOpen = function(_xModel, onComplete) {
    xModel = _xModel;
    controller = _xModel.controller;
    self.jsh.XExt.execif(self.onBeforeOpen,
      function(f){
        self.onBeforeOpen(xModel, dialog.getFormSelector(), f);
      },
      function(){
        if(onComplete) onComplete();
      }
    );
  }

  dialog.onOpened = function(_$dialog, _xModel, acceptFunc, cancelFunc) {
    $dialog = _$dialog;
    controller.grid.Prop.Enabled = true;
    controller.Render(function() {
      if (_.isFunction(self.onOpened)) self.onOpened(_$dialog, xModel);
    });
  }

  dialog.onCancel = function(options) {
    if (!options.force && controller.HasUpdates()) {
      self.jsh.XExt.Confirm('Close without saving changes?', function() {
        controller.form.ResetDataset();
        options.forceCancel();
      });
      return false;
    }
  }

  dialog.onClose = function() {
    controller.grid.Prop.Enabled = false;
    if (_.isFunction(self.onClose)) self.onClose($dialog, xModel);
  }

  dialog.open();
}

exports = module.exports = GridDialog;

},{"./dialog":6}],10:[function(require,module,exports){
/**
 * @classdesc A static service for ensuring the overlay appears
 * between the last modal in the modal stack and all other modals.
 * @class
 * @static
 */
function OverlayService() {}

/**
 * @private
 * @static
 * @type {JQuery[]}
 */
OverlayService._dialogStack = [];

/**
 * Remove the last dialog element from the overlay stack.
 * @public
 * @static
*/
OverlayService.popDialog = function() {

  OverlayService._dialogStack.pop();
  if (OverlayService._dialogStack.length < 1) {
    $('.xdialogblock .childDialogOverlay').remove();
    return;
  }

  var $overlay = OverlayService.getOverlay();
  var $dialog = $(OverlayService._dialogStack[OverlayService._dialogStack.length - 1]);
  var zIndex = OverlayService.getZIndex($dialog);
  $overlay.css('z-index', zIndex);
  $dialog.before($overlay);
}

/**
 * Add a dialog element to the overlay stack.
 * @public
 * @static
 * @param {(HTMLElement | JQuery)} dialog
*/
OverlayService.pushDialog = function(dialog) {
  var zIndex = OverlayService.getZIndex(dialog);
  var $overlay = OverlayService.getOverlay();
  $overlay.css('z-index', zIndex);
  OverlayService._dialogStack.push($(dialog));
  $(dialog).before($overlay);
}

/**
 * Get the overlay. Creates and adds to DOM if it doesn't already
 * exist.
 * @private
 * @static
 * @returns {JQuery}
 */
OverlayService.getOverlay = function() {
  var $dialogBlock = $('.xdialogblock');
  var $childOverlay = $dialogBlock.find('.childDialogOverlay');
  if ($childOverlay.length > 0) {
    return $childOverlay;
  }

  $childOverlay = $('<div class="childDialogOverlay"></div>');
  $dialogBlock.prepend($childOverlay);

  $childOverlay
    .css('background-color', 'rgba(0,0,0,0.4)')
    .css('position', 'absolute')
    .css('width', '100%')
    .css('height', '100%');

  $childOverlay.off('click').on('click', function() {
    $dialogBlock.click();
  });

  return $childOverlay;
}

/**
 * Get the z-index for the element.
 * @private
 * @static
 * @param {(HTMLElement | JQuery)} element
 * @returns {number}
 */
OverlayService.getZIndex = function(element) {
  var zIndex = parseInt( $(element).css('zIndex'));
  return isNaN(zIndex) || zIndex == undefined ? 0 : zIndex;
}

exports = module.exports = OverlayService;
},{}],11:[function(require,module,exports){

var Convert  = require('../utils/convert');
var GridDataStore = require('./gridDataStore');
var DataEditor_Form = require('./dataEditor_form')
var ComponentTemplate = require('../componentModel/componentTemplate');
var TemplateRenderer = require('../templateRenderer');


/** @typedef {import('../templateRenderer').RenderConfig} RenderConfig */
/** @typedef {import('../templateRenderer').GridPreviewRenderContext} GridPreviewRenderContext */

/** @typedef {import('../componentModel/dataModelTemplate_gridPreview').DataModelTemplate_GridPreview} DataModelTemplate_GridPreview */


/**
 * @callback DataEditor_GridPreviewController~beforeRenderGridRow
 * @param {DataGridItemEditor~RenderConfig} renderConfig
 */

/**
 * @callback DataEditor_GridPreviewController~renderGridRow
 * @param {HTMLElement} element
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 */

/**
 * @class
 * @classdesc Controller for handling grid preview data editor.
 * @public
 * @param {Object} xModel
 * @param {Object} data - the data used to render the component.
 * @param {Object} properties - the component's configured properties (used to render the component)
 * @param {(JQuery | HTMLElement)} dialogWrapper
 * @param {Object} cms
 * @param {Object} jsh
 * @param {DataModelTemplate_GridPreview} dataModelTemplate_GridPreview
 * @param {ComponentTemplate} componentTemplate
 */
function DataEditor_GridPreviewController(xModel, data, properties, dialogWrapper, cms, jsh, dataModelTemplate_GridPreview, componentTemplate) {

  var self = this;

  /** @private @type {Object} */
  this._properties = properties;

  /** @private @type {Object} */
  this.jsh = jsh;

  /** @private @type {Object} */
  this.cms = cms;

  /** @private @type {Object} */
  this.xModel = xModel;

  /** @private @type {JQuery} */
  this.$dialogWrapper = $(dialogWrapper);

  /** @private @type {string} */
  this._idFieldName = dataModelTemplate_GridPreview.getIdFieldName();

  /** @private @type {ComponentTemplate} */
  this._componentTemplate = componentTemplate;

  /** @private @type {string} */
  this._rowTemplate = dataModelTemplate_GridPreview.getRowTemplate();

  /** @private @type {DataModelTemplate_GridPreview} */
  this._modelTemplate = dataModelTemplate_GridPreview;

  /** @public @type {DataEditor_GridPreviewController~tileUpdateCallback} */
  this.onDataUpdated = undefined;

  /** @public @type {DataEditor_GridPreviewController~beforeRenderGridRow} */
  this.onBeforeRenderGridRow = undefined;

  /** @public @type {DataEditor_GridPreviewController~renderGridRow} */
  this.onRenderGridRow = undefined;

  if (!_.isArray(data || [])) {
    throw new Error('Grid data must be an array');
  }
  data = data || [];
  // We are going to keep two copies of data.
  // The data store has clean and distinct references
  // that the model doesn't touch.
  // The data store is updated by the user and then
  // changes are propagated to the API data which is
  // attached to the grid.
  /** @type {GridDataStore} */
  this._dataStore = new GridDataStore(this._idFieldName);
  this._apiData = [];
  _.each(data, function(item, index) {
    item[self._idFieldName] = self.makeItemId();
    item.sequence = index;
    // Don't expose references in data store.
    // The grid is not allowed to touch them.
    self._dataStore.addNewItem(item);
    self._apiData.push(_.extend({}, item));
  });
}

/**
 * Called by JSH when adding a row.
 * @public
 * @param {object} $row - the JQuery row element proper
 * @param {Object} rowData - the data for the row (augmented by model)
 */
DataEditor_GridPreviewController.prototype.addRow = function($row, rowData) {
  var rowId = this.getParentRowId($row);
  var $rowComponent = this.getRowElementFromRowId(rowId);
  var self = this;

  $row.find('td.xgrid_action_cell.delete').remove();
  if (rowData._is_insert) {
    var id = this.makeItemId();
    this._insertId = id;
    rowData._insertId = id;
    $rowComponent.attr('data-item-id', id);
    setTimeout(function() {
      self.openItemEditor(id);
      self.scrollToItemRow(id);
    });

    this.forceCommit();
  } else {
    $rowComponent.attr('data-item-id', rowData[this._idFieldName]);
    this.renderRow(rowData);
  }
}

/**
 * Change the position of the item in the item list.
 * @private
 * @param {number} itemId - the item ID of the item being moved
 * @param {boolean} moveDown - set to true to mode the item toward the end of the list.
 */
DataEditor_GridPreviewController.prototype.changeItemSequence = function(itemId, moveDown) {

  var item = this._dataStore.getDataItem(itemId);
  if (!item) return;

  var items = this._dataStore.getDataArray() || [];
  item.sequence = item.sequence == undefined ? 9999 : Convert.toNumber(item.sequence);

  // Find the adjacent items
  var prevSequence = -1;
  var prevIndex = -1;
  var nextSequence = 9999;
  var nextIndex = -1;

  for (var i = 0; i < items.length; i++) {
    var currentItem = items[i];
    var sequence = Convert.toNumber(currentItem.sequence);
    // Find the previous adjacent item by finding the max sequence
    // less than the current sequence
    if (sequence < item.sequence && sequence > prevSequence) {
      prevSequence = sequence;
      prevIndex = i;
    }
    // Find the next adjacent item by finding the min sequence
    // greater than the current sequence
    if (sequence > item.sequence && sequence < nextSequence) {
      nextSequence = sequence;
      nextIndex = i;
    }
  }

  var doUpdate = false;
  var updateIndex = -1;
  var newSequence = -1;

  if (moveDown && nextIndex > -1) {
    updateIndex = nextIndex;
    newSequence = nextSequence
    doUpdate = true;
  } else if (!moveDown && prevIndex > - 1) {
    updateIndex = prevIndex;
    newSequence = prevSequence
    doUpdate = true;
  }

  if (doUpdate) {
    var adjData = items[updateIndex]
    adjData.sequence = item.sequence;
    this.updateModelDataFromDataStore(this.getRowIdFromItemId(adjData[this._idFieldName]));

    item.sequence = newSequence;
    this.updateModelDataFromDataStore(this.getRowIdFromItemId(item[this._idFieldName]));

    this._dataStore.sortBySequence();
    this._apiData.splice(0, this._apiData.length);
    // Update the data attached to the grid from the pristine data store
    this._dataStore.getDataArray().forEach(a => this._apiData.push(a));

    // Data was changed in the view
    this.dataUpdated();

    // Need to maintain the scroll position
    // after the grid re-renders
    var scrollTop = this.$dialogWrapper.scrollTop();

    // A refresh is required by the current grid
    // system to ensure rows are re-drawn in correct order.
    this.forceRefresh();

    // Since we don't really know how long it will take
    // (or have a way to know when render is complete)
    // we will just set the scroll every so often
    // for a short period of time.
    var self = this;
    var refreshTime  = 800;
    var refreshInterval = 50;
    var remainingIntervals = refreshTime/refreshInterval;
    var interval = setInterval(function() {
      if (remainingIntervals-- < 2) clearInterval(interval);
      self.$dialogWrapper.scrollTop(scrollTop);
    }, refreshInterval);
  }
}

/**
 * Call anytime slide data is changed (and valid) in the view.
 * @private
 */
DataEditor_GridPreviewController.prototype.dataUpdated = function() {
  this.updateParentController();
}

/**
 * Commit the data in the grid.
 * Should only be used for inserts and deletes.
 * @private
 */
DataEditor_GridPreviewController.prototype.forceCommit = function() {
  var controller = this.xModel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.Commit();
}

/**
 * Refresh the grid.
 * @private
 */
DataEditor_GridPreviewController.prototype.forceRefresh = function() {
  var controller = this.xModel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.Refresh();
}

/**
 * @private
 * @param {string} itemId
 * @returns {GridPreviewRenderContext}
 */
DataEditor_GridPreviewController.prototype.getGridPreviewRenderContext = function(itemId) {
  var itemIndex = this._dataStore.getItemIndexById(itemId);
  /** @type {GridPreviewRenderContext} */
  var retVal = {
    rowIndex: itemIndex
  };
  return retVal;
}

/**
 * Get the item data for the corresponding rowId
 * @private
 * @param {number} rowId - the row ID of the data to get.
 * @return {(Oobject | undefined)}
 */
DataEditor_GridPreviewController.prototype.getItemDataFromRowId = function(rowId) {
  var slideId = $('.xrow.xrow_' + this.xModel.id + '[data-id="' + rowId + '"] [data-component-template="gridRow"]')
    .attr('data-item-id');
  return this._dataStore.getDataItem(slideId) || {};
}

/**
 * Get the next item sequence which is equal to the
 * current max sequence + 1.
 * @private
 * @returns {number}
 */
DataEditor_GridPreviewController.prototype.getNextSequenceNumber = function() {
  var maxItem =  _.max(this._dataStore.getDataArray(), function(item) {
    return typeof item.sequence == 'number' ? item.sequence : -1;
  });
  return typeof maxItem.sequence == 'number' ? maxItem.sequence + 1 : 0;
}

/**
 * Get the row ID of the parent row for the given element.
 * @private
 * @param {object} $element - a child JQuery element of the row
 * @return {number}
 */
DataEditor_GridPreviewController.prototype.getParentRowId = function($element) {
  return this.jsh.XExt.XModel.GetRowID(this.xModel.id, $element);
}

/**
 * Find the topmost element defined in the row template for the row
 * with the given ID.
 * @private
 * @param {number} rowId
 * @returns {JQuery}
 */
DataEditor_GridPreviewController.prototype.getRowElementFromRowId = function(rowId) {
  var rowSelector = '.xrow[data-id="' + rowId + '"]';
  return this.$dialogWrapper.find(rowSelector + ' [data-component-template="gridRow"]');
}

/**
 * Get the row ID for the item with the given ID.
 * @private
 * @param {number} itemId - the item ID to use to find the parent row ID.
 * @return {number}
 */
DataEditor_GridPreviewController.prototype.getRowIdFromItemId = function(itemId) {
  var $el = $(this.$dialogWrapper).find('[data-component-template="gridRow"][data-item-id="' + itemId + '"]');
  return this.getParentRowId($el);
}

/**
 * Entry point for controller. Do not call until
 * the form is on screen.
 * @public
 */
DataEditor_GridPreviewController.prototype.initialize = function() {

  var self = this;
  var modelInterface = this.jsh.App[this.xModel.id];

  if (!_.isFunction(modelInterface.getDataApi)) {
    throw new Error('model must have function "getDataApi(xModel, apiType)"');
  }

  var gridApi = modelInterface.getDataApi(this.xModel, 'grid');
  var formApi = modelInterface.getDataApi(this.xModel, 'form');

  gridApi.dataset = this._apiData;
  formApi.dataset = this._apiData;

  formApi.onInsert = function(action, actionResult, newRow) {
    newRow[self._idFieldName] = self._insertId;
    newRow.sequence = self.getNextSequenceNumber();
    self._apiData.push(newRow);
    self._insertId = undefined;

    var dataStoreItem = self._modelTemplate.makePristineCopy(newRow, false);
    dataStoreItem = self._modelTemplate.populateDataInstance(dataStoreItem);
    self._dataStore.addNewItem(dataStoreItem);

    actionResult[self.xModel.id] = {}
    actionResult[self.xModel.id][self._idFieldName] = newRow[self._idFieldName];
    self.dataUpdated();
    self.renderRow(self._dataStore.getDataItem(newRow[self._idFieldName]));
  }

  formApi.onDelete  = function(action, actionResult, keys) {
    self._dataStore.deleteItem(keys[self._idFieldName]);
    var index = self._apiData.findIndex(function(item) { return item[self._idFieldName] === keys[self._idFieldName]});
    if (index > -1) {
      self._apiData.splice(index, 1);
    }
    self.dataUpdated();
    return false;
  }

  this.forceRefresh();
}

/**
 * Check to see if the component is readonly.
 * @private
 * @returns {boolean} - true if the model is readonly.
 */
DataEditor_GridPreviewController.prototype.isReadOnly = function() {
  return !!this.cms.readonly;
}

/**
 * Create a random item id
 * @private
 * @returns {string}
 */
DataEditor_GridPreviewController.prototype.makeItemId = function() {
  return '_' + Math.random().toString().replace('.', '');
}

/**
 * @private
 * @param {string} itemId - the ID of the item to edit
 */
DataEditor_GridPreviewController.prototype.openItemEditor = function(itemId) {

  var self = this;
  var dateEditor =  new DataEditor_Form(this._componentTemplate, this.getGridPreviewRenderContext(itemId), this.isReadOnly(), this.cms, this.jsh)
  var currentData = this._dataStore.getDataItem(itemId);
  var rowId = this.getRowIdFromItemId(itemId);

  dateEditor.open(this._dataStore.getDataItem(itemId), this._properties || {},  function(updatedData) {
      _.assign(currentData, updatedData)
      self.updateModelDataFromDataStore(rowId);
      self.dataUpdated();
      self.renderRow(currentData);
  }, function() {
    self.scrollToItemRow(itemId);
  });
}

/**
 * Prompt to delete the row with the given row ID
 * @private
 * @param {number} rowId - the ID of the row to delete.
 */
DataEditor_GridPreviewController.prototype.promptDelete = function(rowId) {
  this.xModel.controller.DeleteRow(rowId);
  var self = this;
  $('body').one('click', '.xdialogbox.xconfirmbox input[type="button"]', function(e) {
    var buttonValue = $(e.target).closest('input[type="button"]').attr('value');
    if (buttonValue === 'Yes') {
      setTimeout(function() {
        self.forceCommit();
      });
    }
  });
}

/**
 * Render the row defined by the data
 * @override
 * @private
 * @param {TileData} data
 */
DataEditor_GridPreviewController.prototype.renderRow = function(data) {
  var self = this;
  var dataId = data[this._idFieldName];
  var rowId = this.getRowIdFromItemId(dataId);
  var $row = this.getRowElementFromRowId(rowId);
  var template =
        '<div tabindex="0" data-component-template="gridRow">' +
          '<div class="toolbar">' +
            '<button data-component-part="moveItem" data-dir="prev">' +
              '<span class="material-icons" style="transform: rotate(-90deg)">' +
                'chevron_right' +
              '</span>' +
            '</button>' +
            '<button data-component-part="moveItem" data-dir="next">' +
              '<span class="material-icons" style="transform: rotate(90deg)">' +
                'chevron_right' +
              '</span>' +
            '</button>' +
            '<button data-component-part="editButton" data-allowReadOnly>' +
              '<span class="material-icons">' +
                'edit' +
              '</span>' +
            '</button>' +
            '<button data-component-part="deleteItem">' +
              '<span class="material-icons">' +
                'delete' +
              '</span>' +
            '</button>' +
          '</div>' +
          '<div data-component-part="preview"></div>' +
        '</div>'

  $row.empty().append(template);

  var renderConfig = TemplateRenderer.createRenderConfig(this._rowTemplate, data, this._properties || {}, this.cms);
  renderConfig.gridContext = this.getGridPreviewRenderContext(dataId);

  if (_.isFunction(this.onBeforeRenderGridRow)) this.onBeforeRenderGridRow(renderConfig);

  var rendered = TemplateRenderer.render(renderConfig, 'gridRowDataPreview', this.jsh);

  $row.find('[data-component-part="preview"]').empty().append(rendered);

  if (this.isReadOnly()) {
    $row.find('button:not([data-allowReadOnly])').attr('disabled', true);
  } else {

    $row.find('[data-component-part="moveItem"]').off('click.basicComponent').on('click.basicComponent', function(e) {
        if (self.isReadOnly()) return;
        var moveDown = $(e.target).closest('button[data-dir]').attr('data-dir') === 'next';
        self.changeItemSequence(dataId, moveDown);
    });

    $row.find('[data-component-part="deleteItem"]').off('click.basicComponent').on('click.basicComponent', function(e) {
      if (self.isReadOnly()) return;
      var rowId = self.getParentRowId(e.target);
      self.promptDelete(rowId);
    });
  }

  $row.find('[data-component-part="editButton"]').on('click', function() {
    self.openItemEditor(dataId);
  });

  $row.find('[data-component-part="preview"]').off('dblclick.cmsComponent').on('dblclick.cmsComponent', function() {
    self.openItemEditor(dataId);
  });

  $row.off('mousedown.cmsComponent').on('mousedown.cmsComponent', function(event) {
    // We don't want the user to accidentally select text (which happens often)
    // when double clicking. This will prevent that.
    if (event.detail === 2) {
      event.preventDefault();
    }
  });

  this.updateSequenceButtonViews();

  if (_.isFunction(this.onRenderGridRow)) this.onRenderGridRow($row.find('[data-component-part="preview"]')[0], renderConfig.data, renderConfig.properties);

  setTimeout(function() {
    _.forEach($row.find('[data-component-part="preview"] [data-component]'), function(el) {
      self.cms.componentManager.renderComponent(el);
    });
  }, 100);
}

/**
 * Set the modal scroll position to show the row for the
 * item with the given item ID. If the item is already visible
 * then do nothing.
 * @private
 * @param {string} itemId
 */
DataEditor_GridPreviewController.prototype.scrollToItemRow = function(itemId) {

  var $row = this.getRowElementFromRowId(this.getRowIdFromItemId(itemId));
  if ($row.length < 1 ) return;

  var $scrollParent = $row.scrollParent();
  var scrollParentY = $scrollParent.offset().top;
  var rowRelativeStartY = $row.offset().top - scrollParentY;
  var rowRelativeEndY = rowRelativeStartY + $row.outerHeight();
  var parentRelativeMaxY = $scrollParent.height();

  var isRowFullyInView = rowRelativeStartY >= 0 && rowRelativeEndY <= parentRelativeMaxY;
  if (isRowFullyInView) return;

  var rowFitsInView = (rowRelativeEndY - rowRelativeStartY) < parentRelativeMaxY;
  if (!rowFitsInView) {
    // If the row doesn't fit then just scroll to the top of the row
    $row[0].scrollIntoView();
    return;
  }

  // Try to minimize the scroll distance
  var rowTopDistanceFromParentTop = Math.abs(rowRelativeStartY);
  var rowBottomDistanceFromParentBottom = Math.abs(parentRelativeMaxY - rowRelativeEndY);
  var alignTop = rowTopDistanceFromParentTop <= rowBottomDistanceFromParentBottom;
  $row[0].scrollIntoView(alignTop);
}

/**
 * Copy properties from data store item to controller data item.
 * Call anytime the data store item changes.
 * @private
 * @param {number} rowId - the ID of the row for which the corresponding data will be updated (mutated).
 */
DataEditor_GridPreviewController.prototype.updateModelDataFromDataStore = function(rowId) {

  var idField = this._idFieldName;
  var data = this.getItemDataFromRowId(rowId);
  var item = this.xModel.controller.form.DataSet.find(a => a[idField] === data[idField]);
  if (!item) {
    return;
  }

  // Don't share references!
  _.extend(item, data);
}

/**
 * Send updated data to the parent controller.
 * Call anytime item data is changed (and valid).
 * @private
 */
DataEditor_GridPreviewController.prototype.updateParentController = function() {
  var self = this;
  this._dataStore.sortBySequence();

  var items = this._dataStore.getDataArray()  || [];
  items = _.map(items, function(item) { return self._modelTemplate.makePristineCopy(item, true); });

  var data = { items: items };

  if (_.isFunction(this.onDataUpdated)) this.onDataUpdated(data);
}

/**
 * Iterate through data and enable/disable sequence buttons as needed.
 * @private
 */
DataEditor_GridPreviewController.prototype.updateSequenceButtonViews = function() {

  var self = this;
  _.forEach(this._dataStore.getDataArray(), function(item, index) {
    var dataId = item[self._idFieldName];
    var $row = self.getRowElementFromRowId(self.getRowIdFromItemId(dataId));

    var isFirst = index < 1;
    var isLast = index >= (self._dataStore.count() - 1);

    $row.find('[data-component-part="moveItem"][data-dir="prev"]')
        .attr('disabled', isFirst || self.isReadOnly());

    $row.find('[data-component-part="moveItem"][data-dir="next"]')
      .attr('disabled', isLast || self.isReadOnly());
  });
}

exports = module.exports = DataEditor_GridPreviewController;

},{"../componentModel/componentTemplate":1,"../templateRenderer":17,"../utils/convert":20,"./dataEditor_form":12,"./gridDataStore":14}],12:[function(require,module,exports){
var FormDialog = require('../dialogs/formDialog');
var ComponentTemplate = require('../componentModel/componentTemplate');
var HTMLPropertyEditorController = require('./htmlPropertyEditorController');
var TemplateRenderer = require('../templateRenderer');

/** @typedef {import('../templateRenderer').RenderConfig} RenderConfig */

/** @typedef {import('../componentModel/componentTemplate').MediaBrowserControlInfo} MediaBrowserControlInfo */

/**
 * @callback DataEditor_Form~beforeRenderDataItemPreview
 * @param {RenderConfig} renderConfig
 */

/**
 * @callback DataEditor_Form~renderDataItemPreview
 * @param {HTMLElement} element
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 */



/**
 * @class
 * @param {ComponentTemplate} componentTemplate
 * @param {(import('../templateRenderer').GridPreviewRenderContext | undefined)} gridContext
 * @param {Object} cms
 * @param {Object} jsh
 */
function DataEditor_Form(componentTemplate, gridContext, isReadOnly, cms, jsh) {

  /** @private @type {ComponentTemplate} */
  this._componentTemplate = componentTemplate;

  /** @private @type {boolean} */
  this._isReadOnly = isReadOnly;

  /** @private @type {Object} */
  this._cms = cms;

  /** @private */
  this._gridContext = gridContext;

  /** @private @type {Object} */
  this._jsh = jsh;

  /** @private @type {HTMLPropertyEditorController[]} */
  this._htmlEditors = [];

  /** @private @type {DataEditor_Form~beforeRenderDataItemPreview} */
  this._onBeforeRenderDataItemPreview = undefined;

  /** @private @type {DataEditor_Form~renderDataItemPreview} */
  this._onRenderDataItemPreview = undefined;
}

/**
 * @private
 * @param {JQuery} $dialog - the dialog element.
 * @param {JQuery} $wrapper - the preview wrapper element.
 */
DataEditor_Form.prototype.attachEditors = function($dialog, $wrapper, $toolbar) {

  var self = this;

  _.forEach(this._htmlEditors, function(editor) { editor.destroy(); });

  _.forEach($wrapper.find('[data-component-full-editor]'), function (editorEl) {
    var $el = $(editorEl);
    var propName = $el.attr('data-component-full-editor');
    var editor = new HTMLPropertyEditorController('full', self._jsh, self._cms, $dialog, propName,  $el, $toolbar);
    editor.initialize(function() {});
    self._htmlEditors.push(editor);
  });

  _.forEach($wrapper.find('[data-component-title-editor]'), function (editorEl) {
    var $el = $(editorEl);
    var propName = $el.attr('data-component-title-editor');
    var editor = new HTMLPropertyEditorController('title', self._jsh, self._cms, $dialog, propName, $el, $toolbar);
    editor.initialize(function() {});
    self._htmlEditors.push(editor);
  });
}

/**
 * Create a new instance of the jsHarmonyCMSEditorPicker
 * @private
 * @returns {object}
 */
DataEditor_Form.prototype.createPicker = function() {
  return this._cms.createJsHarmonyCMSEditorPicker(undefined);
}

/**
 * @private
 * @param {JQuery} $dialog
 * @param {MediaBrowserControlInfo} info
 * @param {boolean} enable
 */
DataEditor_Form.prototype.enableBrowserControl = function($dialog, info, enable) {
  $dialog.find('.xform_ctrl.' + info.titleFieldName).attr('disabled', enable ? null : true);
}

/**
 * Open the editor
 * @public
 * @param {Object} itemData - the data used to render the component.
 * @param {Object} properties - the component's configured properties (used to render the component)
 * @param {Function} onAcceptCb - Called if the data is updated. Arg0 is updated data.
 * @param {Function} onCloseCb - Called anytime the dialog is closed.
 */
DataEditor_Form.prototype.open = function(itemData, properties, onAcceptCb, onCloseCb) {

  var self = this;
  var modelTemplate = this._componentTemplate.getDataModelTemplate_FormPreview();
  var modelConfig = modelTemplate.getModelInstance();
  var template = modelTemplate.getItemTemplate();

  if (this._isReadOnly) {
    modelConfig.actions = 'B';
  }

  var itemData = modelTemplate.populateDataInstance(itemData || {});

  var dialog = new FormDialog(this._jsh, modelConfig, {
    acceptButtonLabel: 'Save',
    cancelButtonLabel:  'Cancel',
    closeOnBackdropClick: true,
    cssClass: 'l-content jsharmony_cms_component_dialog jsharmony_cms_component_dataFormItemEditor jsharmony_cms_component_dataFormItemEditor_' + this._componentTemplate.getTemplateId(),
    dialogId: modelConfig.id,
    maxHeight: 800
  });

  var $toolbar;

  dialog.onBeforeOpen = function(xModel, dialogSelector, onComplete) {
    var editor = self._jsh.App[xModel.id];
    var $dialog = $(dialogSelector);
    $dialog.css('opacity', '0');
    self._formSelector = dialogSelector; // remove this

    // Note that the toolbar HAS to be in the popup DOM hierarchy for focus/blur
    // events to work correctly.
    $toolbar = $('<div class="jsharmony_cms_content_editor_toolbar"></div>')
      .css('position', 'fixed')
      .css('top', '37px')
      .css('left', '0')
      .css('width', '100%')
      .css('z-index', '999999');
    $(dialogSelector).append($toolbar);

    _.forEach(modelTemplate.getBrowserFieldInfos(), function(info) {
      var title = itemData[info.titleFieldName] || '';
      var data = itemData[info.dataFieldName] || '';
      var fieldsMatch = title === data;
      var isDataEmpty = title.length < 1 && data.length < 1;
      var fieldIsEditable = fieldsMatch || isDataEmpty;
      self.enableBrowserControl($dialog, info, fieldIsEditable);
    });

    editor.onChangeData_noDebounce = function() {
      if(!self._jsh.XModels[xModel.id]){ return; }
      var updatedData = {};
      _.forEach(modelConfig.fields, function(field) {
        if (field.type != undefined) {
          updatedData[field.name] = xModel.get(field.name);
        }
      });

      var $wrapper =  $dialog.find('[data-id="previewWrapper"]').first();
      self.renderPreview($wrapper, template, updatedData, properties);
      // Don't attach any events until after the onRenderGridItemPreview hook is called.
      // Otherwise, the events might be attached to elements that get replaced or removed.
      self.attachEditors($dialog, $wrapper, $toolbar);
    }

    // This function NEEDS to be debounced.
    // It SHOULD be anyway so it doesn't re-render the preview on every
    // keystroke, but it HAS to be just in case two fields change
    // at the same time (in which case the first change causes a re-render
    // and the second change breaks things since parts of the re-render are async)
    editor.onChangeData = _.debounce(editor.onChangeData_noDebounce, 300);

    editor.openEditorBrowser = function(browserControlName) {

      var info = modelTemplate.getBrowserFieldInfo(browserControlName);
      if (info == undefined) return;

      var update = function(url, title) {
        // IMPORTANT! Set the title FIRST.
        // The change handler is attached to the title
        // so that will run and update the link control,
        // and then we override the link control.
        xModel.set(info.titleFieldName, title);
        xModel.set(browserControlName, url);
        self.enableBrowserControl($dialog, info, false);
        editor.onChangeData();
      };

      if (info.browserType === 'link') {

        if (info == undefined) return;
        self.openLinkBrowser(function(url, data) {
          var title = url||'';
          if(data){
            if(data.page_path) title = data.page_path;
            else if(data.media_path) title = data.media_path;
            else if(data.item_path) title = data.item_path;
          }
          update(url, title);
        });
      } else if (info.browserType === 'media') {
          self.openMediaBrowser(function(url, data) {
            var title = data.media_path;
            update(url, title);
          });
      } else {
        console.warn(new Error('Unknown browser type ' + info.browserType));
      }
    }

    editor.onChangeBrowserTitleControl = function(browserControlName) {
      // When the user manually changes the link title,
      // the link value must be set to the title value.
      var info = modelTemplate.getBrowserFieldInfo(browserControlName);
      if (info == undefined) return;
      xModel.set(browserControlName, xModel.get(info.titleFieldName));
      editor.onChangeData();
    }

    editor.resetEditorBrowser = function(linkControlName) {
      var info = modelTemplate.getBrowserFieldInfo(linkControlName);
      if (info == undefined) return;
      self.enableBrowserControl($dialog, info, true);
      xModel.set(linkControlName, '');
      xModel.set(info.titleFieldName, '');
      editor.onChangeData();
    }

    self._onBeforeRenderDataItemPreview = editor.onBeforeRenderDataItemPreview;
    self._onRenderDataItemPreview = editor.onRenderDataItemPreview;

    if(onComplete) onComplete();
  }

  dialog.onOpened = function($dialog, xModel) {
    var editor = self._jsh.App[xModel.id];
    // Manually call change to do initial render
    setTimeout(function() {
      editor.onChangeData_noDebounce();
      setTimeout(function() {
        $dialog.css('opacity', '1');
      }, 50);
    });
  }

  dialog.onAccept = function($dialog, xModel) {
    if(!xModel.controller.Commit(itemData, 'U')) return false;
    itemData = modelTemplate.makePristineCopy(itemData);
    if (_.isFunction(onAcceptCb)) onAcceptCb(itemData);
    return true;
  }

  dialog.onCancel = function(options, $dialog, xModel) {
    if (!options.force && xModel.controller.HasUpdates()) {
      self._jsh.XExt.Confirm('Close without saving changes?', function() {
        xModel.controller.form.ResetDataset();
        options.forceCancel();
      });
      return false;
    }
  }

  dialog.onClose = function($dialog, xModel) {
    //Destroy model
    if (xModel.controller && xModel.controller.OnDestroy) xModel.controller.OnDestroy();
    if (typeof xModel.ondestroy != 'undefined') xModel.ondestroy(xModel);

    delete self._jsh.XModels[xModel.id];
    delete self._jsh.App[xModel.id];
    _.forEach(self._htmlEditors, function(editor) { editor.destroy(); });
    if (_.isFunction(onCloseCb)) onCloseCb();
  }

  dialog.open(itemData);
}

/**
 * Open a link browser
 * @private
 * @param {Function} cb - callback for when link is selected (matches original picker signature)
 */
DataEditor_Form.prototype.openLinkBrowser = function(cb) {
  this.createPicker().openLink(cb, '');
}

/**
 * Open a medial browser
 * @private
 * @param {Function} cb - callback for when link is selected (matches original picker signature)
 */
DataEditor_Form.prototype.openMediaBrowser = function(cb) {
  this.createPicker().openMedia(cb, '');
}

/**
 * @private
 * @param {JQuery} $wrapper
 * @param {string} template
 * @param {Object} data
 * @param {Object} properties
 */
DataEditor_Form.prototype.renderPreview = function($wrapper, template, data, properties) {

  var self = this;

  var renderConfig = TemplateRenderer.createRenderConfig(template, data, properties, this._cms);
  renderConfig.gridContext = this._gridContext;

  if (_.isFunction(this._onBeforeRenderDataItemPreview)) this._onBeforeRenderDataItemPreview(renderConfig);

  var rendered = TemplateRenderer.render(renderConfig, 'gridItemPreview', this._jsh);

  $wrapper.empty().append(rendered);

  if (_.isFunction(this._onRenderDataItemPreview)) this._onRenderDataItemPreview($wrapper.children()[0], renderConfig.data, renderConfig.properties);

  setTimeout(function() {
    _.forEach($($wrapper.children()[0]).find('[data-component]'), function(el) {
      self._cms.componentManager.renderComponent(el);
    });
  }, 50);
}

exports = module.exports = DataEditor_Form;
},{"../componentModel/componentTemplate":1,"../dialogs/formDialog":8,"../templateRenderer":17,"./htmlPropertyEditorController":15}],13:[function(require,module,exports){
var ComponentTemplate = require('../componentModel/componentTemplate');
var GridDialog = require('../dialogs/gridDialog');
var DataEditor_GridPreviewController = require('./dataEditor_ gridPreviewController');



/**
 * @class
 * @param {ComponentTemplate} componentTemplate
 * @param {Object} cms
 * @param {Object} jsh
 */
function DataEditor_GridPreview(componentTemplate, cms, jsh) {

  /** @private @type {ComponentTemplate} */
  this._componentTemplate = componentTemplate;

  /** @private @type {Object} */
  this._cms = cms;

  /** @private @type {Object} */
  this._jsh = jsh;
}

/**
 * Open the editor
 * @public
 * @param {Object} data - the data used to render the component.
 * @param {Object} properties - the component's configured properties (used to render the component)
 * @param {Function} dataUpdatedCb - Called when data is updated. Arg0 is updated data.
 */
DataEditor_GridPreview.prototype.open = function(data, properties, dataUpdatedCb) {

  var self = this;
  var modelTemplate = this._componentTemplate.getDataModelTemplate_GridPreview();
  var modelConfig = modelTemplate.getModelInstance();


  var componentInstanceId = modelConfig.id;
  this._jsh.XExt.JSEval(modelTemplate.getModelJs() || '', {}, {
    modelid: componentInstanceId
  });
  var componentInstance = this._jsh.App[componentInstanceId] || {};


  var dialog = new GridDialog(this._jsh, modelConfig, {
    closeOnBackdropClick: true,
    cssClass: 'l-content jsharmony_cms_component_dialog jsharmony_cms_component_dataGridEditor jsharmony_cms_component_dataGridEditor_' + this._componentTemplate.getTemplateId(),
    dialogId: componentInstanceId,
    maxHeight: 800,
    minHeight: modelConfig.popup[1],
    minWidth: modelConfig.popup[0]
  });

  var dataController;

  dialog.onBeforeOpen = function(xModel, dialogSelector, onComplete) {

    self.updateAddButtonText(dialogSelector + ' .xactions .xbuttoninsert', self._componentTemplate.getCaptions());

    dataController = new DataEditor_GridPreviewController(xModel, (data || {}).items, properties, $(dialogSelector),
      self._cms, self._jsh, modelTemplate, self._componentTemplate);

    dataController.onDataUpdated = function(updatedData) {
      if (_.isFunction(dataUpdatedCb)) dataUpdatedCb(updatedData);
    }

    dataController.onBeforeRenderGridRow = function(renderOptions) {
      if (_.isFunction(componentInstance.onBeforeRenderGridRow)) componentInstance.onBeforeRenderGridRow(renderOptions);
    }

    dataController.onRenderGridRow = function(element, data, properties) {
      if (_.isFunction(componentInstance.onRenderGridRow)) componentInstance.onRenderGridRow(element, data, properties);
    }

    var modelInterface = self._jsh.App[xModel.id];

    modelInterface.onRowBind = function(xModel, jobj, dataRow) {
      if (!dataController) return;
      dataController.addRow(jobj, dataRow);
    }

    modelInterface.onCommit = function(xModel, rowId, callback) {
      callback();
    }

    modelInterface.close = function() {
      self._jsh.XExt.CancelDialog();
    }

    if(onComplete) onComplete();
  }

  dialog.onOpened = function($dialog, xModel) {
    dataController.initialize();
  }

  dialog.onClose = function($dialog, xModel) {
    //Destroy model
    if (xModel.controller && xModel.controller.OnDestroy) xModel.controller.OnDestroy();
    if (typeof xModel.ondestroy != 'undefined') xModel.ondestroy(xModel);

    delete self._jsh.XModels[xModel.id];
    delete self._jsh.App[xModel.id];
    delete self._jsh.App[componentInstanceId];
  }

  dialog.open();

}

DataEditor_GridPreview.prototype.updateAddButtonText = function(selector, captions) {

  var text = captions[1] != undefined ? 'Add ' + captions[1] : 'Add';

  var $el = $(selector);
  var $img = $el.find('img');
  $el.empty().append($img).append(text);
}


exports = module.exports = DataEditor_GridPreview;
},{"../componentModel/componentTemplate":1,"../dialogs/gridDialog":9,"./dataEditor_ gridPreviewController":11}],14:[function(require,module,exports){
var Convert  = require('../utils/convert');

/**
 * @class
 * @classdesc A simple data store to handle data management for grid.
 * @param {string} idKey - the data item property name that serves as the unique item ID.
 */
function GridDataStore(idKey) {
  // This array reference must never change!
  /** @type {Array.<Object>} */
  this._dataArray = [];

  /** @type {string} */
  this._idKey = idKey;
}

/**
 * @public
 * @param {Object} item
 */
GridDataStore.prototype.addNewItem = function(item) {
  if (!item[this._idKey]) {
    throw new Error('item must have an ID');
  }
  if (this.getItemIndexById(item[this._idKey]) > -1) {
    throw new Error('item already exists');
  }
  this._dataArray.push(item);
}

/**
 * Remove the item with the given ID if it exists.
 * @public
 */
GridDataStore.prototype.deleteItem = function(id) {
  var index =  this.getItemIndexById(id);
  if (index > -1) {
    this._dataArray.splice(index, 1)
  }
}

/**
 * Get the item with the given ID if it exists.
 * @public
 * @param {string} id
 * @returns {(Object | undefined)}
 */
GridDataStore.prototype.getDataItem = function(id) {
  return this._dataArray[this.getItemIndexById(id)];
}

/**
 * Gets a constant reference to the array of data.
 * @returns {Array.<Object>}
 */
GridDataStore.prototype.getDataArray = function() {
  // Must return same reference every time.
  return this._dataArray;
}

/**
 * Get the index of the data with the given ID
 * @private
 * @param {string} id
 * @returns {number} - index of found item or -1 if not found.
 */
GridDataStore.prototype.getItemIndexById = function(id) {
  var idKey = this._idKey;
  return this._dataArray.findIndex(function(item) { return id === item[idKey]; });
}

/**
 * Return the count of data in the store.
 * @public
 * @returns {number}
 */
GridDataStore.prototype.count = function() {
  return this._dataArray.length;
}

/**
 * Sort the data by sequence number in ascending order
 * @public
 */
GridDataStore.prototype.sortBySequence = function() {
  // Remember, DON'T update array reference EVER!
  this._dataArray.sort(function(a, b) {
    return  Convert.toNumber(a.sequence) > Convert.toNumber(b.sequence) ? 1 : -1;
  });
}

/**
 * Replace the item with the matching ID
 * @public
 * @param {Object} item
 */
GridDataStore.prototype.updateItem = function(item) {
  if (!item[this._idKey]) {
    throw new Error('item must have an ID');
  }
  var index =  this.getItemIndexById(item[this._idKey]);
  if (index < 0) {
    throw new Error('item does not exist');
  }
  this._dataArray[index] = item;
}

exports = module.exports = GridDataStore;

},{"../utils/convert":20}],15:[function(require,module,exports){
/**
 * @class
 * @classdesc This is a wrapper on the jshCMSEditor to easily attach it
 *            to a field in a component property/data editor form.
 *            To use, create a hidden control of type varchar like
 *            {name: 'body', type: 'varchar', control: 'hidden'} and
 *
 *            { caption: 'Body:', control:'html', value:'<div data-editor-for="body"></div>','block':true}
 *
 * @public
 * @param {('full' | 'title')} editorType
 * @param {Object} jsh
 * @param {Object} csm
 * @param {(JQuery | HTMLElement)} formElement - The form element.
 * @param {string} hiddenFieldName - See the class description. The hidden field name
 *                                   is used to bind the editor data to the hidden field
 *                                   and denotes the respective elements.
 * @param {(JQuery | HTMLElement)} editorElement - the element that gets attached as the editor
 * @param {(JQuery | HTMLElement)} toolbarElement - the element used to attach the toolbar.
 */
function HTMLPropertyEditor(editorType, jsh, cms, formElement, hiddenFieldName, editorElement, toolbarElement) {

  /** @private @type {('full' | 'title')} */
  this._editorType = editorType;

  /** @private @type {string} */
  this._jsh = jsh;

  /** @private @type {string} */
  this._cms = cms;

  /** @private @type {JQuery} */
  this._$formElement = $(formElement);

  /** @private @type {string} */
  this._hiddenFieldName = hiddenFieldName;

  /** @private @type {JQuery} */
  this._$editorElement = $(editorElement);

  /** @private @type {JQuery} */
  this._$toolbarElement = $(toolbarElement);

  /** @private @type {Object} */
  this._editor = undefined;

  /** @private @type {string} */
  this._uid = '_' + Math.random().toString().replace('.', '');

  // ID must match the jsHarmony convention in order to get/set
  // content using the jsHarmonyEditor
  /** @private @type {string} */
  this._contentId = 'jsharmony_cms_content_' + this._uid;
}

/**
 * Destroy the editor and cleanup
 * @public
 */
HTMLPropertyEditor.prototype.destroy = function() {
  this._editor.detach(this._uid);
}

/**
 * Get the hidden field JQuery obj that is bound to the editor.
 * @private
 * @returns {JQuery}
 */
HTMLPropertyEditor.prototype.getDataElement = function() {
  return this._$formElement.find('.xform_ctrl.' + this._hiddenFieldName);
}

/**
 * Initialize the editor.
 * Only call one time.
 * @public
 * @param {function} callback - called when the editor is initialized and attached.
 */
HTMLPropertyEditor.prototype.initialize = function(callback) {

  var self = this;
  callback = callback || function() {};

  // ID must match the jsHarmony convention in order to get/set
  // content using the jsHarmonyEditor. So set the ID no matter what.
  this._$editorElement.attr('id', this._contentId);
  this._editor = this._cms.createJsHarmonyCMSEditor(this._$toolbarElement[0]);
  this._editor.onEndEdit = function() {
    var content = self.processText(self._editor.getContent(self._uid));
    self.getDataElement().attr('value', content);
  }
  this._editor.init(function() {

    var config = {};
    var configType = '';
    var editorType = (self._editorType || '').toLowerCase();
    if (editorType === 'full') {
      configType = 'full';
      config = {
        valid_elements : '+*[*],#p[*]',
      };
    } else if (editorType === 'title') {
      configType = 'full';
      config = {
        toolbar: 'forecolor backcolor | bold italic underline | alignleft aligncenter alignright alignjustify | link  image charmapmaterialicons',
        valid_elements : 'a,strong/b,p,span[style],p[*],img[*],br[*]',
        plugins: ['link image charmapmaterialicons'],
        menubar: false,
      };
    } else {
      throw new Error('Unknown editor type "' + self._editorType + '"');
    }

    self._editor.attach(configType, self._contentId, config, function() {
      self.render();
      callback();
    });
  });
}

/**
 * Process text from the editor
 * @private
 * @param {string} text
 * @returns {string}
 */
HTMLPropertyEditor.prototype.processText = function(text) {
  // Sometimes TinyMce adds non-breaking spaces (may be browser dependant).
  // These need to be removed
  return (text || '').replace(/(&nbsp;)|(&#160;)/g, ' ');
}

/**
 * Update the editor with the value from the field bound to the editor.
 * @private
 */
HTMLPropertyEditor.prototype.render = function() {
  var value = this.getDataElement().attr('value') || '';
  this._editor.setContent(this._uid, value);
}


exports = module.exports = HTMLPropertyEditor;
},{}],16:[function(require,module,exports){
var ComponentTemplate = require('../componentModel/componentTemplate');
var FormDialog = require('../dialogs/formDialog');

/**
 * @class
 * @param {ComponentTemplate} componentTemplate
 * @param {Object} cms
 * @param {Object} jsh
 */
function PropertyEditor_Form(componentTemplate, cms, jsh) {

  /** @private @type {ComponentTemplate} */
  this._componentTemplate = componentTemplate;

  /** @private @type {Object} */
  this._cms = cms;

  /** @private @type {Object} */
  this._jsh = jsh;
}

/**
 * Open the editor
 * @public
 * @param {Object} properties - the component's configured properties
 * @param {Function} onAcceptCb - Called if the data is updated. Arg0 is updated data.
 */
PropertyEditor_Form.prototype.open = function(properties, onAcceptCb) {

  var self = this;
  var modelTemplate = this._componentTemplate.getPropertiesModelTemplate_Form();
  var model = modelTemplate.getModelInstance();

  var data = modelTemplate.populateDataInstance(properties || {});

  /** @type {import('../dialogs/formDialog').FormDialogConfig} */
  var dialogParams = {
    acceptButtonLabel: 'Save',
    cancelButtonLabel:  'Cancel',
    closeOnBackdropClick: true,
    cssClass: 'jsharmony_cms_component_dialog jsharmony_cms_component_propertyFormEditor jsharmony_cms_component_propertyFormEditor_' + this._componentTemplate.getTemplateId(),
    dialogId: model.id
  };

  if(model.popup){
    dialogParams.minHeight = model.popup[1];
    dialogParams.minWidth = model.popup[0];
  }

  var dialog = new FormDialog(this._jsh, model, dialogParams);

  dialog.onAccept = function($dialog, xModel) {
    if(!xModel.controller.Commit(data, 'U')) return false;
    data = modelTemplate.makePristineCopy(data);
    if (_.isFunction(onAcceptCb)) onAcceptCb(data);
    return true;
  }

  dialog.onCancel = function(options, $dialog, xModel) {
    if (!options.force && xModel.controller.HasUpdates()) {
      self._jsh.XExt.Confirm('Close without saving changes?', function() {
        xModel.controller.form.ResetDataset();
        options.forceCancel();
      });
      return false;
    }
  }

  dialog.onClose = function($dialog, xModel) {
    //Destroy model
    if (xModel.controller && xModel.controller.OnDestroy) xModel.controller.OnDestroy();
    if (typeof xModel.ondestroy != 'undefined') xModel.ondestroy(xModel);

    delete self._jsh.XModels[xModel.id];
    delete self._jsh.App[xModel.id];
  }

  dialog.open(data);
}

exports = module.exports = PropertyEditor_Form;

},{"../componentModel/componentTemplate":1,"../dialogs/formDialog":8}],17:[function(require,module,exports){
/**
 * @typedef {Object} RenderConfig
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {string} template - the template being rendered
 * @property {string} baseUrl
 * @property {(GridPreviewRenderContext | undefined )} gridContext
 */

/**
 * @typedef {Object} RenderContext
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {('component' | 'gridRowDataPreview' | 'gridItemPreview')} type
 * @property {string} baseUrl
 * @property {(GridPreviewRenderContext | undefined )} gridContext
 */

/**
 * @typedef {Object} GridPreviewRenderContext
 * @property {number} rowIndex
 */



/**
 * @class
 * @public
 * @static
 */
function TemplateRenderer() {}

/**
 * Create a mutable object that can be preprocessed before rendering.
 * @public
 * @static
 * @param {string} template
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 * @param {Object} cms
 * @returns {RenderConfig}
 */
TemplateRenderer.createRenderConfig = function(template, data, properties, cms) {

  /** @type {RenderConfig} */
  var config  = {
    data: data,
    properties: properties,
    template: template,
    baseUrl: (cms._baseurl || '').replace(/\/+$/, '') + '/',
  };

  return config;
}

/**
 * @public
 * @static
 * @param {('component' | 'gridRowDataPreview' | 'gridItemPreview')} type
 * @param {RenderConfig} config
 * @param {Object} jsh
 * @returns {string}
 */
TemplateRenderer.render = function(config, type, jsh) {

    /** @type {RenderContext} */
    var renderContext = {
      baseUrl: config.baseUrl,
      data: config.data,
      properties: config.properties,
      type: type,
      gridContext: config.gridContext,
      _: jsh._,
      escapeHTML: jsh.XExt.escapeHTML,
      stripTags: jsh.XExt.StripTags,
    }

    var rendered = '';
    try {
      rendered = jsh.ejs.render(config.template || '', renderContext);
    } catch (error) {
      console.error(error);
    }
    return rendered
}

exports = module.exports = TemplateRenderer;
},{}],18:[function(require,module,exports){
/**
 * @typedef {Object} IconDefinition
 * @property {string} name - the name the icon is registered as
 * @property {string} html - the html for the icon
 */

/**
 * @typedef {Object} ComponentEvent
 * @property {string} id - the ID of the component for the event target.
 * @property {string} type - the component type for the event target.
 */

/**
 * @typedef {Object} ComponentInfo
 * @property {string} componentType
 * @property {bool} hasData
 * @property {bool} hasProperties
 * @property {string} iconId
 * @property {string} menuLabel
 *
 */

/**
 * Each icon definition will be registered with the editor
 * and available for use within the editor by name property.
 * @type {Object.<string, IconDefinition>}
 **/
var ICONS = {
  edit: {
    name: 'material_edit',
    html: '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">edit</span>'
  },
  settings: {
    name: 'material_setting',
    html: '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">settings</span>'
  },
  widgets: {
    name: 'material_widgets',
    html: '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">widgets</span>'
  }
};



/**
 * This defines commands that can be used for the plugin.
 * @type {Object.<string, string>}
 */
var COMMAND_NAMES = {
  editComponentProperties: 'jsharmonyEditComponentProperties',
  editComponentData: 'jsharmonyEditComponentData'
};

/**
 * This defines event names that can be used for the plugin.
 * @type {Object.<string, string>}
 */
var EVENT_NAMES = {
  renderComponent:  'jsHarmonyRenderComponent'
};


/**
 * Register the JSH CMS Component plugin.
 * @public
 * @param {Object} jsHarmonyCmsComponentManager
 */
function registerPlugin(jsHarmonyCmsComponentManager) {
  if (tinymce.PluginManager.get('jsharmony') != undefined) {
    return;
  }

  var components = jsHarmonyCmsComponentManager.componentTemplates;
  tinymce.PluginManager.add('jsharmony', function(editor, url) {
    new JsHarmonyComponentPlugin(editor, components, jsHarmonyCmsComponentManager);
  });
}

/**
 * @class
 * @private
 * @param {Object} editor - the TinyMce editor instance
 * @param {Object[]} components - the component configurations
 * @param {Object} jsHarmonyCmsComponentManager
 */
function JsHarmonyComponentPlugin(editor, components, jsHarmonyCmsComponentManager) {

  this._editor = editor;
  this._jsHarmonyCmsComponentManager = jsHarmonyCmsComponentManager;
  this.initialize(components);
}

/**
 * Create the menu button for picking components to insert.
 * @private
 * @param {ComponentInfo[]} componentInfo
 */
JsHarmonyComponentPlugin.prototype.createComponentInsertMenu = function(componentInfo) {
  var self = this;

  self._editor.ui.registry.addMenuButton('jsHarmonyComponents', {
    icon: ICONS.widgets.name,
    text: 'Components',
    fetch: function(cb) {
      items = _.map(componentInfo, function(item) {
        return {
          type: 'menuitem',
          text: item.menuLabel,
          icon: item.iconId,
          onAction: function() { self.insertComponentContent(item.componentType); }
        }
      });
      cb(items)
    }
  });
}

/**
 * Create and register the context toolbar for editing
 * the component properties and data.
 * @private
 * @param {ComponentInfo[]} componentInfos
 */
JsHarmonyComponentPlugin.prototype.createContextToolbar = function(componentInfos) {

  var self = this;
  var propButtonId = 'jsharmonyComponentPropEditor';
  var dataButtonId = 'jsharmonyComponentDataEditor';

  self._editor.ui.registry.addButton(dataButtonId, {
    tooltip: 'Edit',
    text: 'Edit',
    icon:  ICONS.edit.name,
    onAction: function() { self._editor.execCommand(COMMAND_NAMES.editComponentData); }
  });

  self._editor.ui.registry.addButton(propButtonId, {
    tooltip: 'Configure',
    text: 'Configure',
    icon: ICONS.settings.name,
    onAction: function() { self._editor.execCommand(COMMAND_NAMES.editComponentProperties); }
  });

  var dataAndPropsToolbar = dataButtonId + ' ' + propButtonId;
  var dataToolBar = dataButtonId;
  var propsToolBar = propButtonId;

  var toolbarPredicate = function(enableData, enableProps) {
    return function(node) {
      var isComponent = self._editor.dom.is(node, '[data-component]');
      if (!isComponent) {
        return false;
      }
      var componentType = self._editor.dom.getAttrib(node, 'data-component');
      var componentInfo = _.find(componentInfos, function(info) { return info.componentType === componentType });
      if (!componentInfo) {
        return false;
      };
      return enableData === componentInfo.hasData && enableProps === componentInfo.hasProperties;
    }
  }

  var addToolbar = function(toolBarConfig, predicate) {
    var contextId = 'jsharmonyComponentContextToolbar_' + toolBarConfig;
    self._editor.ui.registry.addContextToolbar(contextId, {
      predicate: predicate,
      items: toolBarConfig,
      scope: 'node',
      position: 'node'
    });
  }
  addToolbar(dataAndPropsToolbar, toolbarPredicate(true, true));
  addToolbar(dataToolBar, toolbarPredicate(true, false));
  addToolbar(propsToolBar, toolbarPredicate(false, true));
}

/**
 * Find the component instance if it exits
 * @private
 * @param {(string | HTMLElement)} element - if type is string then find the component by the string ID,
 * if type is an HTMLElement then find element and get ID from the ID attribute.
 * @returns {(Object | undefined)}
 */
JsHarmonyComponentPlugin.prototype.getComponentInstance = function(element) {

  if (!element) return;
  var id = element;
  if (!_.isString(element)) {
    id = $(element).attr('data-component-id') || '';
  }

  return this._jsHarmonyCmsComponentManager.components[id];
}

/**
 * When an undo or redo event occurs in the editor
 * the component needs to be re-rendered.
 * @private
 * @param {object} e - the undo/redo event from the TinyMCE editor
 */
JsHarmonyComponentPlugin.prototype.handleUndoRedo = function(e) {
  var self = this;
  var content = e.level.content;
  if (!content) return;
  var parser = new tinymce.html.DomParser({validate: false});
  parser.addAttributeFilter('data-component-id', function(nodes, name) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var id = node.attributes.map['data-component-id'];
      var type = node.attributes.map['data-component'];
      if (id && type) {
        self._editor.fire(EVENT_NAMES.renderComponent, self.makeComponentEvent(id, type));
      }
    }
  });
  parser.parse(content);
}

/**
 * Initialize the plugin.
 * Do not call this more than one time per editor instance.
 * @private
 * @param {Object[]} components - the component configurations
 */
JsHarmonyComponentPlugin.prototype.initialize = function(components) {

  var self = this;

  /** @type {ComponentInfo[]} */
  var componentInfo = [];

  // Register component icons and build
  // component info.
  _.forEach(components, function(component) {
    if (component.icon) {
      // Icon name MUST be lowercase for TinyMce to work correctly.
      var iconRegistryName = ('cms_component_icon_' + component.id).toLowerCase();
      var iconMatch = /^(\w+):/.exec(component.icon);
      var icon = '';
      if (iconMatch) {
        var iconType = iconMatch[1];
        var iconValue = component.icon.slice(iconMatch[0].length);
        if (iconType === 'material') {
          icon = '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">' + iconValue + '</span>';
        } else if (iconType === 'svg' || iconType === 'html') {
          icon = iconValue;
        } else {
          console.error('Unknown icon family "' + iconType + '"');
        }
      } else {
        icon = component.icon;
      }

      self._editor.ui.registry.addIcon(iconRegistryName, icon);

      componentInfo.push({
        componentType: component.id,
        hasData: ((component.data || {}).fields || []).length > 0,
        hasProperties: ((component.properties || {}).fields || []).length > 0,
        iconId: iconRegistryName,
        menuLabel: component.title || component.id
      });
    }
  });

  // Register icons
  for (var key in ICONS) {
    self._editor.ui.registry.addIcon(ICONS[key].name, ICONS[key].html);
  }

  this.createContextToolbar(componentInfo);
  this.createComponentInsertMenu(componentInfo);

  this._editor.on('undo', function(info) { self.handleUndoRedo(info); });
  this._editor.on('redo', function(info) { self.handleUndoRedo(info); });

  this._editor.addCommand(COMMAND_NAMES.editComponentData, function() {
    var el = self._editor.selection.getStart();
    self.openDataEditor(el);
  });

  this._editor.addCommand(COMMAND_NAMES.editComponentProperties, function() {
    var el = self._editor.selection.getStart();
    self.openPropertiesEditor(el);
  });

  this._editor.on('init', function() {
    self._editor.serializer.addNodeFilter('div', function(nodes) { self.serializerFilter(nodes); });
    self._editor.parser.addAttributeFilter('data-component', function(nodes) { self.parseFilter(nodes); });
  });
}

/**
 * Insert the component into the editor.
 * @private
 * @param {string} componentType - the type of the component to insert.
 */
JsHarmonyComponentPlugin.prototype.insertComponentContent = function(componentType) {

  var domUtil = this._editor.dom;
  var selection = this._editor.selection;

  var currentNode = selection.getEnd();

  var el2Id = domUtil.uniqueId();
  var placeHolderEl1 = domUtil.create('div', {}, '');
  var placeHolderEl2 = domUtil.create('div', { id: el2Id },  'b2');

  domUtil.insertAfter(placeHolderEl1, currentNode);
  domUtil.insertAfter(placeHolderEl2, currentNode);

  domUtil.replace(currentNode, placeHolderEl1)

  selection.select(placeHolderEl2);
  selection.collapse(false);

  // Don't need to fire the insert event here.
  // We have a parser filter that will detect the insert and
  // fire the event.
  this._editor.insertContent(this.makeComponentContainer(componentType));

  domUtil.remove(el2Id);
}

/**
 * Create the component container HTML string for
 * inserting into the editor.
 * @private
 * @param {string} componentType - the type of component to create
 * @returns {string} - HTML string
 */
JsHarmonyComponentPlugin.prototype.makeComponentContainer = function(componentType) {
  return '<div class="mceNonEditable" data-component="' + componentType + '" data-component-properties="" data-component-content="" data-is-insert="true"></div>';
}

/**
 * Create a component event.
 * @private
 * @param {string} componentId - the ID of the component that is the event target
 * @param {string} componentType - the type of the component that is the event target
 * @return {ComponentEvent}
 */
JsHarmonyComponentPlugin.prototype.makeComponentEvent = function(componentId, componentType) {
  return {
    componentId: componentId,
    componentType: componentType
  };
}

/**
 * Open the data editor for the component.
 * @private
 * @param {(string | Element)} element - if type is string then find the component by the string ID,
 * if type is an HTMLElement then find component from the ID attribute.
 */
JsHarmonyComponentPlugin.prototype.openDataEditor = function(element) {
  var component = this.getComponentInstance(element);
  if (component && _.isFunction(component.openDataEditor)) {
    component.openDataEditor();
  }
}

/**
 * Open the property editor for the component.
 * @private
 * @param {(string | Element)} element - if type is string then find the component by the string ID,
 * if type is an HTMLElement then find component from the ID attribute.
 */
JsHarmonyComponentPlugin.prototype.openPropertiesEditor = function(element) {
  var component = this.getComponentInstance(element);
  if (component && _.isFunction(component.openPropertiesEditor)) {
    component.openPropertiesEditor();
  }
}

/**
 * Filter the TinyMce content parsed nodes.
 * @private
 * @param {Array.<object>} nodes - a list of TinyMce nodes
 */
JsHarmonyComponentPlugin.prototype.parseFilter = function(nodes) {
  var self = this;
  _.each(nodes, function(node) {
    var id = self._jsHarmonyCmsComponentManager.getNextComponentId();
    // var id = node.attributes.map['data-component-id'];
    node.attr('data-component-id', id);
    var type = node.attributes.map['data-component'];
    // Content is not actually in the DOM yet.
    // Wait for next loop
    setTimeout(function() {
      self._editor.fire(EVENT_NAMES.renderComponent, self.makeComponentEvent(id, type));
    });
  });
}

/**
 * Filter the TinyMce content to find relevant components
 * and serialize the components for save.
 * @private
 * @param {Array.<object>} nodes - a list of TinyMce nodes
 */
JsHarmonyComponentPlugin.prototype.serializerFilter = function(nodes) {
  for(var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var componentAttr = node.attr('data-component');
    if (componentAttr == undefined || componentAttr.length < 1) {
      continue;
    }
    node.empty();
  }
}

exports = module.exports = registerPlugin;
},{}],19:[function(require,module,exports){
/**
 * @class
 * @classdesc Clone objects
 */
function Cloner() { }

/**
 * Do a serialize => deserialize transformation
 * to create a deep clone. Object must be serializable.
 * @public
 * @static
 * @param {Object} obj - item to clone
 * @returns {Object} - cloned object
 */
Cloner.deepClone = function(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

exports = module.exports = Cloner;

},{}],20:[function(require,module,exports){
/**
 * @class
 * @classdesc This contains helper functions to coerce values from one type to another.
 */
function Convert() {}

/**
 * Try to convert the input value to a number.
 * @static
 * @public
 * @param {(number | string | undefined)} input
 * @param {boolean} allowNan - if not true, NaNs will be returned as undefined.
 * @returns {(number | undefined)} - return number of successful
 */
Convert.toNumber = function(input, allowNan) {
  if (typeof input === 'string') {
    input = parseFloat(input);
  }

  if (typeof input === 'number') {
    return !allowNan && isNaN(input) ? undefined : input;
  } else {
    return undefined;
  }
}

exports = module.exports = Convert;

},{}],21:[function(require,module,exports){
/**
 * @class
 * @classdesc Serialize and deserialize component data and property attributes
 */
function DomSerializer() { }

/**
 * Get the attribute from the element.
 * The attribute value will be deserialized and returned as an object.
 * @public
 * @static
 * @param {(Element | JQuery)} element - the element to operate on.
 * @param {string} attrName - the name of the attribute to use
 * @returns {object} - the deserialized object.
 */
DomSerializer.getAttr = function(element, attrName) {
  var rawAttr = $(element).attr(attrName) || '';
  return this.deserializeAttrValue(rawAttr);
}

/**
 * Deserialize the serialized string
 * @public
 * @static
 * @param {string | undefined} value - the raw serialized string.
 * @returns {object} - the deserialized object.
 */
DomSerializer.deserializeAttrValue = function(value) {
  value = value ? atob(value) : '{}';
  return JSON.parse(value);
}

/**
 * Set the object (after serialization) as the attribute value.
 * @public
 * @static
 * @param {(Element | JQuery)} element - the element to operate on.
 * @param {string} attrName - the name of the attribute to use
 * @param {(object | undefined)} data - the object to set as the attribute value
 */
DomSerializer.setAttr = function(element, attrName, data) {
  var attrVal = this.serializeAttrValue(data);
  return $(element).attr(attrName, attrVal);
}

/**
 * Serialize the object for safe component usage
 * @public
 * @static
 * @param {(object | undefined)} data - the object to serialize.
 * @returns {string} - the serialized data.
 */
DomSerializer.serializeAttrValue = function(data) {
  // Need to keep undefined values so they don't get set to default values
  var replacer = function(key, value) { return value == undefined ? null : value };
  return btoa(JSON.stringify(data || {}, replacer));
}

exports = module.exports = DomSerializer;

},{}],22:[function(require,module,exports){
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
  var $element = $(element);

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

  /**
   * Get the data from the element's serialized data attribute value.
   * @private
   * @return {Object}
   */
  this.getData = function() {
    return DomSerializer.getAttr($element, 'data-component-data');
  }

  /**
   * Get the properties from the element's serialized property attribute value
   * and update from model definition.
   * @private
   * @return {Object}
   */
  this.getProperties = function() {
    var model = componentTemplate.getPropertiesModelTemplate_Form();
    var properties = DomSerializer.getAttr($element, 'data-component-properties');
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
    var self = this;
    var dataEditor = new DataEditor_Form(componentTemplate, undefined, this.isReadOnly(), cms, jsh);

    var data = this.getData() || {};
    dataEditor.open(data.item || {}, this.getProperties() || {}, function(updatedData) {
      data.item = updatedData;
      self.saveData(data);
      self.render();
    });
  }

  /**
   * @private
   */
  this.openDataEditor_GridPreview = function() {
    var self = this;
    var dataEditor = new DataEditor_GridPreview(componentTemplate, cms, jsh);

    dataEditor.open(this.getData(), this.getProperties() || {}, function(updatedData) {
      self.saveData(updatedData);
      self.render();
    });
  }

  /**
   * Open the property editor form.
   * @public
   */
  this.openPropertiesEditor = function() {

    var self = this;
    var propertyEditor = new PropertyEditor_Form(componentTemplate, cms, jsh);

    propertyEditor.open(this.getProperties() || {}, function(data) {
      self.saveProperties(data);
      self.render();
    });
  }

  /**
   * Render the component
   * @public
   */
  this.render = function() {

    var self = this;
    var config = componentTemplate.getComponentConfig()  || {};
    var template = (config.templates || {}).editor || '';

    var data = this.getData();
    var props = this.getProperties();


    var renderConfig = TemplateRenderer.createRenderConfig(template, data, props, cms);

    if (_.isFunction(this.onBeforeRender)) this.onBeforeRender(renderConfig);

    var rendered = TemplateRenderer.render(renderConfig, 'component', jsh);

    $element.empty().append(rendered);

    $element.off('dblclick.cmsComponent').on('dblclick.cmsComponent', function() {
      var hasData = ((config.data || {}).fields || []).length > 0;
      var hasProperties = ((config.properties || {}).fields || []).length > 0;
      if(hasData) self.openDataEditor();
      else if(hasProperties) self.openPropertiesEditor();
    });

    if (_.isFunction(this.onRender)) this.onRender($element[0], data, props);

    setTimeout(function() {
      _.forEach($element.find('[data-component]'), function(el) {
        cms.componentManager.renderComponent(el);
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
  this.saveData = function(data) {
    DomSerializer.setAttr($element, 'data-component-data', data);
  }

  /**
   * Call anytime the properties are changed in the view (i.e.,
   * by the user). This will save the properties for the components
   * @private
   * @param {(Object | undefined)} props
   */
  this.saveProperties = function(props) {
    DomSerializer.setAttr($element, 'data-component-properties', props);
  }



  this.initProperties();


}
},{"./component/componentModel/componentTemplate":1,"./component/editors/dataEditor_form":12,"./component/editors/dataEditor_gridPreview":13,"./component/editors/propertyEditor_form":16,"./component/templateRenderer":17,"./component/utils/domSerializer":21}],23:[function(require,module,exports){
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

var JsHarmonyCMSComponent = require('./jsHarmonyCMS.Component');

exports = module.exports = function(jsh, cms){
  var _this = this;
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
            _this.extractComponentTemplateEjs(component);
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

  this.extractComponentTemplateEjs = function(componentTemplate) {
    componentTemplate.templates = componentTemplate.templates || {};
    var componentRawEjs = componentTemplate.templates.editor || '';

    /**********
     * If there is a wrapper element with the "componentTemplate" class
     * then the wrapper's inner HTML is the componentEJS template.
     * It also means that the data EJS template might be in there as well.
     *
     * If the wrapper does not exist then the entire EJS string is the template
     **********/
    var $componentTemplateWrapper = $(componentRawEjs).filter('.componentTemplate');
    if ($componentTemplateWrapper.length){
      componentTemplate.templates.editor = $componentTemplateWrapper.html();
    }

    var $componentPreviewTemplate = $(componentRawEjs).filter('.componentPreviewTemplate');
    if ($componentPreviewTemplate.length){
      componentTemplate.data = componentTemplate.data || {};
      componentTemplate.data.ejs = (componentTemplate.data.ejs ? componentTemplate.data.ejs + '\r\n' : '') + $componentPreviewTemplate.html();
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
    var componentInstance = {};
    XExt.JSEval('\r\n' + (componentTemplate.js || '') + '\r\n', componentInstance, {
      _this: componentInstance,
      cms: cms,
      jsh: jsh,
      component: componentInstance
    });
    if (!_.isFunction(componentInstance.create))  {
      componentInstance.create = function(componentConfig, element) {
        var component = new JsHarmonyCMSComponent(componentId, element, cms, jsh, componentConfig.id);
        component.onBeforeRender = componentInstance.onBeforeRender
        component.onRender = componentInstance.onRender;
        component.render();
        _this.components[componentId] = component;
      }
    }
    componentInstance.create(componentTemplate, element);
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
},{"./jsHarmonyCMS.Component":22}],24:[function(require,module,exports){
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

exports = module.exports = function(jsh, cms){
  var _this = this;

  this.type = ''; //Name of controller, ex. page
  this.hasChanges = false;

  this.init = function(cb){
  }

  this.load = function(cb){
  }

  this.createWorkspace = function(cb){
  }

  this.render = function(){
  }

  this.getValues = function(){
    _this.hasChanges = false;
  }

  this.validate = function(){
    return true;
  }

  this.save = function(){
  }

  this.getComponentRenderParameters = function(component_id){
    return {};
  }

  this.getMenuRenderParameters = function(menu_tag){
    return {
      menu: { menu_item_tree: [] }
    };
  }
}
},{}],25:[function(require,module,exports){
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

exports = module.exports = function(jsh, cms, editor){
  var _this = this;
  var XExt = jsh.XExt;

  this.getParameters = function(filePickerType, url){
    url = (url||'').toString();
    if(cms.onGetFilePickerParameters){
      var qs = cms.onGetFilePickerParameters(filePickerType, url);
      if(qs) return qs;
    }
    if(url.indexOf('#@JSHCMS') >= 0){
      var urlparts = document.createElement('a');
      urlparts.href = url;
      var patharr = (urlparts.pathname||'').split('/');
      if(((urlparts.pathname||'').indexOf('/_funcs/media/')==0) && (patharr.length>=4)){
        var media_key = parseInt(patharr[3]);
        if(media_key.toString()==patharr[3]) return { init_media_key: media_key };
      }
      if(((urlparts.pathname||'').indexOf('/_funcs/page/')==0) && (patharr.length>=4)){
        var page_key = parseInt(patharr[3]);
        if(page_key.toString()==patharr[3]) return { init_page_key: page_key };
      }
    }
    return {};
  }

  this.openLink = function(cb, value, meta){
    cms.filePickerCallback = cb;
    var qs = _this.getParameters('link', value);
    XExt.popupForm('jsHarmonyCMS/Link_Browser', 'browse', qs, { width: 1100, height: 600 });
  }

  this.openMedia = function(cb, value, meta){
    cms.filePickerCallback = cb;
    var qs = { };
    var linkurl = _this.getParameters('media', value);
    if(linkurl.media_key) qs.init_media_key = linkurl.media_key;
    XExt.popupForm('jsHarmonyCMS/Media_Browser', 'browse', qs, { width: 1100, height: 600 });
  }

  this.onmessage = function(event, data){
    if(data.indexOf('cms_file_picker:')==0){
      if(!cms.filePickerCallback) return true;
      data = data.substr(16);
      var jdata = JSON.parse(data);
      if(cms.onFilePickerCallback && (cms.onFilePickerCallback(jdata))){}
      else if(jdata.media_key){
        cms.filePickerCallback(cms._baseurl+'_funcs/media/'+jdata.media_key+'/?media_file_id='+jdata.media_file_id+'#@JSHCMS', jdata);
      }
      else if(jdata.page_key){
        cms.filePickerCallback(cms._baseurl+'_funcs/page/'+jdata.page_key+'/#@JSHCMS', jdata);
      }
      else XExt.Alert('Invalid response from File Browser: '+JSON.stringify(jdata));
      cms.filePickerCallback = null;
      return true;
    }
    return false;
  }
}
},{}],26:[function(require,module,exports){
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

var jsHarmonyCMSEditorPicker = require('./jsHarmonyCMS.Editor.Picker.js');
var registerPlugin = require('./component/tinyMceComponentPlugin');

exports = module.exports = function(jsh, cms, toolbarContainer){
  var _this = this;

  var $ = jsh.$;
  var _ = jsh._;
  var XExt = jsh.XExt;

  this.isEditing = false;
  this.picker = new jsHarmonyCMSEditorPicker(jsh, cms, this);
  this.defaultConfig = {};
  this.toolbarContainer = null;

  this.onBeginEdit = null; //function(editor){};
  this.onEndEdit = null; //function(editor){};


  this.editorConfig = {
    base: null,
    full: null,
    text: null
  };

  this.init = function(cb){
    if(!cb) cb = function(){};

    //Initialize Editor
    _this.initToolbarContainer(toolbarContainer);
    XExt.TinyMCE('', undefined, function(){

      registerPlugin(cms.componentManager);

      //Change text labels
      window.tinymce.addI18n('en', {
        'Media...': 'Video...',
        'Insert / Edit': 'Video...',
        'Insert/edit media': 'Insert/edit video',
        'Insert/Edit Media': 'Insert/Edit Video',
      });

      //Initialize each content editor
      _this.editorConfig.base = _.extend({}, {
        inline: true,
        branding: false,
        browser_spellcheck: true,
        valid_elements: '+*[*],#p',
        valid_children: '+h1[p],+h2[p],+h3[p],+h4[p],+h5[p],+h6[p]',
        entity_encoding: 'numeric',
        plugins: [
          'advlist autolink autoresize lists link image charmapmaterialicons anchor',
          'searchreplace visualblocks code fullscreen wordcount jshwidget',
          'insertdatetime media table paste code noneditable jsharmony'
        ],
        toolbar: 'formatselect | forecolor backcolor | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link  image table fullscreen | jsHarmonyComponents',
        removed_menuitems: 'newdocument',
        image_advtab: true,
        menu: {
          edit: { title: 'Edit', items: 'undo redo | cut copy paste | selectall | searchreplace' },
          view: { title: 'View', items: 'code | visualaid visualchars visualblocks | spellchecker | preview fullscreen' },
          insert: { title: 'Insert', items: 'image link media jshwidget codesample inserttable | charmapmaterialicons emoticons hr | pagebreak nonbreaking anchor toc | insertdatetime' },
          format: { title: 'Format', items: 'bold italic underline strikethrough superscript subscript codeformat | formats | forecolor backcolor | removeformat' },
          tools: { title: 'Tools', items: 'spellchecker spellcheckerlanguage | code wordcount' },
          table: { title: 'Table', items: 'inserttable tableprops deletetable row column cell' },
          help: { title: 'Help', items: 'help' }
        },
        file_picker_types: 'file image',
        file_picker_callback: function(cb, value, meta) {
          // Provide file and text for the link dialog
          if (meta.filetype == 'file') _this.picker.openLink(cb, value, meta);
          else if (meta.filetype == 'image') _this.picker.openMedia(cb, value, meta);
        },
        relative_urls: false,
        urlconverter_callback: function(url, node, on_save, name){
          var urlparts = document.createElement('a');
          var urlparts_editor = document.createElement('a');
          urlparts.href = url;
          urlparts_editor.href = document.location;
          if(urlparts.host == urlparts_editor.host){
            url = url.replace(/^[^:]*\:\/{2}[^/]*\/(.*)/, '/$1');
          }
          url = url;
          return url;
        },
        fixed_toolbar_container: _this.toolbarContainer ? '#' + _this.toolbarContainer.attr('id') : '',
        charmap_append: _this.getMaterialIcons(),
      }, jsh.globalparams.defaultEditorConfig, _this.defaultConfig);

      _this.editorConfig.full = _.extend({}, _this.editorConfig.base, {
        init_instance_callback: function(editor){
          var firstFocus = true;
          editor.on('focus', function(){
            //Fix bug where alignment not reset when switching between editors
            if(firstFocus){
              $('.jsharmony_cms_content_editor_toolbar').find('.tox-tbtn--enabled:visible').removeClass('tox-tbtn--enabled');
              firstFocus = false;
            }
            $('[data-component="header"]').css('pointer-events', 'none');
            _this.isEditing = editor.id.substr(('jsharmony_cms_content_').length);
            _this.toolbarContainer.stop(true).animate({ opacity:1 },300);
            cms.refreshLayout();
            if(_this.onBeginEdit) _this.onBeginEdit(editor);
          });
          editor.on('blur', function(){
            $('[data-component="header"]').css('pointer-events', 'auto');
            _this.isEditing = false;
            _this.toolbarContainer.stop(true).animate({ opacity:0 },300);
            if(_this.onEndEdit) _this.onEndEdit(editor);
          });
          editor.on('jsHarmonyRenderComponent', function(e) {
            var el = $(editor.targetElm).find('[data-component="' + e.componentType + '"][data-component-id="' + e.componentId + '"]')[0];
            if (el) cms.componentManager.renderComponent(el);
          });
        }
      });

      _this.editorConfig.text = _.extend({}, _this.editorConfig.base, {
        inline: true,
        branding: false,
        toolbar: '',
        valid_elements: '',
        valid_styles: {
          '*': ''
        },
        menubar: false,
        browser_spellcheck: true,
        init_instance_callback: function(editor){
          editor.on('blur', function(){
            if(_this.onEndEdit) _this.onEndEdit(editor);
          });
        }
      });

      return cb();
    });
  }

  this.attach = function(config_id, elem_id, options, cb){
    if(!(config_id in _this.editorConfig)) throw new Error('Editor config ' + (config_id||'').toString() + ' not defined');
    var config = _.extend({ selector: '#' + elem_id }, _this.editorConfig[config_id], options);
    if(cb) config.init_instance_callback = XExt.chainToEnd(config.init_instance_callback, cb);
    window.tinymce.init(config);
  }

  this.detach = function(id){
    var editor = window.tinymce.get('jsharmony_cms_content_'+id);
    if(editor){
      if(_this.isEditing == id) editor.fire('blur');
      editor.destroy();
    }
  }

  this.setContent = function(id, val){
    if(cms.readonly){
      //Delay load, so that errors in the HTML do not stop the page loading process
      window.setTimeout(function(){ $('#jsharmony_cms_content_'+id).html(val); },1);
    }
    else {
      var editor = window.tinymce.get('jsharmony_cms_content_'+id);
      if(!editor) throw new Error('Editor not found: '+id);
      if(!_this.isInitialized) editor.undoManager.clear();
      editor.setContent(val);
      if(!_this.isInitialized) editor.undoManager.add();
    }
  }

  this.getContent = function(id){
    var editor = window.tinymce.get('jsharmony_cms_content_'+id);
    if(!editor) throw new Error('Editor not found: '+id);
    return editor.getContent();
  }

  this.initToolbarContainer = function(element) {
    this.toolbarContainer = $(element);
    var id = this.toolbarContainer.attr('id');
    if (!id) {
      do {
        id = 'jsharmony_cms_editor_toolbar_' + Math.random().toString().replace('.', '');
      } while($('#' + id).length > 0)
      this.toolbarContainer.attr('id', id);
    }
  }
  this.getMaterialIcons = function(){
    if(!jsh.globalparams.defaultEditorConfig.materialIcons) return [];
    return [
      [0xe84d,'materialicon_3d_rotation'],
      [0xeb3b,'materialicon_ac_unit'],
      [0xe190,'materialicon_access_alarm'],
      [0xe191,'materialicon_access_alarms'],
      [0xe192,'materialicon_access_time'],
      [0xe84e,'materialicon_accessibility'],
      [0xe914,'materialicon_accessible'],
      [0xe84f,'materialicon_account_balance'],
      [0xe850,'materialicon_account_balance_wallet'],
      [0xe851,'materialicon_account_box'],
      [0xe853,'materialicon_account_circle'],
      [0xe60e,'materialicon_adb'],
      [0xe145,'materialicon_add'],
      [0xe439,'materialicon_add_a_photo'],
      [0xe193,'materialicon_add_alarm'],
      [0xe003,'materialicon_add_alert'],
      [0xe146,'materialicon_add_box'],
      [0xe147,'materialicon_add_circle'],
      [0xe148,'materialicon_add_circle_outline'],
      [0xe567,'materialicon_add_location'],
      [0xe854,'materialicon_add_shopping_cart'],
      [0xe39d,'materialicon_add_to_photos'],
      [0xe05c,'materialicon_add_to_queue'],
      [0xe39e,'materialicon_adjust'],
      [0xe630,'materialicon_airline_seat_flat'],
      [0xe631,'materialicon_airline_seat_flat_angled'],
      [0xe632,'materialicon_airline_seat_individual_suite'],
      [0xe633,'materialicon_airline_seat_legroom_extra'],
      [0xe634,'materialicon_airline_seat_legroom_normal'],
      [0xe635,'materialicon_airline_seat_legroom_reduced'],
      [0xe636,'materialicon_airline_seat_recline_extra'],
      [0xe637,'materialicon_airline_seat_recline_normal'],
      [0xe195,'materialicon_airplanemode_active'],
      [0xe194,'materialicon_airplanemode_inactive'],
      [0xe055,'materialicon_airplay'],
      [0xeb3c,'materialicon_airport_shuttle'],
      [0xe855,'materialicon_alarm'],
      [0xe856,'materialicon_alarm_add'],
      [0xe857,'materialicon_alarm_off'],
      [0xe858,'materialicon_alarm_on'],
      [0xe019,'materialicon_album'],
      [0xeb3d,'materialicon_all_inclusive'],
      [0xe90b,'materialicon_all_out'],
      [0xe859,'materialicon_android'],
      [0xe85a,'materialicon_announcement'],
      [0xe5c3,'materialicon_apps'],
      [0xe149,'materialicon_archive'],
      [0xe5c4,'materialicon_arrow_back'],
      [0xe5db,'materialicon_arrow_downward'],
      [0xe5c5,'materialicon_arrow_drop_down'],
      [0xe5c6,'materialicon_arrow_drop_down_circle'],
      [0xe5c7,'materialicon_arrow_drop_up'],
      [0xe5c8,'materialicon_arrow_forward'],
      [0xe5d8,'materialicon_arrow_upward'],
      [0xe060,'materialicon_art_track'],
      [0xe85b,'materialicon_aspect_ratio'],
      [0xe85c,'materialicon_assessment'],
      [0xe85d,'materialicon_assignment'],
      [0xe85e,'materialicon_assignment_ind'],
      [0xe85f,'materialicon_assignment_late'],
      [0xe860,'materialicon_assignment_return'],
      [0xe861,'materialicon_assignment_returned'],
      [0xe862,'materialicon_assignment_turned_in'],
      [0xe39f,'materialicon_assistant'],
      [0xe3a0,'materialicon_assistant_photo'],
      [0xe226,'materialicon_attach_file'],
      [0xe227,'materialicon_attach_money'],
      [0xe2bc,'materialicon_attachment'],
      [0xe3a1,'materialicon_audiotrack'],
      [0xe863,'materialicon_autorenew'],
      [0xe01b,'materialicon_av_timer'],
      [0xe14a,'materialicon_backspace'],
      [0xe864,'materialicon_backup'],
      [0xe19c,'materialicon_battery_alert'],
      [0xe1a3,'materialicon_battery_charging_full'],
      [0xe1a4,'materialicon_battery_full'],
      [0xe1a5,'materialicon_battery_std'],
      [0xe1a6,'materialicon_battery_unknown'],
      [0xeb3e,'materialicon_beach_access'],
      [0xe52d,'materialicon_beenhere'],
      [0xe14b,'materialicon_block'],
      [0xe1a7,'materialicon_bluetooth'],
      [0xe60f,'materialicon_bluetooth_audio'],
      [0xe1a8,'materialicon_bluetooth_connected'],
      [0xe1a9,'materialicon_bluetooth_disabled'],
      [0xe1aa,'materialicon_bluetooth_searching'],
      [0xe3a2,'materialicon_blur_circular'],
      [0xe3a3,'materialicon_blur_linear'],
      [0xe3a4,'materialicon_blur_off'],
      [0xe3a5,'materialicon_blur_on'],
      [0xe865,'materialicon_book'],
      [0xe866,'materialicon_bookmark'],
      [0xe867,'materialicon_bookmark_border'],
      [0xe228,'materialicon_border_all'],
      [0xe229,'materialicon_border_bottom'],
      [0xe22a,'materialicon_border_clear'],
      [0xe22b,'materialicon_border_color'],
      [0xe22c,'materialicon_border_horizontal'],
      [0xe22d,'materialicon_border_inner'],
      [0xe22e,'materialicon_border_left'],
      [0xe22f,'materialicon_border_outer'],
      [0xe230,'materialicon_border_right'],
      [0xe231,'materialicon_border_style'],
      [0xe232,'materialicon_border_top'],
      [0xe233,'materialicon_border_vertical'],
      [0xe06b,'materialicon_branding_watermark'],
      [0xe3a6,'materialicon_brightness_1'],
      [0xe3a7,'materialicon_brightness_2'],
      [0xe3a8,'materialicon_brightness_3'],
      [0xe3a9,'materialicon_brightness_4'],
      [0xe3aa,'materialicon_brightness_5'],
      [0xe3ab,'materialicon_brightness_6'],
      [0xe3ac,'materialicon_brightness_7'],
      [0xe1ab,'materialicon_brightness_auto'],
      [0xe1ac,'materialicon_brightness_high'],
      [0xe1ad,'materialicon_brightness_low'],
      [0xe1ae,'materialicon_brightness_medium'],
      [0xe3ad,'materialicon_broken_image'],
      [0xe3ae,'materialicon_brush'],
      [0xe6dd,'materialicon_bubble_chart'],
      [0xe868,'materialicon_bug_report'],
      [0xe869,'materialicon_build'],
      [0xe43c,'materialicon_burst_mode'],
      [0xe0af,'materialicon_business'],
      [0xeb3f,'materialicon_business_center'],
      [0xe86a,'materialicon_cached'],
      [0xe7e9,'materialicon_cake'],
      [0xe0b0,'materialicon_call'],
      [0xe0b1,'materialicon_call_end'],
      [0xe0b2,'materialicon_call_made'],
      [0xe0b3,'materialicon_call_merge'],
      [0xe0b4,'materialicon_call_missed'],
      [0xe0e4,'materialicon_call_missed_outgoing'],
      [0xe0b5,'materialicon_call_received'],
      [0xe0b6,'materialicon_call_split'],
      [0xe06c,'materialicon_call_to_action'],
      [0xe3af,'materialicon_camera'],
      [0xe3b0,'materialicon_camera_alt'],
      [0xe8fc,'materialicon_camera_enhance'],
      [0xe3b1,'materialicon_camera_front'],
      [0xe3b2,'materialicon_camera_rear'],
      [0xe3b3,'materialicon_camera_roll'],
      [0xe5c9,'materialicon_cancel'],
      [0xe8f6,'materialicon_card_giftcard'],
      [0xe8f7,'materialicon_card_membership'],
      [0xe8f8,'materialicon_card_travel'],
      [0xeb40,'materialicon_casino'],
      [0xe307,'materialicon_cast'],
      [0xe308,'materialicon_cast_connected'],
      [0xe3b4,'materialicon_center_focus_strong'],
      [0xe3b5,'materialicon_center_focus_weak'],
      [0xe86b,'materialicon_change_history'],
      [0xe0b7,'materialicon_chat'],
      [0xe0ca,'materialicon_chat_bubble'],
      [0xe0cb,'materialicon_chat_bubble_outline'],
      [0xe5ca,'materialicon_check'],
      [0xe834,'materialicon_check_box'],
      [0xe835,'materialicon_check_box_outline_blank'],
      [0xe86c,'materialicon_check_circle'],
      [0xe5cb,'materialicon_chevron_left'],
      [0xe5cc,'materialicon_chevron_right'],
      [0xeb41,'materialicon_child_care'],
      [0xeb42,'materialicon_child_friendly'],
      [0xe86d,'materialicon_chrome_reader_mode'],
      [0xe86e,'materialicon_class'],
      [0xe14c,'materialicon_clear'],
      [0xe0b8,'materialicon_clear_all'],
      [0xe5cd,'materialicon_close'],
      [0xe01c,'materialicon_closed_caption'],
      [0xe2bd,'materialicon_cloud'],
      [0xe2be,'materialicon_cloud_circle'],
      [0xe2bf,'materialicon_cloud_done'],
      [0xe2c0,'materialicon_cloud_download'],
      [0xe2c1,'materialicon_cloud_off'],
      [0xe2c2,'materialicon_cloud_queue'],
      [0xe2c3,'materialicon_cloud_upload'],
      [0xe86f,'materialicon_code'],
      [0xe3b6,'materialicon_collections'],
      [0xe431,'materialicon_collections_bookmark'],
      [0xe3b7,'materialicon_color_lens'],
      [0xe3b8,'materialicon_colorize'],
      [0xe0b9,'materialicon_comment'],
      [0xe3b9,'materialicon_compare'],
      [0xe915,'materialicon_compare_arrows'],
      [0xe30a,'materialicon_computer'],
      [0xe638,'materialicon_confirmation_number'],
      [0xe0d0,'materialicon_contact_mail'],
      [0xe0cf,'materialicon_contact_phone'],
      [0xe0ba,'materialicon_contacts'],
      [0xe14d,'materialicon_content_copy'],
      [0xe14e,'materialicon_content_cut'],
      [0xe14f,'materialicon_content_paste'],
      [0xe3ba,'materialicon_control_point'],
      [0xe3bb,'materialicon_control_point_duplicate'],
      [0xe90c,'materialicon_copyright'],
      [0xe150,'materialicon_create'],
      [0xe2cc,'materialicon_create_new_folder'],
      [0xe870,'materialicon_credit_card'],
      [0xe3be,'materialicon_crop'],
      [0xe3bc,'materialicon_crop_16_9'],
      [0xe3bd,'materialicon_crop_3_2'],
      [0xe3bf,'materialicon_crop_5_4'],
      [0xe3c0,'materialicon_crop_7_5'],
      [0xe3c1,'materialicon_crop_din'],
      [0xe3c2,'materialicon_crop_free'],
      [0xe3c3,'materialicon_crop_landscape'],
      [0xe3c4,'materialicon_crop_original'],
      [0xe3c5,'materialicon_crop_portrait'],
      [0xe437,'materialicon_crop_rotate'],
      [0xe3c6,'materialicon_crop_square'],
      [0xe871,'materialicon_dashboard'],
      [0xe1af,'materialicon_data_usage'],
      [0xe916,'materialicon_date_range'],
      [0xe3c7,'materialicon_dehaze'],
      [0xe872,'materialicon_delete'],
      [0xe92b,'materialicon_delete_forever'],
      [0xe16c,'materialicon_delete_sweep'],
      [0xe873,'materialicon_description'],
      [0xe30b,'materialicon_desktop_mac'],
      [0xe30c,'materialicon_desktop_windows'],
      [0xe3c8,'materialicon_details'],
      [0xe30d,'materialicon_developer_board'],
      [0xe1b0,'materialicon_developer_mode'],
      [0xe335,'materialicon_device_hub'],
      [0xe1b1,'materialicon_devices'],
      [0xe337,'materialicon_devices_other'],
      [0xe0bb,'materialicon_dialer_sip'],
      [0xe0bc,'materialicon_dialpad'],
      [0xe52e,'materialicon_directions'],
      [0xe52f,'materialicon_directions_bike'],
      [0xe532,'materialicon_directions_boat'],
      [0xe530,'materialicon_directions_bus'],
      [0xe531,'materialicon_directions_car'],
      [0xe534,'materialicon_directions_railway'],
      [0xe566,'materialicon_directions_run'],
      [0xe533,'materialicon_directions_subway'],
      [0xe535,'materialicon_directions_transit'],
      [0xe536,'materialicon_directions_walk'],
      [0xe610,'materialicon_disc_full'],
      [0xe875,'materialicon_dns'],
      [0xe612,'materialicon_do_not_disturb'],
      [0xe611,'materialicon_do_not_disturb_alt'],
      [0xe643,'materialicon_do_not_disturb_off'],
      [0xe644,'materialicon_do_not_disturb_on'],
      [0xe30e,'materialicon_dock'],
      [0xe7ee,'materialicon_domain'],
      [0xe876,'materialicon_done'],
      [0xe877,'materialicon_done_all'],
      [0xe917,'materialicon_donut_large'],
      [0xe918,'materialicon_donut_small'],
      [0xe151,'materialicon_drafts'],
      [0xe25d,'materialicon_drag_handle'],
      [0xe613,'materialicon_drive_eta'],
      [0xe1b2,'materialicon_dvr'],
      [0xe3c9,'materialicon_edit'],
      [0xe568,'materialicon_edit_location'],
      [0xe8fb,'materialicon_eject'],
      [0xe0be,'materialicon_email'],
      [0xe63f,'materialicon_enhanced_encryption'],
      [0xe01d,'materialicon_equalizer'],
      [0xe000,'materialicon_error'],
      [0xe001,'materialicon_error_outline'],
      [0xe926,'materialicon_euro_symbol'],
      [0xe56d,'materialicon_ev_station'],
      [0xe878,'materialicon_event'],
      [0xe614,'materialicon_event_available'],
      [0xe615,'materialicon_event_busy'],
      [0xe616,'materialicon_event_note'],
      [0xe903,'materialicon_event_seat'],
      [0xe879,'materialicon_exit_to_app'],
      [0xe5ce,'materialicon_expand_less'],
      [0xe5cf,'materialicon_expand_more'],
      [0xe01e,'materialicon_explicit'],
      [0xe87a,'materialicon_explore'],
      [0xe3ca,'materialicon_exposure'],
      [0xe3cb,'materialicon_exposure_neg_1'],
      [0xe3cc,'materialicon_exposure_neg_2'],
      [0xe3cd,'materialicon_exposure_plus_1'],
      [0xe3ce,'materialicon_exposure_plus_2'],
      [0xe3cf,'materialicon_exposure_zero'],
      [0xe87b,'materialicon_extension'],
      [0xe87c,'materialicon_face'],
      [0xe01f,'materialicon_fast_forward'],
      [0xe020,'materialicon_fast_rewind'],
      [0xe87d,'materialicon_favorite'],
      [0xe87e,'materialicon_favorite_border'],
      [0xe06d,'materialicon_featured_play_list'],
      [0xe06e,'materialicon_featured_video'],
      [0xe87f,'materialicon_feedback'],
      [0xe05d,'materialicon_fiber_dvr'],
      [0xe061,'materialicon_fiber_manual_record'],
      [0xe05e,'materialicon_fiber_new'],
      [0xe06a,'materialicon_fiber_pin'],
      [0xe062,'materialicon_fiber_smart_record'],
      [0xe2c4,'materialicon_file_download'],
      [0xe2c6,'materialicon_file_upload'],
      [0xe3d3,'materialicon_filter'],
      [0xe3d0,'materialicon_filter_1'],
      [0xe3d1,'materialicon_filter_2'],
      [0xe3d2,'materialicon_filter_3'],
      [0xe3d4,'materialicon_filter_4'],
      [0xe3d5,'materialicon_filter_5'],
      [0xe3d6,'materialicon_filter_6'],
      [0xe3d7,'materialicon_filter_7'],
      [0xe3d8,'materialicon_filter_8'],
      [0xe3d9,'materialicon_filter_9'],
      [0xe3da,'materialicon_filter_9_plus'],
      [0xe3db,'materialicon_filter_b_and_w'],
      [0xe3dc,'materialicon_filter_center_focus'],
      [0xe3dd,'materialicon_filter_drama'],
      [0xe3de,'materialicon_filter_frames'],
      [0xe3df,'materialicon_filter_hdr'],
      [0xe152,'materialicon_filter_list'],
      [0xe3e0,'materialicon_filter_none'],
      [0xe3e2,'materialicon_filter_tilt_shift'],
      [0xe3e3,'materialicon_filter_vintage'],
      [0xe880,'materialicon_find_in_page'],
      [0xe881,'materialicon_find_replace'],
      [0xe90d,'materialicon_fingerprint'],
      [0xe5dc,'materialicon_first_page'],
      [0xeb43,'materialicon_fitness_center'],
      [0xe153,'materialicon_flag'],
      [0xe3e4,'materialicon_flare'],
      [0xe3e5,'materialicon_flash_auto'],
      [0xe3e6,'materialicon_flash_off'],
      [0xe3e7,'materialicon_flash_on'],
      [0xe539,'materialicon_flight'],
      [0xe904,'materialicon_flight_land'],
      [0xe905,'materialicon_flight_takeoff'],
      [0xe3e8,'materialicon_flip'],
      [0xe882,'materialicon_flip_to_back'],
      [0xe883,'materialicon_flip_to_front'],
      [0xe2c7,'materialicon_folder'],
      [0xe2c8,'materialicon_folder_open'],
      [0xe2c9,'materialicon_folder_shared'],
      [0xe617,'materialicon_folder_special'],
      [0xe167,'materialicon_font_download'],
      [0xe234,'materialicon_format_align_center'],
      [0xe235,'materialicon_format_align_justify'],
      [0xe236,'materialicon_format_align_left'],
      [0xe237,'materialicon_format_align_right'],
      [0xe238,'materialicon_format_bold'],
      [0xe239,'materialicon_format_clear'],
      [0xe23a,'materialicon_format_color_fill'],
      [0xe23b,'materialicon_format_color_reset'],
      [0xe23c,'materialicon_format_color_text'],
      [0xe23d,'materialicon_format_indent_decrease'],
      [0xe23e,'materialicon_format_indent_increase'],
      [0xe23f,'materialicon_format_italic'],
      [0xe240,'materialicon_format_line_spacing'],
      [0xe241,'materialicon_format_list_bulleted'],
      [0xe242,'materialicon_format_list_numbered'],
      [0xe243,'materialicon_format_paint'],
      [0xe244,'materialicon_format_quote'],
      [0xe25e,'materialicon_format_shapes'],
      [0xe245,'materialicon_format_size'],
      [0xe246,'materialicon_format_strikethrough'],
      [0xe247,'materialicon_format_textdirection_l_to_r'],
      [0xe248,'materialicon_format_textdirection_r_to_l'],
      [0xe249,'materialicon_format_underlined'],
      [0xe0bf,'materialicon_forum'],
      [0xe154,'materialicon_forward'],
      [0xe056,'materialicon_forward_10'],
      [0xe057,'materialicon_forward_30'],
      [0xe058,'materialicon_forward_5'],
      [0xeb44,'materialicon_free_breakfast'],
      [0xe5d0,'materialicon_fullscreen'],
      [0xe5d1,'materialicon_fullscreen_exit'],
      [0xe24a,'materialicon_functions'],
      [0xe927,'materialicon_g_translate'],
      [0xe30f,'materialicon_gamepad'],
      [0xe021,'materialicon_games'],
      [0xe90e,'materialicon_gavel'],
      [0xe155,'materialicon_gesture'],
      [0xe884,'materialicon_get_app'],
      [0xe908,'materialicon_gif'],
      [0xeb45,'materialicon_golf_course'],
      [0xe1b3,'materialicon_gps_fixed'],
      [0xe1b4,'materialicon_gps_not_fixed'],
      [0xe1b5,'materialicon_gps_off'],
      [0xe885,'materialicon_grade'],
      [0xe3e9,'materialicon_gradient'],
      [0xe3ea,'materialicon_grain'],
      [0xe1b8,'materialicon_graphic_eq'],
      [0xe3eb,'materialicon_grid_off'],
      [0xe3ec,'materialicon_grid_on'],
      [0xe7ef,'materialicon_group'],
      [0xe7f0,'materialicon_group_add'],
      [0xe886,'materialicon_group_work'],
      [0xe052,'materialicon_hd'],
      [0xe3ed,'materialicon_hdr_off'],
      [0xe3ee,'materialicon_hdr_on'],
      [0xe3f1,'materialicon_hdr_strong'],
      [0xe3f2,'materialicon_hdr_weak'],
      [0xe310,'materialicon_headset'],
      [0xe311,'materialicon_headset_mic'],
      [0xe3f3,'materialicon_healing'],
      [0xe023,'materialicon_hearing'],
      [0xe887,'materialicon_help'],
      [0xe8fd,'materialicon_help_outline'],
      [0xe024,'materialicon_high_quality'],
      [0xe25f,'materialicon_highlight'],
      [0xe888,'materialicon_highlight_off'],
      [0xe889,'materialicon_history'],
      [0xe88a,'materialicon_home'],
      [0xeb46,'materialicon_hot_tub'],
      [0xe53a,'materialicon_hotel'],
      [0xe88b,'materialicon_hourglass_empty'],
      [0xe88c,'materialicon_hourglass_full'],
      [0xe902,'materialicon_http'],
      [0xe88d,'materialicon_https'],
      [0xe3f4,'materialicon_image'],
      [0xe3f5,'materialicon_image_aspect_ratio'],
      [0xe0e0,'materialicon_import_contacts'],
      [0xe0c3,'materialicon_import_export'],
      [0xe912,'materialicon_important_devices'],
      [0xe156,'materialicon_inbox'],
      [0xe909,'materialicon_indeterminate_check_box'],
      [0xe88e,'materialicon_info'],
      [0xe88f,'materialicon_info_outline'],
      [0xe890,'materialicon_input'],
      [0xe24b,'materialicon_insert_chart'],
      [0xe24c,'materialicon_insert_comment'],
      [0xe24d,'materialicon_insert_drive_file'],
      [0xe24e,'materialicon_insert_emoticon'],
      [0xe24f,'materialicon_insert_invitation'],
      [0xe250,'materialicon_insert_link'],
      [0xe251,'materialicon_insert_photo'],
      [0xe891,'materialicon_invert_colors'],
      [0xe0c4,'materialicon_invert_colors_off'],
      [0xe3f6,'materialicon_iso'],
      [0xe312,'materialicon_keyboard'],
      [0xe313,'materialicon_keyboard_arrow_down'],
      [0xe314,'materialicon_keyboard_arrow_left'],
      [0xe315,'materialicon_keyboard_arrow_right'],
      [0xe316,'materialicon_keyboard_arrow_up'],
      [0xe317,'materialicon_keyboard_backspace'],
      [0xe318,'materialicon_keyboard_capslock'],
      [0xe31a,'materialicon_keyboard_hide'],
      [0xe31b,'materialicon_keyboard_return'],
      [0xe31c,'materialicon_keyboard_tab'],
      [0xe31d,'materialicon_keyboard_voice'],
      [0xeb47,'materialicon_kitchen'],
      [0xe892,'materialicon_label'],
      [0xe893,'materialicon_label_outline'],
      [0xe3f7,'materialicon_landscape'],
      [0xe894,'materialicon_language'],
      [0xe31e,'materialicon_laptop'],
      [0xe31f,'materialicon_laptop_chromebook'],
      [0xe320,'materialicon_laptop_mac'],
      [0xe321,'materialicon_laptop_windows'],
      [0xe5dd,'materialicon_last_page'],
      [0xe895,'materialicon_launch'],
      [0xe53b,'materialicon_layers'],
      [0xe53c,'materialicon_layers_clear'],
      [0xe3f8,'materialicon_leak_add'],
      [0xe3f9,'materialicon_leak_remove'],
      [0xe3fa,'materialicon_lens'],
      [0xe02e,'materialicon_library_add'],
      [0xe02f,'materialicon_library_books'],
      [0xe030,'materialicon_library_music'],
      [0xe90f,'materialicon_lightbulb_outline'],
      [0xe919,'materialicon_line_style'],
      [0xe91a,'materialicon_line_weight'],
      [0xe260,'materialicon_linear_scale'],
      [0xe157,'materialicon_link'],
      [0xe438,'materialicon_linked_camera'],
      [0xe896,'materialicon_list'],
      [0xe0c6,'materialicon_live_help'],
      [0xe639,'materialicon_live_tv'],
      [0xe53f,'materialicon_local_activity'],
      [0xe53d,'materialicon_local_airport'],
      [0xe53e,'materialicon_local_atm'],
      [0xe540,'materialicon_local_bar'],
      [0xe541,'materialicon_local_cafe'],
      [0xe542,'materialicon_local_car_wash'],
      [0xe543,'materialicon_local_convenience_store'],
      [0xe556,'materialicon_local_dining'],
      [0xe544,'materialicon_local_drink'],
      [0xe545,'materialicon_local_florist'],
      [0xe546,'materialicon_local_gas_station'],
      [0xe547,'materialicon_local_grocery_store'],
      [0xe548,'materialicon_local_hospital'],
      [0xe549,'materialicon_local_hotel'],
      [0xe54a,'materialicon_local_laundry_service'],
      [0xe54b,'materialicon_local_library'],
      [0xe54c,'materialicon_local_mall'],
      [0xe54d,'materialicon_local_movies'],
      [0xe54e,'materialicon_local_offer'],
      [0xe54f,'materialicon_local_parking'],
      [0xe550,'materialicon_local_pharmacy'],
      [0xe551,'materialicon_local_phone'],
      [0xe552,'materialicon_local_pizza'],
      [0xe553,'materialicon_local_play'],
      [0xe554,'materialicon_local_post_office'],
      [0xe555,'materialicon_local_printshop'],
      [0xe557,'materialicon_local_see'],
      [0xe558,'materialicon_local_shipping'],
      [0xe559,'materialicon_local_taxi'],
      [0xe7f1,'materialicon_location_city'],
      [0xe1b6,'materialicon_location_disabled'],
      [0xe0c7,'materialicon_location_off'],
      [0xe0c8,'materialicon_location_on'],
      [0xe1b7,'materialicon_location_searching'],
      [0xe897,'materialicon_lock'],
      [0xe898,'materialicon_lock_open'],
      [0xe899,'materialicon_lock_outline'],
      [0xe3fc,'materialicon_looks'],
      [0xe3fb,'materialicon_looks_3'],
      [0xe3fd,'materialicon_looks_4'],
      [0xe3fe,'materialicon_looks_5'],
      [0xe3ff,'materialicon_looks_6'],
      [0xe400,'materialicon_looks_one'],
      [0xe401,'materialicon_looks_two'],
      [0xe028,'materialicon_loop'],
      [0xe402,'materialicon_loupe'],
      [0xe16d,'materialicon_low_priority'],
      [0xe89a,'materialicon_loyalty'],
      [0xe158,'materialicon_mail'],
      [0xe0e1,'materialicon_mail_outline'],
      [0xe55b,'materialicon_map'],
      [0xe159,'materialicon_markunread'],
      [0xe89b,'materialicon_markunread_mailbox'],
      [0xe322,'materialicon_memory'],
      [0xe5d2,'materialicon_menu'],
      [0xe252,'materialicon_merge_type'],
      [0xe0c9,'materialicon_message'],
      [0xe029,'materialicon_mic'],
      [0xe02a,'materialicon_mic_none'],
      [0xe02b,'materialicon_mic_off'],
      [0xe618,'materialicon_mms'],
      [0xe253,'materialicon_mode_comment'],
      [0xe254,'materialicon_mode_edit'],
      [0xe263,'materialicon_monetization_on'],
      [0xe25c,'materialicon_money_off'],
      [0xe403,'materialicon_monochrome_photos'],
      [0xe7f2,'materialicon_mood'],
      [0xe7f3,'materialicon_mood_bad'],
      [0xe619,'materialicon_more'],
      [0xe5d3,'materialicon_more_horiz'],
      [0xe5d4,'materialicon_more_vert'],
      [0xe91b,'materialicon_motorcycle'],
      [0xe323,'materialicon_mouse'],
      [0xe168,'materialicon_move_to_inbox'],
      [0xe02c,'materialicon_movie'],
      [0xe404,'materialicon_movie_creation'],
      [0xe43a,'materialicon_movie_filter'],
      [0xe6df,'materialicon_multiline_chart'],
      [0xe405,'materialicon_music_note'],
      [0xe063,'materialicon_music_video'],
      [0xe55c,'materialicon_my_location'],
      [0xe406,'materialicon_nature'],
      [0xe407,'materialicon_nature_people'],
      [0xe408,'materialicon_navigate_before'],
      [0xe409,'materialicon_navigate_next'],
      [0xe55d,'materialicon_navigation'],
      [0xe569,'materialicon_near_me'],
      [0xe1b9,'materialicon_network_cell'],
      [0xe640,'materialicon_network_check'],
      [0xe61a,'materialicon_network_locked'],
      [0xe1ba,'materialicon_network_wifi'],
      [0xe031,'materialicon_new_releases'],
      [0xe16a,'materialicon_next_week'],
      [0xe1bb,'materialicon_nfc'],
      [0xe641,'materialicon_no_encryption'],
      [0xe0cc,'materialicon_no_sim'],
      [0xe033,'materialicon_not_interested'],
      [0xe06f,'materialicon_note'],
      [0xe89c,'materialicon_note_add'],
      [0xe7f4,'materialicon_notifications'],
      [0xe7f7,'materialicon_notifications_active'],
      [0xe7f5,'materialicon_notifications_none'],
      [0xe7f6,'materialicon_notifications_off'],
      [0xe7f8,'materialicon_notifications_paused'],
      [0xe90a,'materialicon_offline_pin'],
      [0xe63a,'materialicon_ondemand_video'],
      [0xe91c,'materialicon_opacity'],
      [0xe89d,'materialicon_open_in_browser'],
      [0xe89e,'materialicon_open_in_new'],
      [0xe89f,'materialicon_open_with'],
      [0xe7f9,'materialicon_pages'],
      [0xe8a0,'materialicon_pageview'],
      [0xe40a,'materialicon_palette'],
      [0xe925,'materialicon_pan_tool'],
      [0xe40b,'materialicon_panorama'],
      [0xe40c,'materialicon_panorama_fish_eye'],
      [0xe40d,'materialicon_panorama_horizontal'],
      [0xe40e,'materialicon_panorama_vertical'],
      [0xe40f,'materialicon_panorama_wide_angle'],
      [0xe7fa,'materialicon_party_mode'],
      [0xe034,'materialicon_pause'],
      [0xe035,'materialicon_pause_circle_filled'],
      [0xe036,'materialicon_pause_circle_outline'],
      [0xe8a1,'materialicon_payment'],
      [0xe7fb,'materialicon_people'],
      [0xe7fc,'materialicon_people_outline'],
      [0xe8a2,'materialicon_perm_camera_mic'],
      [0xe8a3,'materialicon_perm_contact_calendar'],
      [0xe8a4,'materialicon_perm_data_setting'],
      [0xe8a5,'materialicon_perm_device_information'],
      [0xe8a6,'materialicon_perm_identity'],
      [0xe8a7,'materialicon_perm_media'],
      [0xe8a8,'materialicon_perm_phone_msg'],
      [0xe8a9,'materialicon_perm_scan_wifi'],
      [0xe7fd,'materialicon_person'],
      [0xe7fe,'materialicon_person_add'],
      [0xe7ff,'materialicon_person_outline'],
      [0xe55a,'materialicon_person_pin'],
      [0xe56a,'materialicon_person_pin_circle'],
      [0xe63b,'materialicon_personal_video'],
      [0xe91d,'materialicon_pets'],
      [0xe0cd,'materialicon_phone'],
      [0xe324,'materialicon_phone_android'],
      [0xe61b,'materialicon_phone_bluetooth_speaker'],
      [0xe61c,'materialicon_phone_forwarded'],
      [0xe61d,'materialicon_phone_in_talk'],
      [0xe325,'materialicon_phone_iphone'],
      [0xe61e,'materialicon_phone_locked'],
      [0xe61f,'materialicon_phone_missed'],
      [0xe620,'materialicon_phone_paused'],
      [0xe326,'materialicon_phonelink'],
      [0xe0db,'materialicon_phonelink_erase'],
      [0xe0dc,'materialicon_phonelink_lock'],
      [0xe327,'materialicon_phonelink_off'],
      [0xe0dd,'materialicon_phonelink_ring'],
      [0xe0de,'materialicon_phonelink_setup'],
      [0xe410,'materialicon_photo'],
      [0xe411,'materialicon_photo_album'],
      [0xe412,'materialicon_photo_camera'],
      [0xe43b,'materialicon_photo_filter'],
      [0xe413,'materialicon_photo_library'],
      [0xe432,'materialicon_photo_size_select_actual'],
      [0xe433,'materialicon_photo_size_select_large'],
      [0xe434,'materialicon_photo_size_select_small'],
      [0xe415,'materialicon_picture_as_pdf'],
      [0xe8aa,'materialicon_picture_in_picture'],
      [0xe911,'materialicon_picture_in_picture_alt'],
      [0xe6c4,'materialicon_pie_chart'],
      [0xe6c5,'materialicon_pie_chart_outlined'],
      [0xe55e,'materialicon_pin_drop'],
      [0xe55f,'materialicon_place'],
      [0xe037,'materialicon_play_arrow'],
      [0xe038,'materialicon_play_circle_filled'],
      [0xe039,'materialicon_play_circle_outline'],
      [0xe906,'materialicon_play_for_work'],
      [0xe03b,'materialicon_playlist_add'],
      [0xe065,'materialicon_playlist_add_check'],
      [0xe05f,'materialicon_playlist_play'],
      [0xe800,'materialicon_plus_one'],
      [0xe801,'materialicon_poll'],
      [0xe8ab,'materialicon_polymer'],
      [0xeb48,'materialicon_pool'],
      [0xe0ce,'materialicon_portable_wifi_off'],
      [0xe416,'materialicon_portrait'],
      [0xe63c,'materialicon_power'],
      [0xe336,'materialicon_power_input'],
      [0xe8ac,'materialicon_power_settings_new'],
      [0xe91e,'materialicon_pregnant_woman'],
      [0xe0df,'materialicon_present_to_all'],
      [0xe8ad,'materialicon_print'],
      [0xe645,'materialicon_priority_high'],
      [0xe80b,'materialicon_public'],
      [0xe255,'materialicon_publish'],
      [0xe8ae,'materialicon_query_builder'],
      [0xe8af,'materialicon_question_answer'],
      [0xe03c,'materialicon_queue'],
      [0xe03d,'materialicon_queue_music'],
      [0xe066,'materialicon_queue_play_next'],
      [0xe03e,'materialicon_radio'],
      [0xe837,'materialicon_radio_button_checked'],
      [0xe836,'materialicon_radio_button_unchecked'],
      [0xe560,'materialicon_rate_review'],
      [0xe8b0,'materialicon_receipt'],
      [0xe03f,'materialicon_recent_actors'],
      [0xe91f,'materialicon_record_voice_over'],
      [0xe8b1,'materialicon_redeem'],
      [0xe15a,'materialicon_redo'],
      [0xe5d5,'materialicon_refresh'],
      [0xe15b,'materialicon_remove'],
      [0xe15c,'materialicon_remove_circle'],
      [0xe15d,'materialicon_remove_circle_outline'],
      [0xe067,'materialicon_remove_from_queue'],
      [0xe417,'materialicon_remove_red_eye'],
      [0xe928,'materialicon_remove_shopping_cart'],
      [0xe8fe,'materialicon_reorder'],
      [0xe040,'materialicon_repeat'],
      [0xe041,'materialicon_repeat_one'],
      [0xe042,'materialicon_replay'],
      [0xe059,'materialicon_replay_10'],
      [0xe05a,'materialicon_replay_30'],
      [0xe05b,'materialicon_replay_5'],
      [0xe15e,'materialicon_reply'],
      [0xe15f,'materialicon_reply_all'],
      [0xe160,'materialicon_report'],
      [0xe8b2,'materialicon_report_problem'],
      [0xe56c,'materialicon_restaurant'],
      [0xe561,'materialicon_restaurant_menu'],
      [0xe8b3,'materialicon_restore'],
      [0xe929,'materialicon_restore_page'],
      [0xe0d1,'materialicon_ring_volume'],
      [0xe8b4,'materialicon_room'],
      [0xeb49,'materialicon_room_service'],
      [0xe418,'materialicon_rotate_90_degrees_ccw'],
      [0xe419,'materialicon_rotate_left'],
      [0xe41a,'materialicon_rotate_right'],
      [0xe920,'materialicon_rounded_corner'],
      [0xe328,'materialicon_router'],
      [0xe921,'materialicon_rowing'],
      [0xe0e5,'materialicon_rss_feed'],
      [0xe642,'materialicon_rv_hookup'],
      [0xe562,'materialicon_satellite'],
      [0xe161,'materialicon_save'],
      [0xe329,'materialicon_scanner'],
      [0xe8b5,'materialicon_schedule'],
      [0xe80c,'materialicon_school'],
      [0xe1be,'materialicon_screen_lock_landscape'],
      [0xe1bf,'materialicon_screen_lock_portrait'],
      [0xe1c0,'materialicon_screen_lock_rotation'],
      [0xe1c1,'materialicon_screen_rotation'],
      [0xe0e2,'materialicon_screen_share'],
      [0xe623,'materialicon_sd_card'],
      [0xe1c2,'materialicon_sd_storage'],
      [0xe8b6,'materialicon_search'],
      [0xe32a,'materialicon_security'],
      [0xe162,'materialicon_select_all'],
      [0xe163,'materialicon_send'],
      [0xe811,'materialicon_sentiment_dissatisfied'],
      [0xe812,'materialicon_sentiment_neutral'],
      [0xe813,'materialicon_sentiment_satisfied'],
      [0xe814,'materialicon_sentiment_very_dissatisfied'],
      [0xe815,'materialicon_sentiment_very_satisfied'],
      [0xe8b8,'materialicon_settings'],
      [0xe8b9,'materialicon_settings_applications'],
      [0xe8ba,'materialicon_settings_backup_restore'],
      [0xe8bb,'materialicon_settings_bluetooth'],
      [0xe8bd,'materialicon_settings_brightness'],
      [0xe8bc,'materialicon_settings_cell'],
      [0xe8be,'materialicon_settings_ethernet'],
      [0xe8bf,'materialicon_settings_input_antenna'],
      [0xe8c0,'materialicon_settings_input_component'],
      [0xe8c1,'materialicon_settings_input_composite'],
      [0xe8c2,'materialicon_settings_input_hdmi'],
      [0xe8c3,'materialicon_settings_input_svideo'],
      [0xe8c4,'materialicon_settings_overscan'],
      [0xe8c5,'materialicon_settings_phone'],
      [0xe8c6,'materialicon_settings_power'],
      [0xe8c7,'materialicon_settings_remote'],
      [0xe1c3,'materialicon_settings_system_daydream'],
      [0xe8c8,'materialicon_settings_voice'],
      [0xe80d,'materialicon_share'],
      [0xe8c9,'materialicon_shop'],
      [0xe8ca,'materialicon_shop_two'],
      [0xe8cb,'materialicon_shopping_basket'],
      [0xe8cc,'materialicon_shopping_cart'],
      [0xe261,'materialicon_short_text'],
      [0xe6e1,'materialicon_show_chart'],
      [0xe043,'materialicon_shuffle'],
      [0xe1c8,'materialicon_signal_cellular_4_bar'],
      [0xe1cd,'materialicon_signal_cellular_connected_no_internet_4_bar'],
      [0xe1ce,'materialicon_signal_cellular_no_sim'],
      [0xe1cf,'materialicon_signal_cellular_null'],
      [0xe1d0,'materialicon_signal_cellular_off'],
      [0xe1d8,'materialicon_signal_wifi_4_bar'],
      [0xe1d9,'materialicon_signal_wifi_4_bar_lock'],
      [0xe1da,'materialicon_signal_wifi_off'],
      [0xe32b,'materialicon_sim_card'],
      [0xe624,'materialicon_sim_card_alert'],
      [0xe044,'materialicon_skip_next'],
      [0xe045,'materialicon_skip_previous'],
      [0xe41b,'materialicon_slideshow'],
      [0xe068,'materialicon_slow_motion_video'],
      [0xe32c,'materialicon_smartphone'],
      [0xeb4a,'materialicon_smoke_free'],
      [0xeb4b,'materialicon_smoking_rooms'],
      [0xe625,'materialicon_sms'],
      [0xe626,'materialicon_sms_failed'],
      [0xe046,'materialicon_snooze'],
      [0xe164,'materialicon_sort'],
      [0xe053,'materialicon_sort_by_alpha'],
      [0xeb4c,'materialicon_spa'],
      [0xe256,'materialicon_space_bar'],
      [0xe32d,'materialicon_speaker'],
      [0xe32e,'materialicon_speaker_group'],
      [0xe8cd,'materialicon_speaker_notes'],
      [0xe92a,'materialicon_speaker_notes_off'],
      [0xe0d2,'materialicon_speaker_phone'],
      [0xe8ce,'materialicon_spellcheck'],
      [0xe838,'materialicon_star'],
      [0xe83a,'materialicon_star_border'],
      [0xe839,'materialicon_star_half'],
      [0xe8d0,'materialicon_stars'],
      [0xe0d3,'materialicon_stay_current_landscape'],
      [0xe0d4,'materialicon_stay_current_portrait'],
      [0xe0d5,'materialicon_stay_primary_landscape'],
      [0xe0d6,'materialicon_stay_primary_portrait'],
      [0xe047,'materialicon_stop'],
      [0xe0e3,'materialicon_stop_screen_share'],
      [0xe1db,'materialicon_storage'],
      [0xe8d1,'materialicon_store'],
      [0xe563,'materialicon_store_mall_directory'],
      [0xe41c,'materialicon_straighten'],
      [0xe56e,'materialicon_streetview'],
      [0xe257,'materialicon_strikethrough_s'],
      [0xe41d,'materialicon_style'],
      [0xe5d9,'materialicon_subdirectory_arrow_left'],
      [0xe5da,'materialicon_subdirectory_arrow_right'],
      [0xe8d2,'materialicon_subject'],
      [0xe064,'materialicon_subscriptions'],
      [0xe048,'materialicon_subtitles'],
      [0xe56f,'materialicon_subway'],
      [0xe8d3,'materialicon_supervisor_account'],
      [0xe049,'materialicon_surround_sound'],
      [0xe0d7,'materialicon_swap_calls'],
      [0xe8d4,'materialicon_swap_horiz'],
      [0xe8d5,'materialicon_swap_vert'],
      [0xe8d6,'materialicon_swap_vertical_circle'],
      [0xe41e,'materialicon_switch_camera'],
      [0xe41f,'materialicon_switch_video'],
      [0xe627,'materialicon_sync'],
      [0xe628,'materialicon_sync_disabled'],
      [0xe629,'materialicon_sync_problem'],
      [0xe62a,'materialicon_system_update'],
      [0xe8d7,'materialicon_system_update_alt'],
      [0xe8d8,'materialicon_tab'],
      [0xe8d9,'materialicon_tab_unselected'],
      [0xe32f,'materialicon_tablet'],
      [0xe330,'materialicon_tablet_android'],
      [0xe331,'materialicon_tablet_mac'],
      [0xe420,'materialicon_tag_faces'],
      [0xe62b,'materialicon_tap_and_play'],
      [0xe564,'materialicon_terrain'],
      [0xe262,'materialicon_text_fields'],
      [0xe165,'materialicon_text_format'],
      [0xe0d8,'materialicon_textsms'],
      [0xe421,'materialicon_texture'],
      [0xe8da,'materialicon_theaters'],
      [0xe8db,'materialicon_thumb_down'],
      [0xe8dc,'materialicon_thumb_up'],
      [0xe8dd,'materialicon_thumbs_up_down'],
      [0xe62c,'materialicon_time_to_leave'],
      [0xe422,'materialicon_timelapse'],
      [0xe922,'materialicon_timeline'],
      [0xe425,'materialicon_timer'],
      [0xe423,'materialicon_timer_10'],
      [0xe424,'materialicon_timer_3'],
      [0xe426,'materialicon_timer_off'],
      [0xe264,'materialicon_title'],
      [0xe8de,'materialicon_toc'],
      [0xe8df,'materialicon_today'],
      [0xe8e0,'materialicon_toll'],
      [0xe427,'materialicon_tonality'],
      [0xe913,'materialicon_touch_app'],
      [0xe332,'materialicon_toys'],
      [0xe8e1,'materialicon_track_changes'],
      [0xe565,'materialicon_traffic'],
      [0xe570,'materialicon_train'],
      [0xe571,'materialicon_tram'],
      [0xe572,'materialicon_transfer_within_a_station'],
      [0xe428,'materialicon_transform'],
      [0xe8e2,'materialicon_translate'],
      [0xe8e3,'materialicon_trending_down'],
      [0xe8e4,'materialicon_trending_flat'],
      [0xe8e5,'materialicon_trending_up'],
      [0xe429,'materialicon_tune'],
      [0xe8e6,'materialicon_turned_in'],
      [0xe8e7,'materialicon_turned_in_not'],
      [0xe333,'materialicon_tv'],
      [0xe169,'materialicon_unarchive'],
      [0xe166,'materialicon_undo'],
      [0xe5d6,'materialicon_unfold_less'],
      [0xe5d7,'materialicon_unfold_more'],
      [0xe923,'materialicon_update'],
      [0xe1e0,'materialicon_usb'],
      [0xe8e8,'materialicon_verified_user'],
      [0xe258,'materialicon_vertical_align_bottom'],
      [0xe259,'materialicon_vertical_align_center'],
      [0xe25a,'materialicon_vertical_align_top'],
      [0xe62d,'materialicon_vibration'],
      [0xe070,'materialicon_video_call'],
      [0xe071,'materialicon_video_label'],
      [0xe04a,'materialicon_video_library'],
      [0xe04b,'materialicon_videocam'],
      [0xe04c,'materialicon_videocam_off'],
      [0xe338,'materialicon_videogame_asset'],
      [0xe8e9,'materialicon_view_agenda'],
      [0xe8ea,'materialicon_view_array'],
      [0xe8eb,'materialicon_view_carousel'],
      [0xe8ec,'materialicon_view_column'],
      [0xe42a,'materialicon_view_comfy'],
      [0xe42b,'materialicon_view_compact'],
      [0xe8ed,'materialicon_view_day'],
      [0xe8ee,'materialicon_view_headline'],
      [0xe8ef,'materialicon_view_list'],
      [0xe8f0,'materialicon_view_module'],
      [0xe8f1,'materialicon_view_quilt'],
      [0xe8f2,'materialicon_view_stream'],
      [0xe8f3,'materialicon_view_week'],
      [0xe435,'materialicon_vignette'],
      [0xe8f4,'materialicon_visibility'],
      [0xe8f5,'materialicon_visibility_off'],
      [0xe62e,'materialicon_voice_chat'],
      [0xe0d9,'materialicon_voicemail'],
      [0xe04d,'materialicon_volume_down'],
      [0xe04e,'materialicon_volume_mute'],
      [0xe04f,'materialicon_volume_off'],
      [0xe050,'materialicon_volume_up'],
      [0xe0da,'materialicon_vpn_key'],
      [0xe62f,'materialicon_vpn_lock'],
      [0xe1bc,'materialicon_wallpaper'],
      [0xe002,'materialicon_warning'],
      [0xe334,'materialicon_watch'],
      [0xe924,'materialicon_watch_later'],
      [0xe42c,'materialicon_wb_auto'],
      [0xe42d,'materialicon_wb_cloudy'],
      [0xe42e,'materialicon_wb_incandescent'],
      [0xe436,'materialicon_wb_iridescent'],
      [0xe430,'materialicon_wb_sunny'],
      [0xe63d,'materialicon_wc'],
      [0xe051,'materialicon_web'],
      [0xe069,'materialicon_web_asset'],
      [0xe16b,'materialicon_weekend'],
      [0xe80e,'materialicon_whatshot'],
      [0xe1bd,'materialicon_widgets'],
      [0xe63e,'materialicon_wifi'],
      [0xe1e1,'materialicon_wifi_lock'],
      [0xe1e2,'materialicon_wifi_tethering'],
      [0xe8f9,'materialicon_work'],
      [0xe25b,'materialicon_wrap_text'],
      [0xe8fa,'materialicon_youtube_searched_for'],
      [0xe8ff,'materialicon_zoom_in'],
      [0xe900,'materialicon_zoom_out'],
      [0xe56b,'materialicon_zoom_out_map'],
    ];
  }
}
},{"./component/tinyMceComponentPlugin":18,"./jsHarmonyCMS.Editor.Picker.js":25}],27:[function(require,module,exports){
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

exports = module.exports = function(cms){
  var _this = this;
  this.loadQueue = [];
  this.isLoading = false;
  this.defaultLoadObj = {main:1};

  this.onSquashedClick = [];
  this.onMouseDown = [];
  this.onMouseUp = [];
  
  this.StartLoading = function(obj){
    if(!obj) obj = _this.defaultLoadObj;
    
    var foundObj = false;
    for(var i=0;i<this.loadQueue.length;i++){ if(obj===this.loadQueue[i]) foundObj = true; }
    if(!foundObj) this.loadQueue.push(obj);

    if(this.isLoading) return;
    this.isLoading = true;

    var loader_obj = document.getElementById('jsHarmonyCMSLoading')

    if(loader_obj){
      if(cms.isInitialized) loader_obj.style.backgroundColor = 'rgba(0,0,0,0.2)';
      if(cms.jsh) cms.jsh.$('#jsHarmonyCMSLoading').fadeIn();
      else loader_obj.style.display = 'block';
    }
    else {
      var loader_obj = document.createElement('div');
      loader_obj.id = 'jsHarmonyCMSLoading';
      //loader_obj.style.backgroundColor = 'rgba(0,0,0,0.5)';
      loader_obj.style.backgroundColor = 'rgba(255,255,255,1)';
      loader_obj.style.position = 'fixed';
      loader_obj.style.top = '0px';
      loader_obj.style.left = '0px';
      loader_obj.style.bottom = '0px';
      loader_obj.style.width = '100%';
      loader_obj.style.zIndex = 2147483642;
      loader_obj.style.cursor = 'wait';
      document.body.appendChild(loader_obj);

      var loader_img_container = document.createElement('div');
      loader_img_container.style.position = 'absolute';
      loader_img_container.style.top = '50%';
      loader_img_container.style.left = '50%';
      loader_obj.appendChild(loader_img_container);

      var loader_img = document.createElement('img');
      loader_img.src = cms._baseurl + 'images/loading-cms.svg';
      loader_img.style.height = '100px';
      loader_img.style.width = '100px';
      loader_img.style.position = 'relative';
      loader_img.style.top = '-50px';
      loader_img.style.left = '-50px';
      loader_img_container.appendChild(loader_img);
    }
  }

  this.StopLoading = function(obj){
    if(!obj) obj = _this.defaultLoadObj;

    for(var i=0;i<this.loadQueue.length;i++){ if(obj===this.loadQueue[i]){ this.loadQueue.splice(i, 1); i--; } }
    if(this.loadQueue.length) return;

    this.isLoading = false;
    if(cms.jsh) cms.jsh.$('#jsHarmonyCMSLoading').stop(true).fadeOut();
    else document.getElementById('jsHarmonyCMSLoading').style.display = 'none';
  }

  this.ClearLoading = function(){
    this.loadQueue = [];
    this.StopLoading();
  }
}
},{}],28:[function(require,module,exports){
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

exports = module.exports = function(jsh, cms){
  var _this = this;
  var $ = jsh.$;
  var XExt = jsh.XExt;
  var async = jsh.async;
  var ejs = jsh.ejs;

  this.menuTemplates = {};
  this.isInitialized = false;

  this.load = function(onComplete){
    var url = '../_funcs/templates/menu/'+cms.branch_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.menuTemplates = rslt.menuTemplates;
        async.eachOf(_this.menuTemplates, function(menu, menu_template_id, menu_cb){
          async.eachOf(menu.content_elements, function(content_element, content_element_name, content_element_cb){
            if(!content_element.remote_template) return content_element_cb();

            //Load remote menu templates
            var loadObj = {};
            cms.loader.StartLoading(loadObj);
            $.ajax({
              type: 'GET',
              cache: false,
              url: content_element.remote_template,
              xhrFields: { withCredentials: true },
              success: function(data){
                cms.loader.StopLoading(loadObj);
                content_element.template = (content_element.template||'')+data;
                return content_element_cb();
              },
              error: function(xhr, status, err){
                cms.loader.StopLoading(loadObj);
                content_element.template = '*** ERROR DOWNLOADING REMOTE MENU ***';
                return content_element_cb();
              }
            });
          }, menu_cb);
        }, function(err){
          _this.isInitialized = true;
        });
      }
      else{
        if(onComplete) onComplete(new Error('Error Loading Menus'));
        XExt.Alert('Error loading menus');
      }
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  };

  this.render = function(){
    $('.jsharmony_cms_menu').addClass('mceNonEditable').each(function(){
      var jobj = $(this);
      var menu_tag = jobj.data('menu_tag');
      var content_element_name = jobj.data('menu_content_element');
      var menu_content = '';
      if(!menu_tag) menu_content = '*** MENU MISSING data-menu_tag ATTRIBUTE ***';
      else if(!content_element_name) menu_content = '*** MENU MISSING data-menu_content_element ATTRIBUTE ***';
      else if(!(menu_tag in cms.controller.menus)) menu_content = '*** MISSING MENU DATA FOR MENU TAG ' + menu_tag+' ***';
      else {
        var menu = cms.controller.menus[menu_tag];
        var menuTemplate = _this.menuTemplates[menu.menu_template_id];
        if(!menuTemplate) menu_content = '*** MENU TEMPLATE NOT FOUND: ' + menu.menu_template_id+' ***';
        else if(!(content_element_name in menuTemplate.content_elements)) menu_content = '*** MENU ' + menu.menu_template_id + ' CONTENT ELEMENT NOT DEFINED: ' + content_element_name+' ***';
        else{
          var content_element = menuTemplate.content_elements[content_element_name];
          menu_content = ejs.render(content_element.template || '', cms.controller.getMenuRenderParameters(menu_tag));
        }
      }
      jobj.html(menu_content);
    });
  }
}
},{}],29:[function(require,module,exports){
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

exports = module.exports = function(jsh, cms){
  var _this = this;
  var $ = jsh.$;

  this.editorBarDocked = false;
  this.origMarginTop = undefined;
 
  this.render = function(){
    cms.util.addStyle('jsharmony_cms_editor_css',cms.views['jsh_cms_editor.css']);
    jsh.root.append(cms.views['jsh_cms_editor']);
    this.origMarginTop = $('body').css('margin-top');
    this.toggleAutoHide(false);
    jsh.InitControls();
  }

  this.toggleAutoHide = function(val){
    if(typeof val =='undefined') val = !this.editorBarDocked;
    this.editorBarDocked = !!val;

    if(this.editorBarDocked){
      $('body').css('margin-top', this.origMarginTop);
    }
    else {
      var barHeight = $('#jsharmony_cms_editor_bar .actions').outerHeight();
      $('body').css('margin-top', barHeight+'px');
    }
    $('#jsharmony_cms_editor_bar .autoHideEditorBar').toggleClass('enabled',!val);
  }
  
  this.toggleSettings = function(display, noSlide){
    var jbutton = $('#jsharmony_cms_editor_bar .button.settings');
    var prevdisplay = !!jbutton.hasClass('selected');
    if(typeof display == 'undefined') display = !prevdisplay;
    
    if(prevdisplay==display) return;
    else {
      var jsettings = $('#jsharmony_cms_editor_bar .page_settings');
      if(display){
        //Open
        jbutton.addClass('selected');
        jsettings.stop(true);
        if(noSlide) jsettings.show();
        else jsettings.slideDown();
      }
      else {
        //Close
        if(!cms.controller.validate()) return;
        jbutton.removeClass('selected');
        jsettings.stop(true);
        if(noSlide) jsettings.hide();
        else jsettings.slideUp();
      }
    }
  }

  this.showSettings = function(noSlide){ this.toggleSettings(true, noSlide); }

  this.hideSettings = function(noSlide){ this.toggleSettings(false, noSlide); }


}
},{}],30:[function(require,module,exports){
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

exports = module.exports = function(){
  
  this.setHTML = function(jobj, html){
    try{
      jobj.html(html);
    }
    catch(ex){
      console.log(ex);
    }
  }

  this.appendHTML = function(jobj, html){
    try{
      jobj.append(html);
    }
    catch(ex){
      console.log(ex);
    }
  }

  this.refreshParentPageTree = function(page_folder, page_key){
    if(window.opener){
      window.opener.postMessage('jsharmony-cms:refresh_page_folder:'+page_folder, '*');
      if(page_key) window.opener.postMessage('jsharmony-cms:refresh_page_key:'+page_key, '*');
    }
  }

  this.disableControl = function(jctrl){
    jctrl.removeClass('editable');
    jctrl.addClass('uneditable');

    if (jctrl.hasClass('dropdown')) jctrl.prop('disabled', true);
    else if (jctrl.hasClass('checkbox')) jctrl.prop('disabled', true);
    else if(jctrl.hasClass('xtagbox_base')){
      jctrl.prev().addClass('uneditable');
      jctrl.prev().find('input').prop('disabled', true);
    }
    else jctrl.prop('readonly', true);
  }

  this.loadScript = function(url, cb){
    var script = document.createElement('script');
    if(cb) script.onload = cb;
    script.src = url;
    document.head.appendChild(script);
  }

  this.loadCSS = function(url, cb){
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.media = 'all';
    document.head.appendChild(link);
  }

  this.addStyle = function(id, css){
    var style = document.createElement('style');
    style.type = 'text/css';
    style.media = 'all';
    style.id = id;
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  this.removeStyle = function(id){
    var elem = document.getElementById(id);
    if(elem) elem.parentNode.removeChild(elem);
  }
}
},{}],31:[function(require,module,exports){
(function (global){
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

var jsHarmonyCMSUtil = require('./jsHarmonyCMS.Util.js');
var jsHarmonyCMSLoader = require('./jsHarmonyCMS.Loader.js');
var jsHarmonyCMSToolbar = require('./jsHarmonyCMS.Toolbar.js');
var jsHarmonyCMSController = require('./jsHarmonyCMS.Controller.js');
var jsHarmonyCMSEditor = require('./jsHarmonyCMS.Editor.js');
var jsHarmonyCMSEditorPicker = require('./jsHarmonyCMS.Editor.Picker.js');
var jsHarmonyCMSComponentManager = require('./jsHarmonyCMS.ComponentManager.js');
var jsHarmonyCMSMenuController = require('./jsHarmonyCMS.MenuController.js');

var jsHarmonyCMS = function(options){
  var _this = this;

  this._instance = '';
  this.App = {}; //Variable data store for implementations

  this.loader = new jsHarmonyCMSLoader(this);
  this.util = new jsHarmonyCMSUtil(this);
  this.toolbar = undefined; //Loaded after init
  this.controller = undefined; //Loaded after init
  this.editor = undefined; //Loaded after init
  this.componentManager = undefined; // Loaded after init
  this.menuController = undefined; //Loaded after init
  this.views = {
    'jsh_cms_editor.css': '',
    'jsh_cms_editor': '',
  };


  this.jsh = undefined;
  this._baseurl = '<%-Helper.escapeJS(baseurl)%>';
  this._cookie_suffix = '<%-Helper.escapeJS(cookie_suffix)%>';
  this.readonly = false;
  this.isInitialized = false;
  this.defaultControllerUrl = 'js/jsHarmonyCMS.Controller.page.js';

  this.branch_id = undefined;
  this.filePickerCallback = null;        //function(url)

  this.onInit = null;                    //function(jsh)
  this.onLoad = null;                    //function(jsh)
  this.onLoaded = null;                  //function(jsh)
  this.onGetControllerUrl = null;        //function() => url
  this.onFilePickerCallback = null;      //function(jdata)
  this.onGetFilePickerParameters = null; //function(filePickerType, url)
  this.onApplyProperties = null;         //function(page)
  this.onTemplateLoaded = function(f){ $(document).ready(f); }

  for(var key in options){
    if(key in _this) _this[key] = options[key];
  }


  var loader = _this.loader;
  var util = _this.util;
  var jsh = null;
  var XExt = null;
  var $ = null;
  var async = null;


  this.init = function(){
    loader.StartLoading();
    //Load jsHarmony
    util.loadScript(_this._baseurl+'js/jsHarmony.js', function(){
      var jshInit = false;
      jsh = _this.jsh = window.jshInstance = new jsHarmony({
        _debug: true,
        _BASEURL: _this._baseurl,
        _PUBLICURL: _this._baseurl,
        forcequery: {},
        home_url: _this._baseurl,
        uimap: {"code_val":"code_val","code_txt":"code_txt","code_parent_id":"code_parent_id","code_icon":"code_icon","code_id":"code_id","code_parent":"code_parent","code_seq":"code_seq","code_type":"code_type"},
        _instance: "jshInstance",
        cookie_suffix: _this._cookie_suffix,
        isAuthenticated: true,
        dev: 1,
        urlrouting: false,
        onInit: function(){
          jshInit = true;
        }
      });
      $ = jsh.$;
      XExt = jsh.XExt;
      async = jsh.async;

      _this.toolbar = new jsHarmonyCMSToolbar(jsh, _this);
      _this.controller = new jsHarmonyCMSController(jsh, _this);
      _this.editor = _this.createCoreEditor()
      _this.componentManager = new jsHarmonyCMSComponentManager(jsh, _this);

      if(_this.onInit) _this.onInit(jsh);

      var controllerUrl = '';
      if(_this.onGetControllerUrl) controllerUrl = _this.onGetControllerUrl();
      if(!controllerUrl) controllerUrl = _this._baseurl + _this.defaultControllerUrl;

      _this.menuController = new jsHarmonyCMSMenuController(jsh, _this);

      jsh.xLoader = loader;
      async.parallel([
        function(cb){ util.loadScript(_this._baseurl+'application.js', function(){ cb(); }); },
        function(cb){ util.loadScript(_this._baseurl+'js/site.js', function(){ cb(); }); },
        function(cb){ util.loadScript(_this._baseurl+'js/jsHarmony.render.js', function(){
          jsh.Config.debug_params.monitor_globals = false;
          cb();
        }); },
        function(cb){ util.loadScript(controllerUrl, function(){ return cb(); }); },
        function(cb){ XExt.waitUntil(function(){ return jshInit; }, function(){ cb(); }, undefined, 50); },
      ], function(err){
        setTimeout(function(){ _this.load(); }, 1);
      });
    });
    util.loadCSS(_this._baseurl+'jsharmony.css');
    util.loadCSS(_this._baseurl+'application.css?rootcss=.jsharmony_cms');
    util.loadScript('https://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js', function(){
      WebFont.load({ google: { families: ['PT Sans', 'Roboto', 'Roboto:bold', 'Material Icons'] } });
    });
    window.addEventListener('message', this.onmessage);
  }

  this.load = function(){
    if(_this.onLoad) _this.onLoad(jsh);
    $('.jsharmony_cms_content').prop('contenteditable','true');
    if(jsh._GET['branch_id']){
      _this.branch_id = jsh._GET['branch_id'];
      this.componentManager.load();
      this.menuController.load();
    }
    else{
      loader.StopLoading();
      XExt.Alert('Site ID not defined in querystring');
    }
    _this.controller.init(function(err){
      if(!err){
        if(_this.onLoaded) _this.onLoaded(jsh);
      }
    });
  }

  this.refreshLayout = function(){
    var ww = $(window).width();
    var wh = $(window).height();
    var sleft = $(window).scrollLeft();
    var stop = $(window).scrollTop();
    var docw = $(document).width();
    var doch = $(document).height();
    var pw = ((docw > ww) ? docw : ww);
    var ph = ((doch > wh) ? doch : wh);
    var barh = $('#jsharmony_cms_editor_bar .actions').outerHeight();
    $('#jsharmony_cms_editor_bar .page_settings').css('max-height', (wh-barh)+'px');

    var toolbarTop = 37;
    $('#jsharmony_cms_content_editor_toolbar').css('top', toolbarTop+'px');
  }

  this.onmessage = function(event){
    var data = (event.data || '').toString();
    if(_this.editor && _this.editor.picker && _this.editor.picker.onmessage(event, data)) return;
  }

  this.createCoreEditor = function() {
    var el = $('<div id="jsharmony_cms_content_editor_toolbar"></div>').prependTo('body');
    return new jsHarmonyCMSEditor(jsh, _this, el[0]);
  }

  this.createJsHarmonyCMSEditor = function(toolbarElement) {
    return new jsHarmonyCMSEditor(jsh, _this, toolbarElement);
  }

  this.createJsHarmonyCMSEditorPicker = function(editor) {
    return new jsHarmonyCMSEditorPicker(jsh, _this, editor);
  }

  //Run Init
  _this.init();
}

global.jsHarmonyCMS = jsHarmonyCMS;
global.jsHarmonyCMSInstance = new jsHarmonyCMS({ _instance: 'jsHarmonyCMSInstance' });
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./jsHarmonyCMS.ComponentManager.js":23,"./jsHarmonyCMS.Controller.js":24,"./jsHarmonyCMS.Editor.Picker.js":25,"./jsHarmonyCMS.Editor.js":26,"./jsHarmonyCMS.Loader.js":27,"./jsHarmonyCMS.MenuController.js":28,"./jsHarmonyCMS.Toolbar.js":29,"./jsHarmonyCMS.Util.js":30}]},{},[31]);
