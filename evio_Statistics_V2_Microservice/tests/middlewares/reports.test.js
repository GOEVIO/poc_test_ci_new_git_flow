const { describe, test, expect } = require("@jest/globals");
const validateAndRemoveNegativeFieldsReports = require('../../middlewares/reports');

describe('validateAndRemoveNegativeFieldsReports', () => {

    test('should set negative values in session.totals to zero when session.timeCharged or session.totalPower is non-positive', () => {
        const session = {
            timeCharged: -1,
            totalPower: 10,
            totals: {
                totalPower: -10,
                timeCharged: -5,
                totalPriceInclVat: -100,
                totalPriceExclVat: -80,
                purchaseTariffDetailsExclVat: -50,
                purchaseTariffDetailsInclVat: -60
            }
        };

        const result = validateAndRemoveNegativeFieldsReports(session);

        expect(result.totals.totalPower).toBe(0);
        expect(result.totals.timeCharged).toBe(0);
        expect(result.totals.totalPriceInclVat).toBe(0);
        expect(result.totals.totalPriceExclVat).toBe(0);
        expect(result.totals.purchaseTariffDetailsExclVat).toBe(0);
        expect(result.totals.purchaseTariffDetailsInclVat).toBe(0);
    });

    test('should keep non-negative values in session.totals unchanged when session.timeCharged and session.totalPower are positive', () => {
        const session = {
            timeCharged: 5,
            totalPower: 10,
            totals: {
                totalPower: 10,
                timeCharged: 5,
                totalPriceInclVat: 100,
                totalPriceExclVat: 80,
                purchaseTariffDetailsExclVat: 50,
                purchaseTariffDetailsInclVat: 60
            }
        };

        const result = validateAndRemoveNegativeFieldsReports(session);

        expect(result.totals.totalPower).toBe(10);
        expect(result.totals.timeCharged).toBe(5);
        expect(result.totals.totalPriceInclVat).toBe(100);
        expect(result.totals.totalPriceExclVat).toBe(80);
        expect(result.totals.purchaseTariffDetailsExclVat).toBe(50);
        expect(result.totals.purchaseTariffDetailsInclVat).toBe(60);
    });

    test('should handle negative values in session.totalsGroupBy and its nested arrays when session.timeCharged or session.totalPower is non-positive', () => {
        const session = {
            timeCharged: 0,
            totalsGroupBy: [
                {
                    totalPower: -10,
                    timeCharged: -5,
                    totalPriceInclVat: -100,
                    totalPriceExclVat: -80,
                    purchaseTariffDetailsExclVat: -50,
                    purchaseTariffDetailsInclVat: -60,
                    list: [
                        {
                            totalPower: -15,
                            timeCharged: -8,
                            totalPrice: {
                                excl_vat: -20,
                                incl_vat: -25
                            },
                            purchaseTariffDetails: {
                                excl_vat: -30,
                                incl_vat: -35,
                                kwhListAverage: [-0.1, -0.5, -0.9]
                            }
                        }
                    ]
                }
            ]
        };

        const result = validateAndRemoveNegativeFieldsReports(session);

        const group = result.totalsGroupBy[0];
        const item = group.list[0];

        expect(group.totalPower).toBe(0);
        expect(group.timeCharged).toBe(0);
        expect(group.totalPriceInclVat).toBe(0);
        expect(group.totalPriceExclVat).toBe(0);
        expect(group.purchaseTariffDetailsExclVat).toBe(0);
        expect(group.purchaseTariffDetailsInclVat).toBe(0);

        // Verify item-level fields
        expect(item.totalPower).toBe(0);
        expect(item.timeCharged).toBe(0);
        expect(item.totalPrice.excl_vat).toBe(0);
        expect(item.totalPrice.incl_vat).toBe(0);
        expect(item.purchaseTariffDetails.excl_vat).toBe(0);
        expect(item.purchaseTariffDetails.incl_vat).toBe(0);
        expect(item.purchaseTariffDetails.kwhListAverage).toEqual([0, 0, 0]);
    });

    test('should keep non-negative values in session.totalsGroupBy and its nested arrays unchanged when session.timeCharged and session.totalPower are positive', () => {
        const session = {
            timeCharged: 5,
            totalPower: 10,
            totalsGroupBy: [
                {
                    totalPower: 10,
                    timeCharged: 5,
                    totalPriceInclVat: 100,
                    totalPriceExclVat: 80,
                    purchaseTariffDetailsExclVat: 50,
                    purchaseTariffDetailsInclVat: 60,
                    list: [
                        {
                            totalPower: 15,
                            timeCharged: 8,
                            totalPrice: {
                                excl_vat: 20,
                                incl_vat: 25
                            },
                            purchaseTariffDetails: {
                                excl_vat: 30,
                                incl_vat: 35,
                                kwhListAverage: [0.1, 0.5, 0.9]
                            }
                        }
                    ]
                }
            ]
        };

        const result = validateAndRemoveNegativeFieldsReports(session);

        const group = result.totalsGroupBy[0];
        const item = group.list[0];

        expect(group.totalPower).toBe(10);
        expect(group.timeCharged).toBe(5);
        expect(group.totalPriceInclVat).toBe(100);
        expect(group.totalPriceExclVat).toBe(80);
        expect(group.purchaseTariffDetailsExclVat).toBe(50);
        expect(group.purchaseTariffDetailsInclVat).toBe(60);

        expect(item.totalPower).toBe(15);
        expect(item.timeCharged).toBe(8);
        expect(item.totalPrice.excl_vat).toBe(20);
        expect(item.totalPrice.incl_vat).toBe(25);
        expect(item.purchaseTariffDetails.excl_vat).toBe(30);
        expect(item.purchaseTariffDetails.incl_vat).toBe(35);
        expect(item.purchaseTariffDetails.kwhListAverage).toEqual([0.1, 0.5, 0.9]);
    });

    test('should handle empty arrays and missing fields gracefully', () => {
        const session = {
            timeCharged: 0,
            totals: {},
            totalsGroupBy: []
        };

        const result = validateAndRemoveNegativeFieldsReports(session);

        expect(result.totals).toEqual({});
        expect(result.totalsGroupBy).toEqual([]);
    });

    test('should return the original session if session is null or undefined', () => {
        expect(validateAndRemoveNegativeFieldsReports(null)).toBeNull();
        expect(validateAndRemoveNegativeFieldsReports(undefined)).toBeUndefined();
    });
});
