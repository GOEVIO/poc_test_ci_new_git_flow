import { Request, Response, Send } from 'express';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';

// Middleware
import chargersMiddleware from '../../middleware/chargerMiddleware';

describe('ValidatePlugsSetPointsRequest', () => {
    const next = jest.fn();
    let res = {} as unknown as Response;
    res.send = jest.fn() as Send;
    res.status = jest.fn(() => res);
    let req = {
        params: {},
    } as unknown as Request;

    beforeEach(() => {
        req.body = {
            hwId: 'test',
            plugId: 15,
            controlType: 'AUTO',
            userId: 'sdface8845',
        };
    });

    it('should throw BadRequest if is missing body', () => {
        req.body = null;
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'missing_body',
            message: 'Missing body in request',
        });
    });

    it('should throw BadRequest if is missing hwid', () => {
        req.body = { plugId: 15 };
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'missing_hwId',
            message: 'Missing hwId',
        });
    });
    it('should throw BadRequest if is missing plugID', () => {
        delete req.body.plugId;
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'missing_plugId',
            message: 'Missing plugId',
        });
    });
    it('should throw BadRequest if is missing controlType', () => {
        delete req.body.controlType;
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'missing_controlType',
            message: 'Missing or invalid controlType',
        });
    });
    it('should throw BadRequest if is bad controlType', () => {
        req.body.controlType = 'Teste';
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'missing_controlType',
            message: 'Missing or invalid controlType',
        });
    });
    it('should throw BadRequest if is missing userId', () => {
        delete req.body.userId;
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'missing_userId',
            message: 'Missing userId',
        });
    });
    it('should throw BadRequest if is minActivePower is present but is not an number', () => {
        req.body.minActivePower = 'sdfadsc';
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'invalid_minActivePower',
            message: 'Invalid minActivePower',
        });
    });

    it('should throw BadRequest if is setCurrentLimit is present but is not an number', () => {
        req.body.setCurrentLimit = 'sdface8845';
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'invalid_setCurrentLimit',
            message: 'Invalid setCurrentLimit',
        });
    });

    it('It should pass the test', () => {
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(next).toHaveBeenCalled();
        req.body.minActivePower = 100;
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(next).toHaveBeenCalled();
        req.body.setCurrentLimit = 100;
        chargersMiddleware.ValidatePlugsSetPointsRequest(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
