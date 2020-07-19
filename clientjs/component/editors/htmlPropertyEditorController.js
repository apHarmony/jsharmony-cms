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

/**
 * @class
 * @classdesc This is a wrapper on the jshCMSEditor to easily attach it
 *            to a field in a component property/data editor form.
 *            To use, create a hidden control of type varchar like
 *            {name: 'body', type: 'varchar', control: 'hidden'} and
 *
 *            { caption: 'Body:', control:'html', value:'<div data-editor-for="body"></div>','block':true}
 *
 * @public
 * @param {('full' | 'title')} editorType
 * @param {Object} jsh
 * @param {Object} csm
 * @param {(JQuery | HTMLElement)} formElement - The form element.
 * @param {string} hiddenFieldName - See the class description. The hidden field name
 *                                   is used to bind the editor data to the hidden field
 *                                   and denotes the respective elements.
 * @param {(JQuery | HTMLElement)} editorElement - the element that gets attached as the editor
 * @param {(JQuery | HTMLElement)} toolbarElement - the element used to attach the toolbar.
 */
function HTMLPropertyEditor(editorType, jsh, cms, formElement, hiddenFieldName, editorElement, toolbarElement) {

  /** @private @type {('full' | 'title')} */
  this._editorType = editorType;

  /** @private @type {string} */
  this._jsh = jsh;

  /** @private @type {string} */
  this._cms = cms;

  /** @private @type {JQuery} */
  this._$formElement = this._jsh.$(formElement);

  /** @private @type {string} */
  this._hiddenFieldName = hiddenFieldName;

  /** @private @type {JQuery} */
  this._$editorElement = this._jsh.$(editorElement);

  /** @private @type {JQuery} */
  this._$toolbarElement = this._jsh.$(toolbarElement);

  /** @private @type {Object} */
  this._editor = undefined;

  /** @private @type {string} */
  this._uid = '_' + Math.random().toString().replace('.', '');

  // ID must match the jsHarmony convention in order to get/set
  // content using the jsHarmonyEditor
  /** @private @type {string} */
  this._contentId = 'jsharmony_cms_content_' + this._uid;
}

/**
 * Destroy the editor and cleanup
 * @public
 */
HTMLPropertyEditor.prototype.destroy = function() {
  this._editor.detach(this._uid);
}

/**
 * Get the hidden field JQuery obj that is bound to the editor.
 * @private
 * @returns {JQuery}
 */
HTMLPropertyEditor.prototype.getDataElement = function() {
  return this._$formElement.find('.xform_ctrl.' + this._hiddenFieldName);
}

/**
 * Initialize the editor.
 * Only call one time.
 * @public
 * @param {function} callback - called when the editor is initialized and attached.
 */
HTMLPropertyEditor.prototype.initialize = function(callback) {

  var self = this;
  callback = callback || function() {};

  // ID must match the jsHarmony convention in order to get/set
  // content using the jsHarmonyEditor. So set the ID no matter what.
  this._$editorElement.attr('id', this._contentId);
  this._editor = this._cms.createJsHarmonyCMSEditor(this._$toolbarElement[0]);
  this._editor.onEndEdit = function() {
    var content = self.processText(self._editor.getContent(self._uid));
    self.getDataElement().attr('value', content);
  }
  this._editor.init(function() {

    var config = {};
    var configType = '';
    var editorType = (self._editorType || '').toLowerCase();
    if (editorType === 'full') {
      configType = 'full';
      config = {
        valid_elements : '+*[*],#p[*]',
      };
    } else if (editorType === 'title') {
      configType = 'full';
      config = {
        toolbar: 'forecolor backcolor | bold italic underline | alignleft aligncenter alignright alignjustify | link  image charmapmaterialicons',
        valid_elements : 'a,strong/b,p,span[style|class],p[*],img[*],br[*]',
        plugins: ['link image charmapmaterialicons'],
        menubar: false,
      };
    } else {
      throw new Error('Unknown editor type "' + self._editorType + '"');
    }

    self._editor.attach(configType, self._contentId, config, function() {
      self.render();
      callback();
    });
  });
}

/**
 * Process text from the editor
 * @private
 * @param {string} text
 * @returns {string}
 */
HTMLPropertyEditor.prototype.processText = function(text) {
  // Sometimes TinyMce adds non-breaking spaces (may be browser dependant).
  // These need to be removed
  return (text || '').replace(/(&nbsp;)|(&#160;)/g, ' ');
}

/**
 * Update the editor with the value from the field bound to the editor.
 * @private
 */
HTMLPropertyEditor.prototype.render = function() {
  var value = this.getDataElement().attr('value') || '';
  this._editor.setContent(this._uid, value);
}


exports = module.exports = HTMLPropertyEditor;