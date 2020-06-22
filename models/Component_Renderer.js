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
 */

/**
 * @typedef ComponentLocation
 * @property {number} startIndex
 * @property {number} endIndex
 */

class ComponentRenderer {

  /**
   * @param {Object.<string, string>} components - each entry is the component template for the component key.
   */
  constructor(components) {
    this._components = components || {};
  }

  /**
   * @private
   * @param {string} input - base64 encoded JSON string
   * @returns {Object}
   */
  deserialize(input) {
    const str = Buffer.from(input || '', 'base64').toString() || '{}';
    return JSON.parse(str);
  }

  /**
   * Start from an index in the middle of the component
   * and search backwards for the start, and search forwards for the end.
   * @private
   * @param {number} midIndex - an index that is between the start and end index.
   * @param {string} input - the string to search
   * @returns {ComponentLocation} a tuple with the index bounds. If either the start
   * or end is not found then both indices will be -1.
   */
  findComponentIndexBounds(midIndex, input) {

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
   * @public
   * @param {string} input - the HTML string to search
   * @returns {ComponentLocation[]}
   */
  findComponents(input) {

    const locations = [];
    const regex = /data-component=(?:'|")/gi;
    let match = regex.exec(input);
    while (match) {

      /** @type {ComponentLocation} */
      const location = this.findComponentIndexBounds(regex.lastIndex, input);
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
   * Render the components on the page
   * @public
   * @param {string} pageContent - the page HTML string
   * @returns {string}
   */
  render(pageContent) {
    const locations = this.findComponents(pageContent).reverse();
    locations.forEach(location => {
      let component = pageContent.slice(location.startIndex, location.endIndex + 1);
      component = this.renderComponent(component);
      pageContent = this.spliceString(pageContent, component, location);
    });
    return pageContent;
  }

  /**
   * Render the component. Recursively called
   * for all nested components.
   * @private
   * @param {string} componentHtml
   * @returns {string}
   */
  renderComponent(componentHtml) {
    const $component = cheerio(componentHtml || '');
    const type = $component.attr('data-component');

    const template = this._components[type] || ''; // Should this be an error if template is empty?
    const data = this.deserialize($component.attr('data-component-data'));
    const props = this.deserialize($component.attr('data-component-properties'));

    /** @type {RenderContext} */
    const context = {
      baseUrl: '',
      data: data,
      properties: props,
      type: 'component',
      _: _,
      escapeHTML: Helper.escapeHTML,
    };

    let component = '';
    try{
      component = ejs.render(template, context);
    }
    catch(ex){
      throw new Error('Error rendering '+template+'\r\n'+ex.toString());
    }
    let nestedComponentLocations = this.findComponents(component).reverse();
    nestedComponentLocations.forEach(location => {
      let nestedComponent = component.slice(location.startIndex, location.endIndex + 1);
      nestedComponent = this.renderComponent(nestedComponent);
      component = this.spliceString(component, nestedComponent, location);
    });

    return component;
  }

  /**
   * Cut the input string at the given location
   * and replace the cut portion with the insert string.
   * @private
   * @param {string} input
   * @param {string} insert
   * @param {ComponentLocation} location
   * @returns {string}
   */
  spliceString(input, insert, location) {
    return input.slice(0, location.startIndex) + insert + input.slice(location.endIndex + 1);
  }
}

module.exports = exports = ComponentRenderer;
