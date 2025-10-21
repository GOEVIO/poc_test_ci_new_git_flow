const moment = require('moment');

/**
 * Calculates the number of days between two dates.
 * @param {string} startDate - The start date in ISO format.
 * @param {string} endDate - The end date in ISO format.
 * @returns {number} - The number of days between the two dates.
 */
module.exports = calcNumberOfDaysSessionDuration = (startDate, endDate) => {
    const diffInMinutes = moment(endDate).diff(moment(startDate), 'minutes');
    return diffInMinutes / 1440;
}