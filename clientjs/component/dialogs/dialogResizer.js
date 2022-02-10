/*
Copyright 2020 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

var _ = require('lodash');

/**
 * @class
 * @classdesc Use to resize dialogs when content changes. Otherwise
 * dialogs will not be rendered with correct locations or sizes
 * (especially when content changes dynamically after opening).
 * @param {HTMLElement} wrapper
 * @param {Object} jsh
 */
function DialogResizer(wrapper, jsh) {

  /** @private @type {Object} */
  this._jsh = jsh;

  /** @private @type {Function} */
  this._execCleanUp = function() {};


  if (typeof ResizeObserver !== 'undefined') {
    // Using ResizeObserver is the absolute best way to do this.
    // But it is not available in IE.
    this.startResizeObserver(wrapper);
    // This works pretty well for IE 11.
  } else if (typeof MutationObserver !== 'undefined') {
    this.startMutationObserver(wrapper);
  } else {
    // Fallback of ResizeObserver and MutationObserver are not supported.
    // (Ideally, ResizeObserver would be pollyfilled by the build system or even manually)
    this.startIntervalResize(wrapper);
  }
}

/**
 * @private
 * @static
 * @param {Function} cb - called for each interval
 * @returns {Function} The return value is a function that must be called for cleanup.
 */
DialogResizer.addIntervalCallback = function(cb) {

  this._intervalCbId  = this._intervalCbId || 0;
  this._intervalCallbacks = this._intervalCallbacks || [];

  this._intervalCbId++;
  var id = this._intervalCbId;
  this._intervalCallbacks.push({ id: id, cb: cb });

  if (this._intervalCallbacks.length === 1) {
    if (this._intervalId != undefined) {
      clearInterval(this._intervalId);
    }
    this._intervalId = setInterval(function() {
      _.forEach(DialogResizer._intervalCallbacks, function(item) { item.cb(); });
    }, 100);
  }

  return function() {
    var index = DialogResizer._intervalCallbacks.findIndex(function(item) { return item.id === id; });
    if (index > -1) {
      DialogResizer._intervalCallbacks.splice(index, 1);
    }
    if (DialogResizer._intervalCallbacks.length < 1 && DialogResizer._intervalId != undefined) {
      clearInterval(DialogResizer._intervalId);
      DialogResizer._intervalId = undefined;
    }
  };
};

/**
 * This must be called when the dialog is closed
 * to ensure proper cleanup is executed
 * @public
 */
DialogResizer.prototype.closeDialog = function() {
  if (this._execCleanUp) {
    this._execCleanUp();
  }
};

/**
 * Perform the resize on the given element.
 * @private
 * @param {HTMLElement} wrapper
 */
DialogResizer.prototype.resize = function(wrapper) {
  this._jsh.XWindowResize();
};

/**
 * Use a interval resize strategy to resize the dialog.
 * This should be used as a last resort if ResizeObserver
 * or MutationObserver is not supported.
 * @private
 * @param {HTMLElement} wrapper
 */
DialogResizer.prototype.startIntervalResize = function(wrapper) {
  var _this = this;
  this._execCleanUp = DialogResizer.addIntervalCallback(function() {
    _this.resize(wrapper);
  });
};

/**
 * Use a MutationObserver resize strategy to resize the dialog.
 * This should be used only if ResizeObserver
 * not supported.
 * @private
 * @param {HTMLElement} wrapper
 */
DialogResizer.prototype.startMutationObserver = function(wrapper) {
  var _this = this;
  var observer = new MutationObserver(function() {
    _this.resize(wrapper);
  });
  observer.observe(wrapper, { childList: true, subtree: true });
  this._execCleanUp = function() {
    observer.disconnect();
  };
};

/**
 * Use a ResizeObserver resize strategy to resize the dialog.
 * This is the 100%, absolute best way to handle resize.
 * @private
 * @param {HTMLElement} wrapper
 */
DialogResizer.prototype.startResizeObserver = function(wrapper) {
  var _this = this;
  var observer = new ResizeObserver(function() {
    _this.resize(wrapper);
  });
  observer.observe(wrapper);
  this._execCleanUp = function() {
    observer.unobserve(wrapper);
  };
};

exports = module.exports = DialogResizer;