/** @typedef {import('./Media_Editor.imageEditorController.js').ColorModel} ColorModel */

/**
 * @class
 * @param {JQuery} $imageEditor
 */
function ColorEditor($imageEditor) {
  this._$editor = $imageEditor.find('[data-editor="color"]');

  /** @private @type {(ColorModel | undefined)} */
  this._model = {
    blueLevel: 0,
    greenLevel: 0,
    redLevel: 0
  };

  /** @private @type {JQuery} */
  this._$redSlider = this._$editor.find('[data-control-id="redRange"]');
  /** @private @type {JQuery} */
  this._$greenSlider = this._$editor.find('[data-control-id="greenRange"]');
  /** @private @type {JQuery} */
  this._$blueSlider = this._$editor.find('[data-control-id="blueRange"]');

  /**
   * @public
   * @type {(red: number, green: number, blue: number) => void}
   */
  this.onLevelsChanged = undefined;

  this.initEventHandlers();
}

/**
 * @public
 * @returns {void}
 */
ColorEditor.prototype.activate = function() {
  this._$editor.show();
}

/**
 * @public
 * @returns {void}
 */
ColorEditor.prototype.deactivate = function() {
  this._$editor.hide();
}

/**
 * @public
 * @returns {string}
 */
ColorEditor.prototype.getTitle = function() {
  return this._$editor.attr('data-editor-title')
}

/**
 * @private
 * @returns {void}
 */
ColorEditor.prototype.initEventHandlers = function() {
  const self = this;

  this._$blueSlider.off('change.media_editor').on('change.media_editor', function() { self.onChangeColorLevel('blue'); });
  this._$greenSlider.off('change.media_editor').on('change.media_editor', function() { self.onChangeColorLevel('green'); });
  this._$redSlider.off('change.media_editor').on('change.media_editor', function() { self.onChangeColorLevel('red'); });
}

/**
 * @private
 * @param {('red' | 'green' | 'blue')} color
 * @returns {void}
 */
ColorEditor.prototype.onChangeColorLevel = function(color) {

  if (color === 'blue') {
    this._model.blueLevel = parseFloat(this._$blueSlider[0].value);
  } else if (color === 'green') {
    this._model.greenLevel = parseFloat(this._$greenSlider[0].value);
  } else if (color === 'red') {
    this._model.redLevel = parseFloat(this._$redSlider[0].value);
  } else {
    throw new Error('Don\'t know how to handle color "' + color + '"');
  }

  if (this.onLevelsChanged) this.onLevelsChanged(this._model.redLevel, this._model.greenLevel, this._model.blueLevel);
}

/**
 * @public
 * @param {number} red
 * @param {number} green
 * @param {number} blue
 * @returns {void}
 */
ColorEditor.prototype.setLevels = function(red, green, blue) {
  this._$blueSlider[0].value = blue;
  this._$greenSlider[0].value = green;
  this._$redSlider[0].value = red;

  this._model = {
    blueLevel: blue,
    greenLevel: green,
    redLevel: red
  };
}