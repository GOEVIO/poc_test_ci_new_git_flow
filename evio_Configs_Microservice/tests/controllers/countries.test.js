const request = require('supertest');
const express = require('express');
const router = require('../../routes/countries');
const CountryController = require('../..//controllers/countries');
const Country = require('../../models/countries');
const { getCountryCode } = require('../../caching/getCountryCode');

jest.mock('../../caching/getCountryCode', () => ({
    getCountryCode: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/', router);

describe('getCountries', () => {
    test('successfully retrieves countries', async () => {
        const req = { body: { query: { countryName: 'Portugal' } } };
        const countries = [
            { _id: '1', countryName: 'Portugal', country: 'PRT', countryCode: 'PT' },
        ];

        Country.getCountries = jest.fn((query, callback) => callback(null, countries));

        const result = await CountryController.getCountries(req);
        expect(result).toEqual(countries);
        expect(Country.getCountries).toHaveBeenCalledWith(req.body.query, expect.any(Function));
    });

    test('throws error if query is invalid', async () => {
        const req = { body: { query: { countryName: 'InvalidCountry' } } };
        const errorMessage = 'Country not found';

        Country.getCountries = jest.fn((query, callback) => callback(new Error(errorMessage), null));

        await expect(CountryController.getCountries(req)).rejects.toThrow(errorMessage);
        expect(Country.getCountries).toHaveBeenCalledWith(req.body.query, expect.any(Function));
    });
});


describe('addCountry', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('successfully adds a single country', async () => {
        const req = { body: { countryName: 'Portugal', country: 'PRT', countryCode: 'PT' } };
        const savedCountry = { _id: '1', ...req.body };

        Country.prototype.save = jest.fn((callback) => callback(null, savedCountry));

        const result = await CountryController.addCountry(req);
        expect(result).toEqual(savedCountry);
        expect(Country.prototype.save).toHaveBeenCalled();
    });

    test('successfully adds multiple countries', async () => {
        const req = {
            body: [
                { countryName: 'Portugal', country: 'PRT', countryCode: 'PT' },
                { countryName: 'Spain', country: 'ESP', countryCode: 'ES' }
            ]
        };

        const savedCountries = req.body.map((country, index) => ({ _id: String(index + 1), ...country }));

        Country.insertMany = jest.fn((countries, callback) => callback(null, savedCountries));

        const result = await CountryController.addCountry(req);
        expect(result).toEqual(savedCountries);
        expect(Country.insertMany).toHaveBeenCalledWith(req.body, expect.any(Function));
    });

    test('throws error if adding a single country fails', async () => {
        const req = { body: { countryName: 'Portugal', country: 'PRT', countryCode: 'PT' } };
        const errorMessage = 'Failed to save country';

        Country.prototype.save = jest.fn((callback) => callback(new Error(errorMessage), null));

        await expect(CountryController.addCountry(req)).rejects.toThrow(errorMessage);
        expect(Country.prototype.save).toHaveBeenCalled();
    });

    test('throws error if adding multiple countries fails', async () => {
        const req = {
            body: [
                { countryName: 'Portugal', country: 'PRT', countryCode: 'PT' },
                { countryName: 'Spain', country: 'ESP', countryCode: 'ES' }
            ]
        };
        const errorMessage = 'Failed to insert multiple countries';

        Country.insertMany = jest.fn((countries, callback) => callback(new Error(errorMessage), null));

        await expect(CountryController.addCountry(req)).rejects.toThrow(errorMessage);
        expect(Country.insertMany).toHaveBeenCalledWith(req.body, expect.any(Function));
    });
});


describe('GET /api/private/country-code/:country', () => {
    test('returns country code when country exists', async () => {
        const country = 'Portugal';
        const countryCode = 'PT';

        getCountryCode.mockResolvedValue(countryCode);

        const response = await request(app).get(`/api/private/country-code/${country}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ countryCode: countryCode });
        expect(getCountryCode).toHaveBeenCalledWith(country);
    });

    test('returns 404 when country code is not found', async () => {
        const country = 'UnknownCountry';

        getCountryCode.mockResolvedValue(null);

        const response = await request(app).get(`/api/private/country-code/${country}`);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Country code not found" });
        expect(getCountryCode).toHaveBeenCalledWith(country);
    });
});
