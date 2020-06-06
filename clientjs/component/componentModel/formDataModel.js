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
