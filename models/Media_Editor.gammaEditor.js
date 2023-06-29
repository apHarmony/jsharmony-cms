/**
 * @class
 * @param {JQuery} $imageEditor
 */
function GammaEditor($imageEditor) {

  /** @private @type {JQuery} */
  this._$editor = $imageEditor.find('[data-editor="gamma"]');

  /** @private @type {number} */
  this._gamma = 0;

  /** @private @type {JQuery} */
  this._$gammaSlider = this._$editor.find('[data-control-id="gammaRange"]');

  /**
   * @public
   * @type {(gamma: number) => void}
   */
  this.onGammaChange = undefined;

  this.initEventHandlers();
}

/**
 * @public
 * @returns {void}
 */
GammaEditor.prototype.activate = function() {
  this._$editor.show();
}

/**
 * @public
 * @returns {void}
 */
GammaEditor.prototype.deactivate = function() {
  this._$editor.hide();
}

/**
 * @public
 * @returns {string}
 */
GammaEditor.prototype.getTitle = function() {
  return this._$editor.attr('data-editor-title')
}

/**
 * @private
 * @returns {void}
 */
GammaEditor.prototype.initEventHandlers = function() {
  const self = this;

  this._$gammaSlider.off('change.media_editor').on('change.media_editor', function() {
    self._gamma = parseFloat(self._$gammaSlider[0].value);
    if (self.onGammaChange) self.onGammaChange(self._gamma);
  });
}

/**
 * @public
 * @param {number} gamma
 * @returns {void}
 */
GammaEditor.prototype.setGamma = function(gamma) {
  this._gamma = gamma;
  this._$gammaSlider[0].value = gamma;
}