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

/**
 * @classdesc A static service for ensuring the overlay appears
 * between the last modal in the modal stack and all other modals.
 * @class
 * @static
 */
function OverlayService(dialog) {
  this.dialog = dialog;
  this.jsh = dialog._jsh;
}

/**
 * @private
 * @static
 * @type {JQuery[]}
 */
OverlayService._dialogStack = [];

/**
 * Remove the last dialog element from the overlay stack.
 * @public
 * @static
*/
OverlayService.prototype.popDialog = function() {

  OverlayService._dialogStack.pop();
  if (OverlayService._dialogStack.length < 1) {
    this.jsh.$('.xdialogblock .xdialogoverlay').remove();
    return;
  }

  var $overlay = this.getOverlay();
  var $dialog = this.jsh.$(OverlayService._dialogStack[OverlayService._dialogStack.length - 1]);
  var zIndex = this.getZIndex($dialog);
  $overlay.css('z-index', zIndex);
  $dialog.before($overlay);
}

/**
 * Add a dialog element to the overlay stack.
 * @public
 * @static
 * @param {(HTMLElement | JQuery)} dialog
*/
OverlayService.prototype.pushDialog = function(dialog) {
  var zIndex = this.getZIndex(dialog);
  var $overlay = this.getOverlay();
  $overlay.css('z-index', zIndex);
  OverlayService._dialogStack.push(this.jsh.$(dialog));
  this.jsh.$(dialog).before($overlay);
}

/**
 * Get the overlay. Creates and adds to DOM if it doesn't already
 * exist.
 * @private
 * @static
 * @returns {JQuery}
 */
OverlayService.prototype.getOverlay = function() {
  var $dialogBlock = this.jsh.$('.xdialogblock');
  var $childOverlay = $dialogBlock.find('.xdialogoverlay');
  if ($childOverlay.length > 0) {
    return $childOverlay;
  }

  $childOverlay = this.jsh.$('<div class="xdialogoverlay"></div>');
  $dialogBlock.prepend($childOverlay);

  $childOverlay.off('click').on('click', function() {
    $dialogBlock.click();
  });

  return $childOverlay;
}

/**
 * Get the z-index for the element.
 * @private
 * @static
 * @param {(HTMLElement | JQuery)} element
 * @returns {number}
 */
OverlayService.prototype.getZIndex = function(element) {
  var zIndex = parseInt(this.jsh.$(element).css('zIndex'));
  return isNaN(zIndex) || zIndex == undefined ? 0 : zIndex;
}

exports = module.exports = OverlayService;