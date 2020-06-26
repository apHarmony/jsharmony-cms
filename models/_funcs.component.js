var ejs = require('ejs');
var cheerio = require('cheerio');
var _ = require('lodash');
var Helper = require('jsharmony/Helper');


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


module.exports = exports = function(module, funcs){
  const exports = {};

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
    /** @type {XmlLikeNode} */
      const itemNode = {
        attribs: {},
        children: [],
        name: kvp[0],
        text: kvp[1]
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
   * Render the component. Recursively called
   * for all nested components.
   * @param {string} componentHtml
   * @param {Object.<string, string>} componentsTemplates - each entry is the component template for the component key.
   * @returns {string}
   */
  function renderComponent(componentHtml, componentsTemplates) {
    const componentConfig = deserialize(componentHtml);
    const template = componentsTemplates[componentConfig.type] || ''; // Should this be an error if template is empty?
    const data = componentConfig.data;
    const props = componentConfig.properties;

    /** @type {RenderContext} */
    const context = {
      baseUrl: '',
      data: data,
      properties: props,
      type: 'component',
      _: _,
      escapeHTML: Helper.escapeHTML,
      stripTags: Helper.StripTags,
    };

    let component = '';
    try{
      component = ejs.render(template, context);
    }
    catch(ex){
      throw new Error('Error rendering '+template+'\r\n'+ex.toString());
    }
    const nestedComponentLocations = findComponents(component).reverse();
    nestedComponentLocations.forEach(location => {
      let nestedComponent = component.slice(location.startIndex, location.endIndex + 1);
      nestedComponent = renderComponent(nestedComponent, componentsTemplates);
      component = spliceString(component, nestedComponent, location);
    });

    return component;
  }

  /**
   * Render the component in XML-like  format
   * for component diffing. Recursively called
   * for all nested components.
   * @param {string} componentHtml
   * @param {(number | undefined)} [depth]
   * @returns {string}
   */
  function renderComponentXmlLike(componentHtml, depth = 0) {

    const componentConfig = deserialize(componentHtml);

    /** @type {XmlLikeNode} */
    const topNode = { attribs: {}, children: [], name: componentConfig.type, text: '' };

    // Add properties
    topNode.children.push(createObjectXmlLikeNode(componentConfig.properties, 'properties'));

    // Add data
    const dataItems = componentConfig.data.item ? [componentConfig.data.item] : componentConfig.data.items || [];
    dataItems.forEach((item, i) => topNode.children.push(createObjectXmlLikeNode(item, 'data', { item: i + 1 })));

    let rendered =  renderXmlLikeNode(topNode, depth);
    const nestedComponentLocations = findComponents(rendered).reverse();
    nestedComponentLocations.forEach(location => {
      let nestedComponent = rendered.slice(location.startIndex, location.endIndex + 1);
      nestedComponent = renderComponentXmlLike(nestedComponent, depth + 4);
      rendered = spliceString(rendered, nestedComponent, location);
    });

    return rendered;
  }

  /**
   * @param {XmlLikeNode} node
   * @param {(number | undefined)} [depth]
   * @returns {string}
   */
  function renderXmlLikeNode(node, depth = 0) {
    const indent = new Array(depth * 2).fill(' ').join('');
    const attributes = Object.entries(node.attribs).map(kvp => `${kvp[0]}="${kvp[1]}"`);
    const startTag = `<${[node.name, ...attributes].join(' ')}>`;

    if ((node.children || []).length < 1) {
      return `${indent}${startTag}${node.text ? node.text : ''}</${node.name}>`;
    } else {
      const lineBuffer = [];
      lineBuffer.push(`${indent}${startTag}${node.text ? node.text : ''}`);
      (node.children || []).forEach(childNode => {
        const child = renderXmlLikeNode(childNode, depth + 1)
        lineBuffer.push(child)
      });
      lineBuffer.push(`${indent}</${node.name}>`);
      return lineBuffer.join('\r\n');
    }
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