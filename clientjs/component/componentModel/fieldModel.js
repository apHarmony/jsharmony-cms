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
FieldModel.getPristineData = function(dataInstance, fields) {

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
 * then the field will be added to the new data instance object. When adding
 * a field, the value is set as either the value in the current data instance
 * (if that property key exists) or as the field model default/undefined.
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

    // If the loaded data has the field set
    // (even if set to null/undefined) then we
    // need to use that value. Otherwise use the default
    // or set to undefined. All props must included in the data object (even if null/undefined).
    const dataHasField = fieldName in dataInstance;
    if (dataHasField) {
      dataInstance[fieldName] = dataInstance[fieldName];
    } else {
      // It's okay if default is undefined. We just have to ensure that the
      // field key is set in the data object.
      dataInstance[fieldName] = field.default;
    }
  });
  FieldModel.convertTypes(dataInstance);
  // Must return in case original instance was null/undefined
  return dataInstance;
}

exports = module.exports = FieldModel;
