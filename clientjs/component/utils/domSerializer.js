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
 * @classdesc Serialize and deserialize component data and property attributes
 */
function DomSerializer(jsh) {
  this.jsh = jsh;
}

/**
 * Get the attribute from the element.
 * The attribute value will be deserialized and returned as an object.
 * @public
 * @static
 * @param {(Element | JQuery)} element - the element to operate on.
 * @param {string} attrName - the name of the attribute to use
 * @returns {object} - the deserialized object.
 */
DomSerializer.prototype.getAttr = function(element, attrName) {
  var rawAttr = this.jsh.$(element).attr(attrName) || '';
  return this.deserializeAttrValue(rawAttr);
};

/**
 * Deserialize the serialized string
 * @public
 * @static
 * @param {string | undefined} value - the raw serialized string.
 * @returns {object} - the deserialized object.
 */
DomSerializer.prototype.deserializeAttrValue = function(value) {
  value = value ? atob(value) : '{}';
  return JSON.parse(value);
};

/**
 * Set the object (after serialization) as the attribute value.
 * @public
 * @static
 * @param {(Element | JQuery)} element - the element to operate on.
 * @param {string} attrName - the name of the attribute to use
 * @param {(object | undefined)} data - the object to set as the attribute value
 */
DomSerializer.prototype.setAttr = function(element, attrName, data) {
  var attrVal = this.serializeAttrValue(data);
  return this.jsh.$(element).attr(attrName, attrVal);
};

/**
 * Serialize the object for safe component usage
 * @public
 * @static
 * @param {(object | undefined)} data - the object to serialize.
 * @returns {string} - the serialized data.
 */
DomSerializer.prototype.serializeAttrValue = function(data) {
  // Need to keep undefined values so they don't get set to default values
  var replacer = function(key, value) { return value == undefined ? null : value; };
  try {
    var jsonStr = JSON.stringify(data || {}, replacer);
    if(jsonStr) jsonStr = jsonStr.replace(/[\u00A0-\u9999]/g, function(i) { return '&#' + i.charCodeAt(0) + ';'; });
    return btoa(jsonStr);
  }
  catch(ex){
    alert(ex);
    throw ex;
  }
};

exports = module.exports = DomSerializer;
