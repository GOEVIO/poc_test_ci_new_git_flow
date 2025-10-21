import { Request, Response, Send } from 'express';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';

// controllers
import controllersMiddleware from '../../middleware/controllersMiddleware';

describe('validatePublishTopic', () => {
    let req: Request;
    let next = jest.fn();
    let res = {} as unknown as Response;

    beforeEach(() => {
        req = {} as Request;
        res = {} as Response;
        res.send = jest.fn() as Send;
        res.status = jest.fn(() => res);
        next = jest.fn();
    });

    it('should return 400 if request body is missing', () => {
        controllersMiddleware.validatePublishTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({ auth: false, code: 'missing_body', message: 'Missing body in request' });
    });

    it('should return 400 if controllerId is missing', () => {
        req.body = {
            variables: [{ variable: 'var1', value: 'value1' }],
            deviceId: 'device1',
        };
        controllersMiddleware.validatePublishTopic(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({ auth: false, code: 'missing_controllerId', message: 'Missing controller in request' });
    });

    it('should return 400 if variables are missing', () => {
        req.body = {
            controllerId: 'controller1',
            deviceId: 'device1',
        };
        controllersMiddleware.validatePublishTopic(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({ auth: false, code: 'missing_variables', message: 'Missing variables in request' });
    });

    it('should return 400 if any variable or value is missing', () => {
        req.body = {
            controllerId: 'controller1',
            variables: [
                { variable: 'var1', value: 'value1' },
                { variable: '', value: 'value2' },
            ],
            deviceId: 'device1',
        };
        controllersMiddleware.validatePublishTopic(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({ auth: false, code: 'missing_variable', message: 'Missing variable or value in request' });
    });

    it('should call next if all validations pass', () => {
        req.body = {
            controllerId: 'controller1',
            variables: [{ variable: 'var1', value: 'value1' }],
            deviceId: 'device1',
        };
        controllersMiddleware.validatePublishTopic(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
