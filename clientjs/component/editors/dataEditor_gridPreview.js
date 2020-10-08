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
var ComponentTemplate = require('../componentModel/componentTemplate');
var GridDialog = require('../dialogs/gridDialog');
var DataEditor_GridPreviewController = require('./dataEditor_ gridPreviewController');



/**
 * @class
 * @param {ComponentTemplate} componentTemplate
 * @param {Object} cms
 * @param {Object} jsh
 * @param {Object} component
 */
function DataEditor_GridPreview(componentTemplate, cms, jsh, component) {

  /** @private @type {ComponentTemplate} */
  this._componentTemplate = componentTemplate;

  /** @private @type {Object} */
  this._cms = cms;

  /** @private @type {Object} */
  this._jsh = jsh;

  /** @private @type {Object} */
  this._component = component;
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
    minHeight: modelConfig.popup[1],
    minWidth: modelConfig.popup[0]
  });

  var dataController;

  dialog.onBeforeOpen = function(xModel, dialogSelector, onComplete) {

    self.updateAddButtonText(dialogSelector + ' .xactions .xbuttoninsert', self._componentTemplate.getCaptions());

    dataController = new DataEditor_GridPreviewController(xModel, (data || {}).items, properties, self._jsh.$(dialogSelector),
      self._cms, self._jsh, self._component, modelTemplate, self._componentTemplate);

    dataController.onDataUpdated = function(updatedData) {
      if (_.isFunction(dataUpdatedCb)) dataUpdatedCb(updatedData);
    }

    dataController.onBeforeRenderGridRow = function(renderOptions) {
      if (_.isFunction(componentInstance.onBeforeRenderGridRow)) componentInstance.onBeforeRenderGridRow(renderOptions);
    }

    dataController.onRenderGridRow = function(element, data, properties, cms, component) {
      if (_.isFunction(componentInstance.onRenderGridRow)) componentInstance.onRenderGridRow(element, data, properties, cms, component);
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

  var $el = this._jsh.$(selector);
  var $img = $el.find('img');
  $el.empty().append($img).append(text);
}


exports = module.exports = DataEditor_GridPreview;