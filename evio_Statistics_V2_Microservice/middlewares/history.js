const moment = require('moment');
const { findInvoiceByDocumentNumber } = require('evio-library-billing/dist').default;
const { historyTypeEnums } = require('../utils/enums/historyEnums');
const { Constants } = require('../utils/constants');

function isValidDateFormat(date) {
    return moment(date, 'YYYY-MM-DDTHH:mm', true).isValid();
}

function validateDateRange(startDate, endDate) {
    const startDateMoment = moment(startDate, 'YYYY-MM-DDTHH:mm', true);
    const endDateMoment = moment(endDate, 'YYYY-MM-DDTHH:mm', true);
    if (endDateMoment.isBefore(startDateMoment)) {
        throw new Error('End date needs to be bigger than start date');
    }
}

function validateType(type) {
    const validTypes = [historyTypeEnums.Chargers, historyTypeEnums.Evs];
    if (!validTypes.includes(type.toUpperCase())) {
        throw new Error('Unsupported type');
    }
}

function validateLimitQuery(limitQuery) {
    if (isNaN(limitQuery)) throw new Error('Invalid limit query');
    if (limitQuery < Constants.queryMininum) throw new Error('Invalid limit query');
    if (limitQuery > Constants.limitQueryMax) throw new Error('Limit query cannot be greater than 100');
}

function validatePageNumber(pageNumber) {
    if (isNaN(pageNumber)) throw new Error('Invalid page number');
    if (pageNumber < Constants.queryMininum) throw new Error('Page number cannot be less than 1');
}

function createOptions(pageNumber, limitQuery) {
    return {
        skip: (pageNumber - 1) * limitQuery,
        limit: limitQuery
    };
}

function createCommonFields() {
    return {
        _id: 1, totalPower: 1, estimatedPrice: 1, batteryCharged: 1, timeCharged: 1, CO2Saved: 1, authType: 1, hwId: 1, evId: 1, idTag: 1, status: 1, plugId: 1,
        startDate: 1, stopDate: 1, 'readingPoints.readDate': 1, 'readingPoints.totalPower': 1, 'readingPoints.instantPower': 1, 'readingPoints.instantVoltage': 1,
        'readingPoints.instantAmperage': 1, sessionId: 1, meterStart: 1, meterStop: 1, finalPrice: 1, paymentMethod: 1, paymentStatus: 1,
        paymentBillingInfo: 1, cdrId: 1, cardNumber: 1, 'totalPrice.excl_vat': 1, 'ev.brand': 1, 'ev.model': 1, 'ev.licensePlate': 1,
        invoiceDetails: 1
    };
}

function projectInvoiceDetails() {
    return {
        hwId: 1,
        plugId: 1,
        startDate: 1,
        stopDate: 1,
        sessionId: 1,
        cardNumber: 1,
        evLicensePlate: "$ev.licensePlate",
        operator: "$charger.operatorID",
        name: "$charger.name",
        address: 1,
        code: "$invoiceDetails.code",
        description: "$invoiceDetails.description",
        unitPrice: "$invoiceDetails.unitPrice",
        uom: "$invoiceDetails.uom",
        quantity: "$invoiceDetails.quantity",
        vat: "$invoiceDetails.vat",
    };
}

function createQuery(additionalConditions, primaryConditions, dateField, startDate, endDate) {
    return {
        ...primaryConditions,
        [dateField]: { $gte: new Date(startDate), $lte: new Date(endDate) },
        status: { $ne: process.env.PaymentStatusFaild },
        ...additionalConditions
    };
}

async function validateInput(startDate, endDate, type, limitQuery,
                             pageNumber, optInvoiceDocumentNumber) {
    if(optInvoiceDocumentNumber) {
        const fetchedInvoice = await findInvoiceByDocumentNumber(optInvoiceDocumentNumber);

        if (!fetchedInvoice) throw new Error('Invoice not found');
    } else {
        if (!startDate) throw new Error('Start date is required');
        if (!endDate) throw new Error('End date is required');

        if (!isValidDateFormat(startDate)) throw new Error('Invalid start date format');
        if (!isValidDateFormat(endDate)) throw new Error('Invalid end date format');

        validateDateRange(startDate, endDate);
        if (!type) throw new Error('Type is required');
        validateType(type);
        if (limitQuery) {
            validateLimitQuery(limitQuery);
        }
        if (pageNumber) {
            validatePageNumber(pageNumber);
        }
    }
}

module.exports = { 
    validateInput, 
    createOptions, 
    createCommonFields, 
    createQuery, 
    validatePageNumber, 
    validateLimitQuery, 
    projectInvoiceDetails 
}
