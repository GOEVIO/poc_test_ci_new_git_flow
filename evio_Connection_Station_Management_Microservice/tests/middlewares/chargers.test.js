require('dotenv').config();
const {
    checkRatingValidity,
    checkTariffTypeValidity,
    validateRequestBody,
    validateChargersToCompare,
    validateConnectorType,
    addFilterToQuery,
    filterChargersByConnectorType,
    filterTeslaStations,
    excludeTeslaChargers,
    standardiseConnectorType,
    getSecondaryConnectorTypes
} = require('../../middlewares/chargers');
const { ChargerSubStatus, PlugStatus } = require('../../utils/enums/enumPlugs');
const { StationsEnum } = require('../../utils/enums/enumStations');
const Constants = require('../../utils/constants');
const { app } = require('../../app');
const request = require('supertest');
const httpMocks = require('node-mocks-http');

describe('checkTariffTypeValidity', () => {
    it('should return true for valid tariff types', () => {
        const tariffType = 'time';
        const result = checkTariffTypeValidity(tariffType);
        expect(result).toBe(true);
    });


    it('should return false for invalid tariff types', async () => {
        const response = await request(app)
            .post('/api/private/connectionstation/maps')
            .set('clientname', 'EVIO')
            .query({
                lat: 39.5458661,
                lng: -8.29246785,
                distance: 9000,

            })
            .send({
                "chargingTime": 1300,
                "sessionStartDate": "2023-04-03T16:05:23.645Z",
                "tariffType": "invalid"
            })
        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            auth: false,
            code: 'server_invalid_tariff_type',
            message: 'Invalid tariff type.',
        });
    });
});


describe('validateRequestBody', () => {
    it('should return false and send a 400 response when body is missing', async () => {
        const response = await request(app)
            .post('/api/private/connectionstation/rankings')
            .set('clientname', "EVIO")
            .send({});
        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            auth: false,
            code: 'server_body_required',
            message: 'Body is required',
        });
    });

    it('should return true when body is present', () => {
        const req = httpMocks.createRequest({
            body: { key: 'value' },
        });
        const res = httpMocks.createResponse();
        const result = validateRequestBody(req, res);

        expect(result).toBe(true);
    });
});

describe('validateConnectorType', () => {
    test('should return true for valid connector types', () => {
        expect(validateConnectorType(['CCS 2', 'TYPE 2', 'CHADEMO'])).toBe(true);
    });

    it('should return false for invalid connector types', () => {
        expect(validateConnectorType(['CCS 2', 'invalidType', 'CHADEMO'])).toBe(false);
    });
});

