var DialogResizer = require('./dialogResizer');

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
 * @param {Object} xModel - the JSH model instance
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
 * @param {Object} xModel - the JSH model instance
 * @param {Function} acceptFunc - Call this function to trigger accept logic
 * @param {Function} cancelFunc - Call this function to trigger cancel logic
 */

 /**
  * @class
  * @param {Object} jsh
  * @param {Object} model - the model that will be loaded into the virtual model
  * @param {DialogConfig} config - the dialog configuration
  */
function Dialog(jsh, model, config) {
  this._jsh = jsh;
  this._model = model;
  this._id = config.dialogId ? config.dialogId : this.getNextId();
  /** @type {DialogConfig} */
  this._config = config || {};
  this._$wrapper = this.makeDialog(this._id, this._config);
  this._$overlay = undefined;
  this._destroyed = false;

  $('body').append(this._$wrapper)

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
 * Find the z-index of the child element with the
 * highest z-index inside of the dialog block
 * @private
 * @returns {number}
 */
Dialog.prototype.getMaxDialogBlockZIndex = function() {
  var self = this;
  var maxZIndex = 0;
  $('.xdialogblock').children().each(function(i, el) {
    var zIndex = self.getZIndex(el);
    maxZIndex = Math.max(maxZIndex, zIndex);
  });

  return maxZIndex;
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
 * Get the z-index for the element.
 * @private
 * @param {(HTMLElement | JQuery)} element
 * @returns {number}
 */
Dialog.prototype.getZIndex = function(element) {
  var zIndex = parseInt( $(element).css('zIndex'));
  return isNaN(zIndex) || zIndex == undefined ? 0 : zIndex;
}

/**
 * Create and insert the overlay for this dialog.
 * @private
 */
Dialog.prototype.insertOverlay = function() {
  var $dialogBlock = $('.xdialogblock');
  var $childOverlay = $('<div class="childDialogOverlay"></div>')
  $childOverlay
    .css('background-color', 'rgba(0,0,0,0.1)')
    .css('position', 'absolute')
    .css('width', '100%')
    .css('height', '100%');

  this.setZIndexToNextMax($childOverlay);

  $childOverlay.on('click', function() {
    $dialogBlock.click();
  });


  $dialogBlock.append($childOverlay);

  this._$overlay = $childOverlay;
}

/**
 * @private
 */
Dialog.prototype.load = function(callback) {
  var self = this;
  this._jsh.XPage.LoadVirtualModel($(self.getFormSelector()), this._model, function(xModel) {
    callback(xModel);
  });
}

/**
 * Create the dialog elements and append to the body DOM.
 * @private
 * @param {string} id - the ID that uniquely identifies the dialog
 * @param {DialogConfig} config
 */
Dialog.prototype.makeDialog = function(id, config) {

  var $form = $('<div class="xdialogbox"></div>')
    .addClass(this._id)
    .attr('id', this._id)
    .css('max-width', _.isNumber(config.maxWidth) ? config.maxWidth + 'px' : null)
    .css('max-height',  _.isNumber(config.maxHeight) ? config.maxHeight + 'px' : null)
    .css('min-width', _.isNumber(config.minWidth) ? config.minWidth + 'px' : null)
    .css('min-height',  _.isNumber(config.minHeight) ? config.minHeight + 'px' : null)
    .css('height',  _.isNumber(config.height) ? config.height + 'px' : null)
    .css('width',  _.isNumber(config.width) ? config.width + 'px' : null)
    .addClass(config.cssClass || '');

  var $wrapper = $('<div style="display: none;" class="xdialogbox-wrapper"></div>')
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

  var self = this;
  var formSelector = this.getFormSelector();
  var oldActive = document.activeElement;
  this.load(function(xModel) {

    self.insertOverlay();
    self.registerLovs(xModel);
    var $wrapper = $(formSelector);
    var lastScrollTop = 0
    self._jsh.XExt.execif(self.onBeforeOpen,
      function(f){
        self.onBeforeOpen(xModel, f);
      },
      function(){
        /** @type {DialogResizer} */
        var dialogResizer = undefined;

        self._jsh.XExt.CustomPrompt(formSelector, $(formSelector),
          function(acceptFunc, cancelFunc) {
            self.setZIndexToNextMax($wrapper);
            lastScrollTop = self.getScrollTop($wrapper);
            dialogResizer = new DialogResizer($wrapper[0], self._jsh);
            if (_.isFunction(self.onOpened)) self.onOpened($wrapper, xModel, acceptFunc, cancelFunc);
          },
          function(success) {
            lastScrollTop = self.getScrollTop($wrapper);

            if (_.isFunction(self.onAccept)) self.onAccept(success);
          },
          function(options) {
            lastScrollTop = self.getScrollTop($wrapper);
            if (_.isFunction(self.onCancel)) return self.onCancel(options);
            return false;
          },
          function() {
            if (oldActive) oldActive.focus();
            self.setScrollTop(lastScrollTop, $wrapper);
            dialogResizer.closeDialog();
            if(_.isFunction(self.onClose)) self.onClose();
            self.destroy();
          },
          { reuse: false, backgroundClose: self._config.closeOnBackdropClick, restoreFocus: false }
        );
      }
    );
  });
}

/**
 * Register the LOVs defined in the model.
 * @private
 * @param {Object} xModel
 */
Dialog.prototype.registerLovs = function(xModel) {
  _.forEach(this._model.fields, function(field) {
    if (field.type == undefined || field.lov == undefined) return;

    var lovs = undefined;

    if (_.isArray(field.lov.values)) {
      lovs = field.lov.values;
    } else if (_.isObject(field.lov.values)) {
      lovs = _.map(_.pairs(field.lov.values), function(kvp) {
        return { code_val: kvp[0], code_txt: kvp[1] };
      });
    }
    if (lovs) {
      xModel.controller.setLOV(field.name, lovs);
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

/**
 * Find the current maximum z-index for the children
 * elements of the dialog block and set the given
 * element's z-index to one greater.
 * @private
 * @param {(HTMLElement | JQuery)} element
 */
Dialog.prototype.setZIndexToNextMax = function(element) {
  var maxZIndex = this.getMaxDialogBlockZIndex() + 1;
  $(element).css('zIndex', maxZIndex);
}

exports = module.exports = Dialog;
