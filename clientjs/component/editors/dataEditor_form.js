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
var FormDialog = require('../dialogs/formDialog');
var ComponentTemplate = require('../componentModel/componentTemplate');
var HTMLPropertyEditorController = require('./htmlPropertyEditorController');
var TemplateRenderer = require('../templateRenderer');

/** @typedef {import('../templateRenderer').RenderConfig} RenderConfig */

/** @typedef {import('../componentModel/componentTemplate').MediaBrowserControlInfo} MediaBrowserControlInfo */

/**
 * @callback DataEditor_Form~beforeRenderDataItemPreview
 * @param {RenderConfig} renderConfig
 */

/**
 * @callback DataEditor_Form~renderDataItemPreview
 * @param {HTMLElement} element
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 * @param {Object} cms - the parent jsHarmonyCMSInstance
 * @param {Object} component - the parent component
 */



/**
 * @class
 * @param {ComponentTemplate} componentTemplate
 * @param {(import('../templateRenderer').GridPreviewRenderContext | undefined)} gridContext
 * @param {Object} cms
 * @param {Object} jsh
 * @param {Object} component
 */
function DataEditor_Form(componentTemplate, gridContext, isReadOnly, cms, jsh, component) {

  /** @private @type {ComponentTemplate} */
  this._componentTemplate = componentTemplate;

  /** @private @type {boolean} */
  this._isReadOnly = isReadOnly;

  /** @private @type {Object} */
  this._cms = cms;

  /** @private */
  this._gridContext = gridContext;

  /** @private @type {Object} */
  this._jsh = jsh;

  /** @private @type {Object} */
  this._component = component;

  /** @private @type {HTMLPropertyEditorController[]} */
  this._htmlEditors = [];

  /** @private @type {DataEditor_Form~beforeRenderDataItemPreview} */
  this._onBeforeRenderDataItemPreview = undefined;

  /** @private @type {DataEditor_Form~renderDataItemPreview} */
  this._onRenderDataItemPreview = undefined;
}

/**
 * @private
 * @param {JQuery} $dialog - the dialog element.
 * @param {JQuery} $wrapper - the preview wrapper element.
 */
DataEditor_Form.prototype.attachEditors = function($dialog, $wrapper, $toolbar) {

  var _this = this;

  _.forEach(this._htmlEditors, function(editor) { editor.destroy(); });

  _.forEach($wrapper.find('[data-component-full-editor]'), function (editorEl) {
    var $el = _this._jsh.$(editorEl);
    var propName = $el.attr('data-component-full-editor');
    var editor = new HTMLPropertyEditorController('full', _this._jsh, _this._cms, $dialog, propName,  $el, $toolbar);
    editor.initialize(function() {});
    _this._htmlEditors.push(editor);
  });

  _.forEach($wrapper.find('[data-component-title-editor]'), function (editorEl) {
    var $el = _this._jsh.$(editorEl);
    var propName = $el.attr('data-component-title-editor');
    var editor = new HTMLPropertyEditorController('title', _this._jsh, _this._cms, $dialog, propName, $el, $toolbar);
    editor.initialize(function() {});
    _this._htmlEditors.push(editor);
  });
}

/**
 * @private
 * @param {JQuery} $dialog
 * @param {MediaBrowserControlInfo} info
 * @param {boolean} enable
 */
DataEditor_Form.prototype.enableBrowserControl = function($dialog, info, enable) {
  var jctrl = $dialog.find('.xform_ctrl.' + info.titleFieldName);
  if(jctrl.hasClass('editable')){
    $dialog.find('.xform_ctrl.' + info.titleFieldName).attr('disabled', enable ? null : true);
  }
}

/**
 * Open the editor
 * @public
 * @param {Object} itemData - the data used to render the component.
 * @param {Object} properties - the component's configured properties (used to render the component)
 * @param {Function} onAcceptCb - Called if the data is updated. Arg0 is updated data.
 * @param {Function} onCloseCb - Called anytime the dialog is closed.
 */
