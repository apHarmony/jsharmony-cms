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
 * @classdesc This contains helper functions to coerce values from one type to another.
 */
function Convert() {}

/**
 * Try to convert the input value to a number.
 * @static
 * @public
 * @param {(number | string | undefined)} input
 * @param {boolean} allowNan - if not true, NaNs will be returned as undefined.
 * @returns {(number | undefined)} - return number of successful
 */
Convert.toNumber = function(input, allowNan) {
  if (typeof input === 'string') {
    input = parseFloat(input);
  }

  if (typeof input === 'number') {
    return !allowNan && isNaN(input) ? undefined : input;
  } else {
    return undefined;
  }
};

exports = module.exports = Convert;
