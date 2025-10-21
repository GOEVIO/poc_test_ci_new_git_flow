import { Request, Response, Send } from 'express';
import { describe, expect, it, jest } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';

// Middleware
import solarPVMiddleware from '../../middleware/solarPVMiddleware';

describe('validateGetExternalAPI', () => {
    const next = jest.fn();
    const res = {} as unknown as Response;
    res.send = jest.fn() as Send;
    res.status = jest.fn(() => res);
    const req = {
        params: {},
    } as unknown as Request;

    it('should call next if id and userid are valid', () => {
        req.headers = { id: '65cdd3f9ce0b110013e96e6d', userid: 'EVIO' };

        solarPVMiddleware.validateGetExternalAPI(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should throw BadRequest if id is invalid', () => {
        req.headers = { id: 'invalid_id', userid: 'EVIO' };

        solarPVMiddleware.validateGetExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'invalid_id',
            message: 'Invalid id format',
        });
    });

    it('should throw ServerError if userid is missing', () => {
        req.headers = { id: '65cdd3f9ce0b110013e96e6d' };

        solarPVMiddleware.validateGetExternalAPI(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'server_error',
            message: 'Internal Error',
        });
    });
});
