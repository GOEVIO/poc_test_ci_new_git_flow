const mongoose = require('mongoose');
const Transactions = require('../models/transactions')
const Walllet = require('../models/wallet')
const TransactionsHandler = require('../handlers/transactions')
const httpMocks = require('node-mocks-http');

describe("Test_createAndProcessVoucher", () => {

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test("Test_createAndProcessVoucher_card_null", async () => {

        const request = httpMocks.createRequest({
            method: 'POST',
            url: '/api/private/transactions/createAndProcessVoucher',
            body: {
                "userId": "624dabc28c75d0001209babc"
            }
        });

        const response = httpMocks.createResponse();

        await TransactionsHandler.createAndProcessVoucher(request, response, (err) => {
            expect(err).toBeFalsy();
        });

        expect(response.statusCode).toBe(400);
    });

    test("Test_createAndProcessVoucher_userId_null", async () => {

        const request = httpMocks.createRequest({
            method: 'POST',
            url: '/api/private/transactions/createAndProcessVoucher',
            body: {
                "card":
                {
                    "cardNumber": "EVIO9999",
                    "dec": "63984756303945",
                    "decInvert": "String",
                    "amount": {
                        "currency": "EU",
                        "value": 100
                    }
                }
            }
        });

        const response = httpMocks.createResponse();

        await TransactionsHandler.createAndProcessVoucher(request, response, (err) => {
            expect(err).toBeFalsy();
        });

        expect(response.statusCode).toBe(400);
    });

});



