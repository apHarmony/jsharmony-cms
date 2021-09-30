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
var DataEditor_GridPreviewController = require('./dataEditor_gridPreviewController');



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

  var _this = this;
  var modelTemplate = this._componentTemplate.getDataModelTemplate_GridPreview();
  var modelConfig = modelTemplate.getModelInstance();


  var componentInstanceId = modelConfig.id;
  this._jsh.XExt.JSEval(modelTemplate.getModelJs() || '', {}, {
    modelid: componentInstanceId
  });
  var componentInstance = this._jsh.App[componentInstanceId] || {};


  var dialog = new GridDialog(this._jsh, this._cms, modelConfig, {
    closeOnBackdropClick: true,
    cssClass: 'l-content jsharmony_cms_component_dialog jsharmony_cms_component_dataGridEditor jsharmony_cms_component_dataGridEditor_' + this._componentTemplate.getTemplateId(),
    dialogId: componentInstanceId,
    minHeight: modelConfig.popup[1],
    minWidth: modelConfig.popup[0]
  });

  var dataController;

  dialog.onBeforeOpen = function(xmodel, dialogSelector, onComplete) {

    _this.updateAddButtonText(dialogSelector + ' .xactions .jsharmony_cms_component_dataGridEditor_insert', _this._componentTemplate.getCaptions());

    dataController = new DataEditor_GridPreviewController(xmodel, (data || {}).items, properties, _this._jsh.$(dialogSelector),
      _this._cms, _this._jsh, _this._component, modelTemplate, _this._componentTemplate);

    dataController.onDataUpdated = function(updatedData) {
      if (_.isFunction(dataUpdatedCb)) dataUpdatedCb(updatedData);
    }

    dataController.onBeforeRenderGridRow = function(renderOptions) {
      if (_.isFunction(componentInstance.onBeforeRenderGridRow)) componentInstance.onBeforeRenderGridRow(renderOptions);
    }

    dataController.onRenderGridRow = function(element, data, properties, cms, component) {
      if (_.isFunction(componentInstance.onRenderGridRow)) componentInstance.onRenderGridRow(element, data, properties, cms, component);
    }

    var modelInterface = _this._jsh.App[xmodel.id];

    modelInterface.onRowBind = function(xmodel, jobj, dataRow) {
      if (!dataController) return;
      dataController.addRow(jobj, dataRow);
    }

    modelInterface.onCommit = function(xmodel, rowId, callback) {
      callback();
    }

    modelInterface.close = function() {
      _this._jsh.XExt.CancelDialog();
    }

    modelInterface.addItem = function() {
      dataController.addItem();
    }

    if(onComplete) onComplete();
  }

  dialog.onOpened = function($dialog, xmodel) {
    dataController.initialize();
  }

  dialog.onClose = function($dialog, xmodel) {
    //Destroy model
    if (xmodel.controller && xmodel.controller.OnDestroy) xmodel.controller.OnDestroy();
    if (typeof xmodel.ondestroy != 'undefined') xmodel.ondestroy(xmodel);

    delete _this._jsh.XModels[xmodel.id];
    delete _this._jsh.App[xmodel.id];
    delete _this._jsh.App[componentInstanceId];
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