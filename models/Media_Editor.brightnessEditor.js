/**
 * @class
 * @param {JQuery} $imageEditor
 */
function BrightnessEditor($imageEditor) {

  /** @private @type {JQuery} */
  this._$editor = $imageEditor.find('[data-editor="brightness"]');

  /** @private @type {JQuery} */
  this._$brightnessSlider = this._$editor.find('[data-control-id="brightnessRange"]');

  /** @private @type {number} */
  this._brightness = 0;

  /**
   * Called when the model changes
   * @public
   * @type {(brightness: number) => void)}
   */
  this.onBrightnessChange = undefined;

  this.initEventHandlers();
}

/**
 * @public
 * @returns {void}
 */
BrightnessEditor.prototype.activate = function() {
  this._$editor.show();
}

/**
 * @public
 * @returns {void}
 */
BrightnessEditor.prototype.deactivate = function() {
  this._$editor.hide();
}

/**
 * @public
 * @returns {string}
 */
BrightnessEditor.prototype.getTitle = function() {
  return this._$editor.attr('data-editor-title')
}

/**
 * @private
 * @returns {void}
 */
BrightnessEditor.prototype.initEventHandlers = function() {
  const self = this;
  this._$brightnessSlider.off('change.media_editor').on('change.media_editor', function() {
    self._brightness = parseFloat(self._$brightnessSlider[0].value);
    if (self.onBrightnessChange) self.onBrightnessChange(self._brightness);
  });
}

/**
 * @public
 * @param {number} brightness
 * @returns {void}
 */
BrightnessEditor.prototype.setBrightness = function(brightness) {
  this._brightness = brightness;
  this._$brightnessSlider[0].value = brightness
}