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

const ejs = require('ejs');
const cheerio = require('cheerio');
const _ = require('lodash');
const async = require('async');
const Helper = require('jsharmony/Helper');
const urlparser = require('url');
var wclib = require('jsharmony/WebConnect');
var wc = new wclib.WebConnect();

/** Set the chars used to render new lines for the output **/
const NEW_LINE_OUTPUT = '\r\n';
/** Set the chars used for a single indent for the diff output **/
const INDENT_STRING = '  ';

module.exports = exports = function(module, funcs){
  const exports = {};

  exports.templates_components = function(req, res, next){
    var verb = req.method.toLowerCase();

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var XValidate = jsh.XValidate;
    var cms = module;

    if(!req.params || !req.params.branch_id) return next();
    var branch_id = req.params.branch_id;

    var referer = req.get('Referer');
    if(referer){
      var urlparts = urlparser.parse(referer, true);
      var remote_domain = urlparts.protocol + '//' + (urlparts.auth?urlparts.auth+'@':'') + urlparts.hostname + (urlparts.port?':'+urlparts.port:'');
      res.setHeader('Access-Control-Allow-Origin', remote_domain);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With, Content-Type, Accept');
      res.setHeader('Access-Control-Allow-Credentials', true);
    }

    var model = jsh.getModel(req, module.namespace + 'Page_Editor');
    if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    //Get page
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { 'branch_id': branch_id };
    var validate = new XValidate();
    var verrors = {};
    validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);

    var deployment_target_params = '';

    if (verb == 'get'){

      var components = null;
      var site_id = null;

      async.waterfall([

        //Check if branch exists
        function(cb){
          var sql = "select branch_desc,site_id from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc where branch_id=@branch_id";
          appsrv.ExecRow(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(!rslt || !rslt[0]){ return Helper.GenError(req, res, -4, 'No access to this branch'); }
            site_id = rslt[0].site_id;
            if(!site_id){ return Helper.GenError(req, res, -4, 'No site branch is currently checked out'); }
            return cb();
          });
        },

        //Get components
        function(cb){
          funcs.getComponentTemplates(req._DBContext, site_id, { withContent: true }, function(err, _components){
            if(err) return cb(err);
            components = _components;
            return cb();
          });
        },

        //Get deployment_target_params for branch
        function(cb){
          var sql = "select deployment_target_params from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = v_my_branch_desc.site_id where branch_id=@branch_id";
          appsrv.ExecScalar(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) deployment_target_params = rslt[0];
            return cb();
          });
        },

        //Generate components
        function(cb){
          var publish_params = {
            timestamp: (Date.now()).toString(),
            branch_id: branch_id,
          };
          try{
            if(deployment_target_params) publish_params = _.extend(publish_params, JSON.parse(deployment_target_params));
          }
          catch(ex){
            return cb('Publish Target has invalid deployment_target_params: '+deployment.deployment_target_params);
          }
          publish_params = _.extend({}, cms.Config.deployment_target_params, publish_params);

          _.each(components, function(component){
              if(component.remote_templates && component.remote_templates.editor){
                component.remote_templates.editor = funcs.parseDeploymentUrl(component.remote_templates.editor, publish_params);
              }
            });

          return cb();
        },
        
        //Download remote templates
        function(cb){
          async.eachOf(components, function(component, component_name, component_cb){
            if(component.location=='LOCAL') return component_cb();
            if(!(component.remote_templates && component.remote_templates.editor)) return component_cb();
            if(component.optimization && component.optimization.bare_ejs_templates) return component_cb();
            
            var url = component.remote_templates.editor;
            wc.req(url, 'GET', {}, {}, undefined, function(err, res, templateContent){
              if(err) return component_cb(err);
              if(res && res.statusCode){
                if(res.statusCode > 500) return component_cb(new Error(res.statusCode+' Error downloading template '+url));
                if(res.statusCode > 400) return component_cb(new Error(res.statusCode+' Error downloading template '+url));
              }

              //Parse and merge component config
              var templateConfig = null;
              try{
                templateConfig = funcs.readComponentTemplateConfig(templateContent, 'Remote Component Template: '+url);
              }
              catch(ex){
                return component_cb(ex);
              }
              _.merge(component, templateConfig);

              component.templates.editor = templateContent;
              delete component.remote_templates.editor;

              return component_cb();
            });

          }, cb);
        },

        //Parse template config
        function(cb){
          for(var component_name in components){
            var component = components[component_name];
            if(!(component.templates && component.templates.editor)) continue;
            try{
              funcs.parseComponentTemplateConfigExtensions(component);
            }
            catch(ex){
              return cb(new Error('Error parsing '+component_name+' component template config: '+ex.toString()));
            }
          }
          return cb();
        },

        //Parse template content
        function(cb){
          for(var component_name in components){
            var component = components[component_name];
            if(!(component.templates && component.templates.editor)) continue;
            if(component.optimization && component.optimization.bare_ejs_templates) continue;
            try{
              component.templates.editor = funcs.generateComponentTemplate(component, component.templates.editor);
            }
            catch(ex){
              return cb(new Error('Error parsing "'+component_name+'" component editor template: '+ex.toString()));
            }
          }
          return cb();
        },
      ], function(err){
        if(err) { Helper.GenError(req, res, -9, err.toString()); return; }

        res.end(JSON.stringify({
          '_success': 1,
          'components': components
        }));
      });
    }
    else return next();
  }

  /**
   * RMake the components pretty for diffing
   * @param {string} pageContent - the page HTML containing the components to prettify
   */
  exports.prettyComponents = function(pageContent) {
    const locations = findComponents(pageContent).reverse();
    locations.forEach(location => {
      let component = pageContent.slice(location.startIndex, location.endIndex + 1);
      component = renderComponentXmlLike(component);
      pageContent = spliceString(pageContent, component, location);
    });
    return pageContent;
  }

  /**
   * Render the components on the page
   * @param {string} pageContent - the page HTML containing the components to render
   * @param {ReplaceComponentsOptions} options
   */
  exports.replaceComponents = function(pageContent, options) {
    const locations = findComponents(pageContent).reverse();
    locations.forEach(location => {
      let component = pageContent.slice(location.startIndex, location.endIndex + 1);
      component = renderComponent(component, options.components);
      pageContent = spliceString(pageContent, component, location);
    });
    return pageContent;
  }

  /**
   * Create an XML-like node from an object where
   * each object property is a child element with
   * the property value the element text.
   * @param {object} obj
   * @param {string} nodeName - the name of the top element
   * @param {Object.<string, string>} attribs
   */
  function createObjectXmlLikeNode(obj, nodeName, attribs) {
    /** @type {XmlLikeNode} */
    const dataNode = { children: [], attribs: attribs || {}, name: nodeName, text: '' };
    dataNode.children = Object.entries(obj).map(kvp => {
      var itemName = kvp[0];
      if(itemName.indexOf('_jsh_browserDataTitle') > 0) itemName = Helper.ReplaceAll(itemName, '_jsh_browserDataTitle', '_desc');
      /** @type {XmlLikeNode} */
      const itemNode = {
        attribs: {},
        children: [],
        name: itemName,
        text: `${kvp[1]}` // convert to string
      };
      return itemNode;
    });
    return dataNode;
  }

  /**
   * @param {string} componentHtml
   * @returns {ComponentConfig}
   */
  function deserialize(componentHtml) {
    const $component = cheerio(componentHtml || '');

    /** @type {ComponentConfig} */
    const config = {
      data: JSON.parse(Buffer.from($component.attr('data-component-data') || '', 'base64').toString() || '{}'),
      properties: JSON.parse(Buffer.from($component.attr('data-component-properties') || '', 'base64').toString() || '{}'),
      type: $component.attr('data-component')
    };

    return config;
  }

  /**
   * Process the raw component template EJS
   * to extract the component EJS template.
   * @param {string} rawTemplateEjs
   */
  function extractComponentTemplate(rawTemplateEjs) {
    rawTemplateEjs = rawTemplateEjs || '';
    const $wrapper = cheerio(rawTemplateEjs).filter('.componentTemplate');
    return $wrapper.length < 1 ?  rawTemplateEjs : $wrapper.html();
  }

  /**
   * Start from an index in the middle of the component
   * and search backwards for the start, and search forwards for the end.
   * @param {number} midIndex - an index that is between the start and end index.
   * @param {string} input - the string to search
   * @returns {ComponentLocation} a tuple with the index bounds. If either the start
   * or end is not found then both indices will be -1.
   */
  function findComponentIndexBounds(midIndex, input) {

    // The component will always be a div element
    // that starts with the RegEx pattern "<\s*div"
    // and ends with the Regex pattern "<\s*\/\s*div\s*>".

    /** @type {ComponentLocation} */
    const location = {
      endIndex: -1,
      startIndex: -1
    };

    let index = midIndex;
    let stringBuffer = '';
    while (index > -1) {
      stringBuffer = input[index] + stringBuffer;
      if (/^<\s*div/.test(stringBuffer)) {
        location.startIndex = index;
        break;
      }
      index--;
    }

    // We didn't find the starting point.
    // There is no use continuing.
    if (location.startIndex < 0) return location;

    index = midIndex;
    stringBuffer = '';
    while (index < input.length) {
      stringBuffer += input[index];
      if (/<\s*\/\s*div\s*>$/.test(stringBuffer)) {
        location.endIndex = index;
        break;
      }
      index++;
    }

    if (location.endIndex < 0) {
      location.startIndex = -1;
    }
    return location;
  }

  /**
   * Search the input string to find the starting and ending
   * indices of each component.
   * @param {string} input - the HTML string to search
   * @returns {ComponentLocation[]}
   */
  function findComponents(input) {

    const locations = [];
    const regex = /data-component=(?:'|")/gi;
    let match = regex.exec(input);
    while (match) {

      /** @type {ComponentLocation} */
      const location = findComponentIndexBounds(regex.lastIndex, input);
      if (location.endIndex < 0 || location.startIndex < 0) {
        throw new Error(`Could not find component boundaries for component at index ${regex.lastIndex}`);
      }

      locations.push(location);
      regex.lastIndex = location.endIndex;
      match = regex.exec(input);
    }

    return locations;
  }

  /**
   * Get a string for indenting at a desired level
   * @param {number} level - indent level
   * @returns {string}
   */
  function getIndentString(level) {
    if (level < 1) return '';
    return new Array(level).fill(INDENT_STRING).join('');
  }

  /**
   * Indent each line of the text block
   * to the desired level
   * @param {string} text
   * @param {number} level - indentation level
   * @returns {string}
   */
  function indentTextBlock(text, level) {
    const indent = getIndentString(level);
    return indent + (text || '').replace(/\r?\n/g, `${NEW_LINE_OUTPUT}${indent}`);
  }

  /**
   * Render the component. Recursively called
   * for all nested components.
   * @param {string} componentHtml
   * @param {Object.<string, string>} componentsTemplates - each entry is the component template for the component key.
   * @returns {string}
   */
  function renderComponent(componentHtml, componentsTemplates) {
    const componentConfig = deserialize(componentHtml);
    const template = extractComponentTemplate(componentsTemplates[componentConfig.type] || ''); // Should this be an error if template is empty?
    const data = componentConfig.data;
    const props = componentConfig.properties;

    /** @type {RenderContext} */
    const context = {
      baseUrl: '',
      data: data,
      properties: props,
      renderType: 'component',
      _: _,
      escapeHTML: Helper.escapeHTML,
      stripTags: Helper.StripTags,
      isInEditor: false,
      isInPageEditor: false,
      isInComponentEditor: false,
      items: [],
      item: {},
      component: props,
      data_errors: [],
      renderPlaceholder: function(){ return ''; },
    };
    //Add item and items variables
    if(data && data.items){
      context.items = data.items;
      context.item = new Proxy(new Object(), { get: function(target, prop, receiver){ throw new Error('Please add a "component-item" attribute to the container HTML element, to iterate over the items array.  For example:\r\n<div component-item><%=item.name%></div>'); } });
    }
    else if(data && data.item){
      context.item = context.data.item;
      context.items = [context.data.item];
    }

    var rslt = '';
    try{
      rslt = ejs.render(template, context);
    }
    catch(ex){
      throw new Error(`Error rendering ${template}\r\n${ex.toString()}`);
    }

    const nestedComponentLocations = findComponents(rslt).reverse();
    nestedComponentLocations.forEach(location => {
      let nestedComponent = rslt.slice(location.startIndex, location.endIndex + 1);
      nestedComponent = renderComponent(nestedComponent, componentsTemplates);
      rslt = spliceString(rslt, nestedComponent, location);
    });

    return rslt;
  }

  /**
   * Render the component in XML-like  format
   * for component diffing. Recursively called
   * for all nested components.
   * @param {string} componentHtml
   * @returns {string}
   */
  function renderComponentXmlLike(componentHtml) {

    const componentConfig = deserialize(componentHtml);

    /** @type {XmlLikeNode} */
    const topNode = { attribs: {}, children: [], name: componentConfig.type, text: '' };

    // Add properties
    topNode.children.push(createObjectXmlLikeNode(componentConfig.properties, 'properties'));

    // Add data
    const dataItems = componentConfig.data.item ? [componentConfig.data.item] : componentConfig.data.items || [];
    dataItems.forEach((item, i) => topNode.children.push(createObjectXmlLikeNode(item, 'data', { item: i + 1 })));

    let rendered =  renderComponentXmlLikeNode(topNode);
    return rendered;
  }

  /**
   * @param {XmlLikeNode} node
   * @returns {string}
   */
  function renderComponentXmlLikeNode(node) {

    const attributes = Object.entries(node.attribs).map(kvp => `${kvp[0]}="${kvp[1]}"`);
    const startTag = `<${[node.name, ...attributes].join(' ')}>`;
    const endTag = `</${node.name}>`;

    let text = node.text || '';
    findComponents(text).reverse().forEach(location => {
      let nestedComponent = text.slice(location.startIndex, location.endIndex + 1);
      nestedComponent = renderComponentXmlLike(nestedComponent);
      text = spliceString(text, nestedComponent, location);
    });

    const childrenNodeText = (node.children || []).map(child => renderComponentXmlLikeNode(child)).join(NEW_LINE_OUTPUT);

    let innerText = '';
    if (text.length > 0 && childrenNodeText.length > 0) {
      innerText = text + NEW_LINE_OUTPUT + childrenNodeText;
    } else if (text.length > 0) {
      innerText = text;
    } else if (childrenNodeText.length > 0) {
      innerText = childrenNodeText;
    }

    const textIsMultiLine = /\r?\n/.test(innerText);
    innerText = textIsMultiLine ? NEW_LINE_OUTPUT + indentTextBlock(innerText, 1) + NEW_LINE_OUTPUT : innerText;
    return startTag + innerText + endTag;
  }

  /**
   * Cut the input string at the given location
   * and replace the cut portion with the insert string.
   * @param {string} input
   * @param {string} insert
   * @param {ComponentLocation} location
   * @returns {string}
   */
  function spliceString(input, insert, location) {
    return input.slice(0, location.startIndex) + insert + input.slice(location.endIndex + 1);
  }

  return exports;
}


/**
 * @typedef {Object} ComponentConfig
 * @property {Object} data
 * @property {Object} properties
 * @property {string} type
 */

/**
 * @typedef {Object} RenderContext
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {('component')} type
 * @property {string} baseUrl
 * @property {Object} _
 * @property {Function} escapeHTML
 */

/**
 * @typedef ComponentLocation
 * @property {number} startIndex
 * @property {number} endIndex
 */

/**
 * @typedef {Object} ReplaceComponentsOptions
 * @property {Object.<string, string>} components
 */


/**
 * @typedef {Object} XmlLikeNode
 * @property {Object.<string, string>} attribs
 * @property {string} name
 * @property {string} text
 * @property {XmlLikeNode[]} children
 */
