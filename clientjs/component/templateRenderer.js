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
 * @typedef {Object} RenderConfig
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {string} template - the template being rendered
 * @property {string} baseUrl
 * @property {(GridPreviewRenderContext | undefined )} gridContext
 */

/**
 * @typedef {Object} RenderContext
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {('component' | 'gridRowDataPreview' | 'gridItemPreview')} type
 * @property {string} baseUrl
 * @property {(GridPreviewRenderContext | undefined )} gridContext
 */

/**
 * @typedef {Object} GridPreviewRenderContext
 * @property {number} rowIndex
 */



/**
 * @class
 * @public
 * @static
 */
function TemplateRenderer() {}

/**
 * Create a mutable object that can be preprocessed before rendering.
 * @public
 * @static
 * @param {string} template
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 * @param {Object} cms
 * @returns {RenderConfig}
 */
TemplateRenderer.createRenderConfig = function(template, data, properties, cms) {

  /** @type {RenderConfig} */
  var config  = {
    data: data,
    properties: properties,
    template: template,
    baseUrl: (cms._baseurl || '').replace(/\/+$/, '') + '/',
  };

  return config;
}

/**
 * @public
 * @static
 * @param {('component' | 'gridRowDataPreview' | 'gridItemPreview')} type
 * @param {RenderConfig} config
 * @param {Object} jsh
 * @returns {string}
 */
TemplateRenderer.render = function(config, type, jsh) {

    /** @type {RenderContext} */
    var renderContext = {
      baseUrl: config.baseUrl,
      data: config.data,
      properties: config.properties,
      renderType: type,
      gridContext: config.gridContext,
      _: jsh._,
      escapeHTML: jsh.XExt.escapeHTML,
      stripTags: jsh.XExt.StripTags,
      isInEditor: true,
    }

    var rendered = '';
    try {
      rendered = jsh.ejs.render(config.template || '', renderContext);
    } catch (error) {
      console.error(error);
    }
    return rendered
}

exports = module.exports = TemplateRenderer;