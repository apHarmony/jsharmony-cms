/**
 * @class
 * @classdesc Clone objects
 */
function Cloner() { }

/**
 * Do a serialize => deserialize transformation
 * to create a deep clone. Object must be serializable.
 * @public
 * @static
 * @param {Object} obj - item to clone
 * @returns {Object} - cloned object
 */
Cloner.deepClone = function(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

exports = module.exports = Cloner;
