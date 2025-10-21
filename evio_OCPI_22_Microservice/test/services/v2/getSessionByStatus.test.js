const { describe, expect, it } = require('@jest/globals');
const { getSessionByStatusService } = require('../../../services/v2/getSessionByStatus.service');
const Session = require('../../../models/sessions');
const CDRS = require('../../../models/cdrs');
const Identity = require('evio-library-identity').default;

jest.mock('../../../models/sessions', () => ({
    find: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../../../models/cdrs', () => ({
    find: jest.fn(),
}));

jest.mock('evio-library-identity', () => ({
    default: {
        findUsersByQuery: jest.fn(),
    },
}));

describe('getSessionByStatusService', () => {
    it('should return empty sessions and count 0 when no sessions are found', async () => {
        Session.find.mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue([]),
        });
        const requestData = { status: 'active', pageNumber: 1, limiteQuery: 10 };

        const result = await getSessionByStatusService(requestData);

        expect(result).toEqual({ sessions: [], count: 0 });
        expect(Session.find).toHaveBeenCalled();
    });

    it('should return formatted sessions and count when sessions and CDRs are found', async () => {
        const mockSessions = [
            { 
                cdrId: 'cdr1', 
                _id: 'session1', 
                status: 'active', 
                id: 'sess1', 
                location_id: 'loc1', 
                address: { city: 'City1' }, 
                party_id: 'operator1', 
                createdAt: '2025-01-01', 
                suspensionReason: 'none',
                start_date_time: '2025-01-01T00:00:00Z',
                end_date_time: '2025-01-02T00:00:00Z' 
            }
        ];
        const mockCDRs = [
            { 
                id: 'cdr1', 
                total_energy: 100, 
                mobie_cdr_extension: { 
                    subUsages: [
                        { 
                            energia_ponta: 40, 
                            energia_cheias: 10 
                        }
                    ] 
                },
            }
        ];

        Session.find.mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue(mockSessions),
        });
        Session.countDocuments.mockReturnValueOnce(mockSessions.length);
        CDRS.find.mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue(mockCDRs),
        });
        Identity.findUsersByQuery.mockReturnValueOnce([])

        const requestData = { 
            status: 'active', 
            pageNumber: 1, 
            limiteQuery: 10,
            startDate: '2025-01-01',
            endDate: '2025-01-02',
            invalidateReason: 'none',
        };

        const result = await getSessionByStatusService(requestData);

        expect(result.sessions).toHaveLength(1);
        expect(result.count).toBe(1);
        expect(result.sessions[0]).toMatchObject({
            _id: 'session1',
            status: 'active',
            cdrId: 'cdr1',
            sessionId: 'sess1',
            location: 'loc1',
            city: 'City1',
            operator: 'operator1',
            startDate: '2025-01-01T00:00:00Z',
            stopDate: '2025-01-02T00:00:00Z',
            duration: 1,
            totalEnergy: 100,
            totalSubUsagesEnergy: 50,
            diffKWh: 50,
            createdAt: '2025-01-01',
            reason: 'none',
        });
    });
});
