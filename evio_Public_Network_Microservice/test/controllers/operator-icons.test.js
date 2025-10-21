const { jest, describe, test, expect, beforeEach } = require('@jest/globals');

jest.mock('../../services/operator-icons', () => ({
    upsertOperatorIcon: jest.fn(),
    deleteOperatorIcon: jest.fn(),
    listIconsByPartyIds: jest.fn(),
}));

jest.mock(
    'evio-library-commons',
    () => ({
        uploadBase64: jest.fn(),
        deleteByUrl: jest.fn(),
    }),
    { virtual: true }
);

const controller = require('../../controllers/operator-icons');
const service = require('../../services/operator-icons'); // mock acima

describe('operatorIcons.controller', () => {
    let req, res, next, statusMock, jsonMock, sendMock;

    beforeEach(() => {
        jest.clearAllMocks();

        jsonMock = jest.fn();
        sendMock = jest.fn();
        statusMock = jest.fn(() => ({ json: jsonMock, send: sendMock }));

        res = { status: statusMock, json: jsonMock };

        next = jest.fn();
    });

    describe('createOrUpdateIcon', () => {
        test('200 when icon is created/updated', async () => {
            req = {
                params: { partyId: 'PT*ABC' },
                body: { type: 'single', base64: 'data:image/png;base64,AAA' },
            };
            service.upsertOperatorIcon.mockResolvedValue({
                partyId: 'PT*ABC',
                type: 'single',
                url: 'https://link/cpoIcons/x.png',
            });

            await controller.createOrUpdateIcon(req, res, next);

            expect(service.upsertOperatorIcon).toHaveBeenCalledWith({
                partyId: 'PT*ABC',
                type: 'single',
                base64: 'data:image/png;base64,AAA',
                contentType: undefined,
            });
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                partyId: 'PT*ABC',
                type: 'single',
                url: 'https://link/cpoIcons/x.png',
            });
        });

        test('400 when missing type or base64', async () => {
            req = { params: { partyId: 'PT*ABC' }, body: { type: 'single' } };

            await controller.createOrUpdateIcon(req, res, next);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                message: 'type and base64 are required',
            });
            expect(service.upsertOperatorIcon).not.toHaveBeenCalled();
        });

        test('next(err) on service error', async () => {
            req = {
                params: { partyId: 'PT*ABC' },
                body: { type: 'single', base64: '...' },
            };
            const boom = new Error('fail');
            service.upsertOperatorIcon.mockRejectedValue(boom);

            await controller.createOrUpdateIcon(req, res, next);
            expect(next).toHaveBeenCalledWith(boom);
        });
    });

    describe('deleteIcon', () => {
        test('204 on success', async () => {
            req = { params: { partyId: 'PT*ABC', type: 'offline' } };
            service.deleteOperatorIcon.mockResolvedValue();

            await controller.deleteIcon(req, res, next);

            expect(service.deleteOperatorIcon).toHaveBeenCalledWith({
                partyId: 'PT*ABC',
                type: 'offline',
            });
            expect(statusMock).toHaveBeenCalledWith(204);
            expect(sendMock).toHaveBeenCalled();
        });

        test('next(err) on error', async () => {
            req = { params: { partyId: 'PT*ABC', type: 'offline' } };
            const boom = new Error('x');
            service.deleteOperatorIcon.mockRejectedValue(boom);

            await controller.deleteIcon(req, res, next);
            expect(next).toHaveBeenCalledWith(boom);
        });
    });

    describe('bulkFetchIcons', () => {
        test('200 with items', async () => {
            req = { body: { partyIds: ['PT*ABC', 'PT*DEF'] } };
            service.listIconsByPartyIds.mockResolvedValue([
                { partyId: 'PT*ABC', icons: [{ type: 'single', url: 'u1' }] },
                { partyId: 'PT*DEF', icons: [{ type: 'multiple', url: 'u2' }] },
            ]);

            await controller.bulkFetchIcons(req, res, next);

            expect(service.listIconsByPartyIds).toHaveBeenCalledWith([
                'PT*ABC',
                'PT*DEF',
            ]);
            expect(jsonMock).toHaveBeenCalledWith([
                { partyId: 'PT*ABC', icons: [{ type: 'single', url: 'u1' }] },
                { partyId: 'PT*DEF', icons: [{ type: 'multiple', url: 'u2' }] },
            ]);
        });

        test('200 [] when partyIds is empty', async () => {
            req = { body: { partyIds: [] } };

            await controller.bulkFetchIcons(req, res, next);

            expect(service.listIconsByPartyIds).not.toHaveBeenCalled();
            expect(jsonMock).toHaveBeenCalledWith([]);
        });

        test('400 when partyIds is not an array', async () => {
            req = { body: { partyIds: null } };

            await controller.bulkFetchIcons(req, res, next);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                message: 'partyIds must be a non-empty array',
            });
        });

        test('next(err) on error', async () => {
            req = { body: { partyIds: ['PT*ABC'] } };
            const boom = new Error('oops');
            service.listIconsByPartyIds.mockRejectedValue(boom);

            await controller.bulkFetchIcons(req, res, next);
            expect(next).toHaveBeenCalledWith(boom);
        });
    });
});
