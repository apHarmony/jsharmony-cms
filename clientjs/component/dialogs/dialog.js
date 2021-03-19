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
var DialogResizer = require('./dialogResizer');
var OverlayService = require('./overlayService');

/**
 * @typedef {Object} DialogConfig
 * @property {(boolean | undefined)} closeOnBackdropClick - Set true to close the dialog
 * when the background is clicked
 * @property {(string | undefined)} dialogId - set this to override the assigned unique ID for the dialog.
 * There is no need to set this. If it is set, it must be globally unique among ALL dialogs.
 * @property {(number | undefined)} maxHeight - set the max height (pixels) of the form if defined
 * @property {(number | undefined)} maxWidth - set the max width (pixels) of the form if defined
 * @property {(number | undefined)} minHeight - set the min height (pixels) of the form if defined
 * @property {(number | undefined)} minWidth - set the min width (pixels) of the form if defined
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
 * @param {Object} xmodel - the JSH model instance
 * @param {Function} onComplete - Should be called by handler when complete
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
 * @param {Object} xmodel - the JSH model instance
 * @param {Function} acceptFunc - Call this function to trigger accept logic
 * @param {Function} cancelFunc - Call this function to trigger cancel logic
 */

 /**
  * @class
  * @param {Object} jsh
  * @param {Object} cms
  * @param {Object} model - the model that will be loaded into the virtual model
  * @param {DialogConfig} config - the dialog configuration
  */
function Dialog(jsh, cms, model, config) {
  this._jsh = jsh;
  this._cms = cms;
  this._model = model;
  this._id = config.dialogId ? config.dialogId : this.getNextId();
  /** @type {DialogConfig} */
  this._config = config || {};
  this._$wrapper = this.makeDialog(this._id, this._config);
  this._destroyed = false;

  this.overlayService = new OverlayService(this);

  this._jsh.$(this._jsh.root).append(this._$wrapper)

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
  if (this._$overlay) this._$overlay.remove();
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
 * Get the scroll top position for the page.
 * @private
 * @param {JQuery} $wrapper
 * @returns {number}
 */
Dialog.prototype.getScrollTop = function($wrapper) {
  return $wrapper.scrollParent().scrollTop();
}

/**
 * @private
 */
Dialog.prototype.load = function(callback) {
  var _this = this;
  this._jsh.XPage.LoadVirtualModel(_this._jsh.$(_this.getFormSelector()), this._model, function(xmodel) {
    callback(xmodel);
  });
}

/**
 * Create the dialog elements and append to the body DOM.
 * @private
 * @param {string} id - the ID that uniquely identifies the dialog
 * @param {DialogConfig} config
 */
Dialog.prototype.makeDialog = function(id, config) {

  var $form = this._jsh.$('<div class="xdialogbox"></div>')
    .addClass(this._id)
    .attr('id', this._id)
    .addClass(config.cssClass || '');
  if(config.maxWidth) $form.css('max-width', _.isNumber(config.maxWidth) ? config.maxWidth + 'px' : null);
  if(config.maxHeight) $form.css('max-height',  _.isNumber(config.maxHeight) ? config.maxHeight + 'px' : null);
  if(config.minWidth) $form.css('min-width', _.isNumber(config.minWidth) ? config.minWidth + 'px' : null);
  if(config.minHeight) $form.css('min-height',  _.isNumber(config.minHeight) ? config.minHeight + 'px' : null);
  if(config.height) $form.css('height',  _.isNumber(config.height) ? config.height + 'px' : null);
  if(config.width) $form.css('width',  _.isNumber(config.width) ? config.width + 'px' : null);
    
  var $wrapper = this._jsh.$('<div style="display: none;" class="xdialogbox-wrapper"></div>')
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

  var _this = this;
  var formSelector = this.getFormSelector();
  var oldActive = document.activeElement;
  var hasToolbarOffset = !!_this._cms.editor.getOffsetTop();
  var wasAtTop = !$(document).scrollTop();

  this.load(function(xmodel) {

    var $wrapper = _this._jsh.$(formSelector);
    _this.registerLovs(xmodel);
    var lastScrollTop = 0
    _this._jsh.XExt.execif(_this.onBeforeOpen,
      function(f){
        _this.onBeforeOpen(xmodel, f);
      },
      function(){
        /** @type {DialogResizer} */
        var dialogResizer = undefined;

        _this._jsh.XExt.CustomPrompt(formSelector, _this._jsh.$(formSelector),
          function(acceptFunc, cancelFunc) { //onInit
            _this.overlayService.pushDialog($wrapper);
            lastScrollTop = _this.getScrollTop($wrapper);
            dialogResizer = new DialogResizer($wrapper[0], _this._jsh);
            if (_.isFunction(_this.onOpened)) _this.onOpened($wrapper, xmodel, acceptFunc, cancelFunc);
          },
          function(success) { //onAccept
            if (_.isFunction(_this.onAccept)) _this.onAccept(success);
          },
          function(options) { //onCancel
            if (_.isFunction(_this.onCancel)) return _this.onCancel(options);
            return false;
          },
          function() { //onClosed
            dialogResizer.closeDialog();
            if(_.isFunction(_this.onClose)) _this.onClose();
            _this.destroy();
            _this.overlayService.popDialog();
          },
          {
            reuse: false,
            backgroundClose: _this._config.closeOnBackdropClick,
            restoreFocus: false,
            onClosing: function(cb){
              if (oldActive) oldActive.focus();
              _this.setScrollTop(lastScrollTop, $wrapper);
              return cb();
            }
          }
        );
      }
    );
  });
}

/**
 * Register the LOVs defined in the model.
 * @private
 * @param {Object} xmodel
 */
Dialog.prototype.registerLovs = function(xmodel) {
  _.forEach(this._model.fields, function(field) {
    if (field.type == undefined || field.lov == undefined) return;

    var lovs = undefined;

    if (_.isArray(field.lov.values)) {
      lovs = field.lov.values;
    } else if (_.isObject(field.lov.values)) {
      lovs = _.map(_.toPairs(field.lov.values), function(kvp) {
        return { code_val: kvp[0], code_txt: kvp[1] };
      });
    }
    if (lovs) {
      xmodel.controller.setLOV(field.name, lovs);
    }
  });
}

/**
 * Set the scroll top position for the page.
 * @private
 * @param {JQuery} $wrapper
 * @returns {number} position
 */
Dialog.prototype.setScrollTop = function(position, $wrapper) {
  $wrapper.scrollParent().scrollTop(position);
}

exports = module.exports = Dialog;
