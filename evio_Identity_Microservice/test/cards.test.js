require("dotenv-safe").load();
const httpMocks = require('node-mocks-http');
const cards = require('../handlers/cards');
const request = require("supertest");
const mongoose = require('mongoose');
const Card = require('../models/cards');
const Contracts = require('../models/contracts')

describe("Test_verifyCards", () => {

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test("Test_verifyCards_Card_incomplete", async () => {

        let card = {
            "decInvert": "String",
            "amount": {
                "currency": "EU",
                "value": 100
            }
        }

        let error = []

        let response = await cards.verifyCards(card, error)

        expect(response).toBe(false);
    });

    test("Test_verifyCards_Card_incomplete", async () => {

        let card =
        {
            "cardNumber": "10",
            "decInvert": "String",
            "amount": {
                "currency": "EU",
                "value": 100
            }
        }

        let error = []

        let response = await cards.verifyCards(card, error)

        expect(response).toBe(false);
    });

    test("Test_verifyCards_Card_amount_incomplete", async () => {

        let card =
        {
            "cardNumber": "10",
            "dec": "String",
            "decInvert": "String",
            "amount": {
                "value": 100
            }
        }

        let error = []

        let response = await cards.verifyCards(card, error)

        expect(response).toBe(false);
    });

    test("Test_verifyCards_Valid_Card", async () => {
        let card =
        {
            "cardNumber": "Test_verifyCards_Valid_Card",
            "dec": "String",
            "decInvert": "String",
            "amount": {
                "currency": "EU",
                "value": 100
            }
        }

        let error = []

        const mockCard = jest.spyOn(Card, 'find');
        mockCard.mockImplementation((query) => []);

        const mockContracts = jest.spyOn(Contracts, 'find');
        mockContracts.mockImplementation((query) => []);

        let response = await cards.verifyCards(card, error)

        expect(response).toBe(true);
    });

});


describe("Test_useCards", () => {

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test("Test_useCards_cardNumber_null", async () => {
        const request = httpMocks.createRequest({
            method: 'POST',
            url: '/api/private/cards/activate',
            headers: { clientname: 'EVIO' },
            body: {
                "nif": "263165205",
                "contractId": "628e3bd06dce41001259b786"
            }
        });

        const response = httpMocks.createResponse();

        await cards.use(request, response, (err) => {
            expect(err).toBeFalsy();
        });

        expect(response.statusCode).toBe(400);
    });

    test("Test_useCards_nif_null", async () => {
        const request = httpMocks.createRequest({
            method: 'POST',
            url: '/api/private/cards/activate',
            headers: { clientname: 'EVIO' },
            body: {
                "cardNumber": "EVIO3420560",
                "contractId": "628e3bd06dce41001259b786"
            }
        });

        const response = httpMocks.createResponse();

        await cards.use(request, response, (err) => {
            expect(err).toBeFalsy();
        });

        expect(response.statusCode).toBe(400);
    });

    test("Test_useCards_contractId_null", async () => {
        const request = httpMocks.createRequest({
            method: 'POST',
            url: '/api/private/cards/activate',
            headers: { clientname: 'EVIO' },
            body: {
                "cardNumber": "EVIO3420560",
                "nif": "263165205",
            }
        });

        const response = httpMocks.createResponse();

        await cards.use(request, response, (err) => {
            expect(err).toBeFalsy();
        });

        expect(response.statusCode).toBe(400);
    });


    test("Test_useCards_cardNumber_not_EVIO", async () => {
        const request = httpMocks.createRequest({
            method: 'POST',
            url: '/api/private/cards/activate',
            headers: { clientname: 'EVIO' },
            body: {
                "cardNumber": "E3420560",
                "nif": "263165205",
                "contractId": "628e3bd06dce41001259b786"
            }
        });

        const response = httpMocks.createResponse();

        await cards.use(request, response, (err) => {
            expect(err).toBeFalsy();
        });

        expect(response.statusCode).toBe(400);
    });


    test("Test_useCards_contract_not_found", async () => {
        const request = httpMocks.createRequest({
            method: 'POST',
            url: '/api/private/cards/activate',
            headers: { clientname: 'EVIO' },
            body: {
                "cardNumber": "E3420560",
                "nif": "263165205",
                "contractId": "628e3bd06dce41001259b786"
            }
        });

        const response = httpMocks.createResponse();

        const mockContracts = jest.spyOn(Contracts, 'find');
        mockContracts.mockImplementation((query) => []);

        await cards.use(request, response, (err) => {
            expect(err).toBeFalsy();
        });

        expect(response.statusCode).toBe(400);
    });

    test("Test_useCards_card_not_found", async () => {
        const request = httpMocks.createRequest({
            method: 'POST',
            url: '/api/private/cards/activate',
            headers: { clientname: 'EVIO' },
            body: {
                "cardNumber": "E3420560",
                "nif": "263165205",
                "contractId": "628e3bd06dce41001259b786"
            }
        });

        const response = httpMocks.createResponse();

        const mockContracts = jest.spyOn(Contracts, 'find');
        mockContracts.mockImplementation((query) => {
            {
                _id: "628e3bd06dce41001259b786"
            }
        });

        const mockCard = jest.spyOn(Card, 'find');
        mockCard.mockImplementation((query) => []);


        await cards.use(request, response, (err) => {
            expect(err).toBeFalsy();
        });

        expect(response.statusCode).toBe(400);
    });


    test("Test_useCards_card_already_inUse", async () => {
        const request = httpMocks.createRequest({
            method: 'POST',
            url: '/api/private/cards/activate',
            headers: { clientname: 'EVIO' },
            body: {
                "cardNumber": "E3420560",
                "nif": "263165205",
                "contractId": "628e3bd06dce41001259b786"
            }
        });

        const response = httpMocks.createResponse();

        const mockContracts = jest.spyOn(Contracts, 'find');
        mockContracts.mockImplementation((query) => [
            {
                _id: "628e3bd06dce41001259b786"
            }
        ]);

        const mockCard = jest.spyOn(Card, 'find');
        mockCard.mockImplementation((query) => [
            {
                "_id": {
                    "$oid": "649ab04e21fbb60012ec5330"
                },
                "inUse": true,
                "cardNumber": "EVIO9999",
                "dec": "63984756303945",
                "decInvert": "String",
                "amount": {
                    "_id": {
                        "$oid": "649ab04e21fbb60012ec5331"
                    },
                    "currency": "EU",
                    "value": 100
                },
                "__v": 0
            }
        ]);


        await cards.use(request, response, (err) => {
            expect(err).toBeFalsy();
        });

        expect(response.statusCode).toBe(400);
    });
});