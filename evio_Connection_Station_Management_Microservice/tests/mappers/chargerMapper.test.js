const { mapLatLng, mapServiceCost, mapTariffAmounts, mapTariff, mapTariffData, mapGroup, mapFleet, getTranslationKey, getNetworkKey, getTotalPrice, getTotalPriceBy100Km, getTotalPriceBykWh, getTotalPercentage, mapTariffPrice } = require('../../mappers/chargersMapper');
const Constants = require('../../utils/constants');
const { ConnectorPowerTypes } = require('../../utils/enums/enumPlugs');
const { Units } = require('../../utils/enums/enumUnits');

describe('getTranslationKey', () => {
    it('should return the correct translation key', () => {
        const plugProperty = 'AC_1_PHASE';
        const mappingObject = ConnectorPowerTypes;

        const result = getTranslationKey(plugProperty, mappingObject);
        expect(result).toEqual(ConnectorPowerTypes.AC_1_PHASE.translationKey);
    });

    it('should return undefined if the plug property is not found', () => {
        const plugProperty = 'plugType4';
        const mappingObject = ConnectorPowerTypes;

        const result = getTranslationKey(plugProperty, mappingObject);
        expect(result).toBeUndefined();
    });
});

describe('getNetworkKey', () => {
    it('should return the key of the matching network', () => {
        const networkName = Constants.networks.mobie.name;
        const expectedKey = Constants.networks.mobie.key;

        const result = getNetworkKey(networkName);

        expect(result).toEqual(expectedKey);
    });

    it('should return the key of the "others" network if the network name does not match any network', () => {
        const networkName = 'nonExistentNetwork';
        const expectedKey = Constants.networks.others.key;

        const result = getNetworkKey(networkName);

        expect(result).toEqual(expectedKey);
    });
});

describe('getTotalPrice', () => {
    it('should return correct price and currency', () => {
        const plug = {
            tariff: {
                detail: {
                    total: {
                        total: 100
                    }
                }
            },
            serviceCost: {
                currency: Units.EURO
            }
        };

        const result = getTotalPrice(plug);
        expect(result).toEqual({
            currency: Units.EURO,
            value: 100
        });
    });

    it('should return EURO for currency when total is present but currency is not', () => {
        const plug = {
            tariff: {
                detail: {
                    total: {
                        total: 10
                    }
                }
            },
            serviceCost: {
                currency: null
            }
        };

        const result = getTotalPrice(plug);
        expect(result).toEqual({
            currency: Units.EURO,
            value: 10
        });
    });


});


describe('getTotalPriceBy100Km', () => {
    it('should return the correct currency and value when totalByKmh is defined', () => {
        const plug = {
            tariff: {
                detail: {
                    total: {
                        totalByKmh: 10
                    }
                }
            },
            serviceCost: {
                currency: Units.EURO
            }
        };

        const result = getTotalPriceBy100Km(plug);

        expect(result).toEqual({
            currency: Units.EURO,
            value: 10
        });
    });

    it('should return EURO currency and value when totalByKmh is defined but total currency is not', () => {
        const plug = {
            tariff: {
                detail: {
                    total: {
                        totalByKmh: 10
                    }
                }
            },
            serviceCost: {
                currency: null
            }
        };

        const result = getTotalPriceBy100Km(plug);

        expect(result).toEqual({
            currency: Units.EURO,
            value: 10
        });
    });

});


describe('getTotalPriceBykWh', () => {
    it('should return the correct total price by kWh', () => {
        const plug = {
            tariff: {
                detail: {
                    total: {
                        totalBykWh: 10,
                    },
                },
            },
            serviceCost: {
                currency: Units.EURO,
            },
        };

        const result = getTotalPriceBykWh(plug);
        expect(result).toEqual({
            currency: Units.EURO,
            value: 10,
        });
    });

    it('should return EURO currency and value when totalBykWh is defined but total currency is not', () => {
        const plug = {
            tariff: {
                detail: {
                    total: {
                        totalBykWh: 10,
                    },
                },
            },
        };

        const result = getTotalPriceBykWh(plug);
        expect(result).toEqual({
            currency: Units.EURO,
            value: 10,
        });
    });

});

