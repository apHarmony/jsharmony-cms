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
};

exports = module.exports = Cloner;
