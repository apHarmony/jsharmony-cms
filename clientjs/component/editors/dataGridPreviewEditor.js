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