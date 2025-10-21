import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { listChargerImages } from '../../../v2/chargerImages/chargerImages.controller';
import * as chargerImagesService from '../../../v2/chargerImages/chargerImages.service';

describe('ChargerImagesController - listChargerImages', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;
    let sendMock: jest.Mock;

    beforeEach(() => {
        req = { query: { chargerId: 'charger1' } };
        jsonMock = jest.fn();
        sendMock = jest.fn();
        statusMock = jest.fn(() => ({ json: jsonMock, send: sendMock }));
        res = { status: statusMock } as unknown as Response;

        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return charger images successfully', async () => {
        const fakeResponse = { images: ['url1', 'url2'], defaultImage: 'url1' };
        jest.spyOn(chargerImagesService, 'getChargerImages').mockResolvedValue(fakeResponse);

        await listChargerImages(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(fakeResponse);
        expect(sendMock).not.toHaveBeenCalled();
    });

    test('should handle errors', async () => {
        jest.spyOn(chargerImagesService, 'getChargerImages').mockRejectedValue(new Error('Test error'));

        await listChargerImages(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
        expect(jsonMock).not.toHaveBeenCalled();
    });
});
