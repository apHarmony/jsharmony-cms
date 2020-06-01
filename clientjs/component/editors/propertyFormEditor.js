var ComponentConfig = require('../componentModel/componentConfig');
var FormDialog = require('../dialogs/formDialog');

/**
 * @class
 * @param {ComponentConfig} componentConfig
 * @param {Object} cms
 * @param {Object} jsh
 */
function PropertyFormEditor(componentConfig, cms, jsh) {

  /** @private @type {ComponentConfig} */
  this._componentConfig = componentConfig;

  /** @private @type {Object} */
  this._cms = cms;

  /** @private @type {Object} */
  this._jsh = jsh;
}

/**
 * Open the editor
 * @public
 * @param {Object} properties - the component's configured properties
 * @param {Function} onAcceptCb - Called if the data is updated. Arg0 is updated data.
 */
PropertyFormEditor.prototype.open = function(properties, onAcceptCb) {

  var self = this;
  var formModel = this._componentConfig.getFormPropertiesModelInstance();
  var modelConfig = formModel.getModelConfig();

  // Allow title to be overridden
  modelConfig.title = modelConfig.title ? modelConfig.title : 'Configure';

  var data = formModel.getItemFields().populateDataInstance(properties || {});

  var dialog = new FormDialog(this._jsh, modelConfig, {
    acceptButtonLabel: 'Save',
    cancelButtonLabel:  'Cancel',
    closeOnBackdropClick: true,
    cssClass: 'jsHarmony_cms_component_propertyFormEditor_' + this._componentConfig.getComponentConfigId(),
  });

  dialog.onAccept = function($dialog, xModel) {
    if(!xModel.controller.Commit(data, 'U')) return false;
    data = formModel.getItemFields().makePristineModel(data);
    if (_.isFunction(onAcceptCb)) onAcceptCb(data);
    return true;
  }

  dialog.onCancel = function(options, $dialog, xModel) {
    if (!options.force && xModel.controller.HasUpdates()) {
      self._jsh.XExt.Confirm('Close without saving changes?', function() {
        xModel.controller.form.ResetDataset();
        options.forceCancel();
      });
      return false;
    }
  }

  dialog.onClose = function($dialog, xModel) {
    delete self._jsh.XModels[xModel.id];
    delete self._jsh.App[xModel.id];
  }

  dialog.open(data);
}

exports = module.exports = PropertyFormEditor;