describe('getTotalPercentage', () => {
    it('should return the total percentage if it is less than or equal to 100', () => {
        const plug = {
            tariff: {
                detail: {
                    total: {
                        totalPercentage: 80
                    }
                }
            }
        };
        expect(getTotalPercentage(plug)).toBe(80);
    });

    it('should return 100 if the total percentage is more than 100', () => {
        const plug = {
            tariff: {
                detail: {
                    total: {
                        totalPercentage: 120
                    }
                }
            }
        };
        expect(getTotalPercentage(plug)).toBe(100);
    });

    it('should handle undefined values gracefully', () => {
        const plug = {};
        expect(getTotalPercentage(plug)).toBeUndefined();
    });
});


describe('mapLatLng', () => {
    it('should return correct latitude and longitude when charger has valid geometry coordinates', () => {
        const charger = {
            geometry: {
                coordinates: [10, 20]
            }
        };

        const result = mapLatLng(charger);

        expect(result).toEqual({
            latitude: 20,
            longitude: 10
        });
    });

    it('should return undefined for both latitude and longitude when charger does not have geometry coordinates', () => {
        const charger = {};

        const result = mapLatLng(charger);

        expect(result).toEqual({
            latitude: undefined,
            longitude: undefined
        });
    });
});

describe('mapTariffAmounts', () => {
    it('should correctly map tariff amounts when all properties are present', () => {
        const tariff = {
            tariff: {
                activationFee: 10,
                bookingAmount: { uom: Units.EURO, value: 20 },
                chargingAmount: { uom: Units.EURO, value: 30 },
                parkingAmount: { uom: Units.EURO, value: 40 },
                parkingDuringChargingAmount: { uom: Units.EURO, value: 50 },
                evioCommission: { minAmount: { uom: Units.EURO, value: 60 }, transaction: { uom: Units.EURO, value: 70 } }
            }
        };

        const result = mapTariffAmounts(tariff);

        expect(result).toEqual({
            activationFee: 10,
            bookingAmount: { uom: Units.EURO, value: 20 },
            chargingAmount: { uom: Units.EURO, value: 30 },
            parkingAmount: { uom: Units.EURO, value: 40 },
            parkingDuringChargingAmount: { uom: Units.EURO, value: 50 },
            evioCommission: { minAmount: { uom: Units.EURO, value: 60 }, transaction: { uom: Units.EURO, value: 70 } }
        });
    });

    it('should correctly map tariff amounts when some properties are missing', () => {
        const tariff = {
            _id: "tariff1",
            tariff: {
                activationFee: 10,
                bookingAmount: { uom: Units.EURO, value: 20 },
                chargingAmount: null,
                parkingAmount: { uom: Units.EURO, value: 40 },
                parkingDuringChargingAmount: null,
                evioCommission: { minAmount: null, transaction: { uom: Units.EURO, value: 70 } }
            }
        };

        const result = mapTariffAmounts(tariff);

        expect(result).toEqual({
            _id: "tariff1",
            activationFee: 10,
            bookingAmount: { uom: Units.EURO, value: 20 },
            chargingAmount: { uom: undefined, value: undefined },
            parkingAmount: { uom: Units.EURO, value: 40 },
            parkingDuringChargingAmount: { uom: undefined, value: undefined },
            evioCommission: { minAmount: { uom: undefined, value: undefined }, transaction: { uom: Units.EURO, value: 70 } }
        });
    });

    it('should return an empty object when the input is null or undefined', () => {
        const tariff = null;

        const result = mapTariffAmounts(tariff);

        expect(result).toEqual({});
    });
});

