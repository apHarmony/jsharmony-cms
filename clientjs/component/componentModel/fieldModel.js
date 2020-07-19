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
var Cloner = require('../utils/cloner');
var Convert = require('../utils/convert');

/**
 * @typedef {FieldModel} FieldModel
 */

/**
 * @class
 * @classdesc This class adds functionality for working with field models
 * defined in the JSH component JSON.
 */
function FieldModel() {

}

/**
 * JSH changes the types defined in the model.
 * This will convert the fields in dataInstance to the correct type
 * based on the fieldModel.
 * @public
 * @static
 * @param {Object} dataInstance - the data to operate on (will be mutated).
 * @param {Object[]} fields - the fields array from the model
 */
FieldModel.convertTypes = function(dataInstance, fields) {

  if (dataInstance == undefined) return;

  var numberTypeLut = {
    bigint: true,
    int: true,
    smallint: true,
    tinyint: true,
    decimal: true,
    float: true
  }

  dataInstance = dataInstance || {};
  _.forEach(fields || [], function(field) {
    var fieldName = field.name;
    var fieldType = field.type;
    if (fieldType == undefined) return;
    if (!(fieldName in dataInstance)) return;

    if (numberTypeLut[fieldType]) {
      dataInstance[fieldName] = Convert.toNumber(dataInstance[fieldName]);
    }
  });
}

/**
 * Create a pristine copy of the data.
 * This will remove extraneous properties (that don't exist in the model)
 * and do data conversions. It will also add missing fields.
 * The returned value will match the field model exactly.
 *
 * NOTE: this does not set default values! If the value is not set in
 * dataInstance then the property will be set to undefined.
 *
 * @public
 * @static
 * @param {Object} dataInstance - the existing field values.
 * @param {Object[]} fields - the fields array from the model
 * @returns {Object} a copy of the dataInstance with type conversions done and extraneous
 * properties removed.
 */
FieldModel.makePristineCopy = function(dataInstance, fields) {

  var pristineCopy = {};
  _.forEach(fields, function(field) {
    var fieldName = field.name;
    var fieldType = field.type;
    if (fieldType == undefined) return;

    pristineCopy[fieldName] = dataInstance[fieldName];
  });

  FieldModel.convertTypes(pristineCopy);
  return pristineCopy;
}

/**
 * Iterates through the fieldModels
 * to look for fields with "type" property. If a field has the type property
 * then the field will be added to the new data instance object.
 *
 * Setting the field follows specific rules
 * 1. If the data instance does not contain the property key
 *    then the property is set to either undefined or the default value.
 * 2. If the data instance contains the property and the property value is
 *    defined then it is left as-is.
 * 3. If the data instance contains the property and the property value is
 *    null/undefined then the property is overridden if there is a default AND
 *    it is a required field. If it is not required then the value is left as
 *    null/undefined (which allows the user to clear default values that are
 *    not required fields).
 *
 * This will also correctly convert values as needed.
 *
 * This mutates the dataInstance.
 * @public
 * @static
 * @param {Object} dataInstance - the data instance. Each property corresponds
 * to a field in the fieldModels array. This object will not be mutated.
 * @param {Object[]} fields - the fields array from the model
 * @returns {Object} the new or mutated data
 */
FieldModel.populateDataInstance = function(dataInstance, fields) {

  dataInstance = dataInstance || {};
  _.forEach(fields || [], function(field) {
    var fieldName = field.name;
    var fieldType = field.type;
    if (fieldType == undefined) return;

    // Must follow the rules to ensure
    // required fields are set to default values while also
    // allowing default fields to be cleared by the user if they are
    // not required fields.
    if (dataInstance[fieldName] != undefined) {
      return;
    }
    var isRequired = _.some((field.validate || []), function(a) { return a === 'Required'; });
    var defaultValue= field.default;
    const propertyKeyExists = fieldName in dataInstance;

    if (propertyKeyExists && isRequired) {
      // The property has been set by the user
      // (since the key exists) but it is undefined/null
      // while being required. This means the undefined value needs
      // to be overridden with the default.
      dataInstance[fieldName] = defaultValue;
    } else if (!propertyKeyExists) {
      // The property has not been set by the user
      // (since the key does not exist) so must
      // default to the default value (even if undefined/null)
      dataInstance[fieldName] = defaultValue;
    }
  });
  FieldModel.convertTypes(dataInstance);
  // Must return in case original instance was null/undefined
  return dataInstance;
}

exports = module.exports = FieldModel;
