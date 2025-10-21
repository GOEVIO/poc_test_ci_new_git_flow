import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { parseGetAlarmsFiltersAndSort } from '../../../v2/alarms/helpers/filters.helper';
import { Request, Response } from 'express';

describe('parseGetAlarmsFiltersAndSort middleware', () => {
    let req: any = { query: {} };
    const res = {} as Response;
    const next = jest.fn();

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should parse basic filters and default sort', () => {
        req = {
            query: {
                type: 'error',
                status: 'read',
                userId: 'user1',
                hwId: 'hw1'
            }
        };

        parseGetAlarmsFiltersAndSort(req as Request, res, next);

        expect(req.query['_filters']).toEqual({
            type: 'error',
            status: 'read',
            userId: 'user1',
            hwId: 'hw1'
        });
        expect(req.query['_sort']).toBe('timestamp');
        expect(req.query['_order']).toBe('-1');
        expect(next).toHaveBeenCalled();
    });

    test('should handle date range and ordering', () => {
        req = {
            query: {
                startDate: '2024-01-01T00:00:00.000Z',
                endDate: '2024-12-31T23:59:59.000Z',
                sort: 'type',
                order: 'asc'
            }
        };

        parseGetAlarmsFiltersAndSort(req as Request, res, next);

        expect(req.query['_filters']).toEqual({
            timestamp: {
                $gte: new Date('2024-01-01T00:00:00.000Z'),
                $lte: new Date('2024-12-31T23:59:59.000Z')
            }
        });
        expect(req.query['_sort']).toBe('type');
        expect(req.query['_order']).toBe('1');
        expect(next).toHaveBeenCalled();
    });

    test('should fallback to default sort if invalid sort field is provided', () => {
        req = {
            query: {
                sort: 'nonexistent',
                order: 'desc'
            }
        };

        parseGetAlarmsFiltersAndSort(req as Request, res, next);

        expect(req.query['_sort']).toBe('timestamp');
        expect(req.query['_order']).toBe('-1');
        expect(next).toHaveBeenCalled();
    });
});