describe('mapTariff', () => {
    it('should return an object with all properties as undefined when tariff is null or undefined', () => {
        const tariff = null;

        const result = mapTariff(tariff);

        expect(result).toEqual({
            _id: undefined,
            groupName: undefined,
            groupId: undefined,
            fleetName: undefined,
            fleetId: undefined,
            imageContent: undefined,
            tariffId: undefined,
            tariffType: undefined,
            name: undefined,
            tariff: {},
            billingType: undefined,
        });
    });

    it('should return an object with all properties mapped correctly when tariff is not null', () => {
        const tariff = {
            _id: '1',
            groupName: 'group1',
            groupId: 'g1',
            fleetName: 'fleet1',
            fleetId: 'f1',
            imageContent: 'image1',
            tariffId: 't1',
            tariffType: 'type1',
            name: 'name1',
            tariff: {
                activationFee: 10,
                bookingAmount: { uom: Units.EURO, value: 20 },
                chargingAmount: { uom: Units.EURO, value: 30 },
                parkingAmount: { uom: Units.EURO, value: 40 },
                parkingDuringChargingAmount: { uom: Units.EURO, value: 50 },
                evioCommission: { minAmount: { uom: Units.EURO, value: 60 }, transaction: { uom: Units.EURO, value: 70 } },
            },
            billingType: 'billing1',
        };

        const result = mapTariff(tariff);

        expect(result).toEqual({
            _id: '1',
            groupName: 'group1',
            groupId: 'g1',
            fleetName: 'fleet1',
            fleetId: 'f1',
            imageContent: 'image1',
            tariffId: 't1',
            tariffType: 'type1',
            name: 'name1',
            tariff: {
                _id: '1',
                activationFee: 10,
                bookingAmount: { uom: Units.EURO, value: 20 },
                chargingAmount: { uom: Units.EURO, value: 30 },
                parkingAmount: { uom: Units.EURO, value: 40 },
                parkingDuringChargingAmount: { uom: Units.EURO, value: 50 },
                evioCommission: { minAmount: { uom: Units.EURO, value: 60 }, transaction: { uom: Units.EURO, value: 70 } },
            },
            billingType: 'billing1',
        });
    });
});

describe('mapServiceCost', () => {
    it('should correctly map service cost when all properties are present', () => {
        const plug = {
            serviceCost: {
                initialCost: 10,
                costByTime: [
                    {
                        minTime: 1,
                        maxTime: 2,
                        cost: 3,
                        uom: 'hour',
                        description: 'test',
                    },
                ],
                costByPower: {
                    cost: 4,
                    uom: 'kW',
                },
                elements: [],
                currency: Units.EURO,
            },
            tariff: {
                flat: 5,
                time: 6,
                energy: 7,
                parking: 8,
            },
        };

        const result = mapServiceCost(plug);

        expect(result).toEqual({
            initialCost: 10,
            costByTime: [
                {
                    minTime: 1,
                    maxTime: 2,
                    cost: 3,
                    uom: 'hour',
                    description: 'test',
                },
            ],
            costByPower: {
                cost: 4,
                uom: 'kW',
            },
            elements: [],
            detailedTariff: {
                flat: 5,
                time: 6,
                energy: 7,
                parking: 8,
            },
            currency: Units.EURO,
        });
    });

    it('should return an empty object if the service cost is not present', () => {
        const plug = {};

        const result = mapServiceCost(plug);

        expect(result).toEqual({
        });
    });

});

