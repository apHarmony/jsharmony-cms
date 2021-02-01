
/** @typedef {import('./Media_Editor.image').Image} Image */
/** @typedef {import('./Media_Editor.bottomToolbar').BottomToolbar} BottomToolbar */
/** @typedef {import('./Media_Editor.topToolbar').TopToolbar} TopToolbar */
/** @typedef {import('./Media_Editor.rotateEditor').RotateEditor} RotateEditor */
/** @typedef {import('./Media_Editor.resizeEditor').ResizeEditor} ResizeEditor */
/** @typedef {import('./Media_Editor.cropEditor').CropEditor} CropEditor */
/** @typedef {import('./Media_Editor.contrastEditor').ContrastEditor} */
/** @typedef {import('./Media_Editor.colorEditor').ColorEditor} ColorEditor */
/** @typedef {import('./Media_Editor.brightnessEditor').BrightnessEditor} BrightnessEditor */
/** @typedef {import('./Media_Editor.gammaEditor').GammaEditor} GammaEditor */
/** @typedef {import('./Media_Editor.sharpnessEditor').SharpnessEditor} SharpnessEditor */

/**
 * @typedef {object} EditorBase
 * @property {() => void} activate 
 * @property {() => void} deactivate 
 * @property {() => string} getTitle 
 * @property {() => void} imageUpdated
 */

/** 
 * @typedef {object} EditorConfig 
 * @property {() => void} beforeActivate
 * @property {EditorBase} editor
 * @property {() => void} onReset
 * @property {() => void} onZoomChanged
 */

/**
 * @typedef {object} TransformModel
 * @property {BrightnessModel} brightness
 * @property {ColorModel} color
 * @property {ContrastModel} contrast
 * @property {CropModel} crop
 * @property {GammaModel} gamma
 * @property {InvertModel} invert
 * @property {ResizeModel} resize
 * @property {RotateModel} rotate
 * @property {SharpnessModel} sharpness
 * 

/**
 * @typedef {object} BrightnessModel
 * @property {number} brightness - range: -1..1
 */

/**
 * @typedef {object} ColorModel
 * @property {number} blueLevel - range: -1..1
 * @property {number} greenLevel - range: -1..1
 * @property {number} redLevel - range: -1..1
 */

/**
 * @typedef {object} ContrastModel
 * @property {number} contrast - range: -1..1
 */

/**
 * @typedef {object} CropModel
 * @property {RelativeCropWindow} window
 */

/**
 * @typedef {object} GammaModel
 * @property {number} gamma - range: -1..1
 */

/**
 * @typedef {object} InvertModel
 * @property {boolean} invert
 */

/**
 * @typedef {object} ResizeModel
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} RotateModel
 * @property {boolean} flipHorizontal
 * @property {boolean} flipVertical
 * @property {number} rotationAngle
 */

/**
 * @typedef {object} SharpnessModel
 * @property {number} sharpness - range: -1..1
 */

/**
 * @typedef {object} RawQueryObject 
 * @property {string | undefined} brightness - -1...1
 * @property {string | undefined} contrast - -1...1
 * @property {string | undefined} crop - "<x>,<y>,<width>,<height>"
 * @property {string | undefined} flip_horizontal - 0 or 1
 * @property {string | undefined} flip_vertical - 0 or 1
 * @property {string | undefined} gamma - -1...1
 * @property {string | undefined} invert - 0 or 1 
 * @property {string | undefined} levels - "<red>,<green>,<blue>"
 * @property {string | undefined} nocache - 1
 * @property {string| undefined} rotate - 0, 90, 180, 270
 * @property {string| undefined} resize - "<width>,<height>"
 * @property {string | undefined} sharpen - -1...1
 */

/**
 * @typedef {object} RelativeCropWindow 
 * @property {number} x0 - 0 to 1
 * @property {number} x1 - 0 to 1
 * @property {number} y0 - 0 to 1
 * @property {number} y1 - 0 to 1
 */

/**
 * @typedef {object} InputImageInfo 
 * @property {string} inputUrl
 * @property {UrlParts} zeroTransformUrlParts
 */

/**
 * @typedef {object} UrlParts
 * @property {string} fragment
 * @property {string} query
 * @property {string} url - scheme, host, port, path
 */

