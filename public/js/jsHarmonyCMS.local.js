(function(){
  var createCMS = function(){ window.jsHarmonyCMSInstance = new window.jsHarmonyCMS({ _instance: 'jsHarmonyCMSInstance' }); }
  if(document.body) createCMS();
  else document.addEventListener("DOMContentLoaded", createCMS);

  //Fix window position, if necessary
  if (window.opener && window.opener !== window) {
    var targetX = window.screenX;
    var targetY = window.screenY;
    if(window.screen && ('availLeft' in window.screen) && ('availTop' in window.screen)){
      var needsMove = false;
      if(targetX < window.screen.availLeft){ targetX = window.screen.availLeft; needsMove = true; }
      if(targetY < window.screen.availTop){ targetY = window.screen.availTop; needsMove = true; }
      if(needsMove) window.moveTo(targetX, targetY);
    }
  }
})();
