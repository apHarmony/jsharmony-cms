import { ImageEditorController } from './imageEditorController'

jsh.App[modelid] = new (function() {
  this.oninit = function(xmodel) {
    new ImageEditorController().initialize();
  }
})();