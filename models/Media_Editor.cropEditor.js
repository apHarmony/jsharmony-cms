
/** @typedef {import('./Media_Editor.imageEditorController').RelativeCropWindow} RelativeCropWindow */
/** @typedef {import('./Media_Editor.image').Image} Image */



/**
 * @class
 * @param {JQuery} $imageWrapper
 * @param {JQuery} $imageEditor
 * @param {Image} image
 */
function CropEditor($imageEditor, $imageWrapper, image) {

  /** @private @type {JQuery} */
  this._$editor = $imageEditor.find('[data-editor="crop"]');

  /** @private @type {Image} */
  this._image = image;

  /** @private @type {JQuery} */
  this._$cropWidthNum = this._$editor.find('[data-control-id="cropWidth"]');

  /** @private @type {JQuery} */
  this._$cropHeightNum = this._$editor.find('[data-control-id="cropHeight"]');

  /** @private @type {JQuery} */
  this._$cropWindowContainer = $imageWrapper.find('.cropWindowContainer');

  /** @private @type {JQuery} */
  this._$cropShadowTop = $imageWrapper.find('.cropWindowContainer [data-crop-shadow="top"]');

  /** @private @type {JQuery} */
  this._$cropShadowBottom = $imageWrapper.find('.cropWindowContainer [data-crop-shadow="bottom"]');

  /** @private @type {JQuery} */
  this._$cropShadowLeft = $imageWrapper.find('.cropWindowContainer [data-crop-shadow="left"]');

  /** @private @type {JQuery} */
  this._$cropShadowRight = $imageWrapper.find('.cropWindowContainer [data-crop-shadow="right"]');

  /** @private @type {JQuery} */
  this._$cropWindow = $imageWrapper.find('.cropWindowContainer .cropWindow');

  /** @private @type {JQuery} */
  this._$cropWindowHandleTopLeft = $imageWrapper.find('.cropWindowContainer [data-crop-handle="topLeft"]');

  /** @private @type {JQuery} */
  this._$cropWindowHandleTopRight = $imageWrapper.find('.cropWindowContainer [data-crop-handle="topRight"]');

  /** @private @type {JQuery} */
  this._$cropWindowHandleBottomLeft = $imageWrapper.find('.cropWindowContainer [data-crop-handle="bottomLeft"]');

  /** @private @type {JQuery} */
  this._$cropWindowHandleBottomRight = $imageWrapper.find('.cropWindowContainer [data-crop-handle="bottomRight"]');

  /** @private @type {RelativeCropWindow} */
  this._window = {
    x0: 0,
    x1: 1,
    y0: 0,
    y1: 1
  }

  /** 
   * @public
   * @type {(window: RelativeCropWindow) => void}
   **/
  this.onWindowChange = undefined;

  this.initCropWindowHandle(this._$cropWindowHandleTopRight, 'ne');
  this.initCropWindowHandle(this._$cropWindowHandleBottomRight, 'se');
  this.initCropWindowHandle(this._$cropWindowHandleBottomLeft, 'sw');
  this.initCropWindowHandle(this._$cropWindowHandleTopLeft, 'nw');

  this.initCropWindowDrag();
}

/**
 * @public
 * @returns {void}
 */
CropEditor.prototype.activate = function() {
  this._$cropWindowContainer.show();
  this._$editor.show();
  this.redrawWindow();
}

/**
 * @public
 * @returns {void}
 */
CropEditor.prototype.deactivate = function() {
  this._$cropWindowContainer.hide();
  this._$editor.hide();
}

/**
 * @static
 * @private
 * @type {number}
 */
CropEditor._dragNamespaceIndex = 0;

/**
 * @private
 * @param {RelativeCropWindow} window
 * @returns {void}
 */
CropEditor.prototype.drawWindow = function(window) {
  
  this._$cropWindowContainer
    .css('height', this._image.getHeight() + 'px')
    .css('width', this._image.getWidth() + 'px')
    .css('top', this._image.getOffsetTop() + 'px')
    .css('left', this._image.getOffsetLeft() + 'px');

  const windowLeft = Math.round(window.x0 * this._image.getWidth());
  const windowRight = Math.round(window.x1 * this._image.getWidth());
  const windowWidth = Math.max(0, windowRight - windowLeft);

  const windowTop = Math.round(window.y0 * this._image.getHeight());
  const windowBottom = Math.round(window.y1 * this._image.getHeight());
  const windowHeight = Math.max(0, windowBottom - windowTop);

  this._$cropWindow
    .css('height', windowHeight + 'px')
    .css('width', windowWidth + 'px')
    .css('top', windowTop + 'px')
    .css('left', windowLeft + 'px');

  const bottomShadowHeight = this._image.getHeight() - windowHeight - windowTop;
  const rightShadowWidth = this._image.getWidth() - windowWidth - windowLeft;

  this._$cropShadowTop
    .css('width', '100%')
    .css('height', windowTop + 'px');

  this._$cropShadowBottom
    .css('width', '100%')
    .css('height', bottomShadowHeight + 'px')
    .css('top', windowBottom + 'px');

  this._$cropShadowLeft
    .css('width', windowLeft + 'px')
    .css('height', windowHeight + 'px')
    .css('top', windowTop + 'px');

  this._$cropShadowRight
    .css('width', rightShadowWidth + 'px')
    .css('height', windowHeight + 'px')
    .css('left', windowRight + 'px')
    .css('top', windowTop + 'px');

  const absWindow = this.getAbsoluteCropWindow(window, this._image.getNaturalWidth(), this._image.getNaturalHeight());
  this._$cropHeightNum[0].value = absWindow.height;
  this._$cropWidthNum[0].value = absWindow.width;
}

