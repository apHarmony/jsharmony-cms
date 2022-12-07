
/** @typedef {import('./Media_Editor.image').Image} Image */

/**
 * @class
 * @param {JQuery} $imageEditor
 * @param {Image} imageCanvas
 */
function ResizeEditor($imageEditor, imageCanvas) {
  this._$editor = $imageEditor.find('[data-editor="resize"]');

  /** @private @type {Image} */
  this._imageCanvas = imageCanvas;

  /** @type {(ResizeModel | undefined)} */
  this._model = undefined;

  /** @private @type {JQuery} */
  this._$heightNum = this._$editor.find('[data-control-id="resizeHeight"]');

  /** @private @type {JQuery} */
  this._$widthNum = this._$editor.find('[data-control-id="resizeWidth"]');

  /** @private @type {JQuery} */
  this._$unlockRatioButton = this._$editor.find('[data-action="unlockResizeRatio"]');

  /** @private @type {JQuery} */
  this._$lockRatioButton = this._$editor.find('[data-action="lockResizeRatio"]');

  /** @private @type {boolean} */
  this._lockRatio = true;


  /**
   * @public
   * @type {(x: number, y: number) => void }
   */
  this.onDimensionsChange = undefined;

  this.initEventHandlers();

  this.setLockRatio(true);
}

/**
 * @public
 * @returns {void}
 */
ResizeEditor.prototype.activate = function() {
  this._$editor.show()
  this._$heightNum[0].value = this._imageCanvas.getNaturalHeight();
  this._$widthNum[0].value = this._imageCanvas.getNaturalWidth();
}

/**
 * @public
 * @returns {void}
 */
ResizeEditor.prototype.deactivate = function() {
  this._$editor.hide();
}

/**
 * @public
 * @returns {string}
 */
ResizeEditor.prototype.getTitle = function() {
  return this._$editor.attr('data-editor-title')
}

/**
 * @public
 * @returns {void}
 */
ResizeEditor.prototype.imageUpdated = function() {
  this._$heightNum[0].value = this._imageCanvas.getNaturalHeight();
  this._$widthNum[0].value = this._imageCanvas.getNaturalWidth();
}

/**
 * @private
 * @returns {void}
 */
ResizeEditor.prototype.initEventHandlers = function() {
  const self = this;

  this._$heightNum.off('change.media_query').on('change.media_query', function() {
    const height = Math.round(self._$heightNum[0].value);
    let width = Math.random(self._$widthNum[0].value);

    if (self._lockRatio) {
      const factor = height / self._imageCanvas.getNaturalHeight();
      width = Math.round(self._imageCanvas.getNaturalWidth() * factor);
    }

    if (self.onDimensionsChange) self.onDimensionsChange(width, height);
  });

  this._$widthNum.off('change.media_query').on('change.media_query', function() {
    const width = Math.round(self._$widthNum[0].value);
    let height = Math.round(self._$heightNum[0].value);

    if (self._lockRatio) {
      const factor = width / self._imageCanvas.getNaturalWidth();
      height = Math.round(self._imageCanvas.getNaturalHeight() * factor);     
    }

    if (self.onDimensionsChange) self.onDimensionsChange(width, height);
  });

  this._$unlockRatioButton.off('click.media_query').on('click.media_query', function() { self.setLockRatio(false); });
  this._$lockRatioButton.off('click.media_query').on('click.media_query', function() { self.setLockRatio(true); });
}

/**
 * @private
 * @param {boolean} lock
 * @returns {void}
 */
ResizeEditor.prototype.setLockRatio = function(lock) {
  this._lockRatio = lock;
  if (lock) {
    this._$lockRatioButton.hide();
    this._$unlockRatioButton.show();
  } else {
    this._$lockRatioButton.show();
    this._$unlockRatioButton.hide();
  }
}