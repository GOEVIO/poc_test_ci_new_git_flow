const calcNumberOfDaysSessionDuration = require('../../../functions/calcNumberOfDaysSessionDuration');
module.exports = isDurationValid = (params) => {
    const start_date_time = params?.cdr?.start_date_time;
    const end_date_time = params?.cdr?.end_date_time;
    
    if(!start_date_time || !end_date_time) return false;
    const price = params?.session?.finalPrices?.opcPriceDetail?.timePrice?.incl_vat || 0;

    const duration = calcNumberOfDaysSessionDuration(start_date_time, end_date_time);
    return !(duration > params.compareValue && price > 0);
}