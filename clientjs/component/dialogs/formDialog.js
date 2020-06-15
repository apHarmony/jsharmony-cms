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
      controlstyle: 'margin-right:10px; margin-top:10px;'
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