DataEditor_Form.prototype.open = function(itemData, properties, onAcceptCb, onCloseCb) {

  var _this = this;
  var modelTemplate = this._componentTemplate.getDataModelTemplate_FormPreview();
  var modelConfig = modelTemplate.getModelInstance();
  var template = modelTemplate.getItemTemplate();

  if (this._isReadOnly) {
    modelConfig.actions = 'B';
  }

  var itemData = modelTemplate.populateDataInstance(itemData || {});

  var dialog = new FormDialog(this._jsh, this._cms, modelConfig, {
    acceptButtonLabel: 'Save',
    cancelButtonLabel:  'Cancel',
    closeOnBackdropClick: true,
    cssClass: 'l-content jsharmony_cms_component_dialog jsharmony_cms_component_dialog_form jsharmony_cms_component_dataFormItemEditor jsharmony_cms_component_dataFormItemEditor_' + this._componentTemplate.getTemplateId(),
    dialogId: modelConfig.id,
    minHeight: modelConfig.popup[1],
    minWidth: modelConfig.popup[0]
  });

  var $toolbar;

  dialog.onBeforeOpen = function(xmodel, dialogSelector, onComplete) {
    var editor = _this._jsh.App[xmodel.id];
    var $dialog = _this._jsh.$(dialogSelector);
    $dialog.css('opacity', '0');
    _this._formSelector = dialogSelector; // remove this

    // Note that the toolbar HAS to be in the popup DOM hierarchy for focus/blur
    // events to work correctly.
    $toolbar = _this._jsh.$('<div class="jsharmony_cms_content_editor_toolbar"></div>')
      .css('position', 'fixed')
      .css('top', '0px')
      .css('left', '0')
      .css('width', '100%')
      .css('z-index', '1999999999');
    _this._jsh.$(dialogSelector).append($toolbar);

    _.forEach(modelTemplate.getBrowserFieldInfos(), function(info) {
      var title = itemData[info.titleFieldName] || '';
      var data = itemData[info.dataFieldName] || '';
      var fieldsMatch = title === data;
      var isDataEmpty = title.length < 1 && data.length < 1;
      var fieldIsEditable = fieldsMatch || isDataEmpty;
      _this.enableBrowserControl($dialog, info, fieldIsEditable);
    });

    editor.onChangeData_noDebounce = function() {
      if(!_this._jsh.XModels[xmodel.id]){ return; }
      var updatedData = {};
      _.forEach(modelConfig.fields, function(field) {
        if (field.type != undefined) {
          updatedData[field.name] = xmodel.get(field.name);
        }
      });

      var $wrapper =  $dialog.find('[data-id="previewWrapper"]').first();
      _this.renderPreview($wrapper, template, updatedData, properties);
      // Don't attach any events until after the onRenderGridItemPreview hook is called.
      // Otherwise, the events might be attached to elements that get replaced or removed.
      _this.attachEditors($dialog, $wrapper, $toolbar);
    }

    // This function NEEDS to be debounced.
    // It SHOULD be anyway so it doesn't re-render the preview on every
    // keystroke, but it HAS to be just in case two fields change
    // at the same time (in which case the first change causes a re-render
    // and the second change breaks things since parts of the re-render are async)
    // ** Follow up - All "debounce" should be removed and replaced with custom render queues
    editor.onChangeData = _.debounce(editor.onChangeData_noDebounce, 300);

    editor.openEditorBrowser = function(browserControlName) {

      var info = modelTemplate.getBrowserFieldInfo(browserControlName);
      if (info == undefined) return;

      var update = function(url, title) {
        // IMPORTANT! Set the title FIRST.
        // The change handler is attached to the title
        // so that will run and update the link control,
        // and then we override the link control.
        xmodel.set(info.titleFieldName, title);
        xmodel.set(browserControlName, url);
        _this.enableBrowserControl($dialog, info, false);
        editor.onChangeData();
      };

      if (info.browserType === 'link') {
        if (info == undefined) return;
        _this._cms.editor.picker.openLink(function(url, data) {
          var title = url||'';
          if(data){
            if(data.page_path) title = data.page_path;
            else if(data.media_path) title = data.media_path;
            else if(data.item_path) title = data.item_path;
          }
          update(url, title);
        }, xmodel.get(browserControlName));
      }
      else if (info.browserType === 'media') {
        _this._cms.editor.picker.openMedia(function(url, data) {
          var title = data.media_path;
          update(url, title);
        }, xmodel.get(browserControlName));
      }
      else {
        console.warn(new Error('Unknown browser type ' + info.browserType));
      }
    }

    editor.onChangeBrowserTitleControl = function(browserControlName) {
      // When the user manually changes the link title,
      // the link value must be set to the title value.
      var info = modelTemplate.getBrowserFieldInfo(browserControlName);
      if (info == undefined) return;
      xmodel.set(browserControlName, xmodel.get(info.titleFieldName));
      editor.onChangeData();
    }

    editor.resetEditorBrowser = function(linkControlName) {
      var info = modelTemplate.getBrowserFieldInfo(linkControlName);
      if (info == undefined) return;
      _this.enableBrowserControl($dialog, info, true);
      xmodel.set(linkControlName, '');
      xmodel.set(info.titleFieldName, '');
      editor.onChangeData();
    }

    _this._onBeforeRenderDataItemPreview = editor.onBeforeRenderDataItemPreview;
    _this._onRenderDataItemPreview = editor.onRenderDataItemPreview;

    if(onComplete) onComplete();
  }

  dialog.onOpened = function($dialog, xmodel) {
    var editor = _this._jsh.App[xmodel.id];
    // Manually call change to do initial render
    setTimeout(function() {
      editor.onChangeData_noDebounce();
      setTimeout(function() {
        $dialog.css('opacity', '1');
      }, 50);
    });
  }

  dialog.onAccept = function($dialog, xmodel) {
    if(!xmodel.controller.Commit(itemData, 'U')) return false;
    itemData = modelTemplate.makePristineCopy(itemData);
    if (_.isFunction(onAcceptCb)) onAcceptCb(itemData);
    return true;
  }

  dialog.onCancel = function(options, $dialog, xmodel) {
    if (!options.force && xmodel.controller.HasUpdates()) {
      _this._jsh.XExt.Confirm('Close without saving changes?', function() {
        xmodel.controller.form.ResetDataset();
        options.forceCancel();
      });
      return false;
    }
  }

  dialog.onClose = function($dialog, xmodel) {
    //Destroy model
    if (xmodel.controller && xmodel.controller.OnDestroy) xmodel.controller.OnDestroy();
    if (typeof xmodel.ondestroy != 'undefined') xmodel.ondestroy(xmodel);

    delete _this._jsh.XModels[xmodel.id];
    delete _this._jsh.App[xmodel.id];
    _.forEach(_this._htmlEditors, function(editor) { editor.destroy(); });
    if (_.isFunction(onCloseCb)) onCloseCb();
  }

  dialog.open(itemData);
}

