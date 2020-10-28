/**
 * @class
 */
export function TopToolbar($imageEditor) {

  this._$toolbar = $imageEditor.find('.topToolbar');

  /**
   * @public
   * @type {((mode: string) => void) | undefined}
   */
  this.onSetMode = undefined;

  /**
   * @public
   * @type {(() => void) | undefined}
   */
  this.onInvertImage = undefined;

  /** @private @type {JQuery} */
  this._$brightnessButton = this._$toolbar.find('[data-activate-editor="brightness"]');

  /** @private @type {JQuery} */
  this._$colorButton = this._$toolbar.find('[data-activate-editor="color"]');

  /** @private @type {JQuery} */
  this._$contrastButton = this._$toolbar.find('[data-activate-editor="contrast"]');

  /** @private @type {JQuery} */
  this._$cropButton = this._$toolbar.find('[data-activate-editor="crop"]');

  /** @private @type {JQuery} */
  this._$gammaButton = this._$toolbar.find('[data-activate-editor="gamma"]');

  /** @private @type {JQuery} */
  this._$invertButton = this._$toolbar.find('[data-activate-editor="invert"]');

  /** @private @type {JQuery} */
  this._$resizeButton = this._$toolbar.find('[data-activate-editor="resize"]');

  /** @private @type {JQuery} */
  this._$rotateButton = this._$toolbar.find('[data-activate-editor="rotate"]');

  /** @private @type {JQuery} */
  this._$sharpnessButton = this._$toolbar.find('[data-activate-editor="sharpness"]');

  this.initEventHandlers();
}

/**
 * @private
 * @returns {void}
 */
TopToolbar.prototype.initEventHandlers = function() {
  const self = this;

  // Initialize buttons that activate editors.
  _.forEach([
    this._$brightnessButton,
    this._$colorButton,
    this._$contrastButton,
    this._$cropButton,
    this._$gammaButton,
    this._$resizeButton,
    this._$rotateButton,
    this._$sharpnessButton
  ], function($button) {
    $button.off('click.media_editor').on('click.media_editor', function() {
      self.switchMode($(this).attr('data-activate-editor'));
    });
  });

  this._$invertButton.off('click.media_editor').on('click.media_editor', function() {
    if (_.isFunction(self.onInvertImage)) self.onInvertImage();
  });
}

/**
 * @public
 * @param {boolean} visible
 * @returns {void}
 */
TopToolbar.prototype.setVisibility = function(visible) {
  visible ? this._$toolbar.show() : this._$toolbar.hide();
}

/**
 * @private
 * @param {string} mode
 * @returns {void}
 */
TopToolbar.prototype.switchMode = function(mode) {
  if (_.isFunction(this.onSetMode)) this.onSetMode(mode);
}