function ImageEditorController() {

  /** @private @type {InputImageInfo} */
  this._inputImageInfo = this.getInputImageInfo();

  /** @private @type {JQuery} */
  this._$editor = $('.xformcontainer.xelemjsHarmonyCMS_Media_Editor');

  /** @private @type {JQuery} */
  this._$editorAreaWrapper = this._$editor.find('.editorAreaWrapper');

  /** @private @type {JQuery} */
  this._$editorTitle = this._$editor.find('[data-editor-title-placeholder]');

  /** @private @type {JQuery} */
  this._$closeEditorButton = this._$editor.find('[data-action="closeEditor"]');

  /** @private @type {JQuery} */
  this._$imageWrapper = this._$editor.find('.imageWrapper');

  /** @private @type {BottomToolbar} */
  this._bottomToolbar = new BottomToolbar(this._$editor);

  /** @private @type {TopToolbar} */
  this._topToolbar = new TopToolbar(this._$editor);

  /** @private @type {Image} */
  this._image = new Image(this._$imageWrapper, this.buildUrl(this._inputImageInfo.zeroTransformUrlParts, 'nocache=1'));

  /** @private @type {number} */
  this._zoomIncrement = 0;

  /** @private @type {TransformModel} */
  this._model = this.getZeroTransformModel();

  /** @private @type {EditorConfig | undefined} */
  this._activeEditor = undefined;

  /** @private  @type{{[editor: string]: EditorConfig}} */
  this._editors = this.createEditors();
}

/**
 * @private
 * @param {'horizontal' | 'vertical'} rawDirection
 * @returns {void}
 */
ImageEditorController.prototype.applyFlip = function(rawDirection) {

  const flipHorizontal = rawDirection === 'horizontal';

  if (flipHorizontal) {
    this._model.rotate.flipHorizontal = !this._model.rotate.flipHorizontal;

  } else {
    this._model.rotate.flipVertical = !this._model.rotate.flipVertical;
  }

  this.loadImage(false);
}

/**
 * @private
 * @param {'left' | 'right'} rawDirection
 * @returns {void}
 */
ImageEditorController.prototype.applyRotation = function(rawDirection) {
  const hasSingleFlip = (this._model.rotate.flipHorizontal ^ this._model.rotate.flipVertical) === 1;
  const rotateRight = (rawDirection === 'right' && !hasSingleFlip) || (rawDirection === 'left' && hasSingleFlip);
  const currentAngle = this._model.rotate.rotationAngle || 0;
  const wasSideways = currentAngle === 90 || currentAngle === 270;
  if (rotateRight) {
    this._model.rotate.rotationAngle = (currentAngle + 90) % 360;
  } else {
    this._model.rotate.rotationAngle = (currentAngle + 270) % 360;
  }

  const isSideways = this._model.rotate.rotationAngle === 90 || this._model.rotate.rotationAngle === 270;
  if (wasSideways !== isSideways) {
    const tempY = this._model.resize.height || 0;
    this._model.resize.height = this._model.resize.width;
    this._model.resize.width = tempY;
  }

  this.loadImage(false);
}

/**
 * Don't call this unless the image is loaded!
 * @private
 * @param {string} query - should not be decoded.
 * @returns {TransformModel}
 */
