var Cloner = require('../utils/cloner');
var Convert = require('../utils/convert');

/**
 * @typedef {FieldModel} FieldModel
 */

/**
 * @class
 * @classdesc This class adds functionality for working with field models
 * defined in the JSH component JSON.
 * @param {Object[]} fieldModels = the field's as defined by the model's 'field' property
 */
function FieldModel(fieldModels) {

  // Since we might mutate the fields we need out own
  // copy to avoid side effects.
  /** @private @type {Object[]} */
  this._fieldModels = Cloner.deepClone(fieldModels || []);

  /** @private @type {(string | undefined)} */
  this._idFieldName = undefined;

  /** @private @type {(string | undefined)} */
  this._sequenceFieldName = undefined;

  /** @private @type {Objec}*/
  this._AUTO_FIELD_NAMES = {
    id: '_jsh_auto_id',
    sequence: '_jsh_auto_sequence'
  };
}

/**
 * Add a new field to the field models list.
 * @public
 * @param {Object} field
 */
FieldModel.prototype.addField = function(field) {
  this._fieldModels.push(field);
}

/**
 * JSH changes the types defined in the model.
 * This will convert the fields in dataInstance to the correct type
 * based on the fieldModel.
 * @public
 * @param {Object} dataInstance - the data to operate on.
 */
FieldModel.prototype.convertTypes = function(dataInstance) {

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
  _.forEach(this._fieldModels || [], function(field) {
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
 * Ensure that an ID field exists.
 * If no ID field exists then one will be added.
 * An error will be thrown if more than one ID field exists.
 * @public
 */
FieldModel.prototype.ensureIdField = function() {
  var idFields = _.filter(this._fieldModels, function(field) { return field.key; });
  if (idFields.length > 1) throw new Error('Expected a single ID field. Found ' + idFields.length);
  if (idFields.length < 1) {
    var idField = { name: this._AUTO_FIELD_NAMES.id, type: 'varchar', control: 'hidden', key: true, caption: '' };
    idFields = [idField];
    this._fieldModels.push(idField);
  }

  this._idFieldName = idFields[0].name;
}

/**
 * Ensure that a sequence field exists.
 * If no sequence field exists then one will be added.
 * @public
 */
FieldModel.prototype.ensureSequenceField = function() {

  var seqFieldName = this._AUTO_FIELD_NAMES.sequence;
  var hasSeqField = _.some(this._fieldModels, function(field) { return field.name === seqFieldName; })
  if (!hasSeqField) {
    var idField = { name: seqFieldName, type: 'int', control: 'hidden', caption: '' };
    this._fieldModels.push(idField);
  }

  this._sequenceFieldName = seqFieldName
}

/**
 * Get a copy of the field model array.
 * @public
 * @returns {Object[]}
 */
FieldModel.prototype.getFieldModels = function() {
  return Cloner.deepClone(this._fieldModels);
}

/**
 * Get the name of the ID field.
 * Don't call this unless `ensureIdField()` has been called.
 * @public
 * @returns {(string | undefined)}
 */
FieldModel.prototype.getIdFieldName = function() {
  return this._idFieldName;
}

/**
 * Get the name of the sequence field.
 * Don't call this unless `ensureSequenceField()` has been called.
 * @public
 * @returns {(string | undefined)}
 */
FieldModel.prototype.getSequenceFieldName = function() {
  return this._sequenceFieldName;
}

/**
 * Set the field with the given field name to hidden.
 * @public
 * @param {string} fieldName
 */
FieldModel.prototype.makeFieldHidden = function(fieldName) {
  var field = _.find(this._fieldModels, function(field) { return field.name === fieldName; });
  if (field) {
    field.control = 'hidden';
  }
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
 * @param {Object} dataInstance - the existing field values.
 * @param {boolean} [removeAutoProps] - if true then this will remove any fields added
 * (e.g., sequence and ID fields)
 * @returns {Object} a copy of the dataInstance with type conversions done and extraneous
 * properties removed.
 */
FieldModel.prototype.makePristineModel = function(dataInstance, removeAutoProps) {

  var autoFieldNameMap = {};
  if (removeAutoProps) {
    _.values(this._AUTO_FIELD_NAMES, function(a) { autoFieldNameMap[a] = true; });
  }

  var pristineCopy = {};
  _.forEach(this._fieldModels, function(field) {
    var fieldName = field.name;
    var fieldType = field.type;
    if (fieldType == undefined) return;
    if (removeAutoProps && autoFieldNameMap[fieldName]) return;

    pristineCopy[fieldName] = dataInstance[fieldName];
  });

  this.convertTypes(pristineCopy);
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
 * @param {Object} dataInstance - the data instance. Each property corresponds
 * to a field in the fieldModels array. This object will not be mutated.
 */
FieldModel.prototype.populateDataInstance = function(dataInstance) {

  dataInstance = dataInstance || {};
  _.forEach(this._fieldModels || [], function(field) {
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
  this.convertTypes(dataInstance);
  // Must return in case original instance was null/undefined
  return dataInstance;
}
exports = module.exports = FieldModel;