describe('mapTariffData', () => {
    it('should correctly map tariff data', () => {
        const plug = {
            tariff: {
                _id: '123',
                offset: 1,
                timeZone: ['UTC'],
                countryCode: 'PT',
                accessType: 'public',
                listOfGroups: ['Group1', 'Group2'],
                listOfFleets: ['Fleet1', 'Fleet2']
            },
            evseGroup: 'Group1',
            accessType: 'public',
            listOfGroups: ['Group1', 'Group2'],
            listOfFleets: ['Fleet1', 'Fleet2']
        };

        const charger = {
            partyId: '456',
            source: 'EVIO',
            voltageLevel: 'BTE',
            accessType: 'public',
            listOfGroups: ['Group1', 'Group2'],
            listOfFleets: ['Fleet1', 'Fleet2']
        };

        const expectedOutput = {
            _id: '123',
            offset: 1,
            timeZone: 'UTC',
            partyId: '456',
            source: 'EVIO',
            countryCode: 'PT',
            evseGroup: "Group1",
            latLng: mapLatLng(charger),
            evseGroup: 'Group1',
            voltageLevel: {
                value: 'BTE',
                translationKey: 'voltageLevel_BTE'
            },
            tariff: mapTariff(plug.tariff),
            serviceCost: mapServiceCost(plug),
            accessType: 'public',
            listOfGroups: plug.listOfGroups.map(mapGroup),
            listOfFleets: plug.listOfFleets.map(mapFleet),
        };

        expect(mapTariffData(plug, charger)).toEqual(expectedOutput);
    });
});

describe('mapTariffPrice', () => {
    it('should correctly map tariff price', () => {
        const plug = {
            tariff: {
                detail: {
                    priceComponent: {},
                    emsp: {
                        entries: [
                            { label: 'tar', total: 10, unitPrice: 2, pricePer100km: 1 },
                            { label: 'iec', total: 20, unitPrice: 3, pricePer100km: 2 },
                            { label: 'ceme', total: 30, unitPrice: 4, pricePer100km: 3 },
                            { label: 'activationFeeWithDiscount', total: 40, unitPrice: 5 },
                            { label: 'cemeTarIec', total: 50, unitPrice: 6, pricePer100km: 5 },
                        ],
                        totalBykWh: 100,
                        totalByKmh: 200,
                    },
                    cpo: {},
                    total: {},
                    vat: { total: 60, totalBykWh: 70, totalByKmh: 80 },
                },
            },
        };

        const result = mapTariffPrice(plug);
        expect(result).toEqual({
            priceComponent: {},
            emsp: {
                total: 70,
                totalBykWh: 100,
                totalByKmh: 200,
                entries: [
                    { label: 'ceme', total: 30, unitPrice: 4, pricePer100km: 3, collapsable: true },
                    { label: 'activationFeeWithDiscount', total: 40, unitPrice: 5, },
                ],
            },
            cpo: {},
            total: {},
            vat: { total: 60, totalBykWh: 70, totalByKmh: 80 },
            taxes: {
                entries: [
                    { label: 'tar', total: 10, unitPrice: 2, pricePer100km: 1, collapsableGroup: 'taxes', collapsable: true },
                    { label: 'iec', total: 20, unitPrice: 3, pricePer100km: 2, collapsableGroup: 'taxes', collapsable: false },
                ],
                total: 90,
                totalByKmh: 83,
                totalBykWh: 75,
            },
        });
    });

    it('should return an empty object if tariff or detail is not present', () => {
        const plug = {};

        const result = mapTariffPrice(plug);

        expect(result).toEqual({});
    });

    it('should return tariffPrice with default values when emsp or emsp.entries is not defined', () => {
        const plug = {
            tariff: {
                detail: {
                    priceComponent: {},
                    emsp: undefined,
                    cpo: 'testCpo',
                    total: 'testTotal',
                    vat: {
                        total: 1,
                        totalBykWh: 2,
                        totalByKmh: 3
                    }
                }
            }
        };

        const expectedTariffPrice = {
            priceComponent: {},
            emsp: undefined,
            cpo: 'testCpo',
            total: 'testTotal',
            vat: {
                total: 1,
                totalBykWh: 2,
                totalByKmh: 3
            },
            taxes: {
                entries: [],
                total: 1,
                totalBykWh: 2,
                totalByKmh: 3
            }
        };

        const result = mapTariffPrice(plug);
        expect(result).toEqual(expectedTariffPrice);
    });
});