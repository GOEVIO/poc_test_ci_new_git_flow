import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { addImages } from '../../../v2/chargerImages/chargerImages.controller';
import * as chargerImagesService from '../../../v2/chargerImages/chargerImages.service';

const fakeCharger = {
    imageContent: ['url1', 'url2'],
    defaultImage: 'url1',
};

describe('ChargerImagesController - addImages', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;
    let sendMock: jest.Mock;

    beforeEach(() => {
        req = {
            query: { chargerId: 'charger1' },
            body: { newImages: ['data:image/jpeg;base64,base64data1'] },
        };

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

    test('should add images and return updated charger', async () => {
        jest.spyOn(chargerImagesService, 'addChargerImages').mockResolvedValue({
            imageContent: fakeCharger.imageContent,
            defaultImage: fakeCharger.defaultImage,
        } as any);

        await addImages(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
            images: fakeCharger.imageContent,
            defaultImage: fakeCharger.defaultImage,
        });
        expect(sendMock).not.toHaveBeenCalled();
    });

    test('should handle errors on addImages', async () => {
        jest
            .spyOn(chargerImagesService, 'addChargerImages')
            .mockRejectedValue(new Error('Add error'));

        await addImages(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
        expect(jsonMock).not.toHaveBeenCalled();
    });
});
