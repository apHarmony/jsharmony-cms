var ejs = require('ejs');
var cheerio = require('cheerio');
var _ = require('lodash');
var Helper = require('jsharmony/Helper');


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

module.exports = exports = function(module, funcs){
  const exports = {};

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
   * @param {string} input - base64 encoded JSON string
   * @returns {Object}
   */
  function deserialize(input) {
    const str = Buffer.from(input || '', 'base64').toString() || '{}';
    return JSON.parse(str);
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
    const $component = cheerio(componentHtml || '');
    const type = $component.attr('data-component');

    const template = componentsTemplates[type] || ''; // Should this be an error if template is empty?
    const data = deserialize($component.attr('data-component-data'));
    const props = deserialize($component.attr('data-component-properties'));

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
    let nestedComponentLocations = findComponents(component).reverse();
    nestedComponentLocations.forEach(location => {
      let nestedComponent = component.slice(location.startIndex, location.endIndex + 1);
      nestedComponent = renderComponent(nestedComponent, componentsTemplates);
      component = spliceString(component, nestedComponent, location);
    });

    return component;
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