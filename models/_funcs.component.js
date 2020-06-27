const ejs = require('ejs');
const cheerio = require('cheerio');
const _ = require('lodash');
const Helper = require('jsharmony/Helper');

/** Set the chars used to render new lines for the output **/
const NEW_LINE_OUTPUT = '\r\n';
/** Set the chars used for a single indent for the diff output **/
const INDENT_STRING = '  ';

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
      throw new Error(`Error rendering ${template}\r\n${ex.toString()}`);
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