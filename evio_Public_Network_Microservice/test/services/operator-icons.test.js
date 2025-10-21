const { jest, describe, test, expect, beforeEach } = require('@jest/globals');

jest.mock('../../models/operator', () => ({
    updateOne: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
}));

jest.mock(
    'evio-library-commons',
    () => ({
        uploadBase64: jest.fn(),
        deleteByUrl: jest.fn(),
    }),
    { virtual: true }
);

const Operator = require('../../models/operator');
const { uploadBase64, deleteByUrl } = require('evio-library-commons');

const {
    upsertOperatorIcon,
    deleteOperatorIcon,
    listIconsByPartyIds,
} = require('../../services/operator-icons');

describe('operatorIcons.service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        deleteByUrl.mockResolvedValue();
    });

    describe('upsertOperatorIcon', () => {
        test('updates when there is already an icon of the same type', async () => {
            Operator.findOne.mockResolvedValue({
                icons: [{ type: 'single', url: 'https://old/url.png' }],
            });
            uploadBase64.mockResolvedValue({
                url: 'https://link/cpoIcons/a.png',
                key: 'k',
            });
            Operator.updateOne.mockResolvedValue({ nModified: 1 });

            const result = await upsertOperatorIcon({
                partyId: 'PT*ABC',
                type: 'single',
                base64: 'data:image/png;base64,AAA',
            });

            expect(uploadBase64).toHaveBeenCalled();
            expect(Operator.updateOne).toHaveBeenCalledWith(
                { partyId: 'PT*ABC', 'icons.type': 'single' },
                { $set: { 'icons.$.url': 'https://link/cpoIcons/a.png' } }
            );
            expect(result).toEqual({
                partyId: 'PT*ABC',
                type: 'single',
                url: 'https://link/cpoIcons/a.png',
            });
        });

        test('inserts a new type when there is no previous icon', async () => {
            Operator.findOne.mockResolvedValue(null);
            uploadBase64.mockResolvedValue({
                url: 'https://link/cpoIcons/b.png',
                key: 'k',
            });

            await upsertOperatorIcon({
                partyId: 'PT*ABC',
                type: 'multiple',
                base64: '...',
            });

            expect(Operator.updateOne).toHaveBeenCalledTimes(1);
            expect(Operator.updateOne).toHaveBeenCalledWith(
                { partyId: 'PT*ABC' },
                { $push: { icons: { type: 'multiple', url: 'https://link/cpoIcons/b.png' } } },
                { upsert: true }
            );
        });

        test('throws error on invalid type', async () => {
            await expect(
                upsertOperatorIcon({ partyId: 'PT*ABC', type: 'weird', base64: '...' })
            ).rejects.toThrow(/Invalid type/);
            expect(uploadBase64).not.toHaveBeenCalled();
        });
    });

    describe('deleteOperatorIcon', () => {
        test('removes from the array and deletes the file by URL', async () => {
            // mock chain: findOne(...).select('icons').lean()
            Operator.findOne.mockReturnValue({
                select: () => ({
                    lean: async () => ({
                        icons: [{ type: 'offline', url: 'https://link/cpoIcons/c.png' }],
                    }),
                }),
            });
            Operator.updateOne.mockResolvedValue({ acknowledged: true });
            deleteByUrl.mockResolvedValue();

            await deleteOperatorIcon({ partyId: 'PT*ABC', type: 'offline' });

            expect(Operator.updateOne).toHaveBeenCalledWith(
                { partyId: 'PT*ABC' },
                { $pull: { icons: { type: 'offline' } } }
            );
            expect(deleteByUrl).toHaveBeenCalledWith('https://link/cpoIcons/c.png');
        });

        test('does not call deleteByUrl when there is no current url', async () => {
            Operator.findOne.mockReturnValue({
                select: () => ({ lean: async () => ({ icons: [] }) }),
            });
            Operator.updateOne.mockResolvedValue({ acknowledged: true });

            await deleteOperatorIcon({ partyId: 'PT*ABC', type: 'offline' });
            expect(deleteByUrl).not.toHaveBeenCalled();
        });
    });

    describe('listIconsByPartyIds', () => {
        test('returns [] when there are no partyIds', async () => {
            const res = await listIconsByPartyIds([]);
            expect(res).toEqual([]);
            expect(Operator.find).not.toHaveBeenCalled();
        });

        test('returns icons grouped by partyId', async () => {
            const lean = jest.fn().mockResolvedValue([
                { partyId: 'PT*ABC', icons: [{ type: 'single', url: 'u1' }] },
                { partyId: 'PT*DEF', icons: [{ type: 'multiple', url: 'u2' }] },
            ]);
            const select = jest.fn(() => ({ lean }));
            Operator.find.mockReturnValue({ select });

            const res = await listIconsByPartyIds(['PT*ABC', 'PT*DEF']);

            expect(Operator.find).toHaveBeenCalledWith({
                partyId: { $in: ['PT*ABC', 'PT*DEF'] },
            });
            expect(select).toHaveBeenCalledWith('partyId icons');
            expect(res).toEqual([
                { partyId: 'PT*ABC', icons: [{ type: 'single', url: 'u1' }] },
                { partyId: 'PT*DEF', icons: [{ type: 'multiple', url: 'u2' }] },
            ]);
        });
    });
});
