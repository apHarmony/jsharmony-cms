/**
 * @class
 * @classdesc Serialize and deserialize component data and property attributes
 */
function DomSerializer() { }

/**
 * Get the attribute from the element.
 * The attribute value will be deserialized and returned as an object.
 * @public
 * @static
 * @param {(Element | JQuery)} element - the element to operate on.
 * @param {string} attrName - the name of the attribute to use
 * @returns {object} - the deserialized object.
 */
DomSerializer.getAttr = function(element, attrName) {
  var rawAttr = $(element).attr(attrName) || '';
  return this.deserializeAttrValue(rawAttr);
}

/**
 * Deserialize the serialized string
 * @public
 * @static
 * @param {string | undefined} value - the raw serialized string.
 * @returns {object} - the deserialized object.
 */
DomSerializer.deserializeAttrValue = function(value) {
  value = value ? atob(value) : '{}';
  return JSON.parse(value);
}

/**
 * Set the object (after serialization) as the attribute value.
 * @public
 * @static
 * @param {(Element | JQuery)} element - the element to operate on.
 * @param {string} attrName - the name of the attribute to use
 * @param {(object | undefined)} data - the object to set as the attribute value
 */
DomSerializer.setAttr = function(element, attrName, data) {
  var attrVal = this.serializeAttrValue(data);
  return $(element).attr(attrName, attrVal);
}

/**
 * Serialize the object for safe component usage
 * @public
 * @static
 * @param {(object | undefined)} data - the object to serialize.
 * @returns {string} - the serialized data.
 */
DomSerializer.serializeAttrValue = function(data) {
  // Need to keep undefined values so they don't get set to default values
  var replacer = function(key, value) { return value == undefined ? null : value };
  return btoa(JSON.stringify(data || {}, replacer));
}

exports = module.exports = DomSerializer;