/**
 * @public
 * @param {RelativeCropWindow} relativeWindow
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
CropEditor.prototype.getAbsoluteCropWindow = function(relativeWindow, imageWidth, imageHeight) {
  const x = Math.round(relativeWindow.x0 * imageWidth);
  const width = Math.round(relativeWindow.x1 * imageWidth) - x;
  const y = Math.round(relativeWindow.y0 * imageHeight);
  const height = Math.round(relativeWindow.y1 * imageHeight) - y;
  return {
    height: height,
    width: width,
    x: x,
    y: y
  };
}

/**
 * @private
 * @returns {void}
 */
CropEditor.prototype.initCropWindowDrag = function() {

  const self = this;

  this._$cropWindow.off('mousedown.media_editor').on('mousedown.media_editor', function(downEvent) {
    if (downEvent.target !== self._$cropWindow[0]) {
      return;
    }

    let lastX = downEvent.clientX;
    let lastY = downEvent.clientY;

    self.startDrag(self._$cropWindow, 
      function(event) {
        const imageHeight = self._image.getHeight();
        const imageWidth = self._image.getWidth();
        const absoluteWindow = self.getAbsoluteCropWindow(self._window, imageWidth, imageHeight);

        let absX0 = absoluteWindow.x;
        let absX1 = absoluteWindow.x + absoluteWindow.width;
        let absY0 = absoluteWindow.y;
        let absY1 = absoluteWindow.y + absoluteWindow.height;

        let dx = event.clientX - lastX;
        let dy = event.clientY - lastY;
        
        const isMovingRight = dx > 0;
        if (isMovingRight) {
          dx = Math.min(imageWidth - absX1, dx);
        } else {
          dx = Math.max(-absX0, dx);
        }

        const isMovingDown = dy > 0;
        if(isMovingDown) {
          dy = Math.min(imageHeight - absY1, dy);
        } else {
          dy = Math.max(-absY0, dy);
        }

        absX0 += dx;
        absX1 += dx;
        absY0 += dy;
        absY1 += dy;

        lastX += dx;
        lastY += dy

        self._window = {
          x0: absX0 / imageWidth,
          x1: absX1 / imageWidth,
          y0: absY0 / imageHeight,
          y1: absY1 / imageHeight
        };
        self.drawWindow(self._window);
      },
      function() {
        if (self.onWindowChange) self.onWindowChange(_.extend(self._window));
      }
    );
  });
}

/**
 * @private
 * @param {JQuery} $handleElement
 * @param {('nw' | 'ne' | 'se' | 'sw')}
 * @returns {void}
 */
CropEditor.prototype.initCropWindowHandle = function($handleElement, corner) {
  const self = this;
  $handleElement.off('mousedown.media_editor').on('mousedown.media_editor', function() {
    self.startDrag($handleElement, function(event) {

      const imageXY = self._image.mapClientXYToImageProportionalXY(event.clientX, event.clientY);
      const imageX = Math.max(0, Math.min(1, imageXY.x));
      const imageY = Math.max(0, Math.min(1, imageXY.y));

      const moveTopEdge = function() {
        self._window.y0 = Math.min(self._window.y1, imageY);
      };

      const moveBottomEdge = function() {
        self._window.y1 = Math.max(self._window.y0, imageY);
      };

      const moveRightEdge = function() {
        self._window.x1 = Math.max(self._window.x0, imageX);
      }

      const moveLeftEdge = function() {
        self._window.x0 = Math.min(self._window.x1, imageX);
      }

      switch (corner) {
        case 'ne':
          moveTopEdge()
          moveRightEdge();
          break;
        case 'se':
          moveBottomEdge();
          moveRightEdge();
          break;
        case 'sw':
          moveBottomEdge();
          moveLeftEdge();
          break;
        case 'nw':
          moveTopEdge();
          moveLeftEdge();
          break;
      }

      self.drawWindow(self._window);
    },
    function() {
      if (self.onWindowChange) self.onWindowChange(_.extend(self._window));
    });
  });
}

/**
 * @public
 * @returns {void}
 */
CropEditor.prototype.redrawWindow = function() {
  this.drawWindow(this._window);
}

/**
 * @public
 * @param {RelativeCropWindow} relativeCropWindow
 * @returns {void}
 */
CropEditor.prototype.setWindow = function(relativeCropWindow) {
  this._window = {
    x0: relativeCropWindow.x0,
    x1: relativeCropWindow.x1,
    y0: relativeCropWindow.y0,
    y1: relativeCropWindow.y1
  }

  this.drawWindow(this._window);
}

/**
 * @public
 * @param {boolean} show
 * @returns {void}
 */
CropEditor.prototype.showWindow = function(show) {
  show ? this._$cropWindowContainer.show() : this._$cropWindowContainer.hide();
  this.drawWindow(this._window);
}

/**
 * @private
 * @param {JQuery} $element
 * @param {(event: MouseEvent) => void} dragStartCb
 * @param {() => void} [dragEndCallback]
 * @returns {void}
 */
CropEditor.prototype.startDrag = function($element, dragStartCb, dragEndCallback) {

  const namespace = '_' + CropEditor._dragNamespaceIndex++;
  const mouseUpEventName = 'mouseup.' + namespace;
  const mouseMoveEventName = 'mousemove.' + namespace;

  const cleanup = function() {
    $(window).off(mouseUpEventName);
    $(window).off(mouseMoveEventName);
  }

  $(window).on(mouseUpEventName, function() {
    cleanup();
    if (dragEndCallback) dragEndCallback();
  });

  $(window).on(mouseMoveEventName, _.throttle(function(event) {
    window.getSelection().removeAllRanges();
    dragStartCb(event);
  }, 15));
}