import { CropEditor } from './cropEditor';


/**
 * @class
 * @param {JQuery} $imageWrapper
 */
export function Image($imageWrapper, imageUrl) {

  /** @private @type {JQuery} */
  this._$imageWrapper = $imageWrapper;

  /** @private @type {JQuery} */
  this._$image = this._$imageWrapper.find('img');

  /** @private @type {string} */
  this._imageUrl = imageUrl;

  /** @private @type {number} */
  this._naturalWidth = 0;

  /** @private @type {number} */
  this._naturalHeight = 0;

  /** @private @type {number} */
  this._originalWidth = 0;

  /** @private @type {number} */
  this._originalHeight = 0;

  /** @private @type {number} */
  this._offsetLeft = 0;

  /** @private @type {number} */
  this._offsetTop = 0;

  /** @private @type {number} */
  this._width = 0;

  /** @private @type {number} */
  this._height = 0;

  /** @private @type {number} */
  this._zoomFactor = 1;
}

/**
 * @private
 * @returns {void}
 */
Image.prototype.applyZoomAndPosition = function() {

  this._height = Math.round(this._naturalHeight * this._zoomFactor);
  this._width = Math.round(this._naturalWidth * this._zoomFactor);

  this._offsetLeft = (this._width < this._$imageWrapper.width()) ?
    Math.round((this._$imageWrapper.width() - this._width) / 2) : 0;

  this._offsetTop = (this._height < this._$imageWrapper.height()) ?
    Math.round((this._$imageWrapper.height() - this._height) / 2) : 0;

  this._$image
    .css('height', this._height + 'px')
    .css('width', this._width + 'px')
    .css('left', this._offsetLeft + 'px')
    .css('top', this._offsetTop + 'px');
}

/**
 * @public
 * @returns {number}
 */
Image.prototype.getHeight = function() {
  return this._height;
}

/**
 * @public
 * @returns {number}
 */
Image.prototype.getNaturalHeight = function() {
  return this._naturalHeight;
}

/**
 * @public
 * @returns {number}
 */
Image.prototype.getNaturalWidth = function() {
  return this._naturalWidth;
}

/**
 * @public
 * @returns {number}
 */
Image.prototype.getOffsetLeft = function() {
  return this._offsetLeft;
}

/**
 * @public
 * @returns {number}
 */
Image.prototype.getOffsetTop = function() {
  return this._offsetTop;
}

/**
 * @public
 * @returns {number}
 */
Image.prototype.getOriginalHeight = function() {
  return this._originalHeight;
}

/**
 * @public
 * @returns {number}
 */
Image.prototype.getOriginalWidth = function() {
  return this._originalWidth;
}

/**
 * @public
 * @returns {number}
 */
Image.prototype.getWidth = function() {
  return this._width;
}

/**
 * @public
 * @param {() => void} callback
 * @returns {void}
 */
Image.prototype.initialize = function(callback) {  
  const self = this;
  this._$image.css('opacity', '0');
  this.loadImage(this._imageUrl, function() {
    self._originalHeight = self._$image[0].naturalHeight;
    self._originalWidth = self._$image[0].naturalWidth;
    self.loadImage('');
    self._$image.css('opacity', '1');
    if (callback) callback();
  });
}

/**
 * @public
 * @param {string} src
 * @param {() => void} callback
 * @returns {void}
 */
Image.prototype.loadImage = function(src, callback) {
  const self = this;
  const loadEventName = 'load.media_editor';
  this._$image.css('opacity', '0');
  this._$image.attr('src', '');
  this._$image.off(loadEventName).on(loadEventName, function() {
    self._$image.off(loadEventName);
    self._naturalHeight = self._$image[0].naturalHeight;
    self._naturalWidth = self._$image[0].naturalWidth;
    self.applyZoomAndPosition();    
    if (callback) callback();
  });
  this._$image.attr('src', src);
  this._$image.css('opacity', '1');
}

/**
 * The return value will have x,y as numbers relative
 * to the image width/height. Number less than or 0
 * or greater than 1 mean the point is out of bounds.
 * @public
 * @param {number} x - the client x-coordinate
 * @param {number} x - the client x-coordinate
 * @returns {{x: number, y: number}}
 */
Image.prototype.mapClientXYToImageProportionalXY = function(x, y) {

  /** @type {DOMRect} */
  const imageClientRect = this._$image[0].getBoundingClientRect();

  const relativeX = x - imageClientRect.left;
  const relativeY = y - imageClientRect.top;
  return {
    x: relativeX / this.getWidth(),
    y: relativeY / this.getHeight()
  }
}

/**
 * @public
 * @param {number} zoomFactor
 * @returns {void}
 */
Image.prototype.setZoomFactor = function(zoomFactor) {
  this._zoomFactor = zoomFactor;
  this.applyZoomAndPosition();
}