ImageEditorController.prototype.buildModelFromQuery = function(query) {

  const self = this;

  /** @type {Partial<RawQueryObject>} */
  const queryObject = this.parseQueryString(query);

  const model = this.getZeroTransformModel();

  model.rotate.rotationAngle = this.parseInt(queryObject.rotate, 0);
  model.rotate.flipHorizontal = queryObject.flip_horizontal === '1';
  model.rotate.flipVertical = queryObject.flip_vertical === '1';
  
  if (model.rotate.flipVertical && model.rotate.flipHorizontal) {
    model.rotate.flipHorizontal = false;
    model.rotate.flipVertical = false;
    model.rotate.rotationAngle = (model.rotate.rotationAngle + 180) % 360;
  }
  
  const isSideways = model.rotate.rotationAngle === 90 || model.rotate.rotationAngle === 270;
  const hasSingleFlip = (model.rotate.flipHorizontal ^ model.rotate.flipVertical) === 1;
  if (isSideways && hasSingleFlip) {
    const tempFlip = model.rotate.flipHorizontal;
    model.rotate.flipHorizontal = model.rotate.flipVertical;
    model.rotate.flipVertical = tempFlip;
  }

  if (queryObject.resize) {
    const parts = queryObject.resize.split(',');
    model.resize.width = this.parseInt(parts[isSideways ? 1 : 0], 0);
    model.resize.height = this.parseInt(parts[isSideways ? 0 : 1], 0);
  }

  if (queryObject.crop) {
    const values = _.map(queryObject.crop.split(','), function(value) { return self.parseFloat(value, 0); });
    // values: [x, y, width, height]
    model.crop.window.x0 = values[0]; 
    model.crop.window.x1 = values[0] + values[2];
    model.crop.window.y0 = values[1];
    model.crop.window.y1 = values[1] + values[3];
  }

  if (queryObject.brightness) {
    model.brightness.brightness = this.parseFloat(queryObject.brightness, 0);
  }

  if (queryObject.contrast) {
    model.contrast.contrast = this.parseFloat(queryObject.contrast, 0);
  }

  if (queryObject.gamma) {
    model.gamma.gamma = this.parseFloat(queryObject.gamma, 0);
  }

  model.invert.invert = queryObject.invert === '1'
  
  if (queryObject.levels) {
    const levels = queryObject.levels.split(',');
    model.color.redLevel = this.parseFloat(levels[0], 0);
    model.color.greenLevel = this.parseFloat(levels[1], 0);
    model.color.blueLevel = this.parseFloat(levels[2], 0);
  }
  
  if (queryObject.sharpen) {
    model.sharpness.sharpness = this.parseFloat(queryObject.sharpen, 0);
  }

  return model;
}

/**
 * @private
 * @param {UrlParts} urlParts
 * @param {string | undefined} additionalQuery
 * @returns {string}
 */
ImageEditorController.prototype.buildUrl = function(urlParts, additionalQuery) {
  const queryParts = [];
  if (urlParts.query) queryParts.push(urlParts.query);
  if (additionalQuery) queryParts.push(additionalQuery);
  const query = queryParts.join('&');
  return urlParts.url + (query ? ('?' + query) : '') + (urlParts.fragment ? ('#' + urlParts.fragment) : '');
}

/**
 * @private
 * @param {TransformModel} model
 * @returns {RawQueryObject}
 */
ImageEditorController.prototype.buildQueryObjectFromModel = function(model) {
  if (!model) return '';
  
  /** @type {Partial<RawQueryObject>} */
  const query = {};

  let rotationAngle = model.rotate ? model.rotate.rotationAngle || 0 : 0;
  const isSideways = rotationAngle === 90 || rotationAngle === 270;
  let flipHorizontal = model.rotate ? model.rotate.flipHorizontal : false;
  let flipVertical = model.rotate ? model.rotate.flipVertical : false;

  if (flipVertical && flipHorizontal) {
    flipHorizontal = false;
    flipVertical = false;
    rotationAngle = (rotationAngle + 180) % 360;
  }

  const hasSingleFlip = (flipHorizontal ^ flipVertical) === 1;
  if (isSideways && hasSingleFlip) {
    const tempFlip = flipHorizontal;
    flipHorizontal = flipVertical;
    flipVertical = tempFlip;
  }

  if (flipHorizontal) query.flip_horizontal = '1';
  if (flipVertical) query.flip_vertical = '1';
  if (rotationAngle) query.rotate = rotationAngle;

  const isCropFullImage =
    model.crop.window.x0 === 0 &&
    model.crop.window.x1 === 1 &&
    model.crop.window.y0 === 0 &&
    model.crop.window.y1 === 1;
  if (!isCropFullImage) {
    const window = {
      x: model.crop.window.x0,
      y: model.crop.window.y0,
      height: model.crop.window.y1 - model.crop.window.y0,
      width: model.crop.window.x1 - model.crop.window.x0
    };

    const hasCrop = window.height > 0 && window.width > 0;
    if (hasCrop) {
      const values = [
        window.x || 0,
        window.y || 0,
        window.width || 0,
        window.height || 0,
      ];
      query.crop = values.join(',');
    }
  }

  if (model.resize != undefined) {
    const hasResize =
      model.resize.width > 0 ||
      model.resize.height > 0;

    if (hasResize) {
      const width = model.resize.width || 0;
      const height = model.resize.height || 0;
      const values = [
        isSideways ? height : width,
        isSideways ? width : height
      ];
      query.resize = values.join(',');
    }
  }

  const hasBrightnessChange = model.brightness.brightness !== 0;
  if (hasBrightnessChange) query.brightness = model.brightness.brightness;

  const hasContrastChange = model.contrast.contrast !== 0;
  if (hasContrastChange) query.contrast = model.contrast.contrast;
  
  const hasColorLevelChange = 
    model.color.blueLevel !== 0 ||
    model.color.greenLevel !== 0 ||
    model.color.redLevel !== 0;

  if (hasColorLevelChange) {
    const values = [
      model.color.redLevel,
      model.color.greenLevel,
      model.color.blueLevel
    ];
    query.levels = values.join(',');
  }

  const hasGammaChange = model.gamma.gamma !== 0;
  if (hasGammaChange) query.gamma = model.gamma.gamma;

  const invertImage = model.invert.invert;
  if (invertImage) query.invert = '1';

  const hasSharpnessChange = model.sharpness.sharpness !== 0;
  if (hasSharpnessChange) query.sharpen = model.sharpness.sharpness;

  query.nocache = '1';

  return query;
}

