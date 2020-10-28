/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is not neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
var fooba;fooba =
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/image.js":
/*!**********************!*\
  !*** ./src/image.js ***!
  \**********************/
/*! namespace exports */
/*! export Image [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__.r, __webpack_exports__, __webpack_require__.d, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"Image\": () => /* binding */ Image\n/* harmony export */ });\n/**\r\n * @class\r\n * @param {JQuery} $imageWrapper\r\n */\r\nfunction Image($imageWrapper, imageUrl) {\r\n\r\n  /** @private @type {JQuery} */\r\n  this._$imageWrapper = $imageWrapper;\r\n\r\n  /** @private @type {JQuery} */\r\n  this._$image = this._$imageWrapper.find('img');\r\n\r\n  /** @private @type {string} */\r\n  this._imageUrl = imageUrl;\r\n\r\n  /** @private @type {number} */\r\n  this._naturalWidth = 0;\r\n\r\n  /** @private @type {number} */\r\n  this._naturalHeight = 0;\r\n}\r\n\r\n/**\r\n * @public\r\n * @param {() => void} callback\r\n * @returns {void}\r\n */\r\nImage.prototype.initialize = function(callback) {\r\n  const self = this;\r\n  const loadEventName = 'load.media_editor_init';\r\n  this._$image.off(loadEventName).on(loadEventName, function() {\r\n    self._$image.off(loadEventName);\r\n    self._naturalHeight = self._$image[0].naturalHeight;\r\n    self._naturalWidth = self._$image[0].naturalWidth;\r\n    console.log(self);\r\n    if (callback) callback();\r\n  });\r\n}\n\n//# sourceURL=webpack://fooba/./src/image.js?");

/***/ }),

/***/ "./src/imageEditorController.js":
/*!**************************************!*\
  !*** ./src/imageEditorController.js ***!
  \**************************************/
/*! namespace exports */
/*! export ImageEditorController [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_require__.r, __webpack_exports__, __webpack_require__.d, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"ImageEditorController\": () => /* binding */ ImageEditorController\n/* harmony export */ });\n/* harmony import */ var _image__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./image */ \"./src/image.js\");\n\r\n\r\nfunction ImageEditorController() {\r\n\r\n  /** @private @type {JQuery} */\r\n  this._$editor = $('.xformcontainer.xelemjsHarmonyCMS_Media_Editor');\r\n\r\n  /** @private @type {JQuery} */\r\n  this._$imageWrapper = this._$editor.find('.imageWrapper');\r\n\r\n\r\n  /** @private @type {Image} */\r\n  this._image = new _image__WEBPACK_IMPORTED_MODULE_0__.Image(this._$imageWrapper, this.getImageUrlFromQuery());\r\n}\r\n\r\n/**\r\n * Get the image URL (without model params) from the query string.\r\n * @private\r\n * @returns {string}\r\n */\r\nImageEditorController.prototype.getImageUrlFromQuery = function() {\r\n  const mediaFileId = (this.getQuery()['media_file_id'] || '').replace(/#@JSHCMS$/i, '');\r\n  if (mediaFileId.length < 1) return '';\r\n\r\n  const url = jsh._BASEURL + '_funcs/media/' + mediaFileId;\r\n  return url;\r\n}\r\n\r\n/**\r\n * @returns {{[key: string]: string}\r\n */\r\nImageEditorController.prototype.getQuery = function() {\r\n  return (window.location.search || '').replace(/^\\?/, '').split('&').reduce(function(obj, kvp) {\r\n    const parts = (kvp || '').split('=');\r\n    obj[parts[0]] = decodeURIComponent(parts[1] || '');\r\n    return obj\r\n  }, {});\r\n}\r\n\r\n\r\nImageEditorController.prototype.initialize = function() {\r\n\r\n  this._image.initialize(() => {\r\n    debugger;\r\n  });\r\n}\n\n//# sourceURL=webpack://fooba/./src/imageEditorController.js?");

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/*! namespace exports */
/*! exports [not provided] [maybe used in main (runtime-defined)] */
/*! runtime requirements: __webpack_require__, __webpack_require__.r, __webpack_exports__, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _imageEditorController__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./imageEditorController */ \"./src/imageEditorController.js\");\n\r\n\r\n  jsh.App[modelid] = new (function() {\r\n    debugger;\r\n    this.oninit = function(xmodel) {\r\n\r\n      const f = new _imageEditorController__WEBPACK_IMPORTED_MODULE_0__.ImageEditorController();\r\n      f.initialize();\r\n\r\n\r\n      // this.getButton('closeEditor').off('click').on('click', function() {\r\n      //   _this.topToolbar.setVisibility(true);\r\n      //   $editor.find('[data-editor]').hide();\r\n      // });\r\n    }\r\n\r\n    this.onClickClose = function() {\r\n      this.sendToEditor();\r\n    }\r\n\r\n    this.sendToEditor = function() {\r\n      console.log('send to uedit')\r\n      if (!window.opener) {\r\n        XExt.Alert('Parent editor not found');\r\n      } else {\r\n        window.opener.postMessage('cms_media_editor:'+JSON.stringify(model), '*');\r\n      }\r\n    }\r\n  })();\n\n//# sourceURL=webpack://fooba/./src/index.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	// module exports must be returned from runtime so entry inlining is disabled
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__("./src/index.js");
/******/ })()
;