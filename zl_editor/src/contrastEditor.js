/**
 * @class
 * @param {JQuery} $imageEditor
 */
export function ContrastEditor($imageEditor) {

  /** @private @type {JQuery} */
  this._$editor = $imageEditor.find('[data-editor="contrast"]');

  /** @private @type {number} */
  this._contrast = 0;

  /** @private @type {JQuery} */
  this._$contrastSlider = this._$editor.find('[data-control-id="contrastRange"]');

  /**
   * @public
   * @type {(contrast: number) => void}
   */
  this.onContrastChange = undefined;

  this.initEventHandlers();
}

/**
 * @public
 * @returns {void}
 */
ContrastEditor.prototype.activate = function() {
  this._$editor.show();
}

/**
 * @public
 * @returns {void}
 */
ContrastEditor.prototype.deactivate = function() {
  this._$editor.hide();
}

/**
 * @public
 * @returns {string}
 */
ContrastEditor.prototype.getTitle = function() {
  return this._$editor.attr('data-editor-title');
}

/**
 * @private
 * @returns {void}
 */
ContrastEditor.prototype.initEventHandlers = function() {
  const self = this;

  this._$contrastSlider.off('change.media_editor').on('change.media_editor', function() {  
    self._contrast = parseFloat(self._$contrastSlider[0].value);
    if (self.onContrastChange) self.onContrastChange(self._contrast);
  });
}

/**
 * @public
 * @param {number} contrast
 * @returns {void}
 */
ContrastEditor.prototype.setContrast = function(contrast) {
  this._$contrastSlider[0].value = contrast;
}