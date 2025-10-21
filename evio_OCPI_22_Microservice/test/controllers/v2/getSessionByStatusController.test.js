const request = require('supertest');
const express = require('express');
const { getSessionByStatus } = require('../../../controllers/v2/getSessionByStatus.controller');
const { getSessionByStatusService } = require('../../../services/v2/getSessionByStatus.service');
const { getSessionSchema } = require('../../../validations/getSessionByStatus/schemas/getSession.schema');
const { StatusCodes } = require('http-status-codes');

jest.mock('../../../services/v2/getSessionByStatus.service', () => ({
    getSessionByStatusService: jest.fn(),
}));

const app = express();
app.use(express.json());
app.get('/getSessionByStatus', getSessionByStatus);

jest.spyOn(getSessionSchema, 'parse');

describe('getSessionByStatus Controller', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return 200 and call the service with parsed data', async () => {
        const reqQuery = { status: ['active'] };
        const parsedData = { status: ['ACTIVE'] };
        const serviceResponse = { data: 'mocked response' };
        getSessionByStatusService.mockResolvedValue(serviceResponse);

        const response = await request(app).get('/getSessionByStatus').query(reqQuery);

        expect(getSessionSchema.parse).toHaveBeenCalledWith({ status: ['ACTIVE']});
        expect(getSessionByStatusService).toHaveBeenCalledWith({...parsedData, limiteQuery: 10, pageNumber: 1});
        expect(response.status).toBe(StatusCodes.OK);
        expect(response.body).toEqual(serviceResponse);
    });

    it('should return 400 if Zod validation fails', async () => {
        const reqQuery = { status: ['aaa'] };

        const response = await request(app).get('/getSessionByStatus').query(reqQuery);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toEqual({
            error: 'Invalid status',
        });
    });

    it('should return 500 if an unexpected error occurs', async () => {
        const reqQuery = { status: ['active'] };
        const unexpectedError = new Error('Unexpected error');
        getSessionByStatusService.mockRejectedValue(unexpectedError);
        const response = await request(app).get('/getSessionByStatus').query(reqQuery);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toEqual({
            error: 'Function getSessionByStatus - An error occurred while processing Error: Unexpected error',
        });
    });
});
