const calcNumberOfDaysSessionDuration = require('../../../functions/calcNumberOfDaysSessionDuration');

module.exports = isSessionOld = (params) => {
    const start_date_time = params?.cdr?.start_date_time;
    const end_date_time = new Date().toJSON();
    if(!start_date_time) return false;

    const duration = calcNumberOfDaysSessionDuration(start_date_time, end_date_time);
    return duration < params.compareValue;
}