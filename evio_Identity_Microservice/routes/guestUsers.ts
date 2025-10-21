import { Request, Response, Router } from 'express';
import dotenv from 'dotenv-safe';
import { BadRequest, errorResponse } from '../utils';
import guestUserService from '../services/guestUsers';
import GuestUsers from '../models/guestUsers';
import Users from '../models/user';
import UserPasswords from '../models/userPasswords';
import { Types } from 'mongoose';

dotenv.load();
const router = Router();

// EVIO-2456 PAUSED and commented
/*
const authorizationServiceProxyGuestUsers = httpProxy('http://authorization:3001/', {
    proxyReqPathResolver: req => {
        const path = `http://authorization:3001/api/private/guestUsers`;
        console.log("Forwarding path:", path);
        return path;
    }
});
*/

// ========== POST ==========
// Create guest users Profile
router.post('/api/private/guestUsers', (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const {
            accounttype: accountType,
            clientname: clientName,
            userid: userId
        } = <{accounttype: string, clientname: string, userid: string}>req.headers;

        if (accountType === process.env.AccountTypeMaster) {
            const { password } = req.body;
            const guestUserData = {
                ...req.body,
                clientName,
                users: [{ userId, rulesIds: [Types.ObjectId(process.env.DEFAULT_GUESTUSER_ROLE)] }]
            };
            const isEVIO = clientName === 'EVIO';
            const guestUser = new GuestUsers(guestUserData);

            guestUserService.validateFieldsCreate(guestUser, password)
                .then(async () => {
                    const queryGuest = {
                        email: guestUser.email,
                        clientName
                    };
                    const query = {
                        status: process.env.USERRREGISTERED,
                        ...queryGuest
                    };

                    const userFound = await Users.findOne(query);
                    const guestUserFound = await GuestUsers.findOne(queryGuest);

                    if (userFound) {
                        return res.status(400).send({ auth: false, code: 'server_email_use_users', message: 'Email is already registered as an user' });
                    }

                    if (guestUserFound) {
                        return res.status(400).send({ auth: false, code: 'server_email_use_guesUsers', message: 'Email is already registered as an guest user' });
                    }

                    return res.status(200).send(
                        await guestUserService.addGuestUser(guestUser, password, isEVIO)
                    );
                })
                .catch((error) => res.status(400).send(error));
        } else {
            return res.status(400).send({ auth: false, code: 'server_not_authorized_add', message: 'Not authorized to add new guest user' });
        }
    } catch (error) {
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        } else if (error.request) {
            console.error('No response received:', error.request);
        }

        return errorResponse(res, error, context);
    }
});

// ========== PATCH ==========
router.patch(['/api/private/guestUsers', '/api/private/guestUsers/:guestUserId'], async (req: Request, res: Response) => {
    const context = `${req.method} ${req.path}`;
    try {
        const {
            accounttype: accountType,
            clientname: clientName,
            userid: userId,
            requestuserid: requestUserId,
        } = req.headers;
        // eslint-disable-next-line no-underscore-dangle
        const guestUserId = req.params?.guestUserId || req.body?._id;
        const isEVIO = clientName === 'EVIO';

        if (!Types.ObjectId.isValid(guestUserId)) throw BadRequest(`${guestUserId} is not a valid ObjectId`);

        console.log(`[${context}] Updating guest user ${guestUserId} (${clientName})...`);

        if (accountType === process.env.AccountTypeMaster || guestUserId === requestUserId) {
            const received = { ...req.body, clientName };
            const { _id, rulesIds } = received;
            let guestUser;

            if (rulesIds && userId) {
                console.log(`[${context}] Updating guest user ${guestUserId} (${clientName}) rules...`);
                guestUser = await guestUserService.updateGuestUsersRules(
                    guestUserId ?? _id,
                    userId as string,
                    rulesIds
                );
            }

            if (received.password) {
                console.log(`[${context}] Updating guest user ${guestUserId} (${clientName}) password...`);
                guestUser = await guestUserService.updateGuestUsersPassword(
                    guestUserId,
                    received,
                    isEVIO
                );
            }

            if (!guestUser) {
                console.log(`[${context}] Updating guest user ${guestUserId} (${clientName}) email and name...`);
                guestUser = await guestUserService.updateGuestUsersEmailName(
                    guestUserId,
                    received,
                    isEVIO
                );
            }

            return res.status(200).send(guestUser);
        }

        return res.status(400).send({ auth: false, code: 'server_not_authorized_edit', message: 'Not authorized to edit an guest user' });
    } catch (error) {
        return errorResponse(res, error, context);
    }
});

// ========== GET ==========
// Get guest users Profile by owner user
router.get('/api/private/guestUsers', async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const userId = <string>req.headers.userid;
        if (!userId) throw BadRequest('Missing header: userid');

        console.log(await guestUserService.getGuestUsersByUser(userId));
        return res.status(200).send(await guestUserService.getGuestUsersByUser(userId));
    } catch (error) {
        return errorResponse(res, error, context);
    }
});

router.get('/api/private/guestUsers/byId', async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const { guestUserId } = req.query;

        if (!guestUserId) throw BadRequest('Missing query param: requestuserid');

        return res.status(200).send(await guestUserService.getGuestUserByID(guestUserId));
    } catch (error) {
        return errorResponse(res, error, context);
    }
});

router.post('/api/private/guestUsers/connect/:guestUserId', async (req, res) => {
    const context = 'GET /api/private/guestUsers';
    try {
        const userId = <string>req.headers.userid;
        const { guestUserId } = <{guestUserId: string}>req.params;

        if (!userId) throw BadRequest('Missing header: userid');
        if (!guestUserId) throw BadRequest('Missing URL param with guestUserId');

        return res.status(200).send(await guestUserService.attachUser(userId, guestUserId));
    } catch (error) {
        return errorResponse(res, error, context);
    }
});

router.post('/api/private/guestUsers/disconnect/:guestUserId', async (req, res) => {
    const context = 'GET /api/private/guestUsers';
    try {
        const userId = <string>req.headers.userid;
        const { guestUserId } = <{guestUserId: string}>req.params;

        if (!userId) throw BadRequest('Missing header: userid');
        if (!guestUserId) throw BadRequest('Missing URL param with guestUserId');

        return res.status(200).send(await guestUserService.detachUser(userId, guestUserId));
    } catch (error) {
        return errorResponse(res, error, context);
    }
});

// ========== DELETE ==========
// Remove guest users Profile
router.delete('/api/private/guestUsers', async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const received = req.body;
        const { accounttype: accountType, clientname: clientName } = req.headers;

        if (!received.guestUserId) {
            return res.status(400).send({ auth: false, code: 'server_guestUserId_required', message: 'Guest user id required' });
        }

        if (accountType === process.env.AccountTypeMaster) {
            const guestUsersFound = await GuestUsers.findOne({ _id: received.guestUserId });
            if (guestUsersFound) {
                const { _id: guestUserId } = guestUsersFound;

                console.log(`[${context}] Removing guest user ${guestUserId} (${clientName}) password...`);
                await UserPasswords.removePasswordByUserId(guestUserId);

                return res.status(200).send(await GuestUsers.removeGuestUser(guestUserId));
            }
            return res.status(404).send({
                auth: false,
                code: 'server_user_not_found',
                message: 'User not found for given parameters'
            });
        }
        return res.status(400).send({ auth: false, code: 'server_not_authorized_removed', message: 'Not authorized to remove guest user' });
    } catch (error) {
        return errorResponse(res, error, context);
    }
});

module.exports = router;
