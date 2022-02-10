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
};

/**
 * @public
 * @static
 * @param {('component' | 'gridRowDataPreview' | 'gridItemPreview')} type
 * @param {RenderConfig} config
 * @param {Object} jsh
 * @param {Object} cms
 * @returns {string}
 */
TemplateRenderer.render = function(config, type, jsh, cms, componentConfig, additionalRenderParams) {
  var _ = jsh._;
  var XValidate = jsh.XValidate;

  var renderPlaceholder = function(params){
    return jsh.RenderEJS(jsh.GetEJS('jsHarmonyCMS.ComponentPlaceholder'),_.extend({
      componentConfig: componentConfig,
      XExt: jsh.XExt,
      errors: '',
    }, params));
  };

  var renderOptions = {
    renderType: type,
    data: null,
    properties: config.properties || {},
  };
  if(config.data && ('items' in config.data)) renderOptions.data = config.data.items;
  else if(config.data && ('item' in config.data)) renderOptions.data = config.data.item;
  else{
    if(componentConfig && (componentConfig.multiple_items)) renderOptions.data = [];
    else renderOptions.data = {};
  }

  var renderContext = cms.componentManager.getComponentRenderParameters(null, renderOptions, _.extend({
    baseUrl: config.baseUrl,
    gridContext: config.gridContext,
    isInEditor: true,
    isInPageEditor: true,
    isInComponentEditor: ((type=='gridRowDataPreview') || (type=='gridItemPreview')),
    componentRenderClass: 'jsharmony_cms_componentRender_'+jsh.XExt.escapeCSSClass((componentConfig&&componentConfig.id)||'')+'_'+cms.componentManager.getUniqueId().toString(),
    getMediaThumbnails: function(url){ return cms.componentManager.getMediaThumbnails(url); },
    renderPlaceholder: renderPlaceholder,
  }, additionalRenderParams));
  
  if(componentConfig){

    var generateValidators = function(model){
      var xvalidate = new XValidate(jsh);
      if(model){
        _.each(model.fields, function(field){
          if(field.validate && field.name){
            for(var j=0;j<field.validate.length;j++){
              var validator = jsh.XPage.ParseValidator(field.validate[j], { actions: 'BIU' }, field, 'BIU');
              for(var i=0;i<validator.funcs.length;i++){
                if(!_.isFunction(validator.funcs[i])) validator.funcs[i] = eval(validator.funcs[i]);
              }
              xvalidate.AddValidator('_obj.'+field.name, validator.caption, validator.actions, validator.funcs);
            }
          }
        });
      }
      return xvalidate;
    };

    var validate = function(xvalidate, data, desc){
      var verrors = xvalidate.Validate('B', data||{});
      if (!_.isEmpty(verrors)) return 'Error: ' + desc + '\n' + verrors[''].join('\n');
      return '';
    };

    //Generate missing validators
    var dataValidators = generateValidators(componentConfig.data);
    var propertyValidators = generateValidators(componentConfig.properties);

    //Show placeholder if editor_placeholder.items_empty=true, and multiple_items, and empty items array
    if(componentConfig.editor_placeholder && componentConfig.editor_placeholder.items_empty){
      if((componentConfig.multiple_items) && (!renderContext.items || !renderContext.items.length)){
        return renderPlaceholder();
      }
    }

    //Show placeholder if editor_placeholder.invalid_fields=true
    if(componentConfig.editor_placeholder && componentConfig.editor_placeholder.invalid_fields){
      //Single item, validation error in data or properties
      if(!componentConfig.multiple_items){
        let dataErrors = validate(dataValidators, renderContext.item, 'Component Data');
        if(dataErrors) return renderPlaceholder({ errors: dataErrors });

        let propertyErrors = validate(propertyValidators, renderContext.properties, 'Component Configuration');
        if(propertyErrors) return renderPlaceholder({ errors: propertyErrors });
      }
      else if(componentConfig.multiple_items){
        let propertyErrors = validate(propertyValidators, renderContext.properties, 'Component Configuration');
        if(propertyErrors) return renderPlaceholder({ errors: propertyErrors });
      }
    }

    if(componentConfig.multiple_items){
      for(var i=0;i<renderContext.items.length;i++){
        let dataErrors = validate(dataValidators, renderContext.items[i], 'Component Data');
        if(dataErrors) renderContext.items[i].jsh_validation_errors = dataErrors;
      }
    }
  }

  var rendered = '';
  
  try {
    rendered = jsh.ejs.render(config.template || '', renderContext);
  } catch (error) {
    rendered = cms.componentManager.formatComponentError('Component Rendering Error: '+error.toString());
    console.log('Render Context:'); // eslint-disable-line no-console
    console.log(renderContext); // eslint-disable-line no-console
    console.error(error); // eslint-disable-line no-console
  }
  return rendered;
};

exports = module.exports = TemplateRenderer;