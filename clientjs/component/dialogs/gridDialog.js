var Dialog = require('./dialog');

/**
 * @typedef {Object} GridDialogConfig
 * @property {(boolean | undefined)} closeOnBackdropClick - Set true to close the dialog
 * when the background is clicked
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
    minHeight: config.minHeight,
    minWidth: config.minWidth,
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
