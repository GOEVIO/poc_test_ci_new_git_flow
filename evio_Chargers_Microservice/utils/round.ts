/**
 * Rounds a number to a specified number of decimal places.
 * @param {number} value - The number to be rounded.
 * @param {number} [decimals=2] - The number of decimal places to round to.
 * @returns {number} The rounded number.
 */

export const round = (value: number, decimals = 2): number => {
    return Number(value.toFixed(decimals))
}