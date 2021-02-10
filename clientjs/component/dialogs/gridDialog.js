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
 * @param {Object} xmodel - the JSH model instance
 * @param {string} dialogSelector - the CSS selector that can be used to select the dialog component once opened.
 * @param {Function} onComplete - Should be called by handler when complete
 */

/**
  * Called when the dialog is first opened
  * @callback GridDialog~dialogOpenedCallback
  * @param {JQuery} dialogWrapper - the dialog wrapper element
  * @param {Object} xmodel - the JSH model instance
  */

/**
 * Called when the dialog closes
 * @callback GridDialog~closeCallback
 * @param {JQuery} dialogWrapper - the dialog wrapper element
 * @param {Object} xmodel - the JSH model instance
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
  var _this = this;

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
  var xmodel = undefined;
  var $dialog = undefined;

  dialog.onBeforeOpen = function(_xmodel, onComplete) {
    xmodel = _xmodel;
    controller = _xmodel.controller;
    _this.jsh.XExt.execif(_this.onBeforeOpen,
      function(f){
        _this.onBeforeOpen(xmodel, dialog.getFormSelector(), f);
      },
      function(){
        if(onComplete) onComplete();
      }
    );
  }

  dialog.onOpened = function(_$dialog, _xmodel, acceptFunc, cancelFunc) {
    $dialog = _$dialog;
    controller.grid.Prop.Enabled = true;
    controller.Render(function() {
      if (_.isFunction(_this.onOpened)) _this.onOpened(_$dialog, xmodel);
    });
  }

  dialog.onCancel = function(options) {
    if (!options.force && controller.HasUpdates()) {
      _this.jsh.XExt.Confirm('Close without saving changes?', function() {
        controller.form.ResetDataset();
        options.forceCancel();
      });
      return false;
    }
  }

  dialog.onClose = function() {
    controller.grid.Prop.Enabled = false;
    if (_.isFunction(_this.onClose)) _this.onClose($dialog, xmodel);
  }

  dialog.open();
}

exports = module.exports = GridDialog;
