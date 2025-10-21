import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { getAllGroup } from '../../../v2/chargers/controllers/allGroups.controller';
import * as AllGroupsService from '../../../v2/chargers/services/allGroups.service';
import * as Sentry from '@sentry/node';

jest.mock('@sentry/node');

describe('getAllGroup Controller', () => {
    const jsonMock = jest.fn();
    const statusMock = jest.fn(() => ({ json: jsonMock }));
    const res = { status: statusMock } as any;
    const req = { headers: { userid: 'user123' } } as any;

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return 200 with group data', async () => {
        const mockResult = {
            internalGroups: [
                { _id: '1', name: 'Fleet A', imageContent: '', details: [] },
            ],
            externalGroups: [
                { _id: '2', name: 'Group B', imageContent: '', details: [] },
            ],
        };

        jest
            .spyOn(AllGroupsService, 'fetchAllGroups')
            .mockResolvedValue(mockResult);

        await getAllGroup(req, res);

        expect(AllGroupsService.fetchAllGroups).toHaveBeenCalledWith('user123');
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockResult);
    });

    test('should handle error and return 500', async () => {
        const error = new Error('Service error');
        jest
            .spyOn(AllGroupsService, 'fetchAllGroups')
            .mockRejectedValue(error);

        await getAllGroup(req, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            message: 'Internal server error',
        });
    });
});
