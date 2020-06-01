var Convert  = require('../utils/convert');

/**
 * @class
 * @classdesc A simple data store to handle data management for grid.
 * @param {string} idKey - the data item property name that serves as the unique item ID.
 */
function GridDataStore(idKey) {
  // This array reference must never change!
  /** @type {Array.<Object>} */
  this._dataArray = [];

  /** @type {string} */
  this._idKey = idKey;
}

/**
 * @public
 * @param {Object} item
 */
GridDataStore.prototype.addNewItem = function(item) {
  if (!item[this._idKey]) {
    throw new Error('item must have an ID');
  }
  if (this.getItemIndexById(item[this._idKey]) > -1) {
    throw new Error('item already exists');
  }
  this._dataArray.push(item);
}

/**
 * Remove the item with the given ID if it exists.
 * @public
 */
GridDataStore.prototype.deleteItem = function(id) {
  var index =  this.getItemIndexById(id);
  if (index > -1) {
    this._dataArray.splice(index, 1)
  }
}

/**
 * Get the item with the given ID if it exists.
 * @public
 * @param {string} id
 * @returns {(Object | undefined)}
 */
GridDataStore.prototype.getDataItem = function(id) {
  return this._dataArray[this.getItemIndexById(id)];
}

/**
 * Gets a constant reference to the array of data.
 * @returns {Array.<Object>}
 */
GridDataStore.prototype.getDataArray = function() {
  // Must return same reference every time.
  return this._dataArray;
}

/**
 * Get the index of the data with the given ID
 * @private
 * @param {string} id
 * @returns {number} - index of found item or -1 if not found.
 */
GridDataStore.prototype.getItemIndexById = function(id) {
  var idKey = this._idKey;
  return this._dataArray.findIndex(function(item) { return id === item[idKey]; });
}

/**
 * Return the count of data in the store.
 * @public
 * @returns {number}
 */
GridDataStore.prototype.count = function() {
  return this._dataArray.length;
}

/**
 * Sort the data by sequence number in ascending order
 * @public
 */
GridDataStore.prototype.sortBySequence = function() {
  // Remember, DON'T update array reference EVER!
  this._dataArray.sort(function(a, b) {
    return  Convert.toNumber(a.sequence) > Convert.toNumber(b.sequence) ? 1 : -1;
  });
}

/**
 * Replace the item with the matching ID
 * @public
 * @param {Object} item
 */
GridDataStore.prototype.updateItem = function(item) {
  if (!item[this._idKey]) {
    throw new Error('item must have an ID');
  }
  var index =  this.getItemIndexById(item[this._idKey]);
  if (index < 0) {
    throw new Error('item does not exist');
  }
  this._dataArray[index] = item;
}

exports = module.exports = GridDataStore;
