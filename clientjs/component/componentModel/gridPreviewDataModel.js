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
