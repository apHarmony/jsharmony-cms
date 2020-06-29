var ComponentTemplate = require('../componentModel/componentTemplate');
var FormDialog = require('../dialogs/formDialog');

/**
 * @class
 * @param {ComponentTemplate} componentTemplate
 * @param {Object} cms
 * @param {Object} jsh
 */
function PropertyEditor_Form(componentTemplate, cms, jsh) {

  /** @private @type {ComponentTemplate} */
  this._componentTemplate = componentTemplate;

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
PropertyEditor_Form.prototype.open = function(properties, onAcceptCb) {

  var self = this;
  var modelTemplate = this._componentTemplate.getPropertiesModelTemplate_Form();
  var model = modelTemplate.getModelInstance();

  var data = modelTemplate.populateDataInstance(properties || {});

  /** @type {import('../dialogs/formDialog').FormDialogConfig} */
  var dialogParams = {
    acceptButtonLabel: 'Save',
    cancelButtonLabel:  'Cancel',
    closeOnBackdropClick: true,
    cssClass: 'jsharmony_cms_component_dialog jsharmony_cms_component_propertyFormEditor jsharmony_cms_component_propertyFormEditor_' + this._componentTemplate.getTemplateId(),
    dialogId: model.id
  };

  if(model.popup){
    dialogParams.minHeight = model.popup[1];
    dialogParams.minWidth = model.popup[0];
  }

  var dialog = new FormDialog(this._jsh, model, dialogParams);

  dialog.onAccept = function($dialog, xModel) {
    if(!xModel.controller.Commit(data, 'U')) return false;
    data = modelTemplate.makePristineCopy(data);
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
    //Destroy model
    if (xModel.controller && xModel.controller.OnDestroy) xModel.controller.OnDestroy();
    if (typeof xModel.ondestroy != 'undefined') xModel.ondestroy(xModel);

    delete self._jsh.XModels[xModel.id];
    delete self._jsh.App[xModel.id];
  }

  dialog.open(data);
}

exports = module.exports = PropertyEditor_Form;