/**
 * @private
 * @param {JQuery} $wrapper
 * @param {string} template
 * @param {Object} data
 * @param {Object} properties
 */
DataEditor_Form.prototype.renderPreview = function($wrapper, template, data, properties) {

  var _this = this;


  var renderData = { item: data };
  var componentConfig = this._componentTemplate && this._componentTemplate._componentConfig;
  if(componentConfig && componentConfig.data && (componentConfig.data.layout == 'grid_preview')){
    renderData = { items: [data] };
  }

  var renderConfig = TemplateRenderer.createRenderConfig(template, renderData, properties, this._cms);
  renderConfig.gridContext = this._gridContext;

  if (_.isFunction(this._onBeforeRenderDataItemPreview)) this._onBeforeRenderDataItemPreview(renderConfig);

  var rendered = TemplateRenderer.render(renderConfig, 'gridItemPreview', this._jsh, this._cms, componentConfig);

  $wrapper.empty().append(rendered);

  if(this._cms && this._cms.editor) this._cms.editor.disableLinks($wrapper)

  if (_.isFunction(this._onRenderDataItemPreview)) this._onRenderDataItemPreview($wrapper.children()[0], renderConfig.data, renderConfig.properties, _this._cms, _this._component);

  setTimeout(function() {
    _.forEach(_this._jsh.$($wrapper.children()[0]).find('[data-component]'), function(el) {
      _this._cms.componentManager.renderContentComponent(el);
    });
  }, 50);
}

exports = module.exports = DataEditor_Form;