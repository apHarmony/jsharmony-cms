var FormDialog = require('../dialogs/formDialog');
var ComponentConfig = require('../componentModel/componentConfig');
var HTMLPropertyEditorController = require('./htmlPropertyEditorController');

/**
 * @typedef {Object} RenderConfig
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {string} template - the template being rendered
 */

/**
 * @callback DataFormEditor~beforeRenderDataItemPreview
 * @param {RenderConfig} renderConfig
 */

/**
 * @callback DataGridItemEditor~renderDataItemPreview
 * @param {HTMLElement} element
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 */



/**
 * @class
 * @param {ComponentConfig} componentConfig
 * @param {Object} cms
 * @param {Object} jsh
 */
function DataFormEditor(componentConfig, isReadOnly, cms, jsh) {

  /** @private @type {ComponentConfig} */
  this._componentConfig = componentConfig;

  /** @private @type {boolean} */
  this._isReadOnly = isReadOnly;

  /** @private @type {Object} */
  this._cms = cms;

  /** @private @type {Object} */
  this._jsh = jsh;

  /** @private @type {HTMLPropertyEditorController[]} */
  this._htmlEditors = [];

  /** @private @type {DataFormEditor~beforeRenderDataItemPreview} */
  this._onBeforeRenderDataItemPreview = undefined;

  /** @private @type {DataGridItemEditor~renderDataItemPreview} */
  this._onRenderDataItemPreview = undefined;
}

/**
 * @private
 * @param {JQuery} $dialog - the dialog element.
 * @param {JQuery} $wrapper - the preview wrapper element.
 */
DataFormEditor.prototype.attachEditors = function($dialog, $wrapper, $toolbar) {

  var self = this;

  _.forEach(this._htmlEditors, function(editor) { editor.destroy(); });

  _.forEach($wrapper.find('[data-component-full-editor]'), function (editorEl) {
    var $el = $(editorEl);
    var propName = $el.attr('data-component-full-editor');
    var editor = new HTMLPropertyEditorController('full', self._jsh, self._cms, $dialog, propName,  $el, $toolbar);
    editor.initialize(function() {});
    self._htmlEditors.push(editor);
  });

  _.forEach($wrapper.find('[data-component-title-editor]'), function (editorEl) {
    var $el = $(editorEl);
    var propName = $el.attr('data-component-title-editor');
    var editor = new HTMLPropertyEditorController('title', self._jsh, self._cms, $dialog, propName, $el, $toolbar);
    editor.initialize(function() {});
    self._htmlEditors.push(editor);
  });
}

/**
 * Create a new instance of the jsHarmonyCMSEditorPicker
 * @private
 * @returns {object}
 */
DataFormEditor.prototype.createPicker = function() {
  return this._cms.createJsHarmonyCMSEditorPicker(undefined);
}

/**
 * @private
 * @param {JQuery} $dialog
 * @param {import('../componentModel/formDataModel').mediaBrowserControlInfo} info
 * @param {boolean}
 */
DataFormEditor.prototype.enableBrowserControl = function($dialog, info, enable) {
  $dialog.find('.xform_ctrl.' + info.titleFieldName).attr('disabled', enable ? null : true);
}

/**
 * Open the editor
 * @public
 * @param {Object} itemData - the data used to render the component.
 * @param {Object} properties - the component's configured properties (used to render the component)
 * @param {Function} onAcceptCb - Called if the data is updated. Arg0 is updated data.
 */
