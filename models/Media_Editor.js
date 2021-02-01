/** @typedef {import('./Media_Editor.imageEditorController').ImageEditorController} ImageEditorController */

jsh.App[modelid] = new (function() {
  this.oninit = function(xmodel) {
    new ImageEditorController().initialize();
  }
})();