describe('validateChargersToCompare', () => {
    const responseBody = {
        auth: false,
        code: 'server_chargers_to_compare_required',
        message: 'chargersToCompare is required',
    };

    it('should return false if chargersToCompare is an empty array', async () => {
        const response = await request(app)
            .post('/api/private/connectionstation/compare')
            .send({ chargersToCompare: [], chargingTime: 1300, sessionStartDate: '2023-04-03T16:05:23.645Z' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual(responseBody);
    });
    it('should return false if chargersToCompare length is more than 10', async () => {
        responseBody.code = 'server_chargers_to_compare_max_length';
        responseBody.message = 'chargersToCompare maximum length is 10';
        const chargers = new Array(11).fill({ chargerId: '1', plugPriceId: '1' });
        const response = await request(app)
            .post('/api/private/connectionstation/compare')
            .send({ chargersToCompare: chargers, chargingTime: 1300, sessionStartDate: '2023-04-03T16:05:23.645Z' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual(responseBody);
    });

    it('should return false if any charger does not have chargerId or plugPriceId', async () => {
        responseBody.code = 'server_chargers_to_compare_invalid';
        responseBody.message = 'chargersToCompare should have chargerId and plugPriceId';
        const chargers = [{ chargerId: '1' }, { plugPriceId: '1' }];
        const response = await request(app)
            .post('/api/private/connectionstation/compare')
            .send({ chargersToCompare: chargers, chargingTime: 1300, sessionStartDate: '2023-04-03T16:05:23.645Z' });
        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual(responseBody);
    });

    it('should return true if chargersToCompare is valid', () => {
        const chargers = [{ chargerId: '1', plugPriceId: '1' }];
        const result = validateChargersToCompare(chargers);
        expect(result).toBe(true);
    });
});


describe('addFilterToQuery', () => {

    it('should add tariffType to query if body has tariffType', () => {
        const query = {};
        const result = addFilterToQuery('someTariffType', false, false, query);
        expect(result).toEqual({ tariffType: 'someTariffType' });
    });

    it('should add subStatus to query if body has onlyAvailable', () => {
        const query = { plugs: { $elemMatch: {} }};
        const result = addFilterToQuery(false, false, true, query);
        expect(result).toEqual({ plugs: { $elemMatch: { subStatus: ChargerSubStatus.AVAILABLE }} });
    });

    it('should add status to query if body has onlyOnline', () => {

        const query = {};
        const result = addFilterToQuery(false, true, false, query);
        expect(result).toEqual({ status: { $ne: PlugStatus.OFFLINE } });
    });

    it('should return the same query if body has no matching properties', () => {
        const query = {};
        const result = addFilterToQuery(false, false, false, query);
        expect(result).toEqual({});
    });
});


describe('checkRatingValidity', () => {
    const query = {
        lat: 39.5458661,
        lng: -8.29246785,
        distance: 9000,
    };
    const bodyObject = {
        chargingTime: 1300,
        sessionStartDate: '2023-04-03T16:05:23.645Z',
    };
    const responseBody = {
        auth: false,
        code: 'server_invalid_rating',
        message: 'Invalid rating. Rating should be an integer between 0 and 5.',
    };

    it('should return true for valid ratings', () => {
        const rating = 4;
        const result = checkRatingValidity(rating);
        expect(result).toBe(true);
    });

    it('should return false and send a response for invalid numeric ratings', async () => {
        bodyObject.rating = 6;
        const response = await request(app)
            .post('/api/private/connectionstation/maps')
            .set('clientname', 'EVIO')
            .query(query)
            .send(bodyObject);
        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual(responseBody);
    });
    it('should return false and send a response for invalid string ratings', async () => {
        bodyObject.rating = 'invalid';
        const response = await request(app)
            .post('/api/private/connectionstation/maps')
            .set('clientname', 'EVIO')
            .query(query)
            .send(bodyObject);
        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual(responseBody);
    });
});

describe('filterChargersByConnectorType', () => {
    it('should filter chargers by connector type', () => {
        const allChargers = [
            { id: 1, plugs: [{ connectorType: 'Type1' }, { connectorType: 'Type2' }] },
            { id: 3, plugs: [{ connectorType: 'Type1' }, { connectorType: 'Type3' }] },
        ];
        const desiredConnectorType = ['Type1'];

        const result = filterChargersByConnectorType(allChargers, desiredConnectorType);

        expect(result).toEqual([
            { id: 1, plugs: [{ connectorType: 'Type1' }] },
            { id: 3, plugs: [{ connectorType: 'Type1' }] },
        ]);
    });

    it('should return all chargers if no desired connector type is provided', () => {
        const allChargers = [
            { id: 1, plugs: [{ connectorType: 'Type1' }, { connectorType: 'Type2' }] },
            { id: 2, plugs: [{ connectorType: 'Type2' }, { connectorType: 'Type3' }] },
            { id: 3, plugs: [{ connectorType: 'Type1' }, { connectorType: 'Type3' }] },
        ];

        const result = filterChargersByConnectorType(allChargers);

        expect(result).toEqual(allChargers);
    });
});

describe('filterTeslaStations', () => {


    it('should filter out "tesla" from the array of stations', () => {
        const stations = ['station1', 'station2', StationsEnum.tesla, 'station3'];
        const result = filterTeslaStations(stations);
        expect(result).toEqual(['station1', 'station2', 'station3']);
    });

    it('should return the same array when "tesla" is not present', () => {
        const stations = ['station1', 'station2', 'station3'];
        const result = filterTeslaStations(stations);
        expect(result).toEqual(['station1', 'station2', 'station3']);
    });

    it('should return the original array when the array is null', () => {
        let stations = null;
        let result = filterTeslaStations(stations);
        expect(result).toEqual(null);

        stations = null;
        result = filterTeslaStations(stations);
        expect(result).toBeNull();
    });
});

describe('excludeTeslaChargers', () => {


    it('should add chargerType to dataPublic when stations is empty or not provided', () => {
        const dataPublic = {};
        const result = excludeTeslaChargers([], dataPublic);
        expect(result).toEqual({ chargerType: { $ne: Constants.networks.tesla.chargerType } });
    });

    it('should add chargerType to dataPublic when stations is null', () => {
        const dataPublic = {};
        const result = excludeTeslaChargers(null, dataPublic);
        expect(result).toEqual({ chargerType: { $ne: Constants.networks.tesla.chargerType } });
    });

    it('should not modify dataPublic when stations is not empty', () => {
        const dataPublic = {};
        const result = excludeTeslaChargers(['station1', 'station2'], dataPublic);
        expect(result).toEqual({});
    });

});

describe('standardiseConnectorType', () => {
    test('should return mainConnectorType for known connectorType', () => {
        const charger = "Supercharger";
        expect(standardiseConnectorType(charger)).toBe("TYPE 2");
    });

    test('should return connectorType if it is unknown', () => {
        const charger = "UnknownType";
        expect(standardiseConnectorType(charger)).toBe("UnknownType");
    });
});

describe('getSecondaryConnectorTypes', () => {
    test('should return main and secondary types for known mainConnectorType', () => {
        expect(getSecondaryConnectorTypes('CCS 2')).toEqual(['CCS 2', "CCS Supercharger", "CCS", "CCS SUPERCHARGER"]);
    });

    test('should return only mainConnectorType if no secondary types exist', () => {
        expect(getSecondaryConnectorTypes('CCS 1')).toEqual(['CCS 1']);
    });

    test('should return only mainConnectorType if it is unknown', () => {
        expect(getSecondaryConnectorTypes("UnknownType")).toEqual(["UnknownType"]);
    });
});