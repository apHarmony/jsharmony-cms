const  jsHarmonyCMSEditorPicker = require('./jsHarmonyCMS.Editor.Picker.js');

/**
  * @typedef {Object} IconDefinition
  * @property {string} name - the name the icon is registered as
  * @property {string} html - the html for the icon
  */

/**
 * Each icon definition will be registered with the editor
 * and available for use within the editor by name property.
 * @type {Object.<string, IconDefinition>}
 **/
const PLUGIN_NAME = 'jsHarmonyCmsImageTools'

const ICONS = {
  edit: {
    name: 'material_edit',
    html: '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">edit</span>'
  }
}

exports = module.exports = function(jsh, cms, editor) {

  var _ = jsh._;
  var $ = jsh.$;
  var XExt = jsh.XExt;

  /**
   * @public
   * @returns {string}
   */
  this.pluginName = function() {
    return PLUGIN_NAME;
  }

  /**
   * Register the JSH image tools plugin
   * @public
   * @returns {void}
   */
  this.register = function() {
    if (tinymce.PluginManager.get(this.pluginName()) != undefined) return;

    tinymce.PluginManager.add(this.pluginName(), function(editor, url) {
      new ImageToolsPlugin(editor);
    });
  }

  /**
   * @class
   * @private
   * @param {object} editor - the TinyMce editor instance
   * @returns {void}
   */
  function ImageToolsPlugin(editor) {
    this._editor = editor;
    this.createContextToolbar();
    this._editor.ui.registry.addIcon(ICONS.edit.name, ICONS.edit.html);
  }

  /**
   * Create and register the context toolbar for editing
   * the component properties and data.
   * @private
   * @returns {void}
   */
  ImageToolsPlugin.prototype.createContextToolbar = function() {

    const self = this;
    const editButtonId = 'jsharmonyImageToolPluginContextToolbar_editButton';

    this._editor.ui.registry.addButton(editButtonId, {
      tooltip: 'Edit',
      text: 'Edit',
      icon: 'edit-image',
      onAction: function(a, b) {

        /** @type {HTMLImageElement} */
        const element =  self._editor.selection.getNode();
        const isCmsImage = self.isCmsImage(element)
        if (!isCmsImage) return;

        const preEditWidth = element.naturalWidth;
        const preEditHeight = element.naturalHeight

        self.openImageEditor(element.src, function(data) {
          const newSource = data.image_source;

          $(element).one('load', function() {
            const postEditWidth = element.naturalWidth;
            const postEditHeight = element.naturalHeight;

            const dimensionsChanged =
              postEditHeight !== preEditHeight ||
              postEditWidth !== preEditWidth;

            if (dimensionsChanged) {
              $(element)
                .attr('width', postEditWidth + 'px')
                .attr('height', postEditHeight + 'px');
            }
          });

          element.src = newSource
          $(element)
            .attr('data-mce-src', data.image_source)
            .attr('width', null);
        })
      }
    });

    this._editor.ui.registry.addContextToolbar('jsharmonyImageToolPluginContextToolbar', {
      predicate: function(node) { return self.isCmsImage(node); },
      items: editButtonId,
      scope: 'node',
      position: 'node'
    })
  }

  /**
   * @private
   * @param {string} url
   * @returns {object}
  */
  ImageToolsPlugin.prototype.getQueryObjectFromUrl = function(url) {

    const queryStartIndex = url.indexOf('?');
    if (queryStartIndex < 0) return {};

    const queryAndHash = url.slice(queryStartIndex + 1).split('#');

    const params = queryAndHash[0].split('&').reduce(function(obj, kvp) {
      const split = kvp.split('=');
      obj[split[0].toLowerCase()] = split[1];
      return obj;
    }, {});

    return params;
  }

  /**
   * @private
   * @param {HTMLImageElement} imgElement
   * @return {boolean}
  */
  ImageToolsPlugin.prototype.isCmsImage = function(imgElement) {
    const isImage = this._editor.dom.is(imgElement, 'img');
    if (!isImage) return false;

    const query = this.getQueryObjectFromUrl(imgElement.src);

    return query.media_file_id != undefined;
  }

  /**
   * @private
   * @param {string | number} mediaFileId
   * @param {(data) => void} callback
   */
  ImageToolsPlugin.prototype.openImageEditor = function(imageSource, callback) {
    cms.createJsHarmonyCMSEditorPicker(this._editor).openMediaEditor(callback, imageSource);
  }
}