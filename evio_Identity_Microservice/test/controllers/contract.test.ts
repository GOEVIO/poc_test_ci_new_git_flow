import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import httpMocks from 'node-mocks-http';
import { StatusCodes } from 'http-status-codes';
import contractController from '../../controllers/contract';
// DB
import User from '../../models/user';

jest.mock('../../models/user');

describe('Test Suit for contracts Controllers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    const USER ={
        _id: "60b67fa4e255650013db9cfe"
    }
    describe(' Function deactivateContracts', () => {
        it(' 500 -> bad reason ', async () => {
            const req = httpMocks.createRequest({
                method: 'PATCH',
                url: '/api/private/users/contracts/deactivate/60b67fa4e255650013db9cfe',
                body: { reason: 'teste' },
            });

            const res = httpMocks.createResponse();
            const response = await contractController.deactivateContracts(
                req,
                res
            );
            const data = res._getData();
            expect(response.statusCode).toBe(500);
            expect(data).toBe('reason is not part of userBlockReasonEnum');
        });

        it(' 400 -> Unknown user ', async () => {
            const req = httpMocks.createRequest({
                method: 'PATCH',
                url: '/api/private/users/contracts/deactivate/60b67fa4e255650013db9cfe',
                body: { reason: 'FLEET_MANAGER' },
            });
            const res = httpMocks.createResponse();
            const response = await contractController.deactivateContracts(
                req,
                res
            );
            const data = res._getData();
            expect(response.statusCode).toBe(400);
            expect(data).toMatchObject({
                code: 'server_user_not_found',
                message: 'User not found',
            });
        });

        it(' 204 -> User blocked', async () => {
            (User.findById as jest.Mock).mockReturnValue(
                USER
            );
            const req = httpMocks.createRequest({
                method: 'PATCH',
                url: '/api/private/users/contracts/deactivate/60b67fa4e255650013db9cfe',
                body: { reason: 'FLEET_MANAGER' },
            });

            const res = httpMocks.createResponse();
            const response = await contractController.deactivateContracts(
                req,
                res
            );
            const data = res._getData();
            expect(response.statusCode).toBe(204);
            expect(data).toBe("");
        });
    });
});
