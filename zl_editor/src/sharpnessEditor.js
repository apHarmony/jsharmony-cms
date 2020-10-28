/**
 * @class
 * @param {JQuery} $imageEditor
 */
export function SharpnessEditor($imageEditor) {

  /** @private @{JQuery} */
  this._$editor = $imageEditor.find('[data-editor="sharpness"]');

  /** @private @{JQuery} */
  this._$sharpnessSlider = this._$editor.find('[data-control-id="sharpnessRange"]');

  /** @private @type {number} */
  this._sharpness = undefined;

  /**
   * @public
   * @type {(sharpness: number) => void}
   */
  this.onSharpnessChange = undefined;

  this.initEventHandlers();
}

/**
 * @public
 * @returns {void}
 */
SharpnessEditor.prototype.activate = function() {
  this._$editor.show();
}

/**
 * @public
 * @returns {void}
 */
SharpnessEditor.prototype.deactivate = function() {
  this._$editor.hide();
}

/**
 * @public
 * @returns {string}
 */
SharpnessEditor.prototype.getTitle = function() {
  return this._$editor.attr('data-editor-title')
}

/**
 * @private
 * @returns {void}
 */
SharpnessEditor.prototype.initEventHandlers = function() {
  const self = this;
  this._$sharpnessSlider.off('change.media_editor').on('change.media_editor', function() { 
    self._sharpness = parseFloat(self._$sharpnessSlider[0].value);
    if (self.onSharpnessChange) self.onSharpnessChange(self._sharpness);
  });
}

/**
 * @public
 * @param {boolean} sharpness
 * @returns {void}
 */
SharpnessEditor.prototype.setSharpness = function(sharpness) {
  this._sharpness = sharpness;
  this._$sharpnessSlider[0].value = sharpness;
}