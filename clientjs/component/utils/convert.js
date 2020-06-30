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
}

exports = module.exports = Convert;
