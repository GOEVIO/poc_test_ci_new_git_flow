const { jest, beforeAll, describe, test, expect } = require("@jest/globals");
const moment = require('moment');
const { historyTypeEnums } = require('../../utils/enums/historyEnums');
const {
    validateInput,
    createOptions,
    createCommonFields,
    createQuery,
    validatePageNumber,
    validateLimitQuery,
} = require('../../middlewares/history');

describe('validateInput', () => {

    test('throws error if startDate is missing', () => {
        expect(() => validateInput(null, '2023-01-01T10:00', 'chargers')).toThrow('Start date is required');
    });

    test('throws error if endDate is missing', () => {
        expect(() => validateInput('2023-01-01T10:00', null, 'chargers')).toThrow('End date is required');
    });

    test('throws error if startDate format is invalid', () => {
        expect(() => validateInput('invalid-date', '2023-01-01T10:00', 'chargers')).toThrow('Invalid start date format');
    });

    test('throws error if endDate format is invalid', () => {
        expect(() => validateInput('2023-01-01T10:00', 'invalid-date', 'chargers')).toThrow('Invalid end date format');
    });

    test('throws error if type is missing', () => {
        expect(() => validateInput('2023-01-01T10:00', '2023-01-01T11:00', null)).toThrow('Type is required');
    });

    test('throws error if type is unsupported', () => {
        expect(() => validateInput('2023-01-01T10:00', '2023-01-01T11:00', 'unsupported')).toThrow('Unsupported type');
    });

    test('throws error if endDate is before startDate', () => {
        expect(() => validateInput('2023-01-01T10:00', '2023-01-01T09:00', 'chargers')).toThrow('End date needs to be bigger than start date');
    });

    test('does not throw error for valid input', () => {
        expect(() => validateInput('2023-01-01T10:00', '2023-01-01T11:00', 'chargers')).not.toThrow();
    });

    test('does not throw error for another valid input', () => {
        expect(() => validateInput('2023-01-01T10:00', '2023-01-01T11:00', 'evs')).not.toThrow();
    });
});

describe('createOptions', () => {
    test('creates correct options', () => {
        const options = createOptions(2, 10);
        expect(options).toEqual({ skip: 10, limit: 10 });
    });
});

describe('createCommonFields', () => {
    test('creates common fields object', () => {
        const fields = createCommonFields();
        expect(fields).toEqual({
            _id: 1,
            totalPower: 1,
            estimatedPrice: 1,
            batteryCharged: 1,
            timeCharged: 1,
            CO2Saved: 1,
            authType: 1,
            hwId: 1,
            evId: 1,
            idTag: 1,
            status: 1,
            plugId: 1,
            startDate: 1,
            stopDate: 1,
            'readingPoints.readDate': 1,
            'readingPoints.totalPower': 1,
            'readingPoints.instantPower': 1,
            'readingPoints.instantVoltage': 1,
            'readingPoints.instantAmperage': 1,
            sessionId: 1,
            meterStart: 1,
            meterStop: 1,
            finalPrice: 1,
            paymentMethod: 1,
            paymentStatus: 1,
            paymentBillingInfo: 1,
            cdrId: 1,
            cardNumber: 1
        });
    });
});

describe('createQuery', () => {
    test('creates query with given parameters', () => {
        const additionalConditions = { someField: 'someValue' };
        const primaryConditions = { anotherField: 'anotherValue' };
        const dateField = 'dateField';
        const startDate = '2023-01-01T00:00:00Z';
        const endDate = '2023-01-31T23:59:59Z';

        const query = createQuery(additionalConditions, primaryConditions, dateField, startDate, endDate);
        expect(query).toEqual({
            ...primaryConditions,
            [dateField]: { $gte: new Date(startDate), $lte: new Date(endDate) },
            status: { $ne: process.env.PaymentStatusFaild },
            ...additionalConditions
        });
    });
});

describe('validateLimitQuery', () => {
    test('throws error if limit query is invalid', () => {
        expect(() => validateLimitQuery('invalid')).toThrow('Invalid limit query');
    });
    test('throws error if limit query is greater than 100', () => {
        expect(() => validateLimitQuery(101)).toThrow('Limit query cannot be greater than 100');
    });
    test('throws error if page number is less than 0', () => {
        expect(() => validatePageNumber(0)).toThrow('Page number cannot be less than 1');
    });
    test('does not throw error if limit query is valid', () => {
        expect(() => validateLimitQuery(50)).not.toThrow();
    });
})

describe('validatePageNumber', () => {
    test('throws error if page number is invalid', () => {
        expect(() => validatePageNumber('invalid')).toThrow('Invalid page number');
    });
    test('throws error if page number is less than 1', () => {
        expect(() => validatePageNumber(0)).toThrow('Page number cannot be less than 1');
    });
    test('does not throw error if page number is valid', () => {
        expect(() => validatePageNumber(1)).not.toThrow();
    });
})
