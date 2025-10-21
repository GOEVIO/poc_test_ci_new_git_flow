import authService from '../services/authentication';
import { checkRequiredFields } from '../utils/validation';
import { BadRequest, errorResponse } from '../utils/errorHandling';

const authenticate = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        return res.status(200).json(await authService.authenticate(req));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const authenticateCaetanoGo = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const { sendRequestToMobile } = req.body;
        const statusCode = sendRequestToMobile ? 401 : 200;

        return res.status(statusCode).json(await authService.authenticateWithEmail(req));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const authenticateHyundai = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        return res.status(200).json(await authService.authenticateWithEmail(req));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const checkauth = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const token = req.headers.token as string;
        if (!token) throw BadRequest('Missing Header: token');

        return res.status(200).json(await authService.checkAuthentication(token));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const disableToken = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const token = req.body.token as string;
        if (!token) throw BadRequest('Missing parameter: token');

        await authService.logout(token);

        return res.status(204).send();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const getCachedRules = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const requiredErrors = checkRequiredFields(req.query, ['token', 'userId']);
        if (requiredErrors.length > 0) throw BadRequest(requiredErrors);

        const { token, userId, guestUserId } = <{
            token: string, userId: string, guestUserId?: string
        }>req.query;

        return res.status(200).json(await authService.getCachedRules(token, userId, guestUserId));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const getUserIdByToken = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const token = req.headers.token as string;
        if (!token) throw BadRequest('Missing Header: token');

        return res.status(200).json(await authService.getUserIdByToken(token));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const saveNewToken = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const requiredErrors = checkRequiredFields(req.body, ['token', 'refreshtoken']);
        if (requiredErrors.length > 0) throw BadRequest(requiredErrors);

        const { token, refreshtoken: refreshToken } = req.body;
        return res.status(200).json(await authService.saveNewToken(req, token, refreshToken));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const logout = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const token = req.headers.token as string;
        if (!token) throw BadRequest('Missing Header: token');

        return res.status(200).json(await authService.logout(token));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const regenerateRules = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const requiredErrors = checkRequiredFields(req.body, ['userId', 'rules']);
        if (requiredErrors.length > 0) throw BadRequest(requiredErrors);

        const { userId, guestUserId, rules } = req.body;

        await authService.setCachedRules(userId, rules, guestUserId);

        return res.status(204).send();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const revokeCachedRules = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        await authService.revokeCachedRules();

        return res.status(204).send();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const finishAllSessions = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const requiredErrors = checkRequiredFields(req.body, ['userId']);
        if (requiredErrors.length > 0) throw BadRequest(requiredErrors);

        const { userId, guestUserId } = req.body;

        await authService.finishAllSessions(userId, guestUserId);

        return res.status(204).send();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

export default {
    authenticate,
    authenticateCaetanoGo,
    authenticateHyundai,
    checkauth,
    disableToken,
    finishAllSessions,
    getCachedRules,
    getUserIdByToken,
    logout,
    regenerateRules,
    revokeCachedRules,
    saveNewToken
};