/**
 * @private
 * @returns {{[editor: string]: EditorConfig}}
 */
ImageEditorController.prototype.createEditors = function() {

  const self = this;

  /**  @type{{[editor: string]: EditorConfig}} */
  const editors = {
    // Ensure the key matches the 'data-editor' attribute
    // defined in the EJS for each editor type.

    brightness: {
      editor: new BrightnessEditor(this._$editor),
      beforeActivate: function() {
        self._editors.brightness.editor.setBrightness(self._model.brightness.brightness);
      },
      onReset: function() {
        self._editors.brightness.editor.setBrightness(self._model.brightness.brightness);
      },
      onZoomChanged: function() {}
    },
    color: {
      editor: new ColorEditor(this._$editor),
      beforeActivate: function() {
        self._editors.color.editor.setLevels(self._model.color.redLevel, self._model.color.greenLevel, self._model.color.blueLevel);
      },
      onReset: function() {
        self._editors.color.editor.setLevels(self._model.color.redLevel, self._model.color.greenLevel, self._model.color.blueLevel);        
      },
      onZoomChanged: function() {}
    },
    contrast: {
      editor: new ContrastEditor(this._$editor),
      beforeActivate: function() {
        self._editors.contrast.editor.setContrast(self._model.contrast.contrast);
      },
      onReset: function() {
        self._editors.contrast.editor.setContrast(self._model.contrast.contrast);
      },
      onZoomChanged: function() {}
    },
    crop: { 
      editor: new CropEditor(this._$editor, this._$imageWrapper, this._image),
      beforeActivate: function() { 
        self._editors.crop.editor.setWindow(self.transformRelativeWindowToView(self._model.crop.window, self._model.rotate));
      },
      onReset: function() {
        self._editors.crop.editor.setWindow(self.transformRelativeWindowToView(self._model.crop.window, self._model.rotate));
      },
      onZoomChanged: function() {
        self._editors.crop.editor.redrawWindow();
      }
    },
    gamma: {
      editor: new GammaEditor(this._$editor),
      beforeActivate: function() {
        self._editors.gamma.editor.setGamma(self._model.gamma.gamma);
      },
      onReset: function() {
        self._editors.gamma.editor.setGamma(self._model.gamma.gamma);
      },
      onZoomChanged: function() {}
    },
    resize: { 
      editor: new ResizeEditor(this._$editor, this._image),
      beforeActivate: function() {},
      onReset: function() {},
      onZoomChanged: function() {}
    },
    rotate: { 
      editor: new RotateEditor(this._$editor),
      beforeActivate: function() {},
      onReset: function() {},
      onZoomChanged: function() {}
    },
    sharpness: {
      editor: new SharpnessEditor(this._$editor),
      beforeActivate: function() {
        self._editors.sharpness.editor.setSharpness(self._model.sharpness.sharpness);
      },
      onReset: function() {
        self._editors.sharpness.editor.setSharpness(self._model.sharpness.sharpness);
      },
      onZoomChanged: function() {}
    }
  };
  return editors;
}

