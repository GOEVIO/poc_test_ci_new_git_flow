import { Request, Response, Send } from 'express';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';
// Middleware
import publicGridMiddleware from '../../middleware/publicGridMiddleware';

describe('validatePutExternalAPI', () => {
    const next = jest.fn();
    const res = {} as unknown as Response;
    res.send = jest.fn() as Send;
    res.status = jest.fn(() => res);
    const req = {
        params: {},
    } as unknown as Request;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should throw BadRequest if request body is missing', () => {
        req.body = undefined;

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'server_missing_body',
            message: 'Missing body in the request',
        });
    });

    it('should throw BadRequest if request body is not an array', () => {
        req.body = {};

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'meter_invalid_request_body',
            message: 'Body should be an array of meters',
        });
    });

    it('should throw BadRequest if meter is missing id', () => {
        req.body = [
            {
                i1: 1,
                v1: 1,
                measurementDate: '2024-05-27T13:48',
            },
        ];

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'server_body_required',
            message: 'Missing id in request body',
        });
    });

    it('should throw BadRequest if meter is missing measurementData', () => {
        req.body = [
            {
                id: 'testingId',
                i1: 1,
                v1: 1,
            },
        ];

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'meter_missing_measurementDate',
            message: 'Missing measurementDate in request body',
        });
    });

    it('should throw BadRequest if meter with bad format measurementData', () => {
        req.body = [
            {
                id: 'testingId',
                i1: 1,
                v1: 1,
                measurementDate: 'sdfsdfs',
            },
        ];

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'meter_invalid_measurementDate',
            message: 'Invalid measurementDate in request body',
        });
    });

    it('should throw BadRequest if no current measurement are sent', () => {
        req.body = [
            {
                id: 'testingId',
                v1: 1,
                measurementDate: '2024-05-27T13:48',
            },
        ];

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            code: 'meter_missing_current',
            message: 'No current parameter in request body',
            status: false,
        });
    });

    it('should throw BadRequest if no voltage measurement are sent', () => {
        req.body = [
            {
                id: 'testingId',
                i1: 15,
                measurementDate: '2024-05-27T13:48',
            },
        ];

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            code: 'meter_missing_voltage',
            message: 'No voltage parameter in request body',
            status: false,
        });
    });

    it('should throw BadRequest if v1 value is negative', () => {
        req.body = [
            {
                id: 'testingId',
                i1: 12,
                v1: -15,
                measurementDate: '2024-05-27T13:48',
            },
        ];

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            code: 'meter_invalid_v1_value',
            message: 'v1 should be positive value',
            status: false,
        });
    });
    it('should throw BadRequest if v2 value is negative', () => {
        req.body = [
            {
                id: 'testingId',
                i1: 12,
                v2: -15,
                measurementDate: '2024-05-27T13:48',
            },
        ];

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            code: 'meter_invalid_v2_value',
            message: 'v2 should be positive value',
            status: false,
        });
    });

    it('should throw BadRequest if v3 value is negative', () => {
        req.body = [
            {
                id: 'testingId',
                i1: 12,
                v3: -15,
                measurementDate: '2024-05-27T13:48',
            },
        ];
        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            code: 'meter_invalid_v3_value',
            message: 'v3 should be positive value',
            status: false,
        });
    });

    it('should throw BadRequest if vTot value is negative', () => {
        req.body = [
            {
                id: 'testingId',
                i1: 12,
                v3: 12,
                vTot: -100,
                measurementDate: '2024-05-27T13:48',
            },
        ];
        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            code: 'meter_invalid_vTot_value',
            message: 'vTot should be positive value',
            status: false,
        });
    });

    it('should throw BadRequest if exportPower value is negative', () => {
        req.body = [
            {
                id: 'testingId',
                i1: 12,
                v3: 12,
                exportPower: -100,
                measurementDate: '2024-05-27T13:48',
            },
        ];
        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            code: 'meter_invalid_exportPower_value',
            message: 'exportPower should be positive value',
            status: false,
        });
    });

    it('should throw BadRequest if importPower value is negative', () => {
        req.body = [
            {
                id: 'testingId',
                i1: 12,
                v3: 12,
                importPower: -100,
                measurementDate: '2024-05-27T13:48',
            },
        ];
        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            code: 'meter_invalid_importPower_value',
            message: 'importPower should be positive value',
            status: false,
        });
    });

    it('should call next if all validations pass', () => {
        req.body = [
            {
                id: 'meter1',
                i1: 1,
                v1: 1,
                measurementDate: '2024-05-27T13:48',
            },
            {
                id: 'meter2',
                i1: 1,
                v1: 0,
                measurementDate: '2024-05-27T13:48',
            },
        ];

        publicGridMiddleware.validatePutExternalAPI(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
