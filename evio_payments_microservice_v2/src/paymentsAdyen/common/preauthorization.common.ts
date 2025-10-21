import { ErrorHandlerCommon } from "../../common/error.handler.common";

export class PreAuthorizationCommon {
    
    constructor() {}

    /**
     * Checks if the given date is more than one month old compared to the current date.
     *
     * @param {number | Date} dateToCheck - The date to check. It can be either a number representing the timestamp or a Date object.
     * @return {boolean} Returns true if the given date is more than one month old, false otherwise.
     */
    static isMoreThanNDaysOld(dateToCheck: number | Date, pastDays: number): boolean {
        // Get the current date
        const currentDate = new Date();
    
        // Subtract one month from the current date
        const oneMonthAgo = new Date(currentDate.getTime() - pastDays * 24 * 60 * 60 * 1000);
        console.log('datas: ', oneMonthAgo, dateToCheck)
        // Compare the dates
        return dateToCheck < oneMonthAgo;
    }

    /**
     * Ensures that the provided request body does not contain any fields that are not allowed for an update.
     *
     * @param {any} body - The request body to be checked.
     * @throws {Object} - Throws an error object with a message, code, errorType, and statusCode if any of the disallowed fields are present in the body.
     */    
    static ensureUpdatePreAuthorizationRequest(body: any) {
        if(body._id || body.transactionId || body.initialAmount || body.currency || body.paymentMethodId || body.createdAt) {
            throw ErrorHandlerCommon.badrequest('server_bad_request', 'Bad Request - _id, transactionId, initialAmount, currency, paymentMethodId, createdAt not allowed', 'Bad Request');
        }

        if(!body.adyenReference) {
            throw ErrorHandlerCommon.badrequest('server_bad_request', 'Bad Request - adyenReference is required', 'Bad Request');
        }

        if(!body.amount) {
            throw ErrorHandlerCommon.badrequest('server_bad_request', 'Bad Request - amount is required', 'Bad Request');
        }
    }

    
}