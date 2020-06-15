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
    cssClass: 'l-content jsHarmony_cms_component_dataGridEditor jsHarmony_cms_component_dataGridEditor_' + this._componentTemplate.getTemplateId(),
    maxHeight: 800,
    minHeight: modelConfig.popup[1],
    minWidth: modelConfig.popup[0]
  });

  var dataController;

  dialog.onBeforeOpen = function(xModel, dialogSelector) {

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

DataEditor_GridPreview.prototype.updateAddButtonText = function(selector, captions) {

  var text = captions[1] != undefined ? 'Add ' + captions[1] : 'Add';

  var $el = $(selector);
  var $img = $el.find('img');
  $el.empty().append($img).append(text);
}


exports = module.exports = DataEditor_GridPreview;