/**
 * @private
 * @param {RelativeCropWindow} window
 * @param {'horizontal' | 'vertical'} direction
 * @return {RelativeCropWindow}
 */
ImageEditorController.prototype.flipRelativeWindow = function(window, direction) {

  /** @type {RelativeCropWindow} */
  const flippedWindow = {};

  if (direction === 'horizontal') {
    flippedWindow.x0 = 1 - window.x1;
    flippedWindow.x1 = 1 - window.x0;
    flippedWindow.y0 = window.y0;
    flippedWindow.y1 = window.y1;
  } else if (direction === 'vertical') {
    flippedWindow.x0 = window.x0;
    flippedWindow.x1 = window.x1;
    flippedWindow.y0 = 1 - window.y1;
    flippedWindow.y1 = 1 - window.y0;
  } else {
    throw new Error('Unknown direction: ' + direction);
  }

  return flippedWindow;
}

/**
 * @private
 * @returns {InputImageInfo}
 */
ImageEditorController.prototype.getInputImageInfo = function() {

  const inputQueryObject = this.parseQueryString(window.location.search || '');
  
  const imageSourceParts = this.getUrlParts(inputQueryObject.image_source || '');
  const imageSourceQueryObject = this.parseQueryString(imageSourceParts.query);
  
  const transformParams = {
    'brightness': true,
    'contrast': true,
    'crop': true,
    'flip_horizontal': true,
    'flip_vertical': true,
    'gamma': true,
    'invert': true,
    'levels': true,
    'rotate': true,
    'resize': true,
    'sharpen': true
  };

  const zeroTransformParams = [];
  _.forEach(_.entries(imageSourceQueryObject), function(kvp) {
    const name = kvp[0];
    if (transformParams[name]) return;
    zeroTransformParams.push(name + '=' + encodeURIComponent(kvp[1]));
  });

  /** @type {InputImageInfo} */
  const info = {    
    url: inputQueryObject.image_source || '',
    zeroTransformUrlParts: {
      fragment: imageSourceParts.fragment,
      query: zeroTransformParams.join('&'),
      url: imageSourceParts.url
    }
  }

  return info;
}

/**
 * @private
 * @param {string} url
 * @returns {UrlParts}
*/
ImageEditorController.prototype.getUrlParts = function(url) {
  url = url || '';
  const fragmentIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  const fragment = (fragmentIndex > -1) ? url.slice(fragmentIndex + 1) : '';
  url = (fragmentIndex > -1) ? url.slice(0, fragmentIndex) : url;

  const query = (queryIndex > -1) ? url.slice(queryIndex + 1) : '';
  url = (queryIndex > -1) ? url.slice(0, queryIndex) : url;

  /** @type {UrlParts} */
  const parts = {
    fragment: fragment,
    query: query,
    url: url
  };
  return parts;
}

/**
 * @private
 * @returns {TransformModel}
 */
ImageEditorController.prototype.getZeroTransformModel = function() {
  
  /** @type {TransformModel} */
  const model = {
    brightness: {
      brightness: 0
    },
    color: {
      blueLevel: 0,
      greenLevel: 0,
      redLevel: 0
    },
    contrast: {
      contrast: 0
    },
    crop: {
      window: {
        x0: 0,
        x1: 1,
        y0: 0,
        y1: 1
      }
    },
    gamma: {
      gamma: 0
    },
    invert: {
      invert: false
    },
    resize: {
      height: 0,
      width: 0
    },
    rotate: {
      flipHorizontal: false,
      flipVertical: false,
      rotationAngle: 0
    },
    sharpness: {
      sharpness: 0
    } 
  };

  return model;
}

/**
 * @private
 * @param {boolean} zoomIn
 * @returns {void}
 */
ImageEditorController.prototype.incrementZoom = function(zoomIn) {
  const MAX_ZOOM = 2;
  const ZOOM_STEP = MAX_ZOOM / 10;

  if (zoomIn) {
    this._zoomIncrement = Math.min(MAX_ZOOM, this._zoomIncrement + ZOOM_STEP);
  } else {
    this._zoomIncrement = Math.max(0, this._zoomIncrement - ZOOM_STEP);
  }

  this._image.setZoomFactor(this._zoomIncrement + 1);
  if (this._activeEditor && this._activeEditor.onZoomChanged) this._activeEditor.onZoomChanged();
}

