/**
 * @classdesc A static service for ensuring the overlay appears
 * between the last modal in the modal stack and all other modals.
 * @class
 * @static
 */
function OverlayService() {}

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
OverlayService.popDialog = function() {

  OverlayService._dialogStack.pop();
  if (OverlayService._dialogStack.length < 1) {
    $('.xdialogblock .childDialogOverlay').remove();
    return;
  }

  var $overlay = OverlayService.getOverlay();
  var $dialog = $(OverlayService._dialogStack[OverlayService._dialogStack.length - 1]);
  var zIndex = OverlayService.getZIndex($dialog);
  $overlay.css('z-index', zIndex);
  $dialog.before($overlay);
}

/**
 * Add a dialog element to the overlay stack.
 * @public
 * @static
 * @param {(HTMLElement | JQuery)} dialog
*/
OverlayService.pushDialog = function(dialog) {
  var zIndex = OverlayService.getZIndex(dialog);
  var $overlay = OverlayService.getOverlay();
  $overlay.css('z-index', zIndex);
  OverlayService._dialogStack.push($(dialog));
  $(dialog).before($overlay);
}

/**
 * Get the overlay. Creates and adds to DOM if it doesn't already
 * exist.
 * @private
 * @static
 * @returns {JQuery}
 */
OverlayService.getOverlay = function() {
  var $dialogBlock = $('.xdialogblock');
  var $childOverlay = $dialogBlock.find('.childDialogOverlay');
  if ($childOverlay.length > 0) {
    return $childOverlay;
  }

  $childOverlay = $('<div class="childDialogOverlay"></div>');
  $dialogBlock.prepend($childOverlay);

  $childOverlay
    .css('background-color', 'rgba(0,0,0,0.4)')
    .css('position', 'absolute')
    .css('width', '100%')
    .css('height', '100%');

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
OverlayService.getZIndex = function(element) {
  var zIndex = parseInt( $(element).css('zIndex'));
  return isNaN(zIndex) || zIndex == undefined ? 0 : zIndex;
}

exports = module.exports = OverlayService;