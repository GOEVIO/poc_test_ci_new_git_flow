import {
    describe,
    expect,
    it,
    jest,
    beforeEach
} from '@jest/globals';
import jwt from 'jsonwebtoken';
import { changeCompanyPasswordWithCode } from '../../controllers/recover_password';
import PasswordRecovery from '../../models/password_recovery';
import User from '../../models/user';

jest.mock('../../models/password_recovery');
jest.mock('../../models/user');
jest.mock('jsonwebtoken');

jest.spyOn(User, 'findOne').mockImplementation(() => ({
    _id: '5dbff32e367a343830cd2f49',
    clientType: 'B2B',
    mobile: '910910910',
    internationalPrefix: '+351'
}) as never);
jest.spyOn(PasswordRecovery, 'markAsUsedById').mockImplementation(() => (true) as never);

describe('changeCompanyPasswordWithCode', () => {
    let req, res;

    beforeEach(() => {
        req = {
            headers: {},
            body: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn()
        };

        jest.clearAllMocks();
    });

    const mockErrorResponse = (error, context) => ({
        context,
        ...error
    });

    const errorResponse = (res, error, context) =>
        res.status(400).send(mockErrorResponse(error, context));

    it('should return 400 if code is not provided', async () => {
        req.body = { email: 'test@example.com', password: 'newpassword' };
        req.headers.clientname = 'testclient';

        await changeCompanyPasswordWithCode(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ code: 'server_code_required' }));
    });

    it('should return 400 if email is not provided', async () => {
        req.body = { code: '123456', password: 'newpassword' };
        req.headers.clientname = 'testclient';

        await changeCompanyPasswordWithCode(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ code: 'server_email_required' }));
    });

    it('should return 400 if password is not provided', async () => {
        req.body = { code: '123456', email: 'test@example.com' };
        req.headers.clientname = 'testclient';

        await changeCompanyPasswordWithCode(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ code: 'server_password_required' }));
    });

    it('should return 400 if user is not found', async () => {
        req.body = { code: '123456', email: 'test@example.com', password: 'newpassword' };
        req.headers.clientname = 'testclient';

        (User.findOne as jest.Mock).mockResolvedValue(null as never);

        await changeCompanyPasswordWithCode(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ code: 'server_user_not_found_email' }));
    });

    it('should return 400 if user is not a company', async () => {
        req.body = { code: '123456', email: 'test@example.com', password: 'newpassword' };
        req.headers.clientname = 'testclient';

        (User.findOne as jest.Mock).mockResolvedValue({ clientType: 'B2C' } as never);

        await changeCompanyPasswordWithCode(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ code: 'server_user_not_company' }));
    });

    it('should return 400 if code is invalid', async () => {
        req.body = { code: '123456', email: 'test@example.com', password: 'newpassword' };
        req.headers.clientname = 'testclient';

        (User.findOne as jest.Mock).mockResolvedValue({ clientType: process.env.ClientTypeB2B } as never);
        (PasswordRecovery.getCodeByUser as jest.Mock).mockResolvedValue(null as never);

        await changeCompanyPasswordWithCode(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ code: 'server_invalid_code' }));
    });

    it('should return 400 if code is already used', async () => {
        req.body = { code: '123456', email: 'test@example.com', password: 'newpassword' };
        req.headers.clientname = 'testclient';

        (User.findOne as jest.Mock).mockResolvedValue({ clientType: process.env.ClientTypeB2B } as never);
        (PasswordRecovery.getCodeByUser as jest.Mock).mockResolvedValue({ used: true } as never);

        await changeCompanyPasswordWithCode(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ code: 'server_code_already_used' }));
    });

    it('should return 400 if code is expired', async () => {
        req.body = { code: '123456', email: 'test@example.com', password: 'newpassword' };
        req.headers.clientname = 'testclient';

        (User.findOne as jest.Mock).mockResolvedValue({ clientType: process.env.ClientTypeB2B } as never);
        (PasswordRecovery.getCodeByUser as jest.Mock).mockResolvedValue({ token: 'expiredtoken', used: false } as never);

        (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('expired'); });

        await changeCompanyPasswordWithCode(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ code: 'server_code_expired' }));
    });

    it('should return 200 if password is successfully changed', async () => {
        req.body = { code: '123456', email: 'test@example.com', password: 'newpassword' };
        req.headers.clientname = 'testclient';

        (User.findOne as jest.Mock).mockResolvedValue({ _id: 'userId', clientType: process.env.ClientTypeB2B } as never);
        (PasswordRecovery.getCodeByUser as jest.Mock).mockResolvedValue({ _id: 'codeId', token: 'validtoken', used: false } as never);
        (jwt.verify as jest.Mock).mockImplementation(() => {});
        (User.getEncriptedPassword as jest.Mock).mockResolvedValue('encryptedpassword' as never);
        (PasswordRecovery.markAsUsedById as jest.Mock).mockResolvedValue(true as never);

        await changeCompanyPasswordWithCode(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ code: 'server_password_changed' }));
    });
});