/**
 * @public
 * @returns {void}
 */
ImageEditorController.prototype.initialize = function() {
  const self = this;

  this._$closeEditorButton.on('click.media_editor', function() { self.setEditorMode(undefined); });

  this._bottomToolbar.onCancel = function() {
    window.close();
  }
  
  this._bottomToolbar.onDone = function() {
    self.sendToEditor();
    window.close();
  };

  this._bottomToolbar.onSetZoom = function(zoomIn) { self.incrementZoom(zoomIn); }

  this._topToolbar.onInvertImage = function() {
    self._model.invert = {
      invert: !self._model.invert.invert
    };
    self.loadImage(false);
  }
  this._topToolbar.onSetMode = function(mode) { self.setEditorMode(mode); }

  this._bottomToolbar.onReset = function() {
    self._model  = self.getZeroTransformModel();
    self._cropResizeFactor = { xFactor: 1, yFactor: 1 };
    if (self._activeEditor && self._activeEditor.onReset) self._activeEditor.onReset();
    self.loadImage(false);
  }

  this._editors.brightness.editor.onBrightnessChange = function(brightness) {
    self._model.brightness = {
      brightness: brightness
    };
    self.loadImage(false);
  }

  this._editors.color.editor.onLevelsChanged = function(red, green, blue) {
    self._model.color = {
      blueLevel: blue,
      greenLevel: green,
      redLevel: red
    };
    self.loadImage(false);
  }

  this._editors.contrast.editor.onContrastChange = function(contrast) {
    self._model.contrast = {
      contrast: contrast
    };
    self.loadImage(false);
  }

  this._editors.crop.editor.setWindow(this._model.crop.window);
  this._editors.crop.editor.onWindowChange = function(window) {

    self._model.crop = {
      window: self.transformRelativeWindowToModel(window, self._model.rotate)
    };   

    const rotationAngle = self._model.rotate.rotationAngle || 0;
    const isSideways = rotationAngle === 90 || rotationAngle === 270;
    

    const xFactor = (isSideways ? self._image.getNaturalHeight() : self._image.getNaturalWidth()) / self._image.getOriginalWidth();
    const yFactor = (isSideways ? self._image.getNaturalWidth() : self._image.getNaturalHeight())  / self._image.getOriginalHeight();  
    const isScaled = xFactor !== 1 || yFactor !== 1;
    if (isScaled) {
      const absCropWindow = self._editors.crop.editor.getAbsoluteCropWindow(self._model.crop.window, self._image.getOriginalWidth(), this._image.getOriginalHeight());

      const imageWidth = Math.round(absCropWindow.width * xFactor);
      const imageHeight = Math.round(absCropWindow.height * yFactor);
      
      self._model.resize = {
        height: isSideways ? imageWidth : imageHeight,
        width: isSideways ? imageHeight :imageWidth
      };
    } else {
      self._model.resize = {
        height: 0,
        width: 0
      }
    }
  }

  this._editors.gamma.editor.onGammaChange = function(gamma) {
    self._model.gamma = {
      gamma: gamma
    };
    self.loadImage(false);
  }

  this._editors.rotate.editor.onFlipHorizontal = function() { self.applyFlip('horizontal'); }
  this._editors.rotate.editor.onFlipVertical = function() { self.applyFlip('vertical'); }
  this._editors.rotate.editor.onRotateLeft = function() { self.applyRotation('left'); }
  this._editors.rotate.editor.onRotateRight = function() { self.applyRotation('right'); }

  this._editors.resize.editor.onDimensionsChange = function(x, y) {

    self._model.resize.height = y || 0;
    self._model.resize.width = x || 0;
    self.loadImage(false);
  }

  this._editors.sharpness.editor.onSharpnessChange = function(sharpness) {
    self._model.sharpness = {
      sharpness: sharpness
    }
    self.loadImage(false);
  }

  this._image.initialize(function() {
    self._model = self.buildModelFromQuery(self.getUrlParts(self._inputImageInfo.url).query);
    self._image.loadImage(self._inputImageInfo.url);
  });
}