DataFormEditor.prototype.open = function(itemData, properties, onAcceptCb) {

  var self = this;
  var formModel = this._componentConfig.getFormDataModelInstance();
  var modelConfig = formModel.getModelConfig();
  var template = formModel.getItemTemplate();

  // Allow title to be overridden
  modelConfig.title = modelConfig.title ? modelConfig.title : 'Edit';

  if (this._isReadOnly) {
    modelConfig.actions = 'B';
  }

  var itemData = formModel.getItemFields().populateDataInstance(itemData || {});


  var dialog = new FormDialog(this._jsh, modelConfig, {
    acceptButtonLabel: 'Save',
    cancelButtonLabel:  'Cancel',
    closeOnBackdropClick: true,
    cssClass: 'l-content jsHarmony_cms_component_dataFormItemEditor jsHarmony_cms_component_dataFormItemEditor_' + this._componentConfig.getComponentConfigId(),
    maxHeight: 800
  });


  var $toolbar;

  dialog.onBeforeOpen = function(xModel, dialogSelector) {

    var editor = self._jsh.App[xModel.id];
    var $dialog = $(dialogSelector);
    self._formSelector = dialogSelector; // remove this

    // Note that the toolbar HAS to be in the popup DOM hierarchy for focus/blur
    // events to work correctly.
    $toolbar = $('<div class="jsharmony_cms_content_editor_toolbar"></div>')
      .css('position', 'fixed')
      .css('top', '37px')
      .css('left', '0')
      .css('width', '100%')
      .css('z-index', '999999');
    $(dialogSelector).append($toolbar);

    _.forEach(formModel.getBrowserFieldInfos(), function(info) {
      self.enableBrowserControl($dialog, info, (itemData[info.titleFieldName] || '') === (itemData[info.dataFieldName] || ''));
    });

    // This function NEEDS to be debounced.
    // It SHOULD be anyway so it doesn't re-render the preview on every
    // keystroke, but it HAS to be just in case two fields change
    // at the same time (in which case the first change causes a re-render
    // and the second change breaks things since parts of the re-render are async)
    editor.onChangeData = _.debounce(function() {
      var updatedData = {};
      _.forEach(modelConfig.fields, function(field) {
        if (field.type != undefined) {
          updatedData[field.name] = xModel.get(field.name);
        }
      });

      var $wrapper =  $dialog.find('[data-id="previewWrapper"]').first();
      self.renderPreview($wrapper, template, updatedData, properties);
      // Don't attach any events until after the onRenderGridItemPreview hook is called.
      // Otherwise, the events might be attached to elements that get replaced or removed.
      self.attachEditors($dialog, $wrapper, $toolbar);
    }, 300);

    editor.openEditorBrowser = function(browserControlName) {

      var info = formModel.getBrowserFieldInfo(browserControlName);
      if (info == undefined) return;

      var update = function(url, title) {
        // IMPORTANT! Set the title FIRST.
        // The change handler is attached to the title
        // so that will run and update the link control,
        // and then we override the link control.
        xModel.set(info.titleFieldName, title);
        xModel.set(browserControlName, url);
        self.enableBrowserControl($dialog, info, false);
        editor.onChangeData();
      };

      if (info.browserType === 'link') {

        if (info == undefined) return;
        self.openLinkBrowser(function(url, data) {
          var title = data.page_path || '';
          update(url, title);
        });
      } else if (info.browserType === 'media') {
          self.openMediaBrowser(function(url, data) {
            var title = data.media_path;
            update(url, title);
          });
      } else {
        console.warn(new Error('Unknown browser type ' + info.browserType));
      }
    }

    editor.onChangeBrowserTitleControl = function(browserControlName) {
      // When the user manually changes the link title,
      // the link value must be set to the title value.
      var info = formModel.getBrowserFieldInfo(browserControlName);
      if (info == undefined) return;
      xModel.set(browserControlName, xModel.get(info.titleFieldName));
      editor.onChangeData();
    }

    editor.resetEditorBrowser = function(linkControlName) {
      var info = formModel.getBrowserFieldInfo(linkControlName);
      if (info == undefined) return;
      self.enableBrowserControl($dialog, info, true);
      xModel.set(linkControlName, '');
      xModel.set(info.titleFieldName, '');
      editor.onChangeData();
    }

    self._onBeforeRenderDataItemPreview = editor.onBeforeRenderDataItemPreview;
    self._onRenderDataItemPreview = editor.onRenderDataItemPreview;
  }

  dialog.onOpened = function($dialog, xModel) {
    var editor = self._jsh.App[xModel.id];
    // Manually call change to do initial render
    setTimeout(function() {
      editor.onChangeData();
    });
  }

  dialog.onAccept = function($dialog, xModel) {
    if(!xModel.controller.Commit(itemData, 'U')) return false;
    itemData = formModel.getItemFields().makePristineModel(itemData);
    if (_.isFunction(onAcceptCb)) onAcceptCb(itemData);
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
    _.forEach(self._htmlEditors, function(editor) { editor.destroy(); });
  }

  dialog.open(itemData);
}

/**
 * Open a link browser
 * @private
 * @param {Function} cb - callback for when link is selected (matches original picker signature)
 */
DataFormEditor.prototype.openLinkBrowser = function(cb) {
  this.createPicker().openLink(cb, '');
}

/**
 * Open a medial browser
 * @private
 * @param {Function} cb - callback for when link is selected (matches original picker signature)
 */
DataFormEditor.prototype.openMediaBrowser = function(cb) {
  this.createPicker().openMedia(cb, '');
}

/**
 * @private
 * @param {JQuery} $wrapper
 * @param {string} template
 * @param {Object} data
 * @param {Object} properties
 */
DataFormEditor.prototype.renderPreview = function($wrapper, template, data, properties) {

  /** @type {RenderConfig} */
  var renderOptions = {
    template: template,
    data: data,
    properties: properties
  };

  if (_.isFunction(this._onBeforeRenderDataItemPreview)) this._onBeforeRenderDataItemPreview(renderOptions);

  var templateData = { data: renderOptions.data, properties: renderOptions.properties };
  var rendered = '';
  try {
    rendered = this._jsh.ejs.render(renderOptions.template || '', templateData);
  } catch (error) {
    console.error(error);
  }

  $wrapper.empty().append(rendered);

  if (_.isFunction(this._onRenderDataItemPreview)) this._onRenderDataItemPreview($wrapper.children()[0], renderOptions.data, renderOptions.properties);
}

exports = module.exports = DataFormEditor;