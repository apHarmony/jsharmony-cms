(function(){
  var createCMS = function(){ window.jsHarmonyCMSInstance = new window.jsHarmonyCMS({ _instance: 'jsHarmonyCMSInstance' }); }
  if(document.body) createCMS();
  else document.addEventListener("DOMContentLoaded", createCMS);
})();
