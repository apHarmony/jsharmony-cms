/** @typedef {import('./imageEditorController').RotateModel} RotateModel*/

/**
 * @class
 * @param {JQuery} $imageEditor
 */
export function RotateEditor($imageEditor) {

  this._$editor = $imageEditor.find('[data-editor="rotate"]');

  /** @private @type {JQuery} */
  this._$flipHorizontalButton = this._$editor.find('button[data-action="flipHorizontal"]');

  /** @private @type {JQuery} */
  this._$flipVerticalButton = this._$editor.find('button[data-action="flipVertical"]');

  /** @private @type {JQuery} */
  this._$rotateLeftButton = this._$editor.find('button[data-action="rotateLeft"]');

  /** @private @type {JQuery} */
  this._$rotateRightButton = this._$editor.find('button[data-action="rotateRight"]');

  /** @public @type {(() => void) | undefined} */
  this.onRotateLeft = undefined;

  /** @public @type {(() => void) | undefined} */
  this.onRotateRight = undefined;

  /** @public @type {(() => void) | undefined} */
  this.onFlipHorizontal = undefined;

  /** @public @type {(() => void) | undefined} */
  this.onFlipVertical = undefined;

  this.initEventHandlers();
}

/**
 * @public
 * @returns {void}
 */
RotateEditor.prototype.activate = function() {
  this._$editor.show();
}

/**
 * @public
 * @returns {void}
 */
RotateEditor.prototype.deactivate = function() {
  this._$editor.hide();
}

/**
 * @private
 * @param {boolean} flipHorizontal
 * @returns {void}
 */
RotateEditor.prototype.flip = function(flipHorizontal) {

  if (flipHorizontal && this.onFlipHorizontal) this.onFlipHorizontal();
  else if (this.onFlipVertical) this.onFlipVertical();
}

/**
 * @public
 * @returns {string}
 */
RotateEditor.prototype.getTitle = function() {
  return this._$editor.attr('data-editor-title');
}

/**
 * @private
 * @returns {void}
 */
RotateEditor.prototype.initEventHandlers = function() {
  const self = this;
  this._$flipHorizontalButton.off('click.media_editor').on('click.media_editor', function() { self.flip(true); });
  this._$flipVerticalButton.off('click.media_editor').on('click.media_editor', function() { self.flip(false); });
  this._$rotateLeftButton.off('click.media_editor').on('click.media_editor', function() { self.rotate(true); });
  this._$rotateRightButton.off('click.media_editor').on('click.media_editor', function() { self.rotate(false); });
}

/**
 * @private
 * @param {boolean} rotateLeft
 * @returns {void}
 */
RotateEditor.prototype.rotate = function(rotateLeft) {

  if (rotateLeft && _.isFunction(this.onRotateLeft)) this.onRotateLeft();
  else if(_.isFunction(this.onRotateLeft)) this.onRotateRight();
}