/**
 * @private
 * @param {boolean} forCrop - true if loading image for crop
 * @param {() => void} callback
 * @returns {void}
 */
ImageEditorController.prototype.loadImage = function(forCrop, callback) {

  const self = this;

  /** @type {TransformModel} */
  const model = _.extend({}, this._model);

  const queryObject = this.buildQueryObjectFromModel(model);

  let cropResizeParam = '';
  if (forCrop) {
    const hasResize = model.resize.height > 0 || model.resize.width > 0;
    if (hasResize) {
      const absCropWindow = this._editors.crop.editor.getAbsoluteCropWindow(model.crop.window, this._image.getOriginalWidth(), this._image.getOriginalHeight());
      
      let resizeXFactor = 0;
      let resizeYFactor = 0;
      const rotationAngle = this._model.rotate.rotationAngle || 0;
      const isSideways = rotationAngle === 90 || rotationAngle === 270;

      if (model.resize.height > 0) {
        resizeYFactor = isSideways ? 
          (model.resize.width / absCropWindow.height) : (model.resize.height / absCropWindow.height);
      }
      if (model.resize.width > 0) {
        resizeXFactor = isSideways ? 
          (model.resize.height / absCropWindow.width) : (model.resize.width / absCropWindow.width);        
      }
      resizeXFactor = resizeXFactor > 0 ? resizeXFactor : resizeYFactor;
      resizeYFactor = resizeYFactor > 0 ? resizeYFactor : resizeXFactor;
      const imageWidth = Math.round(resizeXFactor * this._image.getOriginalWidth());
      const imageHeight = Math.round(resizeYFactor * this._image.getOriginalHeight());
      
      const resizeValue = [
        imageWidth,
        imageHeight
      ].join(',');
      cropResizeParam = 'resize=' + encodeURIComponent(resizeValue);
    }
  }

  const allParams = [];
  const imageLoadParams = [];
  _.forEach(_.entries(queryObject), function(kvp) {
    const paramName = kvp[0];
    let qParam = paramName + '=' + encodeURIComponent(kvp[1]);
    allParams.push(qParam)

    if (forCrop && paramName === 'crop') qParam = undefined;
    if (forCrop && paramName === 'resize') qParam = cropResizeParam;
    if (qParam) imageLoadParams.push(qParam);
  });

  const imageLoadQuery = imageLoadParams.join('&');
  const allParamQuery = allParams.join('&');

  const src = this.buildUrl(this._inputImageInfo.zeroTransformUrlParts, imageLoadQuery);
  this._image.loadImage(src, function() {
    self._model = self.buildModelFromQuery(allParamQuery);
    if (self._activeEditor && self._activeEditor.editor.imageUpdated) self._activeEditor.editor.imageUpdated();
    if (callback) callback();
  });
}

/**
 * @private
 * @param {string | undefined} value
 * @param {number | undefined} defaultValue - number to use if value is NAN
 * @returns {number | undefined}
 */
ImageEditorController.prototype.parseFloat = function(value, defaultValue) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * @private
 * @param {string | undefined} value
 * @param {number | undefined} defaultValue - number to use if value is NAN
 * @returns {number | undefined}
 */
