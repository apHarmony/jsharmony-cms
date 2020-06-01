(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{"./componentModel/componentConfig":2,"./editors/dataFormEditor":11,"./editors/dataGridPreviewEditor":12,"./editors/propertyFormEditor":16,"./utils/domSerializer":20}],2:[function(require,module,exports){
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

},{"../utils/cloner":18,"./formDataModel":4,"./formPropertiesModel":5,"./gridPreviewDataModel":6}],3:[function(require,module,exports){
var Cloner = require('../utils/cloner');
var Convert = require('../utils/convert');

/**
 * @typedef {FieldModel} FieldModel
 */

/**
 * @class
 * @classdesc This class adds functionality for working with field models
 * defined in the JSH component JSON.
 * @param {Object[]} fieldModels = the field's as defined by the model's 'field' property
 */
function FieldModel(fieldModels) {

  // Since we might mutate the fields we need out own
  // copy to avoid side effects.
  /** @private @type {Object[]} */
  this._fieldModels = Cloner.deepClone(fieldModels || []);

  /** @private @type {(string | undefined)} */
  this._idFieldName = undefined;

  /** @private @type {(string | undefined)} */
  this._sequenceFieldName = undefined;

  /** @private @type {Objec}*/
  this._AUTO_FIELD_NAMES = {
    id: '_jsh_auto_id',
    sequence: '_jsh_auto_sequence'
  };
}

/**
 * Add a new field to the field models list.
 * @public
 * @param {Object} field
 */
FieldModel.prototype.addField = function(field) {
  this._fieldModels.push(field);
}

/**
 * JSH changes the types defined in the model.
 * This will convert the fields in dataInstance to the correct type
 * based on the fieldModel.
 * @public
 * @param {Object} dataInstance - the data to operate on.
 */
FieldModel.prototype.convertTypes = function(dataInstance) {

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
  _.forEach(this._fieldModels || [], function(field) {
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
 * Ensure that an ID field exists.
 * If no ID field exists then one will be added.
 * An error will be thrown if more than one ID field exists.
 * @public
 */
FieldModel.prototype.ensureIdField = function() {
  var idFields = _.filter(this._fieldModels, function(field) { return field.key; });
  if (idFields.length > 1) throw new Error('Expected a single ID field. Found ' + idFields.length);
  if (idFields.length < 1) {
    var idField = { name: this._AUTO_FIELD_NAMES.id, type: 'varchar', control: 'hidden', key: true, caption: '' };
    idFields = [idField];
    this._fieldModels.push(idField);
  }

  this._idFieldName = idFields[0].name;
}

/**
 * Ensure that a sequence field exists.
 * If no sequence field exists then one will be added.
 * @public
 */
FieldModel.prototype.ensureSequenceField = function() {

  var seqFieldName = this._AUTO_FIELD_NAMES.sequence;
  var hasSeqField = _.some(this._fieldModels, function(field) { return field.name === seqFieldName; })
  if (!hasSeqField) {
    var idField = { name: seqFieldName, type: 'int', control: 'hidden', caption: '' };
    this._fieldModels.push(idField);
  }

  this._sequenceFieldName = seqFieldName
}

/**
 * Get a copy of the field model array.
 * @public
 * @returns {Object[]}
 */
FieldModel.prototype.getFieldModels = function() {
  return Cloner.deepClone(this._fieldModels);
}

/**
 * Get the name of the ID field.
 * Don't call this unless `ensureIdField()` has been called.
 * @public
 * @returns {(string | undefined)}
 */
FieldModel.prototype.getIdFieldName = function() {
  return this._idFieldName;
}

/**
 * Get the name of the sequence field.
 * Don't call this unless `ensureSequenceField()` has been called.
 * @public
 * @returns {(string | undefined)}
 */
FieldModel.prototype.getSequenceFieldName = function() {
  return this._sequenceFieldName;
}

/**
 * Set the field with the given field name to hidden.
 * @public
 * @param {string} fieldName
 */
FieldModel.prototype.makeFieldHidden = function(fieldName) {
  var field = _.find(this._fieldModels, function(field) { return field.name === fieldName; });
  if (field) {
    field.control = 'hidden';
  }
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
 * @param {boolean} [removeAutoProps] - if true then this will remove any fields added
 * (e.g., sequence and ID fields)
 * @returns {Object} a copy of the dataInstance with type conversions done and extraneous
 * properties removed.
 */
FieldModel.prototype.makePristineModel = function(dataInstance, removeAutoProps) {

  var autoFieldNameMap = {};
  if (removeAutoProps) {
    _.values(this._AUTO_FIELD_NAMES, function(a) { autoFieldNameMap[a] = true; });
  }

  var pristineCopy = {};
  _.forEach(this._fieldModels, function(field) {
    var fieldName = field.name;
    var fieldType = field.type;
    if (fieldType == undefined) return;
    if (removeAutoProps && autoFieldNameMap[fieldName]) return;

    pristineCopy[fieldName] = dataInstance[fieldName];
  });

  this.convertTypes(pristineCopy);
  return pristineCopy;
}

/**
 * Iterates through the fieldModels
 * to look for fields with "type" property. If a field has the type property
 * then the field will be added to the new data instance object. When adding
 * a field, the value is set as either the value in the current data instance
 * (if that property key exists) or as the field model default/undefined.
 *
 * This will also correctly convert values as needed.
 *
 * This mutates the dataInstance.
 * @public
 * @param {Object} dataInstance - the data instance. Each property corresponds
 * to a field in the fieldModels array. This object will not be mutated.
 */
FieldModel.prototype.populateDataInstance = function(dataInstance) {

  dataInstance = dataInstance || {};
  _.forEach(this._fieldModels || [], function(field) {
    var fieldName = field.name;
    var fieldType = field.type;
    if (fieldType == undefined) return;

    // If the loaded data has the field set
    // (even if set to null/undefined) then we
    // need to use that value. Otherwise use the default
    // or set to undefined. All props must included in the data object (even if null/undefined).
    const dataHasField = fieldName in dataInstance;
    if (dataHasField) {
      dataInstance[fieldName] = dataInstance[fieldName];
    } else {
      // It's okay if default is undefined. We just have to ensure that the
      // field key is set in the data object.
      dataInstance[fieldName] = field.default;
    }
  });
  this.convertTypes(dataInstance);
  // Must return in case original instance was null/undefined
  return dataInstance;
}
exports = module.exports = FieldModel;
},{"../utils/cloner":18,"../utils/convert":19}],4:[function(require,module,exports){
var FieldModel = require('./fieldModel');

/**
 * @typedef {Object} mediaBrowserControlInfo
 * @property {string} dataFieldName
 * @property {string} titleFieldName
 * @property {('link' | 'media')} browserType
 */


/**
 * @class
 * @classdesc Use for working with models for editing component
 * data in a form
 * @param {Object} modelConfig - the base model config as defined
 * in the component config.
 */
function FormDataModel(modelConfig) {

  /** @private @type {FieldModel} */
  this._itemFields;

  /** @private @type {string} */
  this._itemTemplate = '';

  /** @private @type {mediaBrowserControlInfo[]} */
  this._browserFields = [];

  /** @private @type {Object} */
  this._modelConfig = modelConfig;

  // Preserve the JS because we will modify it.
  /** @private @type {string} */
  this._rawOriginalJs = '\r\n' + (modelConfig.js || '') + '\r\n';

  this.init(modelConfig);
}

/**
 * Get the link browser field info (if exists) for the link field with
 * the given field name.
 * @public
 * @param {string} fieldName
 * @returns {(mediaBrowserControlInfo | undefined)}
 */
FormDataModel.prototype.getBrowserFieldInfo = function(fieldName) {
  return _.find(this._browserFields, function(item) { return item.dataFieldName === fieldName });
}

/**
 * Get the link browser field infos
 * @public
 * @returns {mediaBrowserControlInfo[]}
 */
FormDataModel.prototype.getBrowserFieldInfos = function() {
  return (this._browserFields || []).slice();
}

/**
 * @public
 * @returns {FieldModel}
 */
FormDataModel.prototype.getItemFields = function() {
  return this._itemFields;
}

/**
 * @public
 * @returns {string}
 */
FormDataModel.prototype.getItemTemplate = function() {
  return this._itemTemplate;
}

/**
 * Return the raw model configuration.
 * @public
 * @returns {Object}
 */
FormDataModel.prototype.getModelConfig = function() {
  return this._modelConfig;
}

/**
 * Return the raw model JavaScript.
 * @public
 * @returns {Object}
 */
FormDataModel.prototype.getModelJs = function() {
  return this._rawOriginalJs;
}

/**
 * Ensure the model is configured according to conventions
 * and setup for standard form operation.
 * @private
 */
FormDataModel.prototype.init = function(modelConfig) {
  var self = this;

  //--------------------------------------------------
  // Build Link And Image Browsers
  //--------------------------------------------------
  var fields = modelConfig.fields || [];
  modelConfig.fields = [];
  _.forEach(fields, function(field) {

    if (field.control === 'link_browser' || field.control === 'media_browser') {
      var browserType = { link_browser: 'link',   media_browser: 'media' }[field.control];

      /** @type {mediaBrowserControlInfo} */
      var info = {
        dataFieldName: field.name,
        titleFieldName: field.name + '_jsh_browserDataTitle',
        browserType: browserType
      }

      self._browserFields.push(info);

      field.name = info.titleFieldName;
      field.control = 'textbox';
      field.type = 'varchar';
      field.onchange = '(function() { var m = jsh.App[modelid]; if (m && m.onChangeBrowserTitleControl) m.onChangeBrowserTitleControl("' + info.dataFieldName + '");  })()';
      modelConfig.fields.push(field);
      modelConfig.fields.push({
        name: field.name + '_browserButton',
        caption: '',
        control: 'button',
        value: 'Browse',
        nl: false,
        onclick: '(function() { var m = jsh.App[modelid]; if (m && m.openEditorBrowser) m.openEditorBrowser("' + info.dataFieldName + '"); })()'
      });
      modelConfig.fields.push({
        name: field.name + '_resetButton',
        controlclass: 'secondary',
        controlstyle: 'margin-left:10px;',
        caption: '',
        control: 'button',
        value: 'Reset',
        nl: false,
        onclick: '(function() { var m = jsh.App[modelid]; if (m && m.resetEditorBrowser) m.resetEditorBrowser("' + info.dataFieldName + '"); })()'
      });
      modelConfig.fields.push({
        name: info.dataFieldName,
        caption: '',
        control: 'hidden',
        type: 'varchar'
      });

    } else if (field.type != undefined) {
      field.onchange = '(function() { var m = jsh.App[modelid]; if (m && m.onChangeData) m.onChangeData();  })()';
      modelConfig.fields.push(field);
    }
  });


  this._itemFields = new FieldModel(modelConfig.fields);
  this._itemFields.addField({
    caption: '', control:'html', value:'<div data-id="previewWrapper"></div>', 'block':true
  });

  //--------------------------------------------------
  // Get templates
  //--------------------------------------------------
  var $templates = $('<div>' + modelConfig.ejs + '</div>');
  var itemTemplateSelector = (modelConfig.templates || {}).itemPreview;
  var itemTemplateElement = itemTemplateSelector ? $templates.find(itemTemplateSelector) : undefined;
  if (itemTemplateElement.length !== 1) {
    throw new Error('Item template must contain a single root element. Found ' + itemTemplateElement.length + ' elements');
  }
  this._itemTemplate = itemTemplateElement ? itemTemplateElement.html() : undefined;

  //--------------------------------------------------
  // Set up the model instance fields
  //--------------------------------------------------
  modelConfig.fields = this._itemFields.getFieldModels();
  modelConfig.layout = 'form';
  modelConfig.unbound = true;
  modelConfig.onecolumn = true;
  modelConfig.ejs = '';
  modelConfig.js = this._rawOriginalJs;

  this._itemFields = new FieldModel(modelConfig.fields)
}

exports = module.exports = FormDataModel;

},{"./fieldModel":3}],5:[function(require,module,exports){
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

},{"./fieldModel":3}],6:[function(require,module,exports){
var FieldModel = require('./fieldModel');

/**
 * @class
 * @classdesc Use for working with models for editing component
 * data in a grid preview
 * @param {Object} modelConfig - the base model config as defined
 * in the component config.
 */
function GridPreviewDataModel(modelConfig) {

  /** @private @type {FieldModel} */
  this._gridFields = undefined;

  /** @private @type {Object} */
  this._modelConfig = undefined;

  /** @private @type {string} */
  this._rowTemplate = '';

  /** @private @type {string} */
  this._rawOriginalJs = '';

  this.init(modelConfig);
}

/**
 * @public
 * @returns {FieldModel}
 */
GridPreviewDataModel.prototype.getGridFields = function() {
  return this._gridFields;
}

/**
 * Return the raw model configuration.
 * @public
 * @returns {Object}
 */
GridPreviewDataModel.prototype.getModelConfig = function() {
  return this._modelConfig;
}

/**
 * Return the raw model JavaScript.
 * @public
 * @returns {Object}
 */
GridPreviewDataModel.prototype.getModelJs = function() {
  return this._rawOriginalJs;
}

/**
 * @public
 * @returns {string}
 */
GridPreviewDataModel.prototype.getRowTemplate = function() {
  return this._rowTemplate;
}

/**
 * Ensure the model is configured according to conventions
 * and setup for standard grid operation.
 * @private
 */
GridPreviewDataModel.prototype.init = function(modelConfig) {
  var self = this;

  //--------------------------------------------------
  // Set up the model instance
  //--------------------------------------------------
  var gridModelConfig = {
    id: modelConfig.id,
    title: modelConfig.title,
    fields: [],
    layout: 'grid',
    unbound: true,
    newrowposition: 'last',
    commitlevel: 'page',
    hide_system_buttons: ['export', 'search', 'save'],
    sort: [],
    buttons: [
      {link: 'js:_this.close()', icon: 'ok', actions: 'IU', text: 'Done' }
    ],
    getapi:   'return _this.getDataApi(xmodel, apitype)',
    onrowbind:   '_this.onRowBind(xmodel,jobj,datarow);',
    oncommit:  '_this.onCommit(xmodel, rowid, callback);',
    ejs:  '',
    js:  function() {
      var gridApi = new jsh.XAPI.Grid.Static(modelid);
      var formApi = new jsh.XAPI.Form.Static(modelid);
      return  {
        getDataApi: function(xmodel, apiType) {
          if (apiType === 'grid') return gridApi;
          else if (apiType === 'form') return formApi;
        }
      }
    }
  }
  this._modelConfig = gridModelConfig;
  this._rawOriginalJs = '\r\n' + (modelConfig.js || '') + '\r\n';

  //--------------------------------------------------
  // Set up the grid fields to match component conventions.
  //--------------------------------------------------
  this._gridFields = new FieldModel(modelConfig.fields);
  _.forEach(modelConfig.fields, function(field) {
    if (field.control === 'link_browser'|| field.control === 'media_browser') {
      field.type = 'varchar';
      field.control = 'hidden'
    }

    if (field.type == undefined)  return;
    self._gridFields.makeFieldHidden(field.name);
  });

  this._gridFields.addField({
    name: 'cust_field', control: 'label', caption: '', unbound: true, controlstyle: 'vertical-align:baseline;',
    value: '<div tabindex="0" data-component-template="gridRow"></div>',
    ongetvalue: 'return;'
  });
  this._gridFields.ensureIdField();
  this._gridFields.ensureSequenceField();
  gridModelConfig.fields = this._gridFields.getFieldModels();
  gridModelConfig.sort = [this._gridFields.getSequenceFieldName()];

  //--------------------------------------------------
  // Get templates
  //--------------------------------------------------
  var $templates = $('<div>' + modelConfig.ejs + '</div>');
  var rowTemplateSelector = (modelConfig.templates || {}).gridRowPreview;
  var rowTemplateElement = rowTemplateSelector ? $templates.find(rowTemplateSelector) : undefined;
  if (rowTemplateElement.length !== 1) {
    throw new Error('Row template must contain a single root element. Found ' + rowTemplateElement.length + ' elements');
  }
  this._rowTemplate = rowTemplateElement ? rowTemplateElement.html() : undefined;
}

exports = module.exports = GridPreviewDataModel;

},{"./fieldModel":3}],7:[function(require,module,exports){
var DialogResizer = require('./dialogResizer');

/**
 * @typedef {Object} DialogConfig
 * @property {(boolean | undefined)} closeOnBackdropClick - Set true to close the dialog
 * when the background is clicked
 * @property {(number | undefined)} maxHeight - set the max height (pixels) of the form if defined
 * @property {(number | undefined)} maxWidth - set the max width (pixels) of the form if defined
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
  this._id = this.getNextId();
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
  this.load(function(xModel) {

    self.registerLovs(xModel);


    if (_.isFunction(self.onBeforeOpen)) self.onBeforeOpen(xModel);

    /** @type {DialogResizer} */
    var dialogResizer = undefined;

    self._jsh.XExt.CustomPrompt(formSelector, $(formSelector),
      function(acceptFunc, cancelFunc) {
        var $wrapper = $(formSelector);
        dialogResizer = new DialogResizer($wrapper[0], self._jsh);
        if (_.isFunction(self.onOpened)) self.onOpened($wrapper, xModel, acceptFunc, cancelFunc)
      },
      function(success) {
        if (_.isFunction(self.onAccept)) self.onAccept(success);
      },
      function(options) {
        if (_.isFunction(self.onCancel)) return self.onCancel(options);
        return false;
      },
      function() {
        dialogResizer.closeDialog();
        if(_.isFunction(self.onClose)) self.onClose();
        self.destroy();
      },
      { reuse: false, backgroundClose: self._config.closeOnBackdropClick }
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

exports = module.exports = Dialog;

},{"./dialogResizer":8}],8:[function(require,module,exports){
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
},{}],9:[function(require,module,exports){
var Dialog = require('./dialog');

/**
 * @typedef {Object} FormDialogConfig
 * @property {(boolean | undefined)} closeOnBackdropClick - Set true to close the dialog
 * when the background is clicked
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
  if (config.cancelButtonLabel) {
    newFields.push({
      name: 'cancel_button',
      control: 'button',
      value: config.cancelButtonLabel,
      controlclass: 'secondary',
      controlstyle: 'margin-right: 10px'
    });
  }
  if (config.acceptButtonLabel) {
    newFields.push({
      name: 'save_button',
      control: 'button',
      value: config.acceptButtonLabel,
      nl:false
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
    height: config.height,
    maxHeight: config.maxHeight,
    maxWidth: config.maxWidth,
    width: config.width
  });

  var controller = undefined;
  var xModel = undefined;
  var $dialog = undefined;

  dialog.onBeforeOpen = function(_xModel) {
    xModel = _xModel;
    controller = _xModel.controller;
    if (_.isFunction(self.onBeforeOpen)) self.onBeforeOpen(xModel, dialog.getFormSelector());
    controller.Render(data);
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
},{"./dialog":7}],10:[function(require,module,exports){
var Dialog = require('./dialog');

/**
 * @typedef {Object} GridDialogConfig
 * @property {(boolean | undefined)} closeOnBackdropClick - Set true to close the dialog
 * when the background is clicked
 * @property {(number | undefined)} maxHeight - set the max height (pixels) of the form if defined
 * @property {(number | undefined)} maxWidth - set the max width (pixels) of the form if defined
 * @property {(number | undefined)} width - set the width (pixels) of the form if defined
 * @property {(number | undefined)} height - set the height (pixels) of the form if defined
 * @property {(string | undefined)} cssClass - space delimited list of classes to add to the dialog element
 */

/**
 *  Called when the dialog is first opened
 * @callback GridDialog~beforeOpenCallback
 * @param {Object} xModel - the JSH model instance
 * @param {string} dialogSelector - the CSS selector that can be used to select the dialog component once opened.
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
    height: config.height,
    maxHeight: config.maxHeight,
    maxWidth: config.maxWidth,
    width: config.width
  });

  var controller = undefined;
  var xModel = undefined;
  var $dialog = undefined;

  dialog.onBeforeOpen = function(_xModel) {
    xModel = _xModel;
    controller = _xModel.controller;
    if (_.isFunction(self.onBeforeOpen)) self.onBeforeOpen(xModel, dialog.getFormSelector());
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

},{"./dialog":7}],11:[function(require,module,exports){
var FormDialog = require('../dialogs/formDialog');
var ComponentConfig = require('../componentModel/componentConfig');
var HTMLPropertyEditorController = require('./htmlPropertyEditorController');

/**
 * @typedef {Object} RenderConfig
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {string} template - the template being rendered
 */

/**
 * @callback DataFormEditor~beforeRenderDataItemPreview
 * @param {RenderConfig} renderConfig
 */

/**
 * @callback DataGridItemEditor~renderDataItemPreview
 * @param {HTMLElement} element
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 */



/**
 * @class
 * @param {ComponentConfig} componentConfig
 * @param {Object} cms
 * @param {Object} jsh
 */
function DataFormEditor(componentConfig, isReadOnly, cms, jsh) {

  /** @private @type {ComponentConfig} */
  this._componentConfig = componentConfig;

  /** @private @type {boolean} */
  this._isReadOnly = isReadOnly;

  /** @private @type {Object} */
  this._cms = cms;

  /** @private @type {Object} */
  this._jsh = jsh;

  /** @private @type {HTMLPropertyEditorController[]} */
  this._htmlEditors = [];

  /** @private @type {DataFormEditor~beforeRenderDataItemPreview} */
  this._onBeforeRenderDataItemPreview = undefined;

  /** @private @type {DataGridItemEditor~renderDataItemPreview} */
  this._onRenderDataItemPreview = undefined;
}

/**
 * @private
 * @param {JQuery} $dialog - the dialog element.
 * @param {JQuery} $wrapper - the preview wrapper element.
 */
DataFormEditor.prototype.attachEditors = function($dialog, $wrapper, $toolbar) {

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
DataFormEditor.prototype.createPicker = function() {
  return this._cms.createJsHarmonyCMSEditorPicker(undefined);
}

/**
 * @private
 * @param {JQuery} $dialog
 * @param {import('../componentModel/formDataModel').mediaBrowserControlInfo} info
 * @param {boolean}
 */
DataFormEditor.prototype.enableBrowserControl = function($dialog, info, enable) {
  $dialog.find('.xform_ctrl.' + info.titleFieldName).attr('disabled', enable ? null : true);
}

/**
 * Open the editor
 * @public
 * @param {Object} itemData - the data used to render the component.
 * @param {Object} properties - the component's configured properties (used to render the component)
 * @param {Function} onAcceptCb - Called if the data is updated. Arg0 is updated data.
 */
DataFormEditor.prototype.open = function(itemData, properties, onAcceptCb) {

  var self = this;
  var formModel = this._componentConfig.getFormDataModelInstance();
  var modelConfig = formModel.getModelConfig();
  var template = formModel.getItemTemplate();

  // Allow title to be overridden
  modelConfig.title = modelConfig.title ? modelConfig.title : 'Edit';

  if (this._isReadOnly) {
    modelConfig.actions = 'B';
  }

  var itemData = formModel.getItemFields().populateDataInstance(itemData || {});


  var dialog = new FormDialog(this._jsh, modelConfig, {
    acceptButtonLabel: 'Save',
    cancelButtonLabel:  'Cancel',
    closeOnBackdropClick: true,
    cssClass: 'l-content jsHarmony_cms_component_dataFormItemEditor jsHarmony_cms_component_dataFormItemEditor_' + this._componentConfig.getComponentConfigId(),
    maxHeight: 800
  });


  var $toolbar;

  dialog.onBeforeOpen = function(xModel, dialogSelector) {

    var editor = self._jsh.App[xModel.id];
    var $dialog = $(dialogSelector);
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

    _.forEach(formModel.getBrowserFieldInfos(), function(info) {
      self.enableBrowserControl($dialog, info, (itemData[info.titleFieldName] || '') === (itemData[info.dataFieldName] || ''));
    });

    // This function NEEDS to be debounced.
    // It SHOULD be anyway so it doesn't re-render the preview on every
    // keystroke, but it HAS to be just in case two fields change
    // at the same time (in which case the first change causes a re-render
    // and the second change breaks things since parts of the re-render are async)
    editor.onChangeData = _.debounce(function() {
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
    }, 300);

    editor.openEditorBrowser = function(browserControlName) {

      var info = formModel.getBrowserFieldInfo(browserControlName);
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
          var title = data.page_path || '';
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
      var info = formModel.getBrowserFieldInfo(browserControlName);
      if (info == undefined) return;
      xModel.set(browserControlName, xModel.get(info.titleFieldName));
      editor.onChangeData();
    }

    editor.resetEditorBrowser = function(linkControlName) {
      var info = formModel.getBrowserFieldInfo(linkControlName);
      if (info == undefined) return;
      self.enableBrowserControl($dialog, info, true);
      xModel.set(linkControlName, '');
      xModel.set(info.titleFieldName, '');
      editor.onChangeData();
    }

    self._onBeforeRenderDataItemPreview = editor.onBeforeRenderDataItemPreview;
    self._onRenderDataItemPreview = editor.onRenderDataItemPreview;
  }

  dialog.onOpened = function($dialog, xModel) {
    var editor = self._jsh.App[xModel.id];
    // Manually call change to do initial render
    setTimeout(function() {
      editor.onChangeData();
    });
  }

  dialog.onAccept = function($dialog, xModel) {
    if(!xModel.controller.Commit(itemData, 'U')) return false;
    itemData = formModel.getItemFields().makePristineModel(itemData);
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
    delete self._jsh.XModels[xModel.id];
    delete self._jsh.App[xModel.id];
    _.forEach(self._htmlEditors, function(editor) { editor.destroy(); });
  }

  dialog.open(itemData);
}

/**
 * Open a link browser
 * @private
 * @param {Function} cb - callback for when link is selected (matches original picker signature)
 */
DataFormEditor.prototype.openLinkBrowser = function(cb) {
  this.createPicker().openLink(cb, '');
}

/**
 * Open a medial browser
 * @private
 * @param {Function} cb - callback for when link is selected (matches original picker signature)
 */
DataFormEditor.prototype.openMediaBrowser = function(cb) {
  this.createPicker().openMedia(cb, '');
}

/**
 * @private
 * @param {JQuery} $wrapper
 * @param {string} template
 * @param {Object} data
 * @param {Object} properties
 */
DataFormEditor.prototype.renderPreview = function($wrapper, template, data, properties) {

  /** @type {RenderConfig} */
  var renderOptions = {
    template: template,
    data: data,
    properties: properties
  };

  if (_.isFunction(this._onBeforeRenderDataItemPreview)) this._onBeforeRenderDataItemPreview(renderOptions);

  var templateData = { data: renderOptions.data, properties: renderOptions.properties };
  var rendered = '';
  try {
    rendered = this._jsh.ejs.render(renderOptions.template || '', templateData);
  } catch (error) {
    console.error(error);
  }

  $wrapper.empty().append(rendered);

  if (_.isFunction(this._onRenderDataItemPreview)) this._onRenderDataItemPreview($wrapper.children()[0], renderOptions.data, renderOptions.properties);
}

exports = module.exports = DataFormEditor;
},{"../componentModel/componentConfig":2,"../dialogs/formDialog":9,"./htmlPropertyEditorController":15}],12:[function(require,module,exports){
var ComponentConfig = require('../componentModel/componentConfig');
var GridDialog = require('../dialogs/gridDialog');
var DataGridPreviewEditorController = require('./dataGridPreviewEditorController');



/**
 * @class
 * @param {ComponentConfig} componentConfig
 * @param {Object} cms
 * @param {Object} jsh
 */
function DataGridPreviewEditor(componentConfig, cms, jsh) {

  /** @private @type {ComponentConfig} */
  this._componentConfig = componentConfig;

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
DataGridPreviewEditor.prototype.open = function(data, properties, dataUpdatedCb) {

  var self = this;
  var gridPreviewDataModel = this._componentConfig.getGridPreviewDataModelInstance();
  var modelConfig = gridPreviewDataModel.getModelConfig();


  var componentInstanceId = modelConfig.id + '_componentInstance';
  this._jsh.XExt.JSEval(gridPreviewDataModel.getModelJs() || '', {}, {
    modelid: componentInstanceId
  });
  var componentInstance = this._jsh.App[componentInstanceId] || {};

  // Allow title to be overridden
  modelConfig.title = modelConfig.title ? modelConfig.title : 'Edit';

  var dialog = new GridDialog(this._jsh, modelConfig, {
    closeOnBackdropClick: true,
    cssClass: 'l-content jsHarmony_cms_component_dataGridEditor jsHarmony_cms_component_dataGridEditor_' + this._componentConfig.getComponentConfigId(),
    maxHeight: 800,
    maxWidth: 1400
  });

  var dataController;

  dialog.onBeforeOpen = function(xModel, dialogSelector) {

    dataController = new DataGridPreviewEditorController(xModel, (data || {}).items, properties, $(dialogSelector),
      self._cms, self._jsh, gridPreviewDataModel, self._componentConfig);

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
  }

  dialog.onOpened = function($dialog, xModel) {
    dataController.initialize();
  }

  dialog.onClose = function($dialog, xModel) {
    delete self._jsh.XModels[xModel.id];
    delete self._jsh.App[xModel.id];
    delete self._jsh.App[componentInstanceId];
  }

  dialog.open();

}

exports = module.exports = DataGridPreviewEditor;
},{"../componentModel/componentConfig":2,"../dialogs/gridDialog":10,"./dataGridPreviewEditorController":13}],13:[function(require,module,exports){

var Convert  = require('../utils/convert');
var GridDataStore = require('./gridDataStore');
var DataFormEditor = require('./dataFormEditor')
var ComponentConfig = require('../componentModel/componentConfig');
var GridPreviewDataModel = require('../componentModel/gridPreviewDataModel');


/**
 * @typedef {Object} RenderConfig
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {string} template - the template being rendered
 */

/**
 * @callback DataGridPreviewEditorController~beforeRenderGridRow
 * @param {DataGridItemEditor~RenderConfig} renderConfig
 */

/**
 * @callback DataGridPreviewEditorController~renderGridRow
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
 * @param {GridPreviewDataModel} gridPreviewDataModel
 * @param {ComponentConfig} componentConfig
 */
function DataGridPreviewEditorController(xModel, data, properties, dialogWrapper, cms, jsh, gridPreviewDataModel, componentConfig) {

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

  /** @private @type {import('../componentModel/fieldModel').FieldModel} */
  this._gridFields = gridPreviewDataModel.getGridFields();

  /** @private @type {ComponentConfig} */
  this._componentConfig = componentConfig;

  /** @private @type {string} */
  this._rowTemplate = gridPreviewDataModel.getRowTemplate();

  /** @public @type {DataGridPreviewEditorController~tileUpdateCallback} */
  this.onDataUpdated = undefined;

  /** @public @type {DataGridPreviewEditorController~beforeRenderGridRow} */
  this.onBeforeRenderGridRow = undefined;

  /** @public @type {DataGridPreviewEditorController~renderGridRow} */
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
  this._dataStore = new GridDataStore(this._gridFields.getIdFieldName());
  this._apiData = [];
  _.each(data, function(item, index) {
    item[self._gridFields.getIdFieldName()] = self.makeItemId();
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
DataGridPreviewEditorController.prototype.addRow = function($row, rowData) {
  var rowId = this.getParentRowId($row);
  var $rowComponent = this.getRowElementFromRowId(rowId);
  $row.find('td.xgrid_action_cell.delete').remove();
  if (rowData._is_insert) {
    var id = this.makeItemId();
    this._insertId = id;
    rowData._insertId = id;
    $rowComponent.attr('data-item-id', id);
    this.forceCommit();
  } else {
    $rowComponent.attr('data-item-id', rowData[this._gridFields.getIdFieldName()]);
    var self = this;
    self.renderRow(rowData);
  }
}

/**
 * Change the position of the item in the item list.
 * @private
 * @param {number} itemId - the item ID of the item being moved
 * @param {boolean} moveDown - set to true to mode the item toward the end of the list.
 */
DataGridPreviewEditorController.prototype.changeItemSequence = function(itemId, moveDown) {

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
    this.updateModelDataFromDataStore(this.getRowIdFromItemId(adjData[this._gridFields.getIdFieldName()]));

    item.sequence = newSequence;
    this.updateModelDataFromDataStore(this.getRowIdFromItemId(item[this._gridFields.getIdFieldName()]));

    this._dataStore.sortBySequence();
    this._apiData.splice(0, this._apiData.length);
    // Update the data attached to the grid from the pristine data store
    this._dataStore.getDataArray().forEach(a => this._apiData.push(a));

    // Data was changed in the view
    this.dataUpdated();

    // A refresh is required by the current grid
    // system to ensure rows are re-drawn in correct order.
    this.forceRefresh();
  }
}

/**
 * Call anytime slide data is changed (and valid) in the view.
 * @private
 */
DataGridPreviewEditorController.prototype.dataUpdated = function() {
  this.updateParentController();
}

/**
 * Commit the data in the grid.
 * Should only be used for inserts and deletes.
 * @private
 */
DataGridPreviewEditorController.prototype.forceCommit = function() {
  var controller = this.xModel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.Commit();
}

/**
 * Refresh the grid.
 * @private
 */
DataGridPreviewEditorController.prototype.forceRefresh = function() {
  var controller = this.xModel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.Refresh();
}

/**
 * Get the item data for the corresponding rowId
 * @private
 * @param {number} rowId - the row ID of the data to get.
 * @return {(Oobject | undefined)}
 */
DataGridPreviewEditorController.prototype.getItemDataFromRowId = function(rowId) {
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
DataGridPreviewEditorController.prototype.getNextSequenceNumber = function() {
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
DataGridPreviewEditorController.prototype.getParentRowId = function($element) {
  return this.jsh.XExt.XModel.GetRowID(this.xModel.id, $element);
}

/**
 * Find the topmost element defined in the row template for the row
 * with the given ID.
 * @private
 * @param {number} rowId
 * @returns {JQuery}
 */
DataGridPreviewEditorController.prototype.getRowElementFromRowId = function(rowId) {
  var rowSelector = '.xrow[data-id="' + rowId + '"]';
  return this.$dialogWrapper.find(rowSelector + ' [data-component-template="gridRow"]');
}

/**
 * Get the row ID for the item with the given ID.
 * @private
 * @param {number} itemId - the item ID to use to find the parent row ID.
 * @return {number}
 */
DataGridPreviewEditorController.prototype.getRowIdFromItemId = function(itemId) {
  var $el = $(this.$dialogWrapper).find('[data-component-template="gridRow"][data-item-id="' + itemId + '"]');
  return this.getParentRowId($el);
}

/**
 * Entry point for controller. Do not call until
 * the form is on screen.
 * @public
 */
DataGridPreviewEditorController.prototype.initialize = function() {

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
    newRow[self._gridFields.getIdFieldName()] = self._insertId;
    newRow.sequence = self.getNextSequenceNumber();
    self._insertId = undefined;
    self._dataStore.addNewItem(_.extend({}, newRow));
    self._apiData.push(newRow);
    actionResult[self.xModel.id] = {}
    actionResult[self.xModel.id][self._gridFields.getIdFieldName()] = newRow[self._gridFields.getIdFieldName()];
    self.dataUpdated();
    self.renderRow(self._dataStore.getDataItem(newRow[self._gridFields.getIdFieldName()]));
  }

  formApi.onDelete  = function(action, actionResult, keys) {
    self._dataStore.deleteItem(keys[self._gridFields.getIdFieldName()]);
    var index = self._apiData.findIndex(function(item) { return item[self._gridFields.getIdFieldName()] === keys[self._gridFields.getIdFieldName()]});
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
DataGridPreviewEditorController.prototype.isReadOnly = function() {
  return !!this.cms.readonly;
}

/**
 * Create a random item id
 * @private
 * @returns {string}
 */
DataGridPreviewEditorController.prototype.makeItemId = function() {
  return '_' + Math.random().toString().replace('.', '');
}

/**
 * @private
 * @param {string} itemId - the ID of the item to edit
 */
DataGridPreviewEditorController.prototype.openItemEditor = function(itemId) {

  var self = this;
  var dataFormEditor =  new DataFormEditor(this._componentConfig, this.isReadOnly(), this.cms, this.jsh)
  var currentData = this._dataStore.getDataItem(itemId);
  dataFormEditor.open(this._dataStore.getDataItem(itemId), this._properties || {},  function(updatedData) {
      _.assign(currentData, updatedData)
      var rowId = self.getRowIdFromItemId(itemId);
      self.updateModelDataFromDataStore(rowId);
      self.dataUpdated();
      self.renderRow(currentData);
  });
}

/**
 * Prompt to delete the row with the given row ID
 * @private
 * @param {number} rowId - the ID of the row to delete.
 */
DataGridPreviewEditorController.prototype.promptDelete = function(rowId) {
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
DataGridPreviewEditorController.prototype.renderRow = function(data) {

  var self = this;
  var dataId = data[this._gridFields.getIdFieldName()];
  var rowId = this.getRowIdFromItemId(dataId);
  var $row = this.getRowElementFromRowId(rowId);
  var itemIndex = this._dataStore.getItemIndexById(dataId);
  var isFirst = itemIndex < 1;
  var isLast = itemIndex >= (this._dataStore.count() - 1);

  var template =
        '<div tabindex="0" data-component-template="gridRow">' +
          '<div class="toolbar">' +
            '<button data-component-part="editButton" data-allowReadOnly>' +
              '<span class="material-icons">' +
                'edit' +
              '</span>' +
            '</button>' +
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
            '<button data-component-part="deleteItem">' +
              '<span class="material-icons">' +
                'delete' +
              '</span>' +
            '</button>' +
          '</div>' +
          '<div data-component-part="preview"></div>' +
        '</div>'

  $row.empty().append(template);

  var renderOptions = {
    template: this._rowTemplate,
    data: data,
    properties: this._properties || {}
  }

  if (_.isFunction(this.onBeforeRenderGridRow)) this.onBeforeRenderGridRow(renderOptions);

  var templateData = { data: renderOptions.data, properties: renderOptions.properties };
  var rendered = '';
  try {
    rendered = this.jsh.ejs.render(renderOptions.template || '', templateData);
  } catch (error) {
    console.error(error);
  }


  $row.find('[data-component-part="preview"]').empty().append(rendered);

  if (this.isReadOnly()) {
    $row.find('button:not([data-allowReadOnly])').attr('disabled', true);
  } else {
    // Disable "move up" button if item is first, otherwise enable
    $row.find('[data-component-part="moveItem"][data-dir="prev"]')
        .attr('disabled', isFirst)
    // Disable "move down" button if item is last, otherwise enable
    $row.find('[data-component-part="moveItem"][data-dir="next"]')
      .attr('disabled', isLast)

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

  $row.off('dblclick.cmsComponent').on('dblclick.cmsComponent', function() {
    self.openItemEditor(dataId);
  });

  if (_.isFunction(this.onRenderGridRow)) this.onRenderGridRow($row.find('[data-component-part="preview"]')[0], renderOptions.data, renderOptions.properties);
}

/**
 * Copy properties from data store item to controller data item.
 * Call anytime the data store item changes.
 * @private
 * @param {number} rowId - the ID of the row for which the corresponding data will be updated (mutated).
 */
DataGridPreviewEditorController.prototype.updateModelDataFromDataStore = function(rowId) {

  var idField = this._gridFields.getIdFieldName();
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
DataGridPreviewEditorController.prototype.updateParentController = function() {
  var self = this;
  this._dataStore.sortBySequence();
  var data = this._dataStore.getDataArray()  || [];

  // /** @type {Array.<TileData>} */
  // var tiles = _.map(data, function(item) {
  //   // return self.cleanAndCopySlideData(item);
  //   return item;
  // });

  /** @type {TilesData} */
  var data = {
    items: data
  };

  if (_.isFunction(this.onDataUpdated)) this.onDataUpdated(data);
}

exports = module.exports = DataGridPreviewEditorController;

},{"../componentModel/componentConfig":2,"../componentModel/gridPreviewDataModel":6,"../utils/convert":19,"./dataFormEditor":11,"./gridDataStore":14}],14:[function(require,module,exports){
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

},{"../utils/convert":19}],15:[function(require,module,exports){
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
    console.log(content);
    self.getDataElement().attr('value', content);
  }
  this._editor.init(function() {

    var config = {};
    var configType = '';
    var editorType = (self._editorType || '').toLowerCase();
    if (editorType === 'full') {
      configType = 'full';
    } else if (editorType === 'title') {
      configType = 'full';
      config = {
        toolbar: 'forecolor backcolor | bold italic underline',
        valid_elements : 'a,strong/b,p,br,span[style]',
        plugins: [],
        menubar: false
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
var ComponentConfig = require('../componentModel/componentConfig');
var FormDialog = require('../dialogs/formDialog');

/**
 * @class
 * @param {ComponentConfig} componentConfig
 * @param {Object} cms
 * @param {Object} jsh
 */
function PropertyFormEditor(componentConfig, cms, jsh) {

  /** @private @type {ComponentConfig} */
  this._componentConfig = componentConfig;

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
PropertyFormEditor.prototype.open = function(properties, onAcceptCb) {

  var self = this;
  var formModel = this._componentConfig.getFormPropertiesModelInstance();
  var modelConfig = formModel.getModelConfig();

  // Allow title to be overridden
  modelConfig.title = modelConfig.title ? modelConfig.title : 'Configure';

  var data = formModel.getItemFields().populateDataInstance(properties || {});

  var dialog = new FormDialog(this._jsh, modelConfig, {
    acceptButtonLabel: 'Save',
    cancelButtonLabel:  'Cancel',
    closeOnBackdropClick: true,
    cssClass: 'jsHarmony_cms_component_propertyFormEditor_' + this._componentConfig.getComponentConfigId(),
  });

  dialog.onAccept = function($dialog, xModel) {
    if(!xModel.controller.Commit(data, 'U')) return false;
    data = formModel.getItemFields().makePristineModel(data);
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
    delete self._jsh.XModels[xModel.id];
    delete self._jsh.App[xModel.id];
  }

  dialog.open(data);
}

exports = module.exports = PropertyFormEditor;

},{"../componentModel/componentConfig":2,"../dialogs/formDialog":9}],17:[function(require,module,exports){
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
 * @param {Object[]} components - the component configurations
 */
function registerPlugin(components) {
  if (tinymce.PluginManager.get('jsharmony') != undefined) {
    return;
  }

  tinymce.PluginManager.add('jsharmony', function(editor, url) {
    new JsHarmonyComponentPlugin(editor, components);
  });
}

/**
 * @class
 * @private
 */
function JsHarmonyComponentPlugin(editor, components) {

  this._editor = editor;
  this.initialize(components);
}

/**
 * Create the menu button for picking components to insert.
 * @private
 * @param {Object[]} componentInfo
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
          text: item.text,
          icon: item.icon,
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
 */
JsHarmonyComponentPlugin.prototype.createContextToolbar = function() {

  var self = this;
  var propButtonId = 'jsharmonyComponentPropEditor';
  var dataButtonId = 'jsharmonyComponentDataEditor'
  var contextId = 'jsharmonyComponentContextToolbar';

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

  var toolbar = dataButtonId + ' ' + propButtonId;

  self._editor.ui.registry.addContextToolbar(contextId, {
    predicate: function(node) {
      return self._editor.dom.is(node, '[data-component]');
    },
    items: toolbar,
    scope: 'node',
    position: 'node'
  });
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

      var text = _.isArray(component.caption) ? component.caption[0] : component.caption;
      componentInfo.push({ componentType: component.id, icon: iconRegistryName, text: text || component.id });
    }
  });

  // Register icons
  for (var key in ICONS) {
    self._editor.ui.registry.addIcon(ICONS[key].name, ICONS[key].html);
  }

  this.createContextToolbar();
  this.createComponentInsertMenu(componentInfo);

  this._editor.on('undo', function(info) { self.handleUndoRedo(info); });
  this._editor.on('redo', function(info) { self.handleUndoRedo(info); });

  this._editor.addCommand(COMMAND_NAMES.editComponentData, function() {
    var el = self._editor.selection.getStart();
    self.openDataEditor(el);
  });

  this._editor.addCommand(COMMAND_NAMES.editComponentProperties, function() {
    var el = self._editor.selection.getStart();
    if (el && el._componentInterface && el._componentInterface.openPropertiesEditor) {
      el._componentInterface.openPropertiesEditor();
    }
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
  var self = this;
  var id = this.makeComponentId(componentType)
  this._editor.insertContent(this.makeComponentContainer(componentType, id));
  // Don't need to fire the insert event here.
  // We have a parser filter that will detect the insert and
  // fire the event.

  // But we do need to open the data dialog.
  // The next loop will cause the editor to parse the data
  // Then the loop after that the content will be in the DOM
  // (at least based on empirical tests).
  // So 1ms will be way more than enough time to wait.
  setTimeout(function() {
    self.openDataEditor(id);
  }, 1);
}

/**
 * Create the component container HTML string for
 * inserting into the editor.
 * @private
 * @param {string} componentType - the type of component to create
 * @param {string} id - the ID to uniquely identify the component.
 * @returns {string} - HTML string
 */
JsHarmonyComponentPlugin.prototype.makeComponentContainer = function(componentType, id) {
  return '<div class="mceNonEditable" data-component="' + componentType +'" data-component-id="' +
    id + '" data-component-properties="" data-component-content=""></div>';
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
 * Create a random ID for uniquely identifying
 * each component add via the editor.
 * @private
 * @returns {string}
 */
JsHarmonyComponentPlugin.prototype.makeComponentId = function(componentType) {
  var id;
  do {
    id = 'jsharmony_cms_component_' + Math.random().toString().replace('.', '');
    var idExists = tinymce.dom.DomQuery.find('#' + id).length > 0;
    id = idExists ? undefined : id;
  } while(!id)
  return id;
}

/**
 * Open the data editor for the component.
 * @private
 * @param {(string | Element)} componentIdOrElement - if type is string then find the component in the dom,
 * or else use the component element passed in
 */
JsHarmonyComponentPlugin.prototype.openDataEditor = function(componentIdOrElement) {
  if (!componentIdOrElement) return;
  if (_.isString(componentIdOrElement)) {
    var componentIdOrElement = tinymce.dom.DomQuery.find('[data-component-id="' + componentIdOrElement + '"]')[0];
  }
  if (!componentIdOrElement) return;
  if (componentIdOrElement && componentIdOrElement._componentInterface && componentIdOrElement._componentInterface.openDataEditor) {
    componentIdOrElement._componentInterface.openDataEditor();
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
    var id = node.attributes.map['data-component-id'];
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
},{}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
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

},{}],21:[function(require,module,exports){
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

var pluginComponentController = require('./component/componentController');

exports = module.exports = function(jsh, cms){
  var _this = this;
  var $ = jsh.$;
  var XExt = jsh.XExt;
  var async = jsh.async;
  var ejs = jsh.ejs;

  this.components = null;
  this.isInitialized = false;

  this.load = function(onComplete){
    var url = '../_funcs/components/'+cms.branch_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.components = rslt.components;
        async.eachOf(_this.components, function(component, key, cb) {
          var loadObj = {};
          cms.loader.StartLoading(loadObj);
          _this.loadComponent(component, function(err){
            cms.loader.StopLoading(loadObj);
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

  this.render = function(){
    $('.jsharmony_cms_component').addClass('mceNonEditable').each(function(){
      var jobj = $(this);
      var component_id = jobj.data('id');
      var component_content = '';
      if(!component_id) component_content = '*** COMPONENT MISSING data-id ATTRIBUTE ***';
      else if(!(component_id in _this.components)) component_content = '*** MISSING CONTENT FOR COMPONENT ID ' + component_id+' ***';
      else{
        var component = _this.components[component_id];
        var templates = component != undefined ? component.templates : undefined
        var editorTemplate = (templates || {}).editor;
        component_content = ejs.render(editorTemplate || '', cms.controller.getComponentRenderParameters(component_id));
      }
      jobj.html(component_content);
    });

    $('[data-component]').each(function(i, element) {
      _this.renderComponent(element);
    });
  }

  this.loadComponent = function(component, complete_cb) {
    var url = (component.remote_template || {}).editor;
    if (!url) return complete_cb();

    _this.loadRemoteTemplate(url, function(error, data){
      if (error) {
        complete_cb(error);
      } else {
        component.templates = component.templates || {};
        var template = (component.templates.editor || '');
        data = data && template ? '\n' + data : data || '';
        component.templates.editor = (template + data) || '*** COMPONENT NOT FOUND ***';
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

  this.renderComponent = function(element) {

    var componentType = $(element).attr('data-component');
    var componentConfig = componentType ? _this.components[componentType] : undefined;
    if (!componentConfig) {
      return;
    }
    componentConfig.id = componentConfig.id || componentType;
    _this.renderComponentStyles(componentType, componentConfig);
    var componentInstance = {};
    XExt.JSEval('\r\n' + (componentConfig.js || '') + '\r\n', componentInstance, {
      _this: componentInstance,
      cms: cms,
      jsh: jsh,
      component: componentInstance
    });
    if (!_.isFunction(componentInstance.create))  {
      componentInstance.create = function(componentConfig, element) {
        var controller = new pluginComponentController(element, cms, jsh, componentConfig.id);
        controller.onBeforeRender = componentInstance.onBeforeRender
        controller.onRender = componentInstance.onRender;
        controller.render();
      }
    }
    componentInstance.create(componentConfig, element);
  }

  this.renderComponentStyles = function(componentType, componentConfig) {
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
},{"./component/componentController":1}],22:[function(require,module,exports){
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
}
},{}],23:[function(require,module,exports){
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
},{}],24:[function(require,module,exports){
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

      registerPlugin(cms.componentController.components);

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
        valid_elements: '+*[*]',
        entity_encoding: 'numeric',
        plugins: [
          'advlist autolink autoresize lists link image charmap anchor',
          'searchreplace visualblocks code fullscreen wordcount template',
          'insertdatetime media table paste code noneditable jsharmony'
        ],
        toolbar: 'formatselect | forecolor backcolor | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link  image table fullscreen | jsHarmonyComponents',
        removed_menuitems: 'newdocument',
        image_advtab: true,
        menu: {
          edit: { title: 'Edit', items: 'undo redo | cut copy paste | selectall | searchreplace' },
          view: { title: 'View', items: 'code | visualaid visualchars visualblocks | spellchecker | preview fullscreen' },
          insert: { title: 'Insert', items: 'image link media template codesample inserttable | charmap emoticons hr | pagebreak nonbreaking anchor toc | insertdatetime' },
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
      }, _this.defaultConfig);

      _this.editorConfig.full = _.extend({}, _this.editorConfig.base, {
        init_instance_callback: function(editor){
          editor.on('focus', function(){
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
            if (el) cms.componentController.renderComponent(el);
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
}
},{"./component/tinyMceComponentPlugin":17,"./jsHarmonyCMS.Editor.Picker.js":23}],25:[function(require,module,exports){
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
      loader_obj.style.zIndex = 2147483641;
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
},{}],27:[function(require,module,exports){
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
},{}],28:[function(require,module,exports){
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
var jsHarmonyCMSComponentController = require('./jsHarmonyCMS.ComponentController.js');

var jsHarmonyCMS = function(){
  var _this = this;

  this.loader = new jsHarmonyCMSLoader(this);
  this.util = new jsHarmonyCMSUtil(this);
  this.toolbar = undefined; //Loaded after init
  this.controller = undefined; //Loaded after init
  this.editor = undefined; //Loaded after init
  this.componentController = undefined; //Loaded after init
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
  this.onLoaded = null;                  //function(jsh)
  this.onGetControllerUrl = null;        //function() => url
  this.onFilePickerCallback = null;      //function(jdata)
  this.onGetFilePickerParameters = null; //function(filePickerType, url)
  this.onTemplateLoaded = function(f){ $(document).ready(f); }


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
      _this.componentController = new jsHarmonyCMSComponentController(jsh, _this);

      if(_this.onInit) _this.onInit(jsh);

      var controllerUrl = '';
      if(_this.onGetControllerUrl) controllerUrl = _this.onGetControllerUrl();
      if(!controllerUrl) controllerUrl = _this._baseurl + _this.defaultControllerUrl;


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
    $('.jsharmony_cms_content').prop('contenteditable','true');
    if(jsh._GET['branch_id']){
      _this.branch_id = jsh._GET['branch_id'];
      this.componentController.load();
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
global.jsHarmonyCMSInstance = new jsHarmonyCMS();
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./jsHarmonyCMS.ComponentController.js":21,"./jsHarmonyCMS.Controller.js":22,"./jsHarmonyCMS.Editor.Picker.js":23,"./jsHarmonyCMS.Editor.js":24,"./jsHarmonyCMS.Loader.js":25,"./jsHarmonyCMS.Toolbar.js":26,"./jsHarmonyCMS.Util.js":27}]},{},[28]);
