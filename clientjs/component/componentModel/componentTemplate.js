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
var DataModelTemplate_GridPreview = require('./dataModelTemplate_gridPreview');
var DataModelTemplate_FormPreview = require('./dataModelTemplate_formPreview');
var PropertiesModelTemplate_Form = require('./propertiesModelTemplate_form');

/**
  * @typedef {Object} MediaBrowserControlInfo
  * @property {string} dataFieldName
  * @property {string} titleFieldName
  * @property {('link' | 'media')} browserType
  */

/** @typedef {ComponentTemplate} ComponentTemplate */

/**
 * @class
 * @param {Object} componentConfig - the component configuration as defined by the component JSON.
 * @param {Object} jsh
 */
function ComponentTemplate(componentConfig, jsh) {

  /** @private @type {Object} */
  this._componentConfig = componentConfig;

  /** @private @type {Object} */
  this._jsh = jsh;

  /** @private @type {DataModelTemplate_GridPreview} */
  this._dataModelTemplate_GridPreview = undefined;

  /** @private @type {DataModelTemplate_FormPreview} */
  this._dataModelTemplate_FormPreview = undefined;

  /** @private @type {PropertiesModelTemplate_Form} */
  this._propertiesModelTemplate_Form = undefined;



  if (this._componentConfig.data) {
    this._componentConfig.data.fields = this.processBrowserFields(this._componentConfig.data.fields || []);
    this._dataModelTemplate_GridPreview = new DataModelTemplate_GridPreview(this, this._componentConfig.data);
    this._dataModelTemplate_FormPreview = new DataModelTemplate_FormPreview(this, this._componentConfig.data);
  }
  if (this._componentConfig.properties) {
    this._componentConfig.properties.fields = this.processBrowserFields(this._componentConfig.properties.fields || []);
    this._propertiesModelTemplate_Form = new PropertiesModelTemplate_Form(this, this._componentConfig.properties);
  }
}

/**
 * Get the component captions tuple as defined by the component JSON.
 * The first element is the title, the second element is the singular caption
 * (if exists), and the third element is the plural caption (if exists).
 * @public
 * @returns {[string, string, string]}
 */
ComponentTemplate.prototype.getCaptions = function() {
  var captions = [this._componentConfig.title];
  if (_.isArray(this._componentConfig.caption)) {
    captions.push(this._componentConfig.caption[0]);
    captions.push(this._componentConfig.caption[1]);
  } else {
    captions.push(this._componentConfig.caption);
    captions.push(this._componentConfig.caption);
  }
  return captions
}

/**
 * Get the component configuration as defined by the component JSON.
 * @public
 * @returns {Object}
 */
ComponentTemplate.prototype.getComponentConfig = function() {
  return this._componentConfig;
}

/**
 * Return the editor type
 * @public
 * @returns {('grid' | 'grid_preview' | 'form' | undefined)}
 */
ComponentTemplate.prototype.getDataEditorType = function() {
  if (this._componentConfig.data) {
    return this._componentConfig.data.layout;
  }
  return undefined;
}

/**
 * @public
 * @returns {(DataModelTemplate_FormPreview | undefined)}
 */
ComponentTemplate.prototype.getDataModelTemplate_FormPreview = function() {
  return this._dataModelTemplate_FormPreview;
}

/**
 * @public
 * @returns {(DataModelTemplate_GridPreview | undefined)}
 */
ComponentTemplate.prototype.getDataModelTemplate_GridPreview = function() {
  return this._dataModelTemplate_GridPreview;
}

/**
 * @public
 * @returns {(PropertiesModelTemplate_Form | undefined)}
 */
ComponentTemplate.prototype.getPropertiesModelTemplate_Form = function() {
  return this._propertiesModelTemplate_Form;
}

/**
 * Get the ID specified for the component configuration.
 * This is NOT an instance id.
 * @public
 * @returns {(string | undefined)}
 */
ComponentTemplate.prototype.getTemplateId = function() {
  return this._componentConfig.id;
}

/**
 * Gets the base class name for this component
 * @public
 * @returns {(string | undefined)}
 */
ComponentTemplate.prototype.getClassName = function() {
  return this._componentConfig.className || jsh.XExt.escapeCSSClass(this._componentConfig.id, { nodash: true });
}

/**
 * @private
 * @param {object[]} fields
 * @returns {object[]}
 */
ComponentTemplate.prototype.processBrowserFields = function(fields) {

  var retVal = [];

  _.forEach(fields, function(field) {
    retVal.push(field);
    if (field.control !== 'link_browser' &&  field.control !== 'media_browser') {
      return;
    }

    var browserType = { link_browser: 'link',   media_browser: 'media' }[field.control];

    /** @type {MediaBrowserControlInfo} */
    var info = {
      dataFieldName: field.name,
      titleFieldName: field.name + '_jsh_browserDataTitle',
      browserType: browserType
    }

    field.mediaBrowserControlInfo = info;
    field.name = info.titleFieldName;
    field.control = 'textbox';
    field.controlclass = 'xtextbox_M';
    field.type = 'varchar';
    field.onchange = '(function() { var m = jsh.App[modelid]; if (m && m.onChangeBrowserTitleControl) m.onChangeBrowserTitleControl("' + info.dataFieldName + '");  })()';

    retVal.push({
      name: field.name + '_browserButton',
      caption: '',
      control: 'button',
      value: 'Browse',
      nl: false,
      onclick: '(function() { var m = jsh.App[modelid]; if (m && m.openEditorBrowser) m.openEditorBrowser("' + info.dataFieldName + '"); })()'
    });

    retVal.push({
      name: field.name + '_resetButton',
      controlclass: 'secondary',
      controlstyle: 'margin-left:10px;',
      caption: '',
      control: 'button',
      value: 'Reset',
      nl: false,
      onclick: '(function() { var m = jsh.App[modelid]; if (m && m.resetEditorBrowser) m.resetEditorBrowser("' + info.dataFieldName + '"); })()'
    });

    retVal.push({
      name: info.dataFieldName,
      caption: '',
      control: 'hidden',
      type: 'varchar'
    });
  });

  return retVal;
}


exports = module.exports = ComponentTemplate;