ImageEditorController.prototype.parseInt = function(value, defaultValue) {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * @private
 * @param {string} queryString
 * @returns {{[key: string]: string}
 */
ImageEditorController.prototype.parseQueryString = function(queryString) {
  return (queryString|| '').replace(/^\?/, '').split('&').reduce(function(obj, kvp) {
    const parts = (kvp || '').split('=');
    obj[parts[0]] = decodeURIComponent(parts[1] || '');
    return obj
  }, {});
}

/**
 * @private
 * @param {RelativeCropWindow} window
 * @param {number} angle - 0, ±90, ±180, ±270
 * @returns {RelativeCropWindow}
 */
ImageEditorController.prototype.rotateRelativeWindow = function(window, angle) {

  /** @type {RelativeCropWindow} */
  const rotatedWindow = {};
  if (angle === 0) {
    rotatedWindow.x0 = window.x0;
    rotatedWindow.x1 = window.x1;
    rotatedWindow.y0 = window.y0;
    rotatedWindow.y1 = window.y1;
  } else if (angle === 270 || angle === -90) {
    rotatedWindow.x0 = window.y0;
    rotatedWindow.x1 = window.y1;
    rotatedWindow.y0 = 1 - window.x1;
    rotatedWindow.y1 = 1 - window.x0;
  } else if (angle === 180 || angle === -180) {
    rotatedWindow.x0 = 1 - window.x1;
    rotatedWindow.x1 = 1 - window.x0;
    rotatedWindow.y0 = 1 - window.y1;
    rotatedWindow.y1 = 1 - window.y0;
  } else if (angle === 90 || angle === -270) {
    rotatedWindow.x0 = 1 - window.y1;
    rotatedWindow.x1 = 1 - window.y0;
    rotatedWindow.y0 = window.x0;
    rotatedWindow.y1 = window.x1;
  } else {
    throw new Error('Invalid angle ' + angle);
  }
  return rotatedWindow;
}

ImageEditorController.prototype.sendToEditor = function() {  
  if (!window.opener) {
    XExt.Alert('Parent editor not found');
  } else {

    const transformQuery = _.map(_.entries(this.buildQueryObjectFromModel(this._model)), function(kvp) {
      return kvp[0] + '=' + encodeURIComponent(kvp[1])
    }).join('&');

    const data = {
      image_source: this.buildUrl(this._inputImageInfo.zeroTransformUrlParts, transformQuery)
    }
    window.opener.postMessage('cms_media_editor:'+JSON.stringify(data), '*');
  }
}

/**
 * @private
 * @param {string | undefined} mode - matches key in _editors
 * @param {() => void} imageLoadCallback
 * @returns {void}
 */ 
ImageEditorController.prototype.setEditorMode = function(mode, imageLoadCallback) {
  const self = this;
  
  this._topToolbar.setVisibility(false)
  this._$editorAreaWrapper.hide();
  this._$editorTitle.empty();

  if (this._activeEditor && this._activeEditor.editor.deactivate) this._activeEditor.editor.deactivate();

  this._activeEditor = this._editors[mode];
  if (!this._activeEditor) {
    this._topToolbar.setVisibility(true);
    this.loadImage(false);
    return;
  }

  const isForCrop = mode === 'crop';

  this.loadImage(isForCrop, function() {
    if (self._activeEditor) {
      if (self._activeEditor.beforeActivate) self._activeEditor.beforeActivate();
      if (self._activeEditor.editor.activate) self._activeEditor.editor.activate();
      if (self._activeEditor.editor.getTitle) self._$editorTitle.text(self._activeEditor.editor.getTitle());
    }
    self._$editorAreaWrapper.show();
    if (imageLoadCallback) imageLoadCallback();
  });

  this._mode = mode;
}

/**
 * @private
 * @param {RelativeCropWindow} window
 * @param {RotateModel} rotateModel
 * @returns {RelativeCropWindow} 
 */
ImageEditorController.prototype.transformRelativeWindowToModel = function(window, rotateModel) {

  const rotationAngle = rotateModel.rotationAngle || 0;
  let transformedWindow = this.rotateRelativeWindow(window, (360 - rotationAngle) % 360);

  const isSideways = rotationAngle === 90 || rotationAngle === 270;

  if ((!isSideways && rotateModel.flipHorizontal) || (isSideways && rotateModel.flipVertical)) {
    transformedWindow = this.flipRelativeWindow(transformedWindow, 'horizontal');
  }
  if ((!isSideways && rotateModel.flipVertical) || (isSideways && rotateModel.flipHorizontal)) {
    transformedWindow = this.flipRelativeWindow(transformedWindow, 'vertical');
  }

  return transformedWindow;
}

/**
 * @private
 * @param {RelativeCropWindow} window
 * @param {RotateModel} rotateModel
 * @returns {RelativeCropWindow} 
 */
ImageEditorController.prototype.transformRelativeWindowToView = function(window, rotateModel) {

  const rotationAngle = rotateModel.rotationAngle || 0;
  let transformedWindow = this.rotateRelativeWindow(window, rotationAngle);
  if (rotateModel.flipHorizontal) {
    transformedWindow = this.flipRelativeWindow(transformedWindow, 'horizontal');
  }
  if (rotateModel.flipVertical) {
    transformedWindow = this.flipRelativeWindow(transformedWindow, 'vertical');
  }

  return transformedWindow;
}