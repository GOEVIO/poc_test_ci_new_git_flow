import { Request, Response, Send } from 'express';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import switchboardsMiddleware from '../../middleware/switchboardsMiddleware';

describe('validateConfigSwitchboard', () => {
    const next = jest.fn();
    const res = {} as unknown as Response;
    res.send = jest.fn() as Send;
    res.status = jest.fn(() => res);
    const req = {
        params: {},
    } as unknown as Request;

    beforeEach(() => {
        req.params = {
            id: '66600c5e36faec00139c10d5',
        };
    });

    it('should call next if id is present and valid', () => {
        switchboardsMiddleware.validateConfigSwitchboard(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should send bad request if id is missing', () => {
        req.params = {};
        switchboardsMiddleware.validateConfigSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'server_switchboard_id_required',
            message: 'SwitchBoard id is required',
        });
    });

    it('should send bad request if id is invalid', () => {
        req.params.id = '1215sd';
        switchboardsMiddleware.validateConfigSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'invalid_id',
            message: 'Invalid id format',
        });
    });
});

describe('validatePatchSwitchboard', () => {
    const next = jest.fn();
    const res = {} as unknown as Response;
    res.send = jest.fn() as Send;
    res.status = jest.fn(() => res);
    const req = {
        params: {},
        body: {},
    } as unknown as Request;

    beforeEach(() => {
        req.params = {
            id: '66600c5e36faec00139c10d5',
        };
        req.body = {
            name: 'Test SwitchBoard',
            cpe: 'Test CPE',
            chargingMode: 'Base Mode',
            minSolarCurrent: 10,
            sharingMode: 'FIFO',
            currentLimit: 20,
        };
    });

    it('should call next if id is present and valid', () => {
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should send bad request if id is missing', () => {
        req.params = {};
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'server_switchboard_id_required',
            message: 'SwitchBoard id is required',
        });
    });

    it('should send bad request if id is invalid', () => {
        req.params.id = '1215sd';
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'invalid_id',
            message: 'Invalid id format',
        });
    });

    it('should send bad request if body is missing', () => {
        req.body = undefined;
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'switchboard_body_required',
            message: 'SwitchBoard body is required',
        });
    });

    it('should send bad request if name is missing', () => {
        req.body.name = undefined;
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'switchboard_name_required',
            message: 'SwitchBoard name is required',
        });
    });

    it('should send bad request if name length exceeds 30 characters', () => {
        req.body.name = 'This is a very long name that exceeds the maximum length of 30 characters';
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'switchboard_name_length',
            message: 'SwitchBoard name must be at most 30 characters length',
        });
    });

    it('should send bad request if charging mode is missing', () => {
        req.body.chargingMode = undefined;
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'switchboard_charging_mode_required',
            message: 'SwitchBoard charging mode is required',
        });
    });

    it('should send bad request if charging mode is invalid', () => {
        req.body.chargingMode = 'Invalid Charging Mode';
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'switchboard_charging_mode_invalid',
            message: 'Invalid charging mode',
        });
    });

    it('should send bad request if sharing mode is invalid', () => {
        req.body.sharingMode = 'Invalid Sharing Mode';
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'switchboard_sharing_mode_invalid',
            message: 'Sharing mode is invalid',
        });
    });

    it('should send bad request if minSolarCurrent is negative', () => {
        req.body.minSolarCurrent = -10;
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'switchboard_minSolarCurrent_invalid',
            message: 'SwitchBoard minSolarCurrent must be positive number',
        });
    });

    it('should send bad request if currentLimit is negative', () => {
        req.body.currentLimit = -20;
        switchboardsMiddleware.validatePatchSwitchboard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            status: false,
            code: 'switchboard_current_limit_invalid',
            message: 'SwitchBoard current limit must be positive number',
        });
    });
});
