/**
 * @class
 */
function BottomToolbar($imageEditor) {

  /** @private @type {JQuery} */
  this._$toolbar = $imageEditor.find('.bottomToolbar');

  /** @private @type {JQuery} */
  this._$resetButton = this._$toolbar.find('[data-action="reset"]');

  /** @private @type {JQuery} */
  this._$zoomInButton = this._$toolbar.find('[data-action="zoomIn"]');

  /** @private @type {JQuery} */
  this._$zoomOutButton = this._$toolbar.find('[data-action="zoomOut"]');

  /** @private @type {JQuery} */
  this._$cancelButton = this._$toolbar.find('[data-action="close"]');

  /** @private @type {JQuery} */
  this._$doneButton = this._$toolbar.find('[data-action="done"]');

  /**
   * @public
   * @type {(() => void) | undefined}
   */
  this.onCancel = undefined;

  /**
   * @public
   * @type {(() => void) | undefined}
   */
  this.onDone = undefined;

  /**
   * @public
   * @type {(() => void) | undefined}
   */
  this.onReset = undefined;

  /**
   * @public
   * @type {((zoomIn: boolean) => void) | undefined}
   */
  this.onSetZoom = undefined;

  this.initEventHandlers();
}

/**
 * @private
 * @returns {void}
 */
BottomToolbar.prototype.initEventHandlers = function() {
  const self = this;

  this._$cancelButton.off('click.media_editor').on('click.media_editor', function() {
    if (self.onCancel) self.onCancel();
  });

  this._$doneButton.off('click.media_editor').on('click.media_editor', function() {
    if (self.onDone) self.onDone();
  });

  this._$resetButton.off('click.media_editor').on('click.media_editor', function() {
    if (self.onReset) self.onReset();
  });

  this._$zoomInButton.off('click.media_editor'). on('click.media_editor', function() {
    if (self.onSetZoom) self.onSetZoom(true);
  });

  this._$zoomOutButton.off('click.media_editor'). on('click.media_editor', function() {
    if (self.onSetZoom) self.onSetZoom(false);
  });
}