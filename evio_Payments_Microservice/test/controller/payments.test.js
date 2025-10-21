const mongoose = require('mongoose');
const { describe, expect } = require('@jest/globals');
const httpMocks = require('node-mocks-http');
// Controllers
const paymentsController = require('../../controllers/payments');
// Models
const NotificationPayments = require('../../models/notificationsPayments');


jest.mock('../../models/notificationsPayments');

describe("Test checkUserHasDebt() ", () => {
    NotificationPayments.findOne = jest.fn();
    afterEach(() => {
        jest.restoreAllMocks()
    })

    test("Test checkUserHasDebt() userId null", async () => {

        const request = httpMocks.createRequest({
            method: 'GET',
            url: '/api/private/payments/checkUserHasDebt',
            headers: {
                userid: null
            }
        });
        const response = httpMocks.createResponse();
        const result = await paymentsController.checkUserHasDebt(request, response);
        expect(result._getData()).toMatchObject({"auth": false, "message": "No userId provided"})
        expect(response.statusCode).toBe(400);
    });

    test("Test checkUserHasDebt() userId don't have debt", async () => {
        NotificationPayments.findOne.mockReturnValueOnce(null);
        const request = httpMocks.createRequest({
            method: 'GET',
            url: '/api/private/payments/checkUserHasDebt',
            headers: {
                userid: "624dabc28c75d0001209babc"
            }
        });
        const response = httpMocks.createResponse();
        const result = await paymentsController.checkUserHasDebt(request, response);
        expect(result._getData()).toBe("false");
        expect(response.statusCode).toBe(200);
    });

    test("Test checkUserHasDebt() userId not has debt", async () => {
        NotificationPayments.findOne.mockReturnValueOnce({_id: "624dabc28c75d0001209babc"});
        const request = httpMocks.createRequest({
            method: 'GET',
            url: '/api/private/payments/checkUserHasDebt',
            headers: {
                userid: "624dabc28c75d0001209babc"
            }
        });
        const response = httpMocks.createResponse();
        const result = await paymentsController.checkUserHasDebt(request, response);
        expect(result._getData()).toBe("true");
        expect(response.statusCode).toBe(200);
    });
});