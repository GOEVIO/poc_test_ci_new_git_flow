import { Types } from 'mongoose';
import { advancedAccountLimiterMiddleware } from '../middlewares/ip.middlewares';
// Models
import User from '../models/user';
import GuestUsers from '../models/guestUsers';
// Services
import usersService from '../services/users';
import guestUserService from '../services/guestUsers';
import contractsServices from '../services/contracts';
import LdapServices from '../services/Ldap';
import gireveServices from '../services/gireve';
import AppConfigurationService from '../services/configsService';
import { activateNetworksForVirtualUserContract } from '../services/activate-network';
// Utills
import { errorResponse, Unauthorized } from '../utils';
import UserPasswords from "../models/userPasswords";
const ReasonForBlockUser = require('../utils/enums/ReasonForBlockUser').ReasonForBlockUser;
const ReasonForUnblockUser = require('../utils/enums/ReasonForUnblockUser').ReasonForUnblockUser;
import { sendChangeNumberSMS } from "../services/notificationsService";
import EmailChangeService from '../services/emailChangeService';

import ENV from '../constants/env';
import constants from '../utils/constants';
import TokenStatusService from '../services/tokenStatus.service';

const { billingProfileStatus } = ENV;

require('dotenv-safe').load();
const express = require('express');
const router = express.Router();
const MongoDb = require('../mongo');
const nodemailer = require('nodemailer');
const axios = require('axios');
const Activation = require('../models/activation');
const fs = require('fs');
const Drivers = require('../models/drivers');
const DriversDependencies = require('../models/driversDependencies');
const GroupDriversDependencies = require('../models/groupDriversDependencies');
const GroupDrivers = require('../models/groupDrivers');
const GroupCSUsers = require('../models/groupCSUsers');
const GroupCSUsersDependencies = require('../models/groupCSUsersDependencies');
const Contract = require('../models/contracts');
const BillingProfile = require('../models/billingProfile');
const CEMETariff = require('../models/cemeTariff');
const PaymentPeriods = require('../models/paymentPeriod.json');
const Validator = require('email-validator');
// Disable node-cron by mocking for an easy turn-back
// const cron = require('node-cron');
const cron = {
    schedule: () => ({
        start: () => {},
        stop: () => {},
        validate: () => {},
        status: '',
    }),
};
const httpProxy = require('express-http-proxy');
const CemeData = require('../controllers/ceme');
const UserHandler = require('../controllers/user');
const ErrorHandler = require('../controllers/errorHandler');
const ContractHandler = require('../controllers/contracts');
const HYSibsCards = require('../controllers/hySibsCards');
const axiosS = require('../services/axios');
const addressS = require('../services/address');
const { getCode, getName } = require('country-list');
const { isDisposableEmail } = require('../middlewares/users');
const UserService = require('../services/users').default;
const Sentry = require('@sentry/node');
const { logger, default: { energy }, default: constants } = require('../utils/constants');
const { default: { sendActivationSMS } } = require('../services/notificationsService');
const toggle = require('evio-toggle').default;

const { setLanguageUser } = require('../utils/users').default;
const { Enums } = require('evio-library-commons').default;
const { TokenStatusChangeReason } = require('../utils/enums/TokenStatusChangeReason');

const authorizationServiceProxyCaetanoGo = httpProxy(
    'http://authorization:3001/',
    {
        forwardPath: (req) =>
            'http://authorization:3001/api/caetanoGo/authenticate',
    }
);

const authorizationServiceProxyHyundai = httpProxy(
    'http://authorization:3001/',
    {
        forwardPath: (req) =>
            'http://authorization:3001/api/hyundai/authenticate',
    }
);

var host;
var auth;
switch (process.env.NODE_ENV) {
    case 'production':
        console.log('Initing production environment');
        auth = {
            username: process.env.UserNameWebserviceGoCharge,
            password: process.env.KeyWebserviceGoCharge,
        };
        host = process.env.HostToken;

        break;
    case 'development':
        console.log('Initing dev environment');
        auth = {
            username: process.env.UserNameWebserviceGoChargePRE,
            password: process.env.KeyWebserviceGoChargePRE,
        };
        host = process.env.HostTokenTest;

        break;
    case 'pre-production':
        console.log('Initing pre environment');
        auth = {
            username: process.env.UserNameWebserviceGoChargePRE,
            password: process.env.KeyWebserviceGoChargePRE,
        };
        host = process.env.HostTokenTest;

        break;
    default:
        console.log('Unknown environment');
        auth = {
            username: process.env.UserNameWebserviceGoChargePRE,
            password: process.env.KeyWebserviceGoChargePRE,
        };
        host = process.env.HostTokenTest;

        break;
}

router.post('/api/private/users/listOfUsersFromEV', async (req, res, next) => {
    const context = 'POST /api/private/users/listOfUsersFromEV';
    try {
        let userIds = req.body.userIds;
        let groupIds = req.body.groupIds;

        if (!userIds) userIds = [];

        if (groupIds)
            if (groupIds.length > 0) {
                let groups = [];

                groups = await GroupDrivers.find({ _id: groupIds });

                groups.forEach((group) => {
                    group.listOfDrivers.forEach((driver) => {
                        userIds.push(driver.driverId);
                    });
                });
            }

        if (userIds.length == 0) return res.status(200).send([]);

        User.find({ _id: userIds }, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(result);
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//========== POST =========
//Get List of Users
router.post('/api/private/users/listOfUsers', (req, res, next) => {
    const context = 'POST /api/private/users/listOfUsers';
    try {
        let query = req.body;

        console.log(query);

        User.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(result);
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.post('/api/private/Job/forceJobValidateDataACP', (req, res, next) => {
    UserHandler.forceJobValidateDataACP()
});

//========== GET ==========
//Get to validate user
router.get('/api/validateUsers', (req, res, next) => {
    const context = 'GET /api/validateUsers';
    try {
        const userId = req.headers['userid'];
        const clientType = req.headers['client'];
        const selectedUserId = req.headers['selecteduserid'];
        let query = {
            _id: userId,
        };

        if (userId) {
            User.findOne(query, async (err, result) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }

                if (
                    selectedUserId &&
                    !result?.userIds?.includes(selectedUserId) &&
                    selectedUserId !== userId
                ) {
                    const error = Unauthorized(
                        `[${context}][findOne] User is not allowed to select this userId [${selectedUserId}]`
                    );
                    return errorResponse(res, error, context);
                }

                if (
                    process.env.CaetanoGOList.includes(result.clientName) &&
                    !clientType.includes('BackOffice')
                ) {
                    let validation =
                        process.env.NODE_ENV !== 'production'
                            ? true
                            : await validateUserIdGo(result);

                    if (validation) {
                        return res.status(200).send(result);
                    } else {
                        //return res.status(400).send({ auth: false, code: 'server_user_not_valid', message: "User is not valid" });
                        let userUpdated = await refreshTokenIdGo(result);
                        if (userUpdated) {
                            return res.status(200).send(userUpdated);
                        } else {
                            return res
                                .status(400)
                                .send({
                                    auth: false,
                                    code: 'server_user_not_valid',
                                    message: 'User is not valid',
                                });
                        }
                    }
                } else {
                    return res.status(200).send(result);
                }
            });
        } else
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_user_required',
                    message: 'User id required!',
                });
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error `, error);
        if (error.auth === false) {
            return res.status(400).send(error);
        } else if (error.response) {
            reject(error.response.data);
        } else {
            return errorResponse(res, error, context);
        }
    }
});

//Get an user by mobile phone or by email
router.get(
    ['/api/private/users', '/api/private/users/byEmail'],
    async (req, res) => {
        const context = `${req.method} ${req.path}`;
        const getUserBy = req.path.includes('users/byEmail')
            ? 'email'
            : 'mobile';
        try {
            console.log('context', context);
            let query = req.query;
            const requestUserId = req.headers['requestuserid'];
            const accountType = req.headers['accounttype'];
            const clientName = req.headers['clientname'];
            const token = req.headers['token'];

            query.active = true;

            if (clientName) {
                query.clientName = clientName;
            }

            if (getUserBy === 'mobile') {
                if (
                    query.internationalPrefix === undefined ||
                    query.internationalPrefix === ''
                ) {
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_internationalPrefix_require',
                            message: 'InternationalPrefix is require',
                        });
                }

                if (query.username === undefined || query.username === '') {
                    if (query.mobile === undefined || query.mobile === '') {
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_mobile_require',
                                message: 'Mobile number is require',
                            });
                    }
                }
            }

            let userFound = await User.findOne(query).lean();

            if (!userFound) {
                return res
                    .status(404)
                    .send({
                        auth: false,
                        code: 'server_users_not_found',
                        message: 'Users not found for given parameters',
                    });
            }

            const { _id: userId } = userFound;

            const billingProfile = await BillingProfile.findOne({
                userId,
            }).lean();
            userFound.billingProfile = billingProfile;

            if (
                accountType === process.env.AccountTypeGuest &&
                requestUserId !== process.env.OperationsManagementID
            ) {
                const guestUserFound = await GuestUsers.findOne({
                    _id: requestUserId,
                });

                if (!guestUserFound) {
                    return res
                        .status(404)
                        .send({
                            auth: false,
                            code: 'server_users_not_found',
                            message:
                                'Guest User not found for given parameters',
                        });
                }

                const rules = await guestUserService.loadCachedRules(
                    token,
                    userId,
                    guestUserFound
                );

                userFound.rules = rules;
                userFound.name = guestUserFound.name;
                userFound.email = guestUserFound.email;
                userFound.mobile = '-';
                userFound.internationalPrefix = '-';
            }

            // Unnecessary field for this endpoint
            delete userFound.userIds;

            return res.status(200).send([userFound]);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }
    }
);

//Get an user or guestuser by token
router.get('/api/private/users/me', async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        const { token, userid, requestuserid, accounttype } = req.headers;
        if (!token) throw BadRequest('Missing Header: token');
        if (!userid) throw BadRequest('Missing Header: userId');
        if (!requestuserid) throw BadRequest('Missing Header: requestUserId');

        const userFound = await usersService.getCurrentUserData(
            token,
            userid,
            requestuserid,
            accounttype
        );

        return res.status(200).send(userFound);
    } catch (error) {
        return errorResponse(res, error, context);
    }
});

//Get Account user
router.get('/api/private/users/account', (req, res, next) => {
    var context = 'GET /api/private/users/account';
    try {
        var userId = req.headers['userid'];
        var query = { _id: userId };
        const removeFields = { userIds: 0 };
        if (userId) {
            User.findOne(query, removeFields, (err, result) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }

                if (result) return res.status(200).send(result);

                return res
                    .status(404)
                    .send({
                        auth: false,
                        code: 'server_users_not_found',
                        message: 'Users not found for given parameters',
                    });
            });
        } else {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_user_required',
                    message: 'User id required!',
                });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Get favorites
router.get('/api/private/users/favorites', (req, res, next) => {
    var context = 'GET /api/private/users/favorites';
    try {
        var userId = req.headers['userid'];
        var query = {
            _id: userId,
        };
        User.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result) {
                    if (result.favorites.length === 0) {
                        var favorites = [];
                        return res.status(200).send(favorites);
                    } else {
                        var user = result;
                        var favoritesEVIO = user.favorites.filter(
                            (favorite) => {
                                if (
                                    favorite.chargerType !=
                                        process.env.ChargerTypeOCM &&
                                    favorite.chargerType !=
                                        process.env.ChargerTypeMobiE &&
                                    favorite.chargerType !=
                                        process.env.ChargerTypeTesla &&
                                    favorite.chargerType !=
                                        process.env.ChargerTypeGirebe &&
                                    favorite.chargerType !=
                                        Enums.ChargerTypes.Hubject
                                        
                                )
                                    return true;
                                else return false;
                            }
                        );

                        let favoritesPublic = user.favorites.filter(
                            (favorite) => {
                                if (
                                    favorite.chargerType ==
                                        process.env.ChargerTypeOCM ||
                                    favorite.chargerType ==
                                        process.env.ChargerTypeMobiE ||
                                    favorite.chargerType ==
                                        process.env.ChargerTypeTesla ||
                                    favorite.chargerType ==
                                        process.env.ChargerTypeGirebe ||
                                    favorite.chargerType ==
                                        Enums.ChargerTypes.Hubject
                                )
                                    return true;
                                else return false;
                            }
                        );

                        getChargersFavorites(favoritesEVIO)
                            .then((value) => {
                                let evio;
                                //console.log("value", value);
                                if (value === undefined) evio = [];
                                else evio = value;
                                if (favoritesPublic.length != 0) {
                                    getChargersPublic(favoritesPublic)
                                        .then((publicFavorites) => {
                                            evio = evio.concat(publicFavorites);
                                            return res.status(200).send(evio);
                                        })
                                        .catch((error) => {
                                            console.error(
                                                `[${context}][getChargersPublic][.catch] Error `,
                                                error.message
                                            );
                                            return res
                                                .status(500)
                                                .send(error.message);
                                        });
                                } else return res.status(200).send(evio);
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}][getChargersFavorites][.catch] Error `,
                                    error.message
                                );
                                return res.status(500).send(error.message);
                            });
                        /*
                        })
                        .catch((error) => {
                            console.error(`[${context}][getChargersType][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                        */
                    }
                } else
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_user_not_found',
                            message: 'User not found for given parameters',
                        });
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Get all users
router.get('/api/private/users/allUsers', (req, res, next) => {
    var context = 'GET /api/private/users/allUsers';
    try {
        var userId = req.headers['userid'];
        var query = {};

        User.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(result);
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Get Client list of an user b2b
router.get('/api/private/users/clientListB2B', (req, res, next) => {
    var context = 'GET /api/private/users/clientListB2B';
    try {
        let userId = req.headers['userid'];

        let query = { _id: userId };
        let fields = { clientList: 1 };

        User.findOne(query, fields, (err, result) => {
            if (err) {
                console.error(`[${context}][User.findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(result);
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

// This endpoint is being used in chargers to add operatorInfo when adding a charger
router.get('/api/private/users/byClientListUserId', (req, res, next) => {
    var context = 'GET /api/private/users/byClientListUserId';
    try {
        let userId = req.headers['userid'];
        //TODO: Review this minor detail
        // What if the user adding the charger is the user with the clientList and not in the clientList? (the operator?)
        // Shouldn't we also be adding that info? For example, Capwatt adding its own chargers? Idk ...
        var query = {
            clientList: {
                $elemMatch: {
                    userId: userId,
                    clientType: 'infrastructure',
                },
            },
        };
        User.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][User.findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result) {
                    return res.status(200).send(result);
                } else {
                    return res.status(200).send(null);
                }
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Get Users or an user by mobile phone
router.get('/api/private/users/byId', (req, res, next) => {
    var context = 'GET /api/private/users/byId';
    try {
        let query = req.query;

        let fields = {
            mobile: 1,
            internationalPrefix: 1,
            imageContent: 1,
            name: 1,
            language: 1,
            country: 1,
            clientType: 1,
            clientName: 1,
            operatorId: 1,
            paymentPeriod: 1,
        };

        User.findOne(query, fields, (err, result) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(result);
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/users/opManagement/clientList', (req, res, next) => {
    var context = 'GET /api/private/users/opManagement/clientList';
    try {
        let clientType = req.headers['client'];

        if (clientType !== 'operationsManagement' && clientType !== 'Postman') {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_not_authorized_access',
                    message:
                        'You are not authorized to access, Only operation management',
                });
        }

        let pageNumber = req.query.pageNumber;
        let query = {
            active: true,
        };

        let options = {
            skip:
                (Number(pageNumber) - 1) * Number(process.env.LimiteQueryUsers),
            limit: Number(process.env.LimiteQueryUsers),
        };

        User.find(query, {}, options, (err, listOfUsers) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (listOfUsers.length > 0) {
                    let newListOfUsers = [];

                    Promise.all(
                        listOfUsers.map((user) => {
                            user = JSON.parse(JSON.stringify(user));

                            return new Promise(async (resolve, reject) => {
                                let numberOfCards = await getNumberOfCards(
                                    user._id
                                );
                                let numberOfEVs = await getNumberOfEVs(
                                    user._id
                                );
                                let numberChargers = await getNumberChargers(
                                    user._id
                                );
                                let numberSessionMobiE =
                                    await getNumberSessionMobiE(user._id);
                                let numberOfTickets = await getNumberOfTickets(
                                    user._id
                                );

                                user.numberOfCards = numberOfCards;
                                user.numberOfEVs = numberOfEVs;
                                user.numberOfChargers =
                                    numberChargers.numberOfChargers;
                                user.numberOfSessions =
                                    numberChargers.numberOfSessions +
                                    numberSessionMobiE;
                                user.numberOfTickets = numberOfTickets;

                                newListOfUsers.push(user);
                                resolve(true);
                            });
                        })
                    )
                        .then(() => {
                            return res.status(200).send(newListOfUsers);
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                } else {
                    return res.status(200).send(listOfUsers);
                }
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/users/opManagement/searchBar', (req, res, next) => {
    var context = 'GET /api/private/users/opManagement/searchBar';
    try {
        let clientType = req.headers['client'];

        if (clientType !== 'operationsManagement' && clientType !== 'Postman') {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_not_authorized_access',
                    message:
                        'You are not authorized to access, Only operation management',
                });
        }

        let pageNumber = req.query.pageNumber;
        let searchBar = req.query.searchBar;
        let regex = new RegExp('^' + `.*${searchBar}.*`, 'i');

        let query = [
            {
                $addFields: {
                    tempUserId: { $toString: '$_id' },
                },
            },
            {
                $match: {
                    $or: [
                        { name: { $regex: regex } },
                        { email: { $regex: regex } },
                        { mobile: { $regex: regex } },
                        { tempUserId: { $regex: regex } },
                    ],
                    active: true,
                },
            },
            {
                $skip:
                    (Number(pageNumber) - 1) *
                    Number(process.env.LimiteQueryUsers),
            },
            {
                $limit: Number(process.env.LimiteQueryUsers),
            },
        ];

        User.aggregate(query, (err, listOfUsers) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (listOfUsers.length > 0) {
                    let newListOfUsers = [];

                    Promise.all(
                        listOfUsers.map((user) => {
                            user = JSON.parse(JSON.stringify(user));

                            return new Promise(async (resolve, reject) => {
                                let numberOfCards = await getNumberOfCards(
                                    user._id
                                );
                                let numberOfEVs = await getNumberOfEVs(
                                    user._id
                                );
                                let numberChargers = await getNumberChargers(
                                    user._id
                                );
                                let numberSessionMobiE =
                                    await getNumberSessionMobiE(user._id);
                                let numberOfTickets = await getNumberOfTickets(
                                    user._id
                                );

                                user.numberOfCards = numberOfCards;
                                user.numberOfEVs = numberOfEVs;
                                user.numberOfChargers =
                                    numberChargers.numberOfChargers;
                                user.numberOfSessions =
                                    numberChargers.numberOfSessions +
                                    numberSessionMobiE;
                                user.numberOfTickets = numberOfTickets;

                                newListOfUsers.push(user);
                                resolve(true);
                            });
                        })
                    )
                        .then(() => {
                            return res.status(200).send(newListOfUsers);
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                } else {
                    return res.status(200).send(listOfUsers);
                }
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/users/usersKPIs', (req, res, next) => {
    var context = 'GET /api/private/users/usersKPIs';
    try {
        User.count({ active: true }, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                //console.log("result", result);
                return res.status(200).send({ numberOfUsers: result });
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/users/userInfo', async (req, res, next) => {
    var context = 'GET /api/private/users/userInfo';
    try {
        const { userid: userId, evid: evId, idtag: idTag } = req.headers;

        let userFound = await User.findOne(
            { _id: userId },
            { clientType: 1, clientName: 1 }
        );

        let query = {
            userId,
            contractType: process.env.ContractTypeUser,
            status: 'active',
        };

        if (evId) {
            query = {
                evId,
                contractType: process.env.ContractTypeFleet,
                status: 'active',
            };
        }

        if(idTag){
            query = {
                status: 'active',
                userId,
                $or: [
                    {"networks.tokens.idTagDec": idTag},
                    {"networks.tokens.idTagHexa": idTag},
                    {"networks.tokens.idTagHexaInv": idTag}
                ]
            }
        }

        contractsFind(query)
            .then(async (contractsFound) => {
                if (contractsFound.length == 0) {
                    let response = {
                        clientType: userFound.clientType,
                        clientName: userFound.clientName,
                        planCeme: {},
                    };
                    return res.status(200).send(response);
                } else {
                    let paymentMethods = await getPaymentMethods(userId);

                    contractsFound = JSON.parse(JSON.stringify(contractsFound));
                    Promise.all(
                        contractsFound.map((contract) => {
                            return new Promise(async (resolve, reject) => {
                                var netWorkIndex = contract.networks.indexOf(
                                    contract.networks.find((netWork) => {
                                        return (
                                            netWork.name ===
                                            process.env.NetworkMobiE
                                        );
                                    })
                                );

                                if (netWorkIndex >= 0) {
                                    //console.log("contract.networks[netWorkIndex]", contract.networks[netWorkIndex]);
                                    if (
                                        contract.networks[netWorkIndex]
                                            .paymentMethod != '' &&
                                        contract.networks[netWorkIndex]
                                            .paymentMethod != undefined
                                    ) {
                                        var paymentMethodInfo =
                                            paymentMethods.find((payment) => {
                                                return (
                                                    payment.id ===
                                                    contract.networks[
                                                        netWorkIndex
                                                    ].paymentMethod
                                                );
                                            });
                                        if (paymentMethodInfo) {
                                            contract.networks[
                                                netWorkIndex
                                            ].paymentMethodInfo =
                                                paymentMethodInfo;
                                        } else {
                                            contract.networks[
                                                netWorkIndex
                                            ].paymentMethodInfo = {};
                                        }
                                    } else {
                                        contract.networks[
                                            netWorkIndex
                                        ].paymentMethodInfo = {};
                                    }
                                }

                                if (contract.tariff !== undefined) {
                                    var params = {
                                        _id: contract.tariff.planId,
                                    };

                                    let tariffInfo = await getTariffCEME(
                                        params
                                    );
                                    //let tariffRoamingInfo = await getTariffRoamingInfo(contract.tariffRoaming);
                                    let tariffRoamingInfo =
                                        await getTariffCEMERoaming(
                                            contract.tariffRoaming
                                        );
                                    contract.tariffRoamingInfo =
                                        tariffRoamingInfo;

                                    //.then((tariffInfo) => {
                                    if (Object.keys(tariffInfo).length != 0) {
                                        tariffInfo.plan.tariff =
                                            tariffInfo.plan.tariff.filter(
                                                (tariff) => {
                                                    return (
                                                        tariff.power ===
                                                        contract.tariff.power
                                                    );
                                                }
                                            );
                                        contract.tariffInfo = tariffInfo;
                                        resolve(true);
                                    } else {
                                        resolve(false);
                                    }
                                    /*})
                                    .catch((error) => {
                                        console.error(`[${context}][getTariffCEME] Error `, error.message);
                                        reject(error);
                                    });*/
                                } else {
                                    contract.tariffInfo = {};
                                    resolve(true);
                                }
                            });
                        })
                    ).then(() => {
                        contractsFound.sort((x, y) => {
                            return x.default - y.default;
                        });
                        contractsFound.reverse();

                        let response = {
                            clientType: userFound.clientType,
                            clientName: userFound.clientName,
                            planCeme: contractsFound[0].tariffInfo,
                            planRoaming: contractsFound[0].tariffRoamingInfo,
                            cardNumber: contractsFound[0].cardNumber,
                        };

                        //console.log("response", response);

                        return res.status(200).send(response);
                    });
                }
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/getUsersToNotify', (req, res, next) => {
    var context = 'GET /api/private/getUsersToNotify';
    try {
        let notificationType = req.query.notificationType;
        let toProcess = false;
        let query = {};

        if (notificationType === 'all') {
            toProcess = true;
            Object.assign(query, {});
        }

        if (notificationType === 'licenseAgreement') {
            toProcess = true;
            Object.assign(query, { licenseAgreement: true });
        }

        if (notificationType === 'licenseMarketing') {
            toProcess = true;
            Object.assign(query, { licenseMarketing: true });
        }

        if (notificationType === 'licenseServices') {
            toProcess = true;
            Object.assign(query, { licenseServices: true });
        }

        if (notificationType === 'licenseProducts') {
            toProcess = true;
            Object.assign(query, { licenseProducts: true });
        }

        if (toProcess == false) {
            return res
                .status(400)
                .send({
                    auth: true,
                    code: 'invalid_notification_type',
                    message: 'Invalid notification type',
                });
        } else {
            var fields = {
                _id: 1,
            };

            User.find(query, fields, (err, result) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                } else {
                    return res.status(200).send(result);
                }
            });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/users/getUsersToNotifyByMail', (req, res, next) => {
    var context = 'GET /api/private/users/getUsersToNotifyByMail';
    try {
        console.log(req.body);

        var fields = {
            _id: 1,
            name: 1,
            email: 1,
            clientName: 1,
        };
        let userQuery = {};
        let contractQuery = {};
        let billingPeriod = '';
        if (req.body) {
            if (req.body.userFilter) {
                userQuery = req.body.userFilter;
            }
            if (req.body.contractFilter) {
                let query = {
                    $and: [],
                };
                if (req.body.contractFilter.activeMobiE) {
                    query['$and'].push({
                        networks: {
                            $elemMatch: {
                                network: process.env.NetworkMobiE,
                                hasJoined: true,
                            },
                        },
                    });
                } else if (req.body.contractFilter.activeMobiE === false) {
                    query['$and'].push({
                        networks: {
                            $elemMatch: {
                                network: process.env.NetworkMobiE,
                                hasJoined: false,
                            },
                        },
                    });
                }

                if (req.body.contractFilter.activeGireve) {
                    query['$and'].push({
                        networks: {
                            $elemMatch: {
                                network: process.env.NetworkGireve,
                                hasJoined: true,
                            },
                        },
                    });
                } else if (req.body.contractFilter.activeGireve === false) {
                    query['$and'].push({
                        networks: {
                            $elemMatch: {
                                network: process.env.NetworkGireve,
                                hasJoined: false,
                            },
                        },
                    });
                }

                if (req.body.contractFilter.activeEvio) {
                    query['$and'].push({
                        networks: {
                            $elemMatch: {
                                network: process.env.NetworkEVIO,
                                hasJoined: true,
                            },
                        },
                    });
                } else if (req.body.contractFilter.activeEvio === false) {
                    query['$and'].push({
                        networks: {
                            $elemMatch: {
                                network: process.env.NetworkEVIO,
                                hasJoined: false,
                            },
                        },
                    });
                }

                if (query['$and'].length > 0) {
                    contractQuery = query;
                }
            }

            if (req.body.billingProfileFilter) {
                billingPeriod = req.body.billingProfileFilter.billingPeriod;
            }
        }
        console.log(userQuery);
        console.log(contractQuery);
        console.log('billingPeriod', billingPeriod);
        User.find(userQuery, fields, async (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (Object.keys(contractQuery).length === 0 && !billingPeriod) {
                    return res.status(200).send(result);
                } else {
                    let usersResult = await findUsersContracts(
                        result,
                        contractQuery,
                        billingPeriod
                    );
                    return res.status(200).send(usersResult);
                }
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Get List of Users
router.get('/api/private/users/listOfUsers', (req, res, next) => {
    const context = 'GET /api/private/users/listOfUsers';
    try {
        let query = req.query;
        // var query = listUsers;

        console.log(query);

        User.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(result);
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get(
    '/api/private/users/controlCenterClients',
    async (req, res, next) => {
        var context = 'GET /api/private/users/controlCenterClients';
        try {
            let users = await User.find(req.body, {
                _id: 1,
                imageContent: 1,
                name: 1,
                country: 1,
                clientName: 1,
                paymentPeriod: 1,
                language: 1,
                blocked: 1,
            }).lean();
            let usersWithBillingInfo = await Promise.all(
                users.map(async (user) => await joinBillingProfile(user))
            );
            return res.status(200).send(usersWithBillingInfo);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }
    }
);

router.get(
    '/api/private/users/controlCenterClientsChargers',
    async (req, res, next) => {
        var context = 'GET /api/private/users/controlCenterClientsChargers';
        try {
            let users = await User.find(req.body, {
                _id: 1,
                imageContent: 1,
                name: 1,
                blocked: 1,
            }).lean();
            return res.status(200).send(
                users.map((user) => {
                    return { ...user, userId: user._id };
                })
            );
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }
    }
);

router.get('/api/private/users/landingPage', async (req, res, next) => {
    var context = 'GET /api/private/users/landingPage';
    try {
        var userId = req.headers['userid'];
        var query;

        var userFound;
        var myContracts = [];
        var contractsFleets = [];
        var CEMETariff = [];

        var paymentMethods = await getPaymentMethods(userId);

        var userAccountPromise = new Promise((resolve, reject) => {
            User.findOne({ _id: userId }, (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    userFound = {};
                    resolve({});
                }
                userFound = result;
                resolve(true);
            });
        });

        var myContractsPromise = new Promise(async (resolve, reject) => {
            let isB2C;
            if (
                await User.findOne({
                    _id: userId,
                    clientType: process.env.ClientTypeb2c,
                })
            )
                isB2C = true;
            else isB2C = false;
            //console.log("isB2C",
            var query;
            if (req.query.contractType) {
                if (req.query.contractType === process.env.ContractTypeUser) {
                    query = {
                        userId: userId,
                        contractType: process.env.ContractTypeUser,
                        active: true,
                    };
                } else {
                    if (
                        req.query.contractType === process.env.ContractTypeFleet
                    ) {
                        query = {
                            userId: userId,
                            contractType: process.env.ContractTypeFleet,
                            active: true,
                        };
                    }
                }
            } else {
                query = {
                    userId: userId,
                    $or: [
                        { contractType: process.env.ContractTypeUser }
                    ],
                    active: true,
                };
            }

            Contract.find(query, async (err, contractsFound) => {
                if (err) {
                    console.error(`[${context}][find] Error `, err.message);
                    myContracts = [];
                    resolve([]);
                } else {
                    if (contractsFound.length == 0) {
                        myContracts = [];
                        resolve([]);
                    } else {
                        var host =
                            process.env.HostTariffCEME +
                            process.env.PathTariffCEMELandingPage;

                        var data = {
                            contractsFound: contractsFound,
                            paymentMethods: paymentMethods,
                        };

                        axios
                            .get(host, { data })
                            .then((response) => {
                                var contracts = response.data;
                                contracts.sort((x, y) => {
                                    return x.default - y.default;
                                });
                                contracts.reverse();

                                myContracts = contracts;
                                resolve(contracts);
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}] Error `,
                                    error.message
                                );
                                myContracts = [];
                                resolve([]);
                            });
                        /*contractsFound = JSON.parse(JSON.stringify(contractsFound));

                        Promise.all(
                            contractsFound.map(contract => {
                                return new Promise(async (resolve, reject) => {

                                    var netWorkIndex = contract.networks.indexOf(contract.networks.find(netWork => {
                                        return netWork.network === process.env.NetworkMobiE;
                                    }));

                                    if (netWorkIndex >= 0) {

                                        if (contract.networks[netWorkIndex].paymentMethod != "" && contract.networks[netWorkIndex].paymentMethod != undefined) {

                                            var paymentMethodInfo = paymentMethods.find(payment => {
                                                return payment.id === contract.networks[netWorkIndex].paymentMethod;
                                            });
                                            if (paymentMethodInfo) {
                                                contract.networks[netWorkIndex].paymentMethodInfo = paymentMethodInfo;
                                            }
                                            else {
                                                contract.networks[netWorkIndex].paymentMethodInfo = {};
                                            };
                                        }
                                        else {
                                            contract.networks[netWorkIndex].paymentMethodInfo = {};
                                        };


                                    };

                                    if (contract.tariff !== undefined) {
                                        var params = {
                                            _id: contract.tariff.planId
                                        };

                                        let tariffInfo = await getTariffCEME(params);
                                        let tariffRoamingInfo = await getTariffCEMERoaming(contract.tariffRoaming);
                                        contract.tariffRoamingInfo = tariffRoamingInfo;
                                        if (Object.keys(tariffInfo).length != 0) {
                                            tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                                return tariff.power === contract.tariff.power
                                            });
                                            contract.tariffInfo = tariffInfo;
                                            resolve(true);
                                        }
                                        else {
                                            resolve(false);
                                        };
                                    }
                                    else {
                                        contract.tariffInfo = {};
                                        resolve(true);
                                    }

                                });
                            })
                        ).then(() => {

                            contractsFound.sort((x, y) => { return x.default - y.default });
                            contractsFound.reverse();

                            myContracts = contractsFound;
                            resolve(contractsFound);

                        });*/
                    }
                }
            });
        });

        var contractsFleetsPromise = new Promise((resolve, reject) => {
            if (req.query.evsId) {
                if (req.query.evsId.length > 0) {
                    query = {
                        evId: req.query.evsId,
                        active: true,
                    };

                    Contract.find(query, async (err, contractsFound) => {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);
                            contractsFleets = [];
                            resolve([]);
                        } else {
                            var host =
                                process.env.HostTariffCEME +
                                process.env.PathTariffCEMELandingPage;

                            var data = {
                                contractsFound: contractsFound,
                                paymentMethods: paymentMethods,
                            };

                            axios
                                .get(host, { data })
                                .then((response) => {
                                    var contracts = response.data;
                                    contracts.sort((x, y) => {
                                        return x.default - y.default;
                                    });
                                    contracts.reverse();

                                    contractsFleets = contracts;
                                    resolve(contracts);
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}] Error `,
                                        error.message
                                    );
                                    contractsFleets = [];
                                    resolve([]);
                                });

                            /*
                            contractsFound = JSON.parse(JSON.stringify(contractsFound));
                            Promise.all(
                                contractsFound.map(contract => {
                                    return new Promise(async (resolve, reject) => {

                                        contract = JSON.parse(JSON.stringify(contract));

                                        var netWorkIndex = contract.networks.indexOf(contract.networks.find(netWork => {
                                            return netWork.network === process.env.NetworkMobiE;
                                        }));

                                        if (netWorkIndex >= 0) {

                                            //console.log("contract.networks[netWorkIndex]", contract.networks[netWorkIndex]);
                                            if (contract.networks[netWorkIndex].paymentMethod != "" && contract.networks[netWorkIndex].paymentMethod != undefined) {

                                                var paymentMethodInfo = paymentMethods.find(payment => {
                                                    return payment.id === contract.networks[netWorkIndex].paymentMethod;
                                                });
                                                if (paymentMethodInfo) {
                                                    contract.networks[netWorkIndex].paymentMethodInfo = paymentMethodInfo;
                                                }
                                                else {
                                                    contract.networks[netWorkIndex].paymentMethodInfo = {};
                                                };
                                            }
                                            else {
                                                contract.networks[netWorkIndex].paymentMethodInfo = {};
                                            };


                                        };

                                        //console.log("contract", contract);

                                        if (Object.keys(contract.tariff).length != 0) {
                                            var params = {
                                                _id: contract.tariff.planId
                                            };

                                            let tariffInfo = await getTariffCEME(params);
                                            let tariffRoamingInfo = await getTariffCEMERoaming(contract.tariffRoaming);
                                            contract.tariffRoamingInfo = tariffRoamingInfo;

                                            //console.log("tariffInfo", tariffInfo);
                                            if (Object.keys(tariffInfo).length != 0) {
                                                tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                                    return tariff.power === contract.tariff.power
                                                });
                                                contract.tariffInfo = tariffInfo;
                                                resolve(true);
                                            }
                                            else {
                                                resolve(false);
                                            };
                                        }
                                        else {
                                            contract.tariffInfo = {};
                                            resolve(true);
                                        }
                                    });
                                })
                            ).then(() => {
                                contractsFound.sort((x, y) => { return x.default - y.default });
                                contractsFound.reverse();

                                contractsFleets = contractsFound;
                                resolve(contractsFound);

                            });
                            */
                        }
                    });
                } else {
                    contractsFleets = [];
                    resolve([]);
                }
            } else {
                contractsFleets = [];
                resolve([]);
            }
        });

        var CEMETariffPromise = new Promise((resolve, reject) => {
            var query = {
                userId: userId,
                active: true,
                CEME: 'EVIO',
            };

            cemeTariffFind(query)
                .then((cemeTariffFound) => {
                    if (cemeTariffFound.length == 0) {
                        CEMETariff = cemeTariffFound;
                        resolve([]);
                    } else {
                        cemeTariffFound = JSON.parse(
                            JSON.stringify(cemeTariffFound)
                        );
                        Promise.all(
                            cemeTariffFound.map((cemeTariff) => {
                                return new Promise((resolve, reject) => {
                                    cemeTariff.cards = cemeTariff.cards.filter(
                                        (card) => {
                                            return card.active == true;
                                        }
                                    );
                                    if (cemeTariff.tariff !== undefined) {
                                        var params = {
                                            _id: cemeTariff.tariff.planId,
                                        };
                                        getTariffCEME(params)
                                            .then((tariffInfo) => {
                                                if (
                                                    Object.keys(tariffInfo)
                                                        .length != 0
                                                ) {
                                                    tariffInfo.plan.tariff =
                                                        tariffInfo.plan.tariff.filter(
                                                            (tariff) => {
                                                                return (
                                                                    tariff.power ===
                                                                    cemeTariff
                                                                        .tariff
                                                                        .power
                                                                );
                                                            }
                                                        );
                                                    cemeTariff.tariffInfo =
                                                        tariffInfo;
                                                    resolve(true);
                                                } else {
                                                    resolve(false);
                                                }
                                            })
                                            .catch((error) => {
                                                console.error(
                                                    `[${context}][getTariffCEME] Error `,
                                                    error.message
                                                );
                                                reject(error);
                                            });
                                    } else {
                                        cemeTariff.tariffInfo = {};
                                        resolve(true);
                                    }
                                });
                            })
                        ).then(() => {
                            cemeTariffFound.sort((x, y) => {
                                return x.default - y.default;
                            });
                            cemeTariffFound.reverse();
                            CEMETariff = cemeTariffFound;
                            resolve(cemeTariffFound);
                        });
                    }
                })
                .catch((error) => {
                    console.error(
                        `[${context}][cemeTariffFind] Error `,
                        error.message
                    );
                    CEMETariff = [];
                    resolve([]);
                });
        });

        Promise.all([
            userAccountPromise,
            myContractsPromise,
            contractsFleetsPromise,
            CEMETariffPromise,
        ])
            .then(() => {
                var response = {
                    userAccount: userFound,
                    myContracts: myContracts,
                    contractsFleets: contractsFleets,
                    CEMETariff: CEMETariff,
                };

                return res.status(200).send(response);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);

                var response = {
                    userAccount: {},
                    myContracts: [],
                    contractsFleets: [],
                    CEMETariff: [],
                };
                return res.status(200).send(response);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        var response = {
            userAccount: {},
            myContracts: [],
            contractsFleets: [],
            CEMETariff: [],
        };
        return res.status(200).send(response);
    }
});

router.get('/api/private/users/paymentPeriodByUser', (req, res, next) => {
    var context = 'GET /api/private/users/paymentPeriodByUser';
    try {
        let userId = req.headers['userid'];

        User.findOne(
            { _id: userId },
            { _id: 1, paymentPeriod: 1 },
            (err, userFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }

                return res.status(200).send(userFound);
            }
        );
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/users/paymentPeriodsMaping', (req, res, next) => {
    var context = 'GET /api/private/users/paymentPeriodsMaping';
    try {
        return res.status(200).send(PaymentPeriods);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/users/paymentPeriods', (req, res, next) => {
    var context = 'GET /api/private/users/paymentPeriods';
    try {
        let query = req.body;

        //console.log("query", query);

        User.find(query, { _id: 1, paymentPeriod: 1 }, (err, usersFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(usersFound);
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/users/allInfoById', async (req, res, next) => {
    var context = 'GET /api/private/users/allInfoById';
    try {
        let { userId, userIdWillPay, userIdToBilling } = req.query;

        let fields = {
            mobile: 1,
            internationalPrefix: 1,
            imageContent: 1,
            name: 1,
            language: 1,
            country: 1,
            clientType: 1,
            clientName: 1,
            operatorId: 1,
            paymentPeriod: 1,
        };

        const query = {
            _id: { $in: [userId, userIdWillPay, userIdToBilling] },
        };
        const result = await User.find(query, fields).lean();

        if (result.length > 0) {
            const response = {
                userIdInfo: result.find((elem) => String(elem._id) === userId),
                userIdWillPayInfo: result.find(
                    (elem) => String(elem._id) === userIdWillPay
                ),
                userIdToBillingInfo: result.find(
                    (elem) => String(elem._id) === userIdToBilling
                ),
            };
            return res.status(200).send(response);
        } else {
            return res.status(200).send({});
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//========== POST ==========
//Post for get details from users
router.post('/api/private/users/details', (req, res, next) => {
    var context = 'POST /api/private/users/details';
    try {
        if (
            Object.entries(req.body).length === 0 &&
            req.body.constructor === Object
        )
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_users_not_found',
                    message: 'Users not found for given parameters',
                });
        else {
            var query = Object.values(req.body);
            const linkFunction = async (item) => {
                return await getDetails(item);
            };

            const getData = async () => {
                return await Promise.all(
                    query.map((item) => linkFunction(item))
                );
            };

            getData()
                .then((value) => {
                    if (value) return res.status(200).send(value);
                    else
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_users_not_found',
                                message: 'Users not found for given parameters',
                            });
                })
                .catch((err) => {
                    console.error(
                        `[${context}][getData][.catch] Error `,
                        err.message
                    );
                    return res.status(500).send(err.message);
                });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.post(
    '/api/private/users/wl',
    isDisposableEmail,
    advancedAccountLimiterMiddleware,
    async (req, res, next) => {
        const context = 'POST /api/private/users/wl';

        try {
            const user = new User(req.body);
            let headers = req.headers;
            let  {clientname: clientName, language} = headers;
            
            let userPackage = {
                packageName: process.env.PackageNameFree,
                packageType: process.env.PackageTypeFree,
                rfidCardsLimit: 1,
                fleetsLimit: 1,
                evsLimit: 3,
                driversLimit: 1,
                groupOfDriversLimit: 1,
                driversInGroupDriversLimit: 1,
                chargingAreasLimit: 0,
                evioBoxLimit: 0,
                chargersLimit: 0,
                tariffsLimit: 0,
                chargersGroupsLimit: 0,
                userInChargerGroupsLimit: 0,
                searchLocationsLimit: 'UNLIMITED',
                searchChargersLimit: 'UNLIMITED',
                comparatorLimit: 'UNLIMITED',
                routerLimit: 'UNLIMITED',
                cardAssociationEnabled: false,
                billingTariffEnabled: false,
            };

            user.userPackage = userPackage;
            user.clientName = clientName;

            // Get the app config
            const appConfig = await AppConfigurationService.getAppConfiguration(user.clientName);

            if (!appConfig) {
                throw { auth: false, code: 'app_config_not_found', message: 'AppConfigurations not found' };
            }

            //set language preference
            user.language = await setLanguageUser(user, appConfig, language); 

            const { licenseServiceEnabled, licenseProductEnabled, licenseMarketingEnabled, unsubscribedLink } = appConfig.marketingAndPromotionNotifications;
            
            if (!licenseServiceEnabled) user.licenseServices = false;
            if (!licenseProductEnabled) user.licenseProducts = false;
            if (!licenseMarketingEnabled) user.licenseMarketing = false;
            
            if (licenseProductEnabled || licenseServiceEnabled || licenseMarketingEnabled) {
                user.unsubscribedLink = User.getUnsubscribedLink(user._id, user.clientName, unsubscribedLink);
            }

            if (clientName === process.env.clientNameKinto) {
                user.active = true;
            }

            if (req.body.imageContent === undefined) {
                user.imageContent = '';
            }

            
            if (clientName === process.env.clientNameEVIO) {
                validateFields(user)
                    .then(() => {
                        if (user.imageContent !== '') {
                            saveImageContent(user)
                                .then((value) => {
                                    addUserWlEVIO(value, res, headers);
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][saveImageContent][.catch] Error `,
                                        error.message
                                    );
                                    return res.status(500).send(error.message);
                                });
                        } else {
                            addUserWlEVIO(user, res, headers);
                        }
                    })
                    .catch((error) => {
                        if (error.auth === false) {
                            console.error(`[${context}] Error `, error);
                            return res.status(400).send(error);
                        }
                        else {
                            console.error(`[${context}] Error `, error);
                            return res.status(500).send(error.message);
                        }
                    });
            } else if (process.env.clientNameLoginMobile.includes(clientName)) {
                validateFields(user)
                    .then(() => {
                        if (user.imageContent !== '') {
                            saveImageContent(user)
                                .then((value) => {
                                    addUserWlLoginMobile(value, res, headers);
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][saveImageContent][.catch] Error `,
                                        error.message
                                    );
                                    return res.status(500).send(error.message);
                                });
                        } else {
                            addUserWlLoginMobile(user, res, headers);
                        }
                    })
                    .catch((error) => {
                        if (error.auth === false) {
                            console.error(`[${context}] Error `, error);
                            return res.status(400).send(error);
                        }
                        else {
                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);
                        }
                    });
            } else {
                validateFieldsWL(user)
                    .then(() => {
                        if (user.imageContent !== '') {
                            saveImageContent(user)
                                .then((value) => {
                                    addUserWl(value, res, headers);
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][saveImageContent][.catch] Error `,
                                        error.message
                                    );
                                    return res.status(500).send(error.message);
                                });
                        } else {
                            addUserWl(user, res, headers);
                        }
                    })
                    .catch((error) => {
                        console.error(`[${context}] Error `, error);
                        return res.status(400).send(error);
                    });
            }
        } catch (error) {
            console.error(`[${context}] Error `, error);
            return res.status(500).send(error.message);
        }
    }
);

//Create User company
router.post('/api/private/users/company', async (req, res, next) => {
    const context = 'POST /api/private/users/company';
    try {
        const user = new User(req.body);
        let headers = req.headers;
        let  {clientname: clientName, language} = headers;

        let userPackage = {
            packageName: process.env.PackageNameFree,
            packageType: process.env.PackageTypeFree,
            rfidCardsLimit: 1,
            fleetsLimit: 100,
            evsLimit: 500,
            driversLimit: 500,
            groupOfDriversLimit: 500,
            driversInGroupDriversLimit: 500,
            chargingAreasLimit: 25,
            evioBoxLimit: 25,
            chargersLimit: 500,
            tariffsLimit: 500,
            chargersGroupsLimit: 100,
            userInChargerGroupsLimit: 500,
            searchLocationsLimit: 'UNLIMITED',
            searchChargersLimit: 'UNLIMITED',
            comparatorLimit: 'UNLIMITED',
            routerLimit: 'UNLIMITED',
            cardAssociationEnabled: false,
            billingTariffEnabled: false,
            mileageEntryEnabled: true
        };

        user.userPackage = userPackage;
        user.clientType = process.env.ClientTypeB2B;
        //When user are B2B
        user.active = true;
        user.language = user.language ? user.language : 'pt';
        user.licenseAgreement = true;
        user.licenseMarketing = true;
        user.licenseServices = true;
        user.licenseProducts = true;
        user.validated = true;
        //user.paymentPeriod = process.env.PaymentPeriodMonthly;
        user.evioCommission = {
            minAmount: {
                uom: 'un',
                value: 0,
            },
            transaction: {
                uom: 'percentage',
                value: 0,
            },
        };
        user.clientName = clientName;
        user.userType = process.env.UserTypeCompany;

        // Get the app config
        const appConfig = await AppConfigurationService.getAppConfiguration(user.clientName);

        if (!appConfig) {
            throw { auth: false, code: 'app_config_not_found', message: 'AppConfigurations not found' };
        }

        //set language preference
        user.language = setLanguageUser(user, appConfig, language);  

        const { licenseServiceEnabled, licenseProductEnabled, licenseMarketingEnabled, unsubscribedLink } = appConfig.marketingAndPromotionNotifications;
        
        if (!licenseServiceEnabled) user.licenseServices = false;
        if (!licenseProductEnabled) user.licenseProducts = false;
        if (!licenseMarketingEnabled) user.licenseMarketing = false;
        
        if (licenseProductEnabled || licenseServiceEnabled || licenseMarketingEnabled) {
            user.unsubscribedLink = User.getUnsubscribedLink(user._id, user.clientName, unsubscribedLink);
        }
        
        //user.accessType = process.env.AccessTypeAll;
        console.log('clientName', clientName);

        if (req.body.imageContent === undefined) {
            user.imageContent = '';
        }

        validateFieldsCompany(user)
            .then(() => {
                if (user.imageContent !== '') {
                    saveImageContent(user)
                        .then((value) => {
                            if (clientName === 'EVIO')
                                addUser(value, res, headers);
                            else addUserWl(value, res, headers);
                        })
                        .catch((error) => {
                            console.error(
                                `[${context}][saveImageContent][.catch] Error `,
                                error.message
                            );
                            return res.status(500).send(error.message);
                        });
                } else {
                    if (clientName === 'EVIO') addUser(user, res, headers);
                    else addUserWl(user, res, headers);
                }
            })
            .catch((error) => {
                return res.status(400).send(error);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.post('/api/private/users/createWallet', (req, res, next) => {
    var context = 'POST /api/private/users/createWallet';
    try {
        var query = { active: true };

        User.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                Promise.all(
                    result.map((user) => {
                        return new Promise((resolve, reject) => {
                            var host =
                                process.env.HostPayments +
                                process.env.PathWallet;
                            var data = {
                                userId: user._id,
                            };
                            axios
                                .post(host, data)
                                .then((result) => {
                                    if (result.data) {
                                        console.log(
                                            `[${context}] Wallet created`
                                        );
                                        reject(false);
                                    } else {
                                        console.log(
                                            `[${context}] Wallet not created`
                                        );
                                        resolve(true);
                                    }
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][.catch] Error `,
                                        error.message
                                    );
                                    reject(false);
                                });
                        });
                    })
                )
                    .then(() => {
                        return res.status(200).send('OK');
                    })
                    .catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.post('/api/private/users/runFirstTime', async (req, res, next) => {
    const context = 'POST /api/private/users/runFirstTime';
    try {
        //addUserPackageb2c();
        //addUserPackageb2b();
        //runFirstTime();
        //activeNeedChangePassword();
        //addEvioCommission();
        //addTypeReferencePlaces();
        //changePackagesLimitsB2BClients();
        //verifyContract();
        //addPaymentTypeB2B();
        //validateUser();
        //addClientNameUser();
        //addClientNameGuestUsers();
        //addClientName()
        //addStatusUser()
        //validateDependencies()
        //activeNetworksb2c();
        //activeNetworksB2C()
        //trimCardNumberACP();
        // updateAddressModel();
        //await UserHandler.addMileageEntryEnabledNewField();
        await addEnergyManagementEnabled();

        return res.status(200).send('OK');
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Job User Id Go Schedule
router.post('/api/private/users/job/userIdGoSchedule/startJob', (req, res) => {
    const context = 'POST /api/private/users/job/userIdGoSchedule/startJob';
    const timer = '*/1 * * * *';

    if (req.body.timer) timer = req.body.timer;

    initUserIdGoSchedule(timer)
        .then(() => {
            taskUserIdGoSchedule.start();
            console.log('User Id Go Schedule Job Started');
            return res.status(200).send('User Id Go Schedule Job Started');
        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.post('/api/private/users/job/userIdGoSchedule/stopJob', (req, res) => {
    const context = 'POST /api/private/users/job/userIdGoSchedule/stopJob';

    taskUserIdGoSchedule.stop();
    console.log('User Id Go Schedule Job  Stopped');
    return res.status(200).send('User Id Go Schedule Job  Stopped');
});

router.post('/api/private/users/job/userIdGoSchedule/statusJob', (req, res) => {
    const context = 'POST /api/private/users/job/userIdGoSchedule/statusJob';

    const status = 'Stopped';
    if (taskUserIdGoSchedule != undefined) {
        status = taskUserIdGoSchedule.status;
    }

    return res.status(200).send({ 'User Id Go Schedule Job  Status': status });
});

router.post('/api/private/users/job/userIdGoSchedule/forceRun', (req, res) => {
    const context = 'POST /api/private/users/job/userIdGoSchedule/forceRun';

    userIdGoSchedule();

    console.log('User Id Go Schedule Job was executed');
    return res.status(200).send('Charging Schedule Job was executed');
});

//========== PATCH ==========
//edit an user
router.patch('/api/private/users', async (req, res, next) => {
    let context = 'PATCH /api/private/users';
    try {
        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];
        let user = req.body;
        let clientType = req.headers['client'];
        let controlCenter = req.headers['controlcenter'];

        //console.log("user", user);

        let query = {
            _id: userId,
            clientName: clientName,
        };

        if (user.devUser != undefined) {
            delete user.devUser;
        }

        if (user.userPackage != undefined) {
            delete user.userPackage;
        }

        if (user.evioCommission != undefined) {
            delete user.evioCommission;
        }

        if (user.paymentPeriod && !controlCenter) {
            delete user.paymentPeriod;
        }

        User.findOne(query, (err, userFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }

            user._id = userId;

            if (clientType === 'BackOffice') {
                startUpdateUserOld(
                    user,
                    query,
                    res,
                    userId,
                    clientName,
                    clientType
                );
            } else {
                if (user.imageContent.includes('base64')) {
                    //console.log("user.imageContent", user.imageContent)

                    if (!userFound.imageContent) {
                        saveImageContent(user)
                            .then((user) => {
                                startUpdateUserOld(
                                    user,
                                    query,
                                    res,
                                    userId,
                                    clientName,
                                    clientType
                                );
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}][saveImageContent][.catch] Error `,
                                    error.message
                                );
                                return res.status(500).send(error.message);
                            });
                    } else {
                        removeImageContent(userFound)
                            .then((result) => {
                                saveImageContent(user)
                                    .then((user) => {
                                        startUpdateUserOld(
                                            user,
                                            query,
                                            res,
                                            userId,
                                            clientName,
                                            clientType
                                        );
                                    })
                                    .catch((error) => {
                                        console.error(
                                            `[${context}][saveImageContent][.catch] Error `,
                                            error.message
                                        );
                                        return res
                                            .status(500)
                                            .send(error.message);
                                    });
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}][removeImageContent][.catch] Error `,
                                    error.message
                                );
                                return res.status(500).send(error.message);
                            });
                    }
                } else if (user.imageContent == '') {
                    user._id = userId;

                    if (userFound) {
                        if (!userFound.imageContent) {
                            startUpdateUserOld(
                                user,
                                query,
                                res,
                                userId,
                                clientName,
                                clientType
                            );
                        } else {
                            removeImageContent(userFound)
                                .then((values) => {
                                    startUpdateUserOld(
                                        user,
                                        query,
                                        res,
                                        userId,
                                        clientName,
                                        clientType
                                    );
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][removeImageContent][.catch] Error `,
                                        error.message
                                    );
                                    return res.status(500).send(error.message);
                                });
                        }
                    } else
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_users_not_found',
                                message: 'Users not found for given parameters',
                            });
                } else {
                    console.log('user.imageContent', user.imageContent);

                    startUpdateUserOld(
                        user,
                        query,
                        res,
                        userId,
                        clientName,
                        clientType
                    );
                }
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.patch('/api/private/users/v2', async (req, res, next) => {
    var context = 'PATCH /api/private/users/v2';
    try {
        var userId = req.headers['userid'];
        var clientName = req.headers['clientname'];
        var user = req.body;
        var clientType = req.headers['client'];

        //console.log("user", user);

        var query = {
            _id: userId,
            clientName: clientName,
        };

        if (user.devUser != undefined) {
            delete user.devUser;
        }

        if (user.userPackage != undefined) {
            delete user.userPackage;
        }

        if (user.evioCommission != undefined) {
            delete user.evioCommission;
        }

        if (user.paymentPeriod) {
            delete user.paymentPeriod;
        }

        User.findOne(query, async (err, userFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }

            const userEmail = user?.email || userFound.email;
            user.language = userFound.language;

            const { auth, code, message, status } =
                await UserService.handleIsDisposableEmail(userEmail);

            if (!auth) {
                return res.status(status).send({
                    auth,
                    code,
                    message,
                });
            }

            user._id = userId;

            if (clientType === 'BackOffice') {
                startUpdateUser(
                    user,
                    query,
                    res,
                    userId,
                    clientName,
                    clientType
                );
            } else {
                if (user.imageContent.includes('base64')) {
                    //console.log("user.imageContent", user.imageContent)

                    if (!userFound.imageContent) {
                        saveImageContent(user)
                            .then((user) => {
                                startUpdateUser(
                                    user,
                                    query,
                                    res,
                                    userId,
                                    clientName,
                                    clientType
                                );
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}][saveImageContent][.catch] Error `,
                                    error.message
                                );
                                return res.status(500).send(error.message);
                            });
                    } else {
                        removeImageContent(userFound)
                            .then((result) => {
                                saveImageContent(user)
                                    .then((user) => {
                                        startUpdateUser(
                                            user,
                                            query,
                                            res,
                                            userId,
                                            clientName,
                                            clientType
                                        );
                                    })
                                    .catch((error) => {
                                        console.error(
                                            `[${context}][saveImageContent][.catch] Error `,
                                            error.message
                                        );
                                        return res
                                            .status(500)
                                            .send(error.message);
                                    });
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}][removeImageContent][.catch] Error `,
                                    error.message
                                );
                                return res.status(500).send(error.message);
                            });
                    }
                } else if (user.imageContent == '') {
                    user._id = userId;

                    if (userFound) {
                        if (!userFound.imageContent) {
                            startUpdateUser(
                                user,
                                query,
                                res,
                                userId,
                                clientName,
                                clientType
                            );
                        } else {
                            removeImageContent(userFound)
                                .then((values) => {
                                    startUpdateUser(
                                        user,
                                        query,
                                        res,
                                        userId,
                                        clientName,
                                        clientType
                                    );
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][removeImageContent][.catch] Error `,
                                        error.message
                                    );
                                    return res.status(500).send(error.message);
                                });
                        }
                    } else
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_users_not_found',
                                message: 'Users not found for given parameters',
                            });
                } else {
                    console.log('user.imageContent', user.imageContent);

                    startUpdateUser(
                        user,
                        query,
                        res,
                        userId,
                        clientName,
                        clientType
                    );
                }
            }
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return res.status(500).send(error.message);
    }
});

router.patch('/api/private/users/backOffice', async (req, res, next) => {
    const context = 'PATCH /api/private/users/backOffice';

    let userId = req.headers['userid'];
    let requestUserId = req.headers['requestuserid'];
    let accountType = req.headers['accounttype'];
    let clientName = req.headers['clientname'];

    let user = req.body;
    let query;

    let token = req.headers.token;

    if (user.devUser != undefined) {
        delete user.devUser;
    }

    if (user.userPackage != undefined) {
        delete user.userPackage;
    }

    if (user.evioCommission != undefined) {
        delete user.evioCommission;
    }

    if (!user.name) {
        return res
            .status(400)
            .send({
                auth: false,
                code: 'server_name_required',
                message: 'Name is required',
            });
    }

    if (!user.email) {
        return res
            .status(400)
            .send({
                auth: false,
                code: 'server_email_required',
                message: 'Email is required',
            });
    }

    if (accountType === process.env.AccountTypeGuest) {
        //console.log("mobile", user.mobile);
        if (user.mobile !== '-') {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_not_authorized_mobile',
                    message: 'Not authorized to change mobile',
                });
        } else {
            query = {
                _id: requestUserId,
            };

            GuestUsers.findOne(query, async (err, guestUserFound) => {
                if (err) {
                    console.error(
                        `[${context}][GuestUsers.findOne] Error `,
                        err.message
                    );
                    return res.status(500).send(err.message);
                } else {
                    if (guestUserFound) {
                        var guestUserToUpdate;
                        if (
                            user.name === guestUserFound.name &&
                            user.email === guestUserFound.email
                        ) {
                            if (clientName == process.env.clientNameHyundai)
                                updateUserHyundai(userId);

                            return res
                                .status(200)
                                .send({
                                    auth: true,
                                    code: 'server_user_updated',
                                    message: 'User updated',
                                });
                        } else if (
                            user.name !== guestUserFound.name &&
                            user.email === guestUserFound.email
                        ) {
                            console.log(`[${context}] Change only name`);

                            try {
                                await GuestUsers.findOneAndUpdate(
                                    { _id: guestUserFound._id },
                                    { $set: { name: user.name } }
                                );

                                if (clientName == process.env.clientNameHyundai) {
                                    updateUserHyundai(userId);
                                }

                                return res
                                    .status(200)
                                    .send({
                                        auth: true,
                                        code: 'server_user_updated',
                                        message: 'User updated',
                                    });

                            } catch (error) {
                                return res
                                    .status(400)
                                    .send({
                                        auth: false,
                                        code: 'server_user_not_updated',
                                        message: 'User not updated',
                                    });
                            }

                        } else if (
                            user.name === guestUserFound.name &&
                            user.email !== guestUserFound.email
                        ) {
                            console.log(`[${context}] Only Email`);

                            let userFound = await User.findOne({
                                email: user.email,
                                active: true,
                            });

                            let guestFound = await GuestUsers.findOne({
                                email: user.email,
                                active: true,
                            });

                            if (!userFound && !guestFound) {
                                guestUserToUpdate = {
                                    _id: guestUserFound._id,
                                    name: guestUserFound.name,
                                    email: user.email,
                                };
                                
                                try {
                                    await GuestUsers.findOneAndUpdate(
                                        { _id: guestUserFound._id },
                                        {
                                            $set: {
                                                name: user.name,
                                                email: user.email,
                                            },
                                        }
                                    );

                                    if (clientName == process.env.clientNameHyundai) {
                                        updateUserHyundai(userId);
                                    }
                                    
                                    return res
                                        .status(200)
                                        .send({
                                            auth: true,
                                            code: 'server_user_updated',
                                            message: 'User updated',
                                        });
                                } catch (error) {
                                    Sentry.captureException(error);

                                    return res
                                        .status(400)
                                        .send({
                                            auth: false,
                                            code: 'server_user_not_updated',
                                            message: 'User not updated',
                                        });
                                }

                            } else {
                                if (userFound) {
                                    return res
                                        .status(400)
                                        .send({
                                            auth: false,
                                            code: 'server_email_use_users',
                                            message:
                                                'Email is already registered as an user',
                                        });
                                } else if (guestFound) {
                                    return res
                                        .status(400)
                                        .send({
                                            auth: false,
                                            code: 'server_email_use_guesUsers',
                                            message:
                                                'Email is already registered as an guest user',
                                        });
                                } else {
                                    return res
                                        .status(400)
                                        .send({
                                            auth: false,
                                            code: 'server_email_taken',
                                            message:
                                                'Email ' +
                                                guestUser.email +
                                                ' is already registered',
                                        });
                                }
                            }
                        } else {
                            console.log(`[${context}] Change name and email`);

                            let userFound = await User.findOne({
                                email: user.email,
                                active: true,
                                _id: { $ne: userId },
                            });

                            let guestFound = await GuestUsers.findOne({
                                email: user.email,
                                active: true,
                            });

                            if (!userFound && !guestFound) {
                                guestUserToUpdate = {
                                    _id: guestUserFound._id,
                                    name: user.name,
                                    email: user.email,
                                };

                                try {

                                    await GuestUsers.findOneAndUpdate(
                                        { _id: guestUserFound._id },
                                        {
                                            $set: {
                                                name: user.name,
                                                email: user.email,
                                            },
                                        }
                                    );

                                    if (clientName == process.env.clientNameHyundai) {
                                        updateUserHyundai(userId);
                                    }

                                    return res
                                        .status(200)
                                        .send({
                                            auth: true,
                                            code: 'server_user_updated',
                                            message: 'User updated',
                                        });

                                } catch (error) {
                                    Sentry.captureException(error);

                                    return res
                                        .status(400)
                                        .send({
                                            auth: false,
                                            code: 'server_user_not_updated',
                                            message: 'User not updated',
                                        });
                                }

                            } else {
                                if (userFound) {
                                    return res
                                        .status(400)
                                        .send({
                                            auth: false,
                                            code: 'server_email_use_users',
                                            message:
                                                'Email is already registered as an user',
                                        });
                                } else if (guestFound) {
                                    return res
                                        .status(400)
                                        .send({
                                            auth: false,
                                            code: 'server_email_use_guesUsers',
                                            message:
                                                'Email is already registered as an guest user',
                                        });
                                } else {
                                    return res
                                        .status(400)
                                        .send({
                                            auth: false,
                                            code: 'server_email_taken',
                                            message:
                                                'Email ' +
                                                guestUser.email +
                                                ' is already registered',
                                        });
                                }
                            }
                        }
                    } else {
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_users_not_found',
                                message: 'Users not found for given parameters',
                            });
                    }
                }
            });
        }
    } else {
        query = {
            _id: userId,
            clientType: process.env.ClientTypeb2b,
            clientName: clientName,
        };

        if (!user.mobile) {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_mobile_required',
                    message: 'Mobile phone is required',
                });
        }

        if (!user.internationalPrefix) {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_international_prefix_required',
                    message: 'International mobile prefix is required',
                });
        }

        User.findOne(query, async (err, userFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (userFound) {
                    var userToUpdate;

                    if (
                        user.name === userFound.name &&
                        user.email === userFound.email &&
                        user.mobile === userFound.mobile &&
                        user.internationalPrefix ===
                            userFound.internationalPrefix
                    ) {
                        if (clientName == process.env.clientNameHyundai)
                            updateUserHyundai(userId);

                        return res
                            .status(200)
                            .send({
                                auth: true,
                                code: 'server_user_updated',
                                message: 'User updated',
                            });
                    } else if (
                        user.name !== userFound.name &&
                        user.email === userFound.email &&
                        user.mobile === userFound.mobile &&
                        user.internationalPrefix ===
                            userFound.internationalPrefix
                    ) {
                        console.log(`[${context}] Change only name`);
                        userToUpdate = {
                            _id: userFound._id,
                            name: user.name,
                            email: userFound.email,
                            mobile: userFound.mobile,
                            internationalPrefix: userFound.internationalPrefix,
                        };

                        try {
                            await updateUsers(query, {
                                $set: { name: user.name },
                            });

                            if (clientName == process.env.clientNameHyundai) {
                                updateUserHyundai(userId);
                            }

                            return res
                                .status(200)
                                .send({
                                    auth: true,
                                    code: 'server_user_updated',
                                    message: 'User updated',
                                });

                        } catch (error) {
                            return res
                                .status(400)
                                .send({
                                    auth: false,
                                    code: 'server_user_not_updated',
                                    message: 'User not updated',
                                });
                        }

                    } else if (
                        user.name !== userFound.name &&
                        user.email !== userFound.email &&
                        user.mobile === userFound.mobile &&
                        user.internationalPrefix ===
                            userFound.internationalPrefix
                    ) {
                        console.log(`[${context}] Change name and email`);

                        User.findOne(
                            {
                                email: user.email,
                                clientName: clientName,
                                active: true,
                                _id: { $ne: userId },
                            },
                            (err, result) => {
                                if (err) {
                                    console.error(
                                        `[${context}][findOne] Error `,
                                        err.message
                                    );
                                    return res.status(500).send(err.message);
                                } else {
                                    if (result) {
                                        return res
                                            .status(400)
                                            .send({
                                                auth: false,
                                                code: 'server_email_taken',
                                                message:
                                                    'Email ' +
                                                    user.email +
                                                    ' is already registered',
                                            });
                                    } else {
                                        userToUpdate = {
                                            _id: userFound._id,
                                            name: user.name,
                                            email: user.email,
                                            mobile: userFound.mobile,
                                            internationalPrefix:
                                                userFound.internationalPrefix,
                                        };

                                        try {

                                            if (requestUserId !== process.env.OperationsManagementID) {
                                                let newUser =
                                                    updateUsers(query, {
                                                        $set: {
                                                            name: user.name,
                                                            email: user.email,
                                                            changedEmail: true,
                                                        },
                                                    });
                                                cancelAllTokens(
                                                    newUser._id
                                                );
                                                cancelFirebaseTokens(
                                                    newUser._id
                                                );
                                                cancelFirebaseWLTokens(
                                                    newUser._id
                                                );
                                            } else {
                                                updateUsers(query, {
                                                    $set: {
                                                        name: user.name,
                                                        email: user.email,
                                                    },
                                                });
                                            }

                                            if (clientName == process.env.clientNameHyundai) {
                                                updateUserHyundai(
                                                    userId
                                                );
                                            }

                                            return res
                                                .status(200)
                                                .send({
                                                    auth: true,
                                                    code: 'server_user_updated',
                                                    message:
                                                        'User updated',
                                                });

                                        } catch (error) {
                                            return res
                                                .status(400)
                                                .send({
                                                    auth: false,
                                                    code: 'server_user_not_updated',
                                                    message:
                                                        'User not updated',
                                                });
                                        }
                                    }
                                }
                            }
                        );
                    } else if (
                        user.name === userFound.name &&
                        user.email !== userFound.email &&
                        user.mobile === userFound.mobile &&
                        user.internationalPrefix ===
                            userFound.internationalPrefix
                    ) {
                        console.log(`[${context}] Only Email`);

                        User.findOne(
                            {
                                email: user.email,
                                clientName: clientName,
                                active: true,
                            },
                            (err, result) => {
                                if (err) {
                                    console.error(
                                        `[${context}][findOne] Error `,
                                        err.message
                                    );
                                    return res.status(500).send(err.message);
                                } else {
                                    if (result) {
                                        return res
                                            .status(400)
                                            .send({
                                                auth: false,
                                                code: 'server_email_taken',
                                                message:
                                                    'Email ' +
                                                    user.email +
                                                    ' is already registered',
                                            });
                                    } else {
                                        userToUpdate = {
                                            _id: userFound._id,
                                            name: userFound.name,
                                            email: user.email,
                                            mobile: userFound.mobile,
                                            internationalPrefix:
                                                userFound.internationalPrefix,
                                        };

                                        try {

                                            if (requestUserId !== process.env.OperationsManagementID) {
                                                let newUser =
                                                    updateUsers(query, {
                                                        $set: {
                                                            name: user.name,
                                                            email: user.email,
                                                            changedEmail: true,
                                                        },
                                                    });
                                                cancelAllTokens(
                                                    newUser._id
                                                );
                                                cancelFirebaseTokens(
                                                    newUser._id
                                                );
                                                cancelFirebaseWLTokens(
                                                    newUser._id
                                                );
                                            } else {
                                                updateUsers(query, {
                                                    $set: {
                                                        name: user.name,
                                                        email: user.email,
                                                    },
                                                });
                                            }

                                            if (clientName == process.env.clientNameHyundai) {
                                                updateUserHyundai(userId);
                                            }
                                             
                                            return res
                                                .status(200)
                                                .send({
                                                    auth: true,
                                                    code: 'server_user_updated',
                                                    message:
                                                        'User updated',
                                                });

                                        } catch(error) {
                                            
                                            Sentry.captureException(error);
                                            
                                            return res
                                                .status(400)
                                                .send({
                                                    auth: false,
                                                    code: 'server_user_not_updated',
                                                    message:
                                                        'User not updated',
                                                });
                                        }

                                    }
                                }
                            }
                        );
                    } else if (
                        user.name === userFound.name &&
                        user.email === userFound.email &&
                        (user.mobile !== userFound.mobile ||
                            user.internationalPrefix !==
                                userFound.internationalPrefix)
                    ) {
                        console.log(`[${context}] Only Mobile`);

                        User.findOne(
                            {
                                mobile: user.mobile,
                                internationalPrefix: user.internationalPrefix,
                                clientName: clientName,
                                active: true,
                            },
                            (err, result) => {
                                if (err) {
                                    console.error(
                                        `[${context}][findOne] Error `,
                                        err.message
                                    );
                                    return res.status(500).send(err.message);
                                } else {
                                    if (result)
                                        return res
                                            .status(400)
                                            .send({
                                                auth: false,
                                                code: 'server_mobile_use',
                                                message:
                                                    'Mobile is already in use!',
                                            });
                                    else {
                                        var oldMobile = userFound.mobile;
                                        var olderInternationalPrefix =
                                            userFound.internationalPrefix;

                                        userToUpdate = {
                                            _id: userFound._id,
                                            mobile: user.mobile,
                                            internationalPrefix:
                                                user.internationalPrefix,
                                            clientName: clientName,
                                        };

                                        User.updateUser(
                                            { _id: userFound._id },
                                            {
                                                $set: {
                                                    username: user.mobile,
                                                    mobile: user.mobile,
                                                    internationalPrefix:
                                                        user.internationalPrefix,
                                                },
                                            },
                                            (err, result) => {
                                                if (err) {
                                                    console.error(
                                                        `[${context}][updateUser] Error `,
                                                        err.message
                                                    );
                                                    return res
                                                        .status(500)
                                                        .send(err.message);
                                                } else {

                                                    try {

                                                        userDriversDependencies(
                                                            userToUpdate
                                                        );
                                                        userGroupDriversDependencies(
                                                            userToUpdate
                                                        );
                                                        userGroupCSUsersDependencies(
                                                            userToUpdate
                                                        );

                                                        updateMobileContract(
                                                            userToUpdate
                                                        );
                                                        updateMobileDrivers(
                                                            userToUpdate
                                                        );
                                                        updateMobileGroupDrivers(
                                                            userToUpdate
                                                        );
                                                        updateMobileGroupCSUsers(
                                                            userToUpdate
                                                        );

                                                        if (clientName == process.env.clientNameHyundai) {
                                                            updateUserHyundai(userId);
                                                        }

                                                        return res
                                                            .status(200)
                                                            .send({
                                                                auth: true,
                                                                code: 'server_user_updated',
                                                                message:
                                                                    'User updated',
                                                            });

                                                    } catch (error) {
                                                        Sentry.captureException(error);

                                                        User.updateUser(
                                                            {
                                                                _id: userFound._id,
                                                            },
                                                            {
                                                                $set: {
                                                                    username:
                                                                    oldMobile,
                                                                    mobile: oldMobile,
                                                                    internationalPrefix:
                                                                    olderInternationalPrefix,
                                                                },
                                                            },
                                                            (
                                                                err,
                                                                result
                                                            ) => {
                                                                if (err) {
                                                                    console.error(
                                                                        `[${context}][updateUser] Error `,
                                                                        err.message
                                                                    );
                                                                    return res
                                                                        .status(
                                                                            500
                                                                        )
                                                                        .send(
                                                                            err.message
                                                                        );
                                                                } else {
                                                                    return res
                                                                        .status(
                                                                            400
                                                                        )
                                                                        .send(
                                                                            {
                                                                                auth: false,
                                                                                code: 'server_user_not_updated',
                                                                                message:
                                                                                    'User not updated',
                                                                            }
                                                                        );
                                                                }
                                                            }
                                                        );

                                                    }

                                                }
                                            }
                                        );
                                    }
                                }
                            }
                        );
                    } else if (
                        user.name !== userFound.name &&
                        user.email === userFound.email &&
                        (user.mobile !== userFound.mobile ||
                            user.internationalPrefix !==
                                userFound.internationalPrefix)
                    ) {
                        console.log(`[${context}] Name and Mobile`);

                        User.findOne(
                            {
                                mobile: user.mobile,
                                internationalPrefix: user.internationalPrefix,
                                clientName: clientName,
                                active: true,
                            },
                            (err, result) => {
                                if (err) {
                                    console.error(
                                        `[${context}][findOne] Error `,
                                        err.message
                                    );
                                    return res.status(500).send(err.message);
                                } else {
                                    if (result)
                                        return res
                                            .status(400)
                                            .send({
                                                auth: false,
                                                code: 'server_mobile_use',
                                                message:
                                                    'Mobile is already in use!',
                                            });
                                    else {
                                        var oldMobile = userFound.mobile;
                                        var olderInternationalPrefix =
                                            userFound.internationalPrefix;

                                        userToUpdate = {
                                            _id: userFound._id,
                                            name: user.name,
                                            mobile: user.mobile,
                                            internationalPrefix:
                                                user.internationalPrefix,
                                            clientName: clientName,
                                        };

                                        try {
                                            userDriversDependencies(
                                                userToUpdate
                                            );
                                            userGroupDriversDependencies(
                                                userToUpdate
                                            );
                                            userGroupCSUsersDependencies(
                                                userToUpdate
                                            );

                                            updateMobileContract(
                                                userToUpdate
                                            );
                                            updateMobileDrivers(
                                                userToUpdate
                                            );
                                            updateMobileGroupDrivers(
                                                userToUpdate
                                            );
                                            updateMobileGroupCSUsers(
                                                userToUpdate
                                            );

                                            updateUsers(
                                                query,
                                                {
                                                    $set: {
                                                        name: user.name,
                                                        username:
                                                        user.mobile,
                                                        mobile: user.mobile,
                                                        internationalPrefix:
                                                        user.internationalPrefix,
                                                    },
                                                }
                                            );

                                            if (clientName == process.env.clientNameHyundai) {
                                                updateUserHyundai(userId);
                                            }

                                            return res
                                                .status(200)
                                                .send({
                                                    auth: true,
                                                    code: 'server_user_updated',
                                                    message:
                                                        'User updated',
                                                });


                                        } catch(error) {
                                            Sentry.captureException(error);

                                            return res
                                                .status(400)
                                                .send({
                                                    auth: false,
                                                    code: 'server_user_not_updated',
                                                    message:
                                                        'User not updated',
                                                });
                                        }

                                    }
                                }
                            }
                        );
                    } else {
                        try {
                            var useEmail = await userFindOne({
                                email: user.email,
                                clientName: clientName,
                                active: true,
                            });
                            var useMobile = await userFindOne({
                                mobile: user.mobile,
                                internationalPrefix: user.internationalPrefix,
                                clientName: clientName,
                                active: true,
                            });
                        } catch (error) {
                            console.error(`[${context}] Error `, err.message);
                            return res.status(500).send(err.message);
                        }

                        if (useEmail && useMobile) {
                            return res
                                .status(400)
                                .send({
                                    auth: false,
                                    code: 'server_mobile_email_use',
                                    message:
                                        'Mobile and Email are already in use!',
                                });
                        } else if (useEmail && !useMobile) {
                            return res
                                .status(400)
                                .send({
                                    auth: false,
                                    code: 'server_mobile_use',
                                    message: 'Mobile is already in use!',
                                });
                        } else if (!useEmail && useMobile) {
                            return res
                                .status(400)
                                .send({
                                    auth: false,
                                    code: 'server_email_taken',
                                    message:
                                        'Email ' +
                                        user.email +
                                        ' is already registered',
                                });
                        } else {
                            var oldMobile = userFound.mobile;
                            var olderInternationalPrefix =
                                userFound.internationalPrefix;

                            userToUpdate = {
                                _id: userFound._id,
                                name: userFound.name,
                                email: user.email,
                                mobile: user.mobile,
                                internationalPrefix: user.internationalPrefix,
                                clientName: clientName,
                            };

                            try {
                                userDriversDependencies(userToUpdate);
                                userGroupDriversDependencies(
                                    userToUpdate
                                );
                                userGroupCSUsersDependencies(
                                    userToUpdate
                                );

                                updateMobileContract(userToUpdate);
                                updateMobileDrivers(userToUpdate);
                                updateMobileGroupDrivers(userToUpdate);
                                updateMobileGroupCSUsers(userToUpdate);

                                if (requestUserId !== process.env.OperationsManagementID) {
                                    let newUser = updateUsers(query, {
                                        $set: {
                                            name: user.name,
                                            email: user.email,
                                            username: user.mobile,
                                            mobile: user.mobile,
                                            internationalPrefix:
                                            user.internationalPrefix,
                                            changedEmail: true,
                                        },
                                    });

                                    cancelAllTokens(newUser._id);
                                    cancelFirebaseTokens(newUser._id);
                                    cancelFirebaseWLTokens(newUser._id);
                                } else {
                                    updateUsers(query, {
                                        $set: {
                                            name: user.name,
                                            email: user.email,
                                            username: user.mobile,
                                            mobile: user.mobile,
                                            internationalPrefix:
                                            user.internationalPrefix,
                                        },
                                    });
                                }

                                if (clientName == process.env.clientNameHyundai) {
                                    updateUserHyundai(userId);
                                }

                                return res
                                    .status(200)
                                    .send({
                                        auth: true,
                                        code: 'server_user_updated',
                                        message: 'User updated',
                                    });


                            } catch (error) {
                                Sentry.captureException(error);

                                return res
                                    .status(400)
                                    .send({
                                        auth: false,
                                        code: 'server_user_not_updated',
                                        message: 'User not updated',
                                    });
                            }
                        }
                    }
                } else {
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_users_not_found',
                            message: 'Users not found for given parameters',
                        });
                }
            }
        });
    }
});

router.patch('/api/private/users/licensePreferences', (req, res, next) => {
    var context = "PATCH /api/private/users/licensePreferences";
    try {
        const userId = req.headers['userid'];
        const { licenseMarketing, licenseProducts, licenseServices } = req.body;

        const licensePreferences = { $set: { } };

        if (licenseMarketing !== undefined) {
            licensePreferences.$set.licenseMarketing = licenseMarketing;
        }

        if (licenseProducts !== undefined) {
            licensePreferences.$set.licenseProducts = licenseProducts;
        }

        if (licenseServices !== undefined) {
            licensePreferences.$set.licenseServices = licenseServices;
        }

        const query = { _id: userId };

        updateUsers(query, licensePreferences)
            .then((value) => {
                if (value)
                    return res.status(200).send({ licenseMarketing, licenseProducts, licenseServices });
                else
                    return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
            })
            .catch((err) => {
                console.error(`[${context}][updateUsers][.catch] Error `, err.message);
                return res.status(500).send(err.message);
            });
    }
    catch(error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
})

//edit an user
router.patch('/api/private/users/editUserPackage', (req, res, next) => {
    var context = 'PATCH /api/private/users/editUserPackage';
    try {
        var userId = req.headers['userid'];
        var userPackage = req.body;

        if (!userId)
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_user_required',
                    message: 'User id required!',
                });

        validateFieldsUsersPackages(userPackage)
            .then(() => {
                let query = { _id: userId };

                //TODO
                //Atualizar em outros locais caso necessário

                User.updateUserFilter(
                    query,
                    { $set: { userPackage: userPackage } },
                    { new: true },
                    (err, result) => {
                        if (err) {
                            console.error(
                                `[${context}][updateUserFilter] Error `,
                                err.message
                            );
                            return res.status(500).send(err.message);
                        } else {
                            return res.status(200).send(result);
                        }
                    }
                );
            })
            .catch((error) => {
                return res.status(400).send(error);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//activate user
router.patch('/api/private/users/activate', (req, res, next) => {
    var context = 'PATCH /api/private/users/activate';
    try {
        var query = req.body.params;
        User.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result) {
                    result.active = true;
                    var newValue = { $set: result };
                    User.updateUser(query, newValue, (err, result) => {
                        if (err) {
                            console.error(
                                `[${context}][updateUser] Error `,
                                err.message
                            );
                            return res.status(500).send(err.message);
                        } else {
                            if (result) return res.send(true);
                            else return res.send(false);
                        }
                    });
                } else
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_users_not_found',
                            message: 'Users not found for given parameters',
                        });
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Change image from a user
router.patch('/api/private/users/image', (req, res, next) => {
    var context = 'PATCH /api/private/users/image';
    try {
        var userId = req.headers['userid'];
        let requestUserId = req.headers['requestuserid'];
        let accountType = req.headers['accounttype'];

        if (accountType === process.env.AccountTypeGuest) {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_not_authorized_toEditImage',
                    message: 'Not authorized to edit image',
                });
        } else {
            var user = {
                _id: userId,
                imageContent: req.body.imageContent,
            };
            var query = {
                _id: userId,
            };
            if (user.devUser != undefined) {
                delete user.devUser;
            }
            User.findOne(query, (err, result) => {
                if (err) {
                    Sentry.captureException(err);
                    console.error(`[${context}][findOne] Error `, err.message);

                    return res.status(500).send(err.message);
                } else {
                    if (result) {
                        saveImageContent(user)
                            .then((value) => {
                                result.imageContent = value.imageContent;
                                var newValue = { $set: result };
                                updateUsers(query, newValue)
                                    .then((value) => {
                                        if (value)
                                            return res.status(200).send(result);
                                        else
                                            return res
                                                .status(400)
                                                .send({
                                                    auth: false,
                                                    code: 'server_user_not_updated',
                                                    message: 'User not updated',
                                                });
                                    })
                                    .catch((err) => {
                                        console.error(
                                            `[${context}][updateUsers][.catch] Error `,
                                            err.message
                                        );
                                        return res
                                            .status(500)
                                            .send(err.message);
                                    });
                            })
                            .catch((error) => {
                                Sentry.captureException(error);
                                console.error(
                                    `[${context}][saveImageContent][.catch] Error `,
                                    error.message
                                );

                                return res.status(500).send(error.message);
                            });
                    } else
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_users_not_found',
                                message: 'Users not found for given parameters',
                            });
                }
            });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Add home and work
router.patch('/api/private/users/referencePlaces', async (req, res, next) => {
    let context = 'PATCH /api/private/users/referencePlaces';
    try {
        let userId = req.headers['userid'];
        let user = req.body;
        let query = {
            _id: userId,
        };
        let clientName = req.headers['clientname'];
        let clientType = req.headers['client'];
        if (user.devUser != undefined) {
            delete user.devUser;
        }

        let result = await User.findOne(query);

        if (result) {
            if (
                process.env.CaetanoGOList.includes(clientName) &&
                !clientType.includes('BackOffice')
            ) {
                updateReferencePlaces(
                    userId,
                    user,
                    query,
                    result.referencePlaces,
                    clientName,
                    res
                );
            } else {
                if (result.referencePlaces.length === 0) {
                    result.referencePlaces = user.referencePlaces;
                    var newValue = { $set: result };
                    updateUsers(query, newValue)
                        .then((value) => {
                            if (value) {
                                User.findOne(
                                    query,
                                    { referencePlaces: 1 },
                                    (err, userFound) => {
                                        if (err) {
                                            console.error(
                                                `[${context}][findOne] Error `,
                                                err.message
                                            );
                                            return res
                                                .status(500)
                                                .send(err.message);
                                        } else {
                                            return res
                                                .status(200)
                                                .send(userFound);
                                        }
                                    }
                                );
                            }
                            //return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
                            else
                                return res
                                    .status(400)
                                    .send({
                                        auth: false,
                                        code: 'server_user_not_updated',
                                        message: 'User not updated',
                                    });
                        })
                        .catch((err) => {
                            console.error(
                                `[${context}][updateUsers][.catch] Error `,
                                err.message
                            );
                            return res.status(500).send(err.message);
                        });
                } else {
                    /*verifyExistence(user, result)
                        .then((result) => {*/
                    result.referencePlaces = user.referencePlaces;
                    var newValue = { $set: result };
                    updateUsers(query, newValue)
                        .then((value) => {
                            if (value) {
                                User.findOne(
                                    query,
                                    { referencePlaces: 1 },
                                    (err, userFound) => {
                                        if (err) {
                                            console.error(
                                                `[${context}][findOne] Error `,
                                                err.message
                                            );
                                            return res
                                                .status(500)
                                                .send(err.message);
                                        } else {
                                            return res
                                                .status(200)
                                                .send(userFound);
                                        }
                                    }
                                );
                            }
                            //return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
                            else
                                return res
                                    .status(400)
                                    .send({
                                        auth: false,
                                        code: 'server_user_not_updated',
                                        message: 'User not updated',
                                    });
                        })
                        .catch((err) => {
                            console.error(
                                `[${context}][verifyExistence][updateUsers][.catch] Error `,
                                err.message
                            );
                            return res.status(500).send(err.message);
                        });
                    /*})
                    .catch((error) => {
                        console.error(`[${context}][verifyExistence][.catch] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                    */
                }
            }
        } else
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_users_not_found',
                    message: 'Users not found for given parameters',
                });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Delete favorite when charger are removed
router.patch('/api/private/users/favorites', (req, res, next) => {
    var context = 'PATCH /api/private/users/favorites';
    try {
        var chargerId = req.body.chargerId;

        var query = {
            favorites: {
                $elemMatch: {
                    baseId: chargerId,
                },
            },
        };

        var fields = {
            favorites: 1,
        };
        User.find(query, fields, (err, result) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result.length === 0) {
                    return res.status(200).send(true);
                } else {
                    Promise.all(
                        result.map((user) => {
                            return new Promise((resolve, reject) => {
                                user.favorites = user.favorites.filter(
                                    (elem) => {
                                        return elem.baseId != chargerId;
                                    }
                                );
                                var query = {
                                    _id: user._id,
                                };
                                var newValues = { $set: user };
                                User.updateUser(
                                    query,
                                    newValues,
                                    (err, result) => {
                                        if (err) {
                                            console.error(
                                                `[${context}][find] Error `,
                                                err.message
                                            );
                                            reject(err);
                                        } else {
                                            resolve(true);
                                        }
                                    }
                                );
                            });
                        })
                    )
                        .then(() => {
                            return res.status(200).send(true);
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.patch('/api/private/users/editEvioCommission', (req, res, next) => {
    var context = 'PATCH /api/private/users/editEvioCommission';
    try {
        let received = req.body;

        let query = { _id: received.userId };
        let newValues = { $set: { evioCommission: received.evioCommission } };

        User.findOneAndUpdate(
            query,
            newValues,
            { new: true },
            (err, userFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    return res.status(500).send(err.message);
                } else {
                    updateUserTariffs(received)
                        .then(() => {
                            return res.status(200).send(userFound);
                        })
                        .catch((error) => {
                            console.error(
                                `[${context}][updateUserTariffs] Error `,
                                error.message
                            );
                            return res.status(500).send(error.message);
                        });
                }
            }
        );
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.patch('/api/private/users/paymentPeriod', async (req, res, next) => {
    var context = 'PATCH /api/private/users/paymentPeriod';
    try {
        var userId = req.headers['userid'];
        var user = req.body;

        var query = {
            _id: userId,
        };

        if (!user.paymentPeriod) {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_paymentPeriod_required',
                    message: 'Payment period is required',
                });
        }

        var newUser = {
            paymentPeriod: user.paymentPeriod,
        };

        User.updateUserFilter(
            query,
            { $set: newUser },
            { new: true },
            (err, userUpdated) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                } else {
                    return res.status(200).send(userUpdated);
                }
            }
        );
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.patch('/api/private/users/paymentMethodB2B', async (req, res, next) => {
    const context = 'PATCH /api/private/users/paymentMethodB2B';
    try {
        var userId = req.headers['userid'];
        var accountType = req.headers['accounttype'];
        var userType = req.headers['usertype'];

        //console.log("req.headers", req.headers);
        var user = req.body;

        if (!user.paymentMethod) {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_paymentMethod_required',
                    message: 'Payment method is required',
                });
        }

        if (accountType !== process.env.AccountTypeMaster) {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_only_master_user',
                    message: 'Only master user can edit payment method',
                });
        } else if (userType !== process.env.ClientTypeB2B) {
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_only_b2b_user',
                    message: 'Exclusive functionality for B2B users',
                });
        } else {
            var query = {
                _id: userId,
            };

            var newValues = {
                paymentMethodB2B: user.paymentMethod,
            };

            User.updateUserFilter(
                query,
                { $set: newValues },
                { new: true },
                (err, userUpdated) => {
                    if (err) {
                        console.error(
                            `[${context}][findOne] Error `,
                            err.message
                        );
                        return res.status(500).send(err.message);
                    } else {
                        return res.status(200).send(userUpdated);
                    }
                }
            );
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.patch(
    '/api/private/users/updateMobileGoCharge',
    async (req, res, next) => {
        const context = 'PATCH /api/private/users/updateMobileGoCharge';
        try {
            let userId = req.headers['userid'];
            let accountType = req.headers['accounttype'];
            let userType = req.headers['usertype'];
            let mobile = req.body.mobile;
            let internationalPrefix = req.body.internationalPrefix;
            let clientName = req.headers['clientname'];

            if (!mobile) {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_mobile_required',
                        message: 'Mobile phone is required',
                    });
            }
            if (!internationalPrefix) {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_internationalPrefix_required',
                        message: 'Internationl prefix is required',
                    });
            }

            let validateMobile = await User.findOne({
                mobile: mobile,
                internationalPrefix: internationalPrefix,
                clientName: clientName,
            });
            let userFound = await User.findOne({ _id: userId });

            if (validateMobile) {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_mobile_use',
                        message: 'Mobile is already in use!',
                    });
            } else {
                if (userFound) {
                    //console.log("userFound", userFound);
                    let userToUpdate = await updateMobileGoCharge(
                        userFound,
                        mobile,
                        internationalPrefix
                    );

                    if (userToUpdate) {
                        let userUpdated = await User.findOneAndUpdate(
                            { _id: userId },
                            {
                                $set: {
                                    mobile: mobile,
                                    internationalPrefix: internationalPrefix,
                                },
                            },
                            { new: true }
                        );
                        //return res.status(200).send(userUpdated);

                        userDriversDependencies(userUpdated);
                        userGroupDriversDependencies(userUpdated);
                        userGroupCSUsersDependencies(userUpdated);
                        userDriverEv(userUpdated);

                        req.body._id = userUpdated._id;
                        req.body.language = userUpdated.language;
                        req.body.name = userUpdated.name;
                        req.body.imageContent = userUpdated.imageContent;
                        req.body.active = userUpdated.active;
                        req.body.mobile = userUpdated.mobile;
                        req.body.internationalPrefix =
                            userUpdated.internationalPrefix;
                        req.body.clientType = userUpdated.clientType;
                        req.body.requestUserId = userUpdated._id;
                        req.body.accountType = process.env.AccountTypeMaster;
                        req.body.username = userUpdated.username;
                        req.body.email = userUpdated.email;
                        req.body.sendRequestToMobile = false;
                        authorizationServiceProxyCaetanoGo(req, res);
                    } else {
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_user_not_updated',
                                message: 'User not updated',
                            });
                    }
                } else {
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_user_not_found',
                            message: 'User not found for given parameters',
                        });
                }
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }
    }
);

router.patch(
    '/api/private/users/updateMobileHyundai',
    async (req, res, next) => {
        const context = 'PATCH /api/private/users/updateMobilHyundai';
        try {
            let userId = req.headers['userid'];
            let accountType = req.headers['accounttype'];
            let userType = req.headers['usertype'];
            let mobile = req.body.mobile;
            let internationalPrefix = req.body.internationalPrefix;
            let clientName = req.headers['clientname'];

            if (!mobile) {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_mobile_required',
                        message: 'Mobile phone is required',
                    });
            }
            if (!internationalPrefix) {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_internationalPrefix_required',
                        message: 'Internationl prefix is required',
                    });
            }

            let validateMobile = await User.findOne({
                mobile: mobile,
                internationalPrefix: internationalPrefix,
                clientName: clientName,
            });
            let userFound = await User.findOne({ _id: userId });

            if (validateMobile) {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_mobile_use',
                        message: 'Mobile is already in use!',
                    });
            } else {
                if (userFound) {
                    let userUpdated = await User.findOneAndUpdate(
                        { _id: userId },
                        {
                            $set: {
                                mobile: mobile,
                                internationalPrefix: internationalPrefix,
                            },
                        },
                        { new: true }
                    );
                    //return res.status(200).send(userUpdated);

                    //console.log("userFound", userFound);
                    await updateUserHyundai(userUpdated._id);

                    userDriversDependencies(userUpdated);
                    userGroupDriversDependencies(userUpdated);
                    userGroupCSUsersDependencies(userUpdated);
                    userDriverEv(userUpdated);

                    req.body._id = userUpdated._id;
                    req.body.language = userUpdated.language;
                    req.body.name = userUpdated.name;
                    req.body.username = userUpdated.username;
                    req.body.imageContent = userUpdated.imageContent;
                    req.body.active = userUpdated.active;
                    req.body.email = userUpdated.email;
                    req.body.mobile = userUpdated.mobile;
                    req.body.internationalPrefix =
                        userUpdated.internationalPrefix;
                    req.body.clientType = userUpdated.clientType;
                    req.body.requestUserId = userUpdated._id;
                    req.body.accountType = process.env.AccountTypeMaster;
                    req.body.guestUser = false;
                    return authorizationServiceProxyHyundai(req, res);
                } else {
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_user_not_found',
                            message: 'User not found for given parameters',
                        });
                }
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }
    }
);

router.patch('/api/private/users/deactivateContracts', async (req, res, next) => {
    const context = 'PATCH /api/private/users/deactivateContracts';
    try {
        let userId = req.body.userId;

        let message = req.body.message;

        if (await toggle.isEnable('fleet-363-deactivate-and-activate-contracts')) {

            if (!userId) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_userId_required',
                    message: 'User ID is required for deactivating contracts',
                });
            }

            if (!message || !message?.key) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_missing_message_key',
                    message: 'Missing message.key for deactivating contracts',
                });
            }

            if (!req.body.reason) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_missing_reason',
                    message: 'Missing reason for deactivating contracts',
                });
            }

            const tokenStatusService = new TokenStatusService();
            await tokenStatusService.switchReasonByUserId({
                userId,
                activeBlock: true,
                reason: req.body.reason,
                requestUserId: req.headers['userid'],
            });

            if (req.body.reason === TokenStatusChangeReason.Debt) {
                await User.blockUser(userId, ReasonForBlockUser.ManuallyBlocked);
            }

            await Contract.updateStatusMessageKey({ userId, statusMessageKey: message?.key });

            return res.status(200).send({
                auth: true,
                code: 'server_contracts_deactivated',
                message: 'Contracts successfully deactivated',
            });
        }
        else {
            let data = {
                userId: userId,
                message: message,
            };

            Contract.markAllAsInactive(data, (err, result) => {
                if (err) {
                    console.error(
                        `[${context}][markAllAsInactive] Error `,
                        err.message
                    );
                    return res.status(500).send(err.message);
                } else {
                    User.blockUser(userId, ReasonForBlockUser.ManuallyBlocked, (err, result) => {
                        if (err) {
                            console.error(
                                `[${context}][blockUser] Error `,
                                err.message
                            );
                            return res.status(500).send(err.message);
                        } else {
                            contractsServices.updateContractStatusExternalNetworks(
                                userId,
                                false
                            );
                            return res
                                .status(200)
                                .send({
                                    auth: true,
                                    code: 'server_contracts_deactivated',
                                    message: 'Contracts successfully deactivated',
                                });
                        }
                    });
                }
            });
        }
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Active user contracts
router.patch('/api/private/users/activateContracts', async (req, res, next) => {
    const context = 'PATCH /api/private/users/activateContracts';
    try {
        let userId = req.body.userId;

        if (await toggle.isEnable('fleet-363-deactivate-and-activate-contracts')) {
            if (!userId) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_userId_required',
                    message: 'User ID is required for activating contracts',
                });
            }

            if (!req.body.reason) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_missing_reason',
                    message: 'Missing reason for activating contracts',
                });
            }

            const tokenStatusService = new TokenStatusService();
            await tokenStatusService.switchReasonByUserId({
                userId,
                activeBlock: false,
                reason: req.body.reason,
                requestUserId: req.headers['userid'],
            });

            if (req.body.reason === TokenStatusChangeReason.Debt) {
                await User.unlockUser(userId, ReasonForBlockUser.ManuallyUnblocked);
            }

            await Contract.updateStatusMessageKey({ userId, statusMessageKey: '' });

            return res.status(200).send({
                auth: true,
                code: 'server_contracts_activated',
                message: 'Contracts successfully activated',
            });
        }
        else {
            Contract.markAllAsActive(userId, (err, result) => {
                if (err) {
                    console.error(
                        `[${context}][markAllAsInactive] Error `,
                        err.message
                    );
                    return res.status(500).send(err.message);
                } else {
                    let query = {
                        _id: userId,
                        blocked: true,
                    };

                    User.findOne(query, (err, userFound) => {
                        if (err) {
                            console.error(
                                `[${context}][findOne] Error `,
                                err.message
                            );
                            return res.status(500).send(err.message);
                        } else {
                            if (userFound) {
                                User.unlockUser(userId, ReasonForUnblockUser.ManuallyUnblocked, (err, result) => {
                                    if (err) {
                                        console.error(
                                            `[${context}][unlockUser] Error `,
                                            err.message
                                        );
                                        return res.status(500).send(err.message);
                                    } else {
                                        unlockUserContract(userId);
                                        return res
                                            .status(200)
                                            .send({
                                                auth: true,
                                                code: 'server_contracts_deactivated',
                                                message:
                                                    'Contracts successfully activated',
                                            });
                                    }
                                });
                            } else {
                                unlockUserContract(userId);
                                return res
                                    .status(200)
                                    .send({
                                        auth: true,
                                        code: 'server_contracts_deactivated',
                                        message: 'Contracts successfully activated',
                                    });
                            }
                        }
                    });
                }
            });
        }
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Give user evioCommission
router.patch('/api/private/users/evioComission', (req, res, next) => {
    const context = 'PATCH /api/private/users/evioComission';
    try {
        let userId = req.body.userId;

        let newEvioComission = req.body.evioComission;

        console.log(userId);
        console.log(newEvioComission);

        User.updateUser(
            { _id: userId },
            { $set: { evioCommissions: newEvioComission } },
            (err, newResult) => {
                if (err) {
                    console.error(
                        `[${context}][updateUser][] Error `,
                        err.message
                    );
                    return res.status(500).send(err.message);
                } else {
                    console.log(newResult);
                    return res.status(200).send();
                }
            }
        );
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//========== PUT ==========
//change password
router.put('/api/private/users/changePassword', (req, res, next) => {
    const context = 'PUT /api/private/users/changePassword';

    try {
        var userId = req.headers['userid'];
        var requestUserId = req.headers['requestuserid'];
        var accountType = req.headers['accounttype'];
        var clientName = req.headers['clientname'];
        var token = req.headers.token;

        var passwords = req.body;
        var query;

        validatePassword(passwords)
            .then(() => {
                if (accountType === process.env.AccountTypeGuest) {
                    query = {
                        _id: requestUserId,
                    };

                    GuestUsers.findOne(query, async (err, guestUserFound) => {
                        if (err) {
                            console.error(
                                `[${context}][findOne] Error `,
                                err.message
                            );
                            return res.status(500).send(err.message);
                        } else {
                            if (guestUserFound) {

                                console.log(`[${context}] Updating password for guestUserId ${guestUserFound?._id}`);
                                await UserPasswords.updatePassword(guestUserFound?._id, passwords?.newPassword);

                                return res
                                    .status(200)
                                    .send({
                                        auth: true,
                                        code: 'server_password_change',
                                        message:
                                            'Password successfully changed',
                                    });

                            } else
                                return res
                                    .status(400)
                                    .send({
                                        auth: false,
                                        code: 'server_users_not_found',
                                        message:
                                            'Users not found for given parameters',
                                    });
                        }
                    });
                } else {
                    query = {
                        _id: userId,
                    };

                    User.findOne(query, async(err, result) => {
                        if (err) {
                            console.error(
                                `[${context}][findOne] Error `,
                                err.message
                            );
                            return res.status(500).send(err.message);
                        } else {
                            if (result) {
                                if (clientName === 'EVIO') {
                                    var username = result.username;
                                    var internationalPrefix =
                                        result.internationalPrefix;

                                    console.log(`[${context}] Updating password for userId ${userId}`);
                                    await UserPasswords.updatePassword(userId, passwords?.newPassword);

                                    cancelFirebaseTokens(userId);
                                    cancelAllTokens(userId);

                                    User.updateUser(
                                        { _id: userId },
                                        {
                                            $set: {
                                                needChangePassword: false,
                                            },
                                        },
                                        async (err, newResult) => {
                                            if (err) {
                                                console.error(
                                                    `[${context}][updateUser][] Error `,
                                                    err.message
                                                );
                                                return res
                                                    .status(500)
                                                    .send(err.message);
                                            } else {
                                                return res
                                                    .status(200)
                                                    .send({
                                                        auth: true,
                                                        code: 'server_password_change',
                                                        message:
                                                            'Password successfully changed',
                                                    });
                                            }
                                        }
                                    );

                                } else if (
                                    process.env.clientNameLoginMobile.includes(
                                        clientName
                                    )
                                ) {
                                    UserHandler.changePasswordWlLoginMobile(
                                        req,
                                        res
                                    )
                                        .then((response) => {
                                            return res
                                                .status(200)
                                                .send(response);
                                        })
                                        .catch((err) => {
                                            console.error(
                                                `[${context}][removeUserById][.catch] Error `,
                                                err.message
                                            );
                                            ErrorHandler.ErrorHandler(err, res);
                                        });
                                } else {``
                                    console.log(`[${context}] Updating password for userId ${userId}`);
                                    await UserPasswords.updatePassword(userId, passwords?.newPassword);
                                    cancelFirebaseWLTokens(userId);
                                    cancelAllTokens(userId);

                                    User.updateUser(
                                        { _id: userId },
                                        {
                                            $set: {
                                                needChangePassword: false,
                                            },
                                        },
                                        async(err, newResult) => {
                                            if (err) {
                                                Sentry.captureException(err);

                                                console.error(
                                                    `[${context}][updateUser][] Error `,
                                                    err.message
                                                );
                                                return res
                                                    .status(500)
                                                    .send(err.message);
                                            } else {

                                                return res
                                                    .status(200)
                                                    .send({
                                                        auth: true,
                                                        code: 'server_password_change',
                                                        message:
                                                            'Password successfully changed',
                                                    });
                                            }
                                        }
                                    );

                                }
                            } else
                                return res
                                    .status(400)
                                    .send({
                                        auth: false,
                                        code: 'server_users_not_found',
                                        message:
                                            'Users not found for given parameters',
                                    });
                        }
                    });
                }
            })
            .catch((error) => {
                Sentry.captureException(error);

                console.error(
                    `[${context}][validatePassword][.catch] Error `,
                    error.message
                );
                return res.status(500).send(error.message);
            });
    } catch (error) {
        Sentry.captureException(error);

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//change mobile
router.put('/api/private/users/changeMobile', async (req, res, next) => {
    const context = 'PUT /api/private/users/changeMobile';

    try {
        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];
        let receivedUserData = req.body;
        let headers = req.headers;
        if (receivedUserData.devUser != undefined) {
            delete receivedUserData.devUser;
        }

        console.log(`[${context}] Handling logic for userId=${userId} (${clientName})`);

        if (clientName === 'EVIO') {

            if (!receivedUserData.mobile) {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_mobile_number_required',
                        message: 'Mobile number required',
                    });
            }

            const mobileIsAlreadyUsed = await User.isUsedMobile(receivedUserData.mobile, userId, clientName, receivedUserData.internationalPrefix);

            if (mobileIsAlreadyUsed) {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_mobile_use',
                        message: 'Mobile is already in use!',
                    });
            }

            const fetchedUser = await User.findOne({ _id: userId }).lean();

            if (!fetchedUser) {
                console.log(`[${context}] User not found for userId=${userId}`);

                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_user_not_updated',
                        message: 'User not updated',
                    });
            }

            try {
                const { client, evioappversion } = headers;
                const code = await usersService.getActivationCodeToUserForValidateChangeMobile(userId);
                const userData = { _id: fetchedUser?._id, mobile: receivedUserData.mobile, internationalPrefix: receivedUserData.internationalPrefix};
                const pendingMobileData = { mobile: receivedUserData.mobile, internationalPrefix: receivedUserData.internationalPrefix };

                await sendChangeNumberSMS(userData, code, client, evioappversion);

                const result = await usersService.setPendingMobile(userId, pendingMobileData);
                console.log("result", result);

                return res.status(200).send({ auth: true, code: 'server_sms_sent_success', message: "SMS sent successfully" });
            } catch (error) {
                Sentry.captureException(error);
                const detailsToUser = { auth: false, code: 'server_error_activation_code', message: "We are currently unable to fulfill your request, please try again later." };

                ErrorHandler.ErrorHandler(detailsToUser, res);
            }

        } else if (process.env.clientNameLoginMobile.includes(clientName)) {
            UserHandler.changeMobileWlLoginMobile(req)
                .then((response) => {
                    return res.status(200).send(response);
                })
                .catch((err) => {
                    console.error(
                        `[${context}][removeUserById][.catch] Error `,
                        err.message
                    );
                    ErrorHandler.ErrorHandler(err, res);
                });
        } else {
            if (receivedUserData.email) {
                let query = {
                    email: receivedUserData.email,
                    clientName: clientName,
                    active: true,
                };

                User.findOne(query, (err, result) => {
                    if (err) {
                        console.error(
                            `[${context}][findOne] Error `,
                            err.message
                        );
                        return res.status(500).send(err.message);
                    }

                    if (result) {
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_email_taken',
                                message:
                                    'Email ' +
                                    receivedUserData.email +
                                    ' is already registered',
                            });
                    } else {
                        query = {
                            _id: userId,
                        };

                        User.findOne(query, (err, userFound) => {
                            if (err) {
                                console.error(
                                    `[${context}][findOne] Error `,
                                    err.message
                                );
                                return res.status(500).send(err.message);
                            }

                            if (userFound) {
                                var oldEmail = userFound.email;

                                //Put new
                                userFound.email = receivedUserData.email;
                                userFound.username = receivedUserData.email;

                                updateEmailMongo(userFound)
                                    .then((value) => {

                                        if(!value) {
                                            return res
                                                .status(400)
                                                .send({
                                                    auth: false,
                                                    code: 'server_user_not_updated',
                                                    message: 'User not updated',
                                                });
                                        }

                                        try {
                                            receivedUserData._id = userFound._id;

                                            contractsServices.updateEmailContract(
                                                receivedUserData
                                            );
                                            if (
                                                userFound.clientType ===
                                                process.env
                                                    .ClientTypeb2c
                                            ) {
                                                cancelAllTokens(userId);
                                                cancelFirebaseWLTokens(
                                                    userId
                                                );
                                                userCodeChangeEmailWl(
                                                    receivedUserData,
                                                    clientName
                                                );
                                            }
                                            return res
                                                .status(200)
                                                .send({
                                                    auth: true,
                                                    code: 'server_user_updated',
                                                    message:
                                                        'User updated',
                                                });

                                        } catch (error) {
                                            Sentry.captureException(error);

                                            userFound.email = oldEmail;
                                            userFound.username =
                                                oldEmail;
                                            userFound.active = true;
                                            updateEmailMongo(userFound)
                                                .then((value) => {
                                                    return res
                                                        .status(400)
                                                        .send({
                                                            auth: false,
                                                            code: 'server_user_not_updated',
                                                            message:
                                                                'User not updated',
                                                        });
                                                })
                                                .catch((err) => {
                                                    console.error(
                                                        `[${context}][updateEmailMongo][.catch] Error `,
                                                        err.message
                                                    );
                                                    return res
                                                        .status(500)
                                                        .send(
                                                            err.message
                                                        );
                                                });
                                        }

                                    })
                                    .catch((err) => {
                                        console.error(
                                            `[${context}][updateEmailMongo][.catch] Error `,
                                            err.message
                                        );
                                        return res
                                            .status(500)
                                            .send(err.message);
                                    });
                            } else {
                                return res
                                    .status(400)
                                    .send({
                                        auth: false,
                                        code: 'server_user_not_found',
                                        message:
                                            'User not found for given parameters',
                                    });
                            }
                        });
                    }
                });
            } else
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_email_required',
                        message: 'Email is required',
                    });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Add favorite to a user
router.put('/api/private/users/favorites', (req, res, next) => {
    var context = 'PUT /api/private/users/favorites';
    try {
        var userId = req.headers['userid'];
        var favorites = req.body;
        var query = {
            _id: userId,
        };

        User.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result) {
                    if (result.favorites.length === 0) {
                        result.favorites.push(favorites);
                        var newValue = { $set: result };
                        updateUsers(query, newValue)
                            .then((value) => {
                                return res
                                    .status(200)
                                    .send({
                                        auth: true,
                                        code: 'server_favorite_added',
                                        message: 'Favorite added to user',
                                    });
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}][updateUsers][.catch] Error `,
                                    error.message
                                );
                                return res.status(500).send(error.message);
                            });
                    } else {
                        if (
                            favorites.baseId != undefined &&
                            favorites.hwId != undefined
                        ) {
                            var found = result.favorites.find((favorite) => {
                                return (
                                    favorite.baseId === favorites.baseId &&
                                    favorite.hwId === favorites.hwId
                                );
                            });
                        } else if (
                            favorites.baseId == undefined &&
                            favorites.hwId != undefined
                        ) {
                            var found = result.favorites.find((favorite) => {
                                return favorite.hwId === favorites.hwId;
                            });
                        } else if (
                            favorites.baseId != undefined &&
                            favorites.hwId == undefined
                        ) {
                            var found = result.favorites.find((favorite) => {
                                return favorite.baseId === favorites.baseId;
                            });
                        }

                        if (found != undefined)
                            return res
                                .status(400)
                                .send({
                                    auth: false,
                                    code: 'server_favorite_already_added',
                                    message: 'Favorite already added.',
                                });
                        else {
                            result.favorites.push(favorites);
                            var newValue = { $set: result };
                            updateUsers(query, newValue)
                                .then((value) => {
                                    return res
                                        .status(200)
                                        .send({
                                            auth: true,
                                            code: 'server_favorite_added',
                                            message: 'Favorite added to user',
                                        });
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][updateUsers][.catch] Error `,
                                        error.message
                                    );
                                    return res.status(500).send(error.message);
                                });
                        }
                    }
                } else
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_user_not_found',
                            message: 'User not found for given parameters',
                        });
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//========== DELETE ==========
//Remove a favorite from a user
router.delete('/api/private/users/favorites', (req, res, next) => {
    var context = 'DELETE /api/private/users/favorites';
    try {
        var userId = req.headers['userid'];
        var favorites = req.body;
        var query = {
            _id: userId,
        };
        User.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result) {
                    if (result.favorites.length === 0)
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_no_favorites',
                                message: 'No favorites to remove',
                            });
                    else {
                        if (
                            favorites.baseId != undefined &&
                            favorites.hwId != undefined
                        ) {
                            var filterFavorites = result.favorites.filter(
                                (favorite) => {
                                    return (
                                        favorite.baseId !== favorites.baseId &&
                                        favorite.hwId !== favorites.hwId
                                    );
                                }
                            );
                        } else if (
                            favorites.baseId == undefined &&
                            favorites.hwId != undefined
                        ) {
                            var filterFavorites = result.favorites.filter(
                                (favorite) => {
                                    return favorite.hwId !== favorites.hwId;
                                }
                            );
                        } else if (
                            favorites.baseId != undefined &&
                            favorites.hwId == undefined
                        ) {
                            var filterFavorites = result.favorites.filter(
                                (favorite) => {
                                    return favorite.baseId !== favorites.baseId;
                                }
                            );
                        }
                        result.favorites = filterFavorites;
                        var newValue = { $set: result };
                        updateUsers(query, newValue)
                            .then((value) => {
                                return res
                                    .status(200)
                                    .send({
                                        auth: true,
                                        code: 'server_favorite_removed',
                                        message: 'Favorite removed from user',
                                    });
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}][updateUsers][.catch] Error `,
                                    error.message
                                );
                                return res.status(500).send(error.message);
                            });
                    }
                } else
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_user_not_found',
                            message: 'User not found for given parameters',
                        });
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Delete image from a user
router.delete('/api/private/users/image', (req, res, next) => {
    var context = 'DELETE /api/private/users/image';
    try {
        var userId = req.headers['userid'];
        var query = {
            _id: userId,
        };
        User.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result) {
                    removeImageContent(result)
                        .then((value) => {
                            var newValue = { $set: value };
                            updateUsers(query, newValue)
                                .then((value) => {
                                    if (value)
                                        return res.status(200).send(value);
                                    else
                                        return res
                                            .status(400)
                                            .send({
                                                auth: false,
                                                code: 'server_image_not_deleted',
                                                message: 'Image not deleted',
                                            });
                                })
                                .catch((err) => {
                                    console.error(
                                        `[${context}][updateUsers][.catch] Error `,
                                        err.message
                                    );
                                    return res.status(500).send(err.message);
                                });
                        })
                        .catch((error) => {
                            console.error(
                                `[${context}][removeImageContent][.catch] Error `,
                                error.message
                            );
                            return res.status(500).send(error.message);
                        });
                } else
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_users_not_found',
                            message: 'Users not found for given parameters',
                        });
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Delete user account
router.delete('/api/private/users', (req, res, next) => {
    const context = 'DELETE /api/private/users';

    try {
        const userId = req.headers['userid'];

        const query = {
            _id: userId,
        };

        User.findOne(query, async (err, userFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (userFound) {
                    //removeContract(userId);
                    removeCEMETariff(userId);
                    removeDrivers(userId);
                    removeGroupDrivers(userId);
                    removeGroupCSUsers(userId);
                    removeFromPoolDrivers(userFound);
                    removeFromGroupDrivers(userFound);
                    removeFromGroupCSUsers(userFound);
                    removeFleets(userId);
                    removeFromDriverEvs(userId);
                    removeInfrastructure(userId);
                    removeTariff(userId);
                    removeNotificationsDefinition(userId);
                    cancelAllTokens(userId);
                    contractsServices.updateContractStatusExternalNetworks(
                        userId,
                        false
                    );
                    await contractsServices.deleteCachedContractsByUser(userId);

                    console.log(`[${context}] Removing password for userId ${userId}`);
                    await UserPasswords.removePasswordByUserId(userId);

                    const mongocontroller = MongoDb();
                    mongocontroller
                        .deletemongoUser(userFound)
                        .then((result) => {
                            return res.status(200).send(result);
                        })
                        .catch((error) => {
                            console.error(
                                `[${context}] Error `,
                                error.message
                            );
                            return res
                                .status(500)
                                .send(error.message);
                        });

                } else {
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_users_not_found',
                            message: 'Users not found for given parameters',
                        });
                }
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Delete user account by user id (use only by EVIO)
router.delete('/api/private/users/byId', async (req, res, next) => {
    var context = 'DELETE /api/private/users/byId';
    try {
        //var userId = req.headers['userid'];
        var userId = req.body.userId;

        var query = {
            _id: userId,
        };

        User.findOne(query, async (err, userFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (userFound) {
                    //removeContract(userId);
                    removeCEMETariff(userId);
                    removeDrivers(userId);
                    removeGroupDrivers(userId);
                    removeGroupCSUsers(userId);
                    removeFromPoolDrivers(userFound);
                    removeFromGroupDrivers(userFound);
                    removeFromGroupCSUsers(userFound);
                    removeFleets(userId);
                    removeFromDriverEvs(userId);
                    removeInfrastructure(userId);
                    removeTariff(userId);
                    removeNotificationsDefinition(userId);
                    removeWallet(userId);
                    cancelAllTokens(userId);
                    contractsServices.updateContractStatusExternalNetworks(
                        userId,
                        false
                    );
                    await contractsServices.deleteCachedContractsByUser(userId);

                    if (userFound.clientName === 'EVIO') {
                        const mongocontroller = MongoDb();
                        mongocontroller
                            .deletemongoUser(userFound)
                            .then((result) => {
                                return res.status(200).send(result);
                            })
                            .catch((error) => {
                                Sentry.captureException(error);

                                console.error(
                                    `[${context}] Error `,
                                    error.message
                                );
                                return res
                                    .status(500)
                                    .send(error.message);
                            });
                    }
                    if (
                        userFound.clientName === process.env.WhiteLabelGoCharge
                    ) {
                        console.log(
                            '1 userFound.clientName - ',
                            userFound.clientName
                        );
                        const mongocontroller = MongoDb();
                        mongocontroller
                            .deletemongoUser(userFound)
                            .then((result) => {
                                return res.status(200).send(result);
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}] Error `,
                                    error.message
                                );
                                return res.status(500).send(error.message);
                            });
                    } else {
                        const mongocontroller = MongoDb();

                        mongocontroller
                            .deletemongoUser(userFound)
                            .then((result) => {
                                return res.status(200).send(result);
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}] Error `,
                                    error.message
                                );
                                return res
                                    .status(500)
                                    .send(error.message);
                            });
                    }
                    //return res.status(200).send(userFound);
                } else {
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_users_not_found',
                            message: 'Users not found for given parameters',
                        });
                }
            }
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Delete user account by user id (use only by EVIO)
router.delete('/api/private/users/byId_new', async (req, res, next) => {
    let context = 'DELETE /api/private/users/byId_new';
    try {
        //TODO to improve
        let userId = req.body.userId;

        UserHandler.removeUserById(userId)
            .then((value) => {
                return res.status(200).send(value);
            })
            .catch((err) => {
                console.error(
                    `[${context}][removeUserById][.catch] Error `,
                    err.message
                );
                ErrorHandler.ErrorHandler(err, res);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res);
    }
});

//========== FUNCTION ==========
const addUser = (user, res, headers) => {
    const context = 'Function addUser';
    const mongocontroller = MongoDb();
    mongocontroller
        .addmongoUser(user)
        .then(async() => {

            try {
                const userDependencies = await createUserDependencies(
                    user,
                    headers,
                    false
                );
                if (user.clientName === constants.clientNames.evio && user.clientType === constants.clientTypes.ClientB2C) {
                    const sent = await EmailChangeService.sendWelcomeEmail(user);
                    console.log(`[${context}][sendWelcomeEmail] sent: ${sent}`)
                }
                res.status(200).send(userDependencies);
            } catch (error) {
                Sentry.captureException(error);

                mongocontroller.deletemongoUser(user);
                return res.status(400).send(error);
            }

        })
        .catch((error) => {
            Sentry.captureException(error);
            if (error.auth != undefined) {
                return res.status(400).send(error);
            } else {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            }
        });
};

const addUserWlEVIO = (user, res, headers) => {
    const context = 'Function addUserWlEVIO';
    console.info(`[${context}] Starting process`);
    const mongocontroller = MongoDb();
    mongocontroller
        .addmongoUser(user, res)
        .then(async(result) => {

            try {
                console.log(`[${context}] Adding password for userId ${user._id}`);
                await UserPasswords.addPassword(user._id, user.password);

                userDriversDependencies(user);
                userGroupDriversDependencies(user);
                userGroupCSUsersDependencies(user);
                userDriverEv(user);
                if (
                    user.clientType === process.env.ClientTypeB2C &&
                    user.clientName !== process.env.clientNameKinto
                ) {
                    userActivation(user, headers);
                }
                if (user.clientType === process.env.ClientTypeB2B) {
                    createListPaymentMethods(user);
                    createListPaymentPeriods(user);
                }
                //sendEmail(user.email, user._id, user.name, res);
                createPoolDriver(user);
                createContract(user);
                createCEMETariffEVIO(user);
                createNotificataionsDefinition(user, headers);

                if (user.clientName === process.env.clientNameKinto) {
                    await createBillingProfileKinto(user);
                } else {
                    await createBillingProfile(user);
                }
                createWallet(user);

                const featureFlagEnabledWelcomeEmail = await toggle.isEnable('evio-5764-send-welcome-email-to-evio-users');
                if (featureFlagEnabledWelcomeEmail) {
                    if (user.clientName === constants.clientNames.evio && user.clientType === constants.clientTypes.ClientB2C) {
                        const sent = await EmailChangeService.sendWelcomeEmail(user);
                        console.log(`[${context}][sendWelcomeEmail] sent: ${sent}`)
                    }
                }
                return res.status(200).send({ user: user, message: {} });
            } catch (error) {
                console.error(`[${context}] Error `, error);
                Sentry.captureException(error);
                //In case of error, DELETE User on mongo DB
                mongocontroller.deletemongoUser(user);
                return res.status(400).send(error);
            }

        })
        .catch((error) => {
            console.error(`[${context}] Error `, error);
            if (error.auth != undefined) {
                return res.status(400).send(error);
            } else {
                return res.status(500).send(error.message);
            }
        });
};

const addUserWlLoginMobile = (user, res, headers) => {
    const context = 'Function addUserWlLoginMobile';
    const mongocontroller = MongoDb();
    mongocontroller
        .addmongoUserWlLoginMobile(user)
        .then(async(result) => {

            try {
                console.log(`[${context}] Adding password for userId ${user._id}`);
                await UserPasswords.addPassword(user._id, user.password);

                userDriversDependencies(user);
                userGroupDriversDependencies(user);
                userGroupCSUsersDependencies(user);
                userDriverEv(user);
                if (
                    user.clientType === process.env.ClientTypeB2C &&
                    user.clientName !== process.env.clientNameKinto
                ) {
                    userActivation(user, headers);
                }
                if (user.clientType === process.env.ClientTypeB2B) {
                    createListPaymentMethods(user);
                    createListPaymentPeriods(user);
                }
                //sendEmail(user.email, user._id, user.name, res);
                createPoolDriver(user);
                createContract(user);
                createCEMETariffEVIO(user);
                createNotificataionsDefinition(user, headers);
                await createBillingProfile(user);
                createWallet(user);

                return res.status(200).send({ user: user, message: {} });
            } catch (error) {
                Sentry.captureException(error);
                console.error(
                    `[${context}][addldapUserWlLoginMobile] Error `,
                    error.message
                );
                //In case of error, DELETE User on mongo DB
                mongocontroller.deletemongoUserWlLoginMobile(user);
                return res.status(400).send(error);
            }
        })
        .catch((error) => {
            if (error.auth != undefined) {
                return res.status(400).send(error);
            } else {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            }
        });
};

const addUserWl = (user, res, headers) => {
    const context = 'Function addUserWl';
    const mongocontroller = MongoDb();

    if (user.cardNumber) {
        user.cardNumber = user.cardNumber.replace(/\s/g, '');
    }

    mongocontroller
        .addmongoUserWl(user)
        .then(async(result) => {
            try {
                const userDependencies = await createUserDependencies(
                    user,
                    headers,
                    false
                );
                res.status(200).send(userDependencies);
            } catch (error) {
                mongocontroller.deletemongoUserWl(user);
                return res.status(400).send(error);
            }

        })
        .catch((error) => {
            if (error.auth != undefined) {
                return res.status(400).send(error);
            } else {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            }
        });
};

// TODO: Refactor this function to remove from users.js
async function createUserDependencies(user, headers, autoValidated) {
    const context = "createUserDependencies";

    console.log(`[${context}] Adding password for userId ${user._id}`);

    // TODO: Sometimes it's a User object, other times it's the request body
    if (user.password) {
        await UserPasswords.addPassword(user._id, user.password);
    }

    userDriversDependencies(user);
    userGroupDriversDependencies(user);
    userGroupCSUsersDependencies(user);
    userDriverEv(user);
    if (
        user.clientType !== process.env.ClientTypeB2B &&
        user.clientName !== process.env.clientNameKinto &&
        !autoValidated
    ) {
        userActivation(user, headers);
    }
    if (user.clientType === process.env.ClientTypeB2B) {
        createListPaymentMethods(user);
        createListPaymentPeriods(user);
    }
    createPoolDriver(user);
    createContract(user);
    createCEMETariffEVIO(user);
    createNotificataionsDefinition(user, headers);
    if (user.clientName === process.env.clientNameKinto) {
        await createBillingProfileKinto(user);
    } else {
        await createBillingProfile(user);
    }
    createWallet(user);

    if (
        user.clientName === process.env.WhiteLabelACP &&
        !user.activePartner &&
        user.cardNumber
    ) {
        if (user.faildConnectionACP) {
            return {
                user: user,
                message: {
                    auth: true,
                    code: 'server_user_partner_updated_faild',
                    message: `Hello ${user.name}, at the moment it has not been possible to validate your ACP membership card details, we will try later if they are filled in.`,
                },
            };
        } else if (user.cardAndMemberNotValid) {
            return {
                user: user,
                message: {
                    auth: true,
                    code: 'server_user_card_membership_not_match',
                    message: `Dear ${user.name}, the membership card number entered does not correspond to the membership number registered during your registration process, as such, you will not be able to take advantage of membership discounts as it was not possible to validate your ACP account. You can validate/update these fields later in your app.`,
                },
            };
        } else {
            return {
                user: user,
                message: {
                    auth: true,
                    code: 'server_user_not_discount',
                    message: `Dear  ${user.name}, your data does not entitle you to an ACP member discount on visa shipments, as it was not possible to validate your membership card number.`,
                },
            };
        }
    } else {
        return { user: user, message: {} };
    }
}

//Function to save image in file
function saveImageContent(user) {
    const context = 'Function saveImageContent';

    return new Promise((resolve, reject) => {
        try {
            console.log(`[${context}] Saving image content for userId=${user?._id}`);

            const dateNow = Date.now();
            const path = `/usr/src/app/img/users/${user._id}_${dateNow}.jpg`;
            let pathImage = '';
            const base64Image = user.imageContent.split(';base64,').pop();
            //console.log("base64Image", base64Image);
            if (process.env.NODE_ENV === 'production') {
                pathImage = `${process.env.HostProd}${user._id}_${dateNow}.jpg`; // For PROD server
            } else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = `${process.env.HostPreProd}${user._id}_${dateNow}.jpg`; // For Pre PROD server
            } else {
                //pathImage = `${process.env.HostLocal}${user._id}_${dateNow}.jpg`; // For local host
                pathImage = `${process.env.HostQA}${user._id}_${dateNow}.jpg`; // For QA server
            }
            fs.writeFile(
                path,
                base64Image,
                { encoding: 'base64' },
                function (err, result) {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        reject(err);
                    } else {
                        user.imageContent = pathImage;
                        resolve(user);
                    }
                }
            );
        } catch (error) {
            Sentry.captureException(error);
            console.error(`[${context}] Error during save image content for userId=${user?._id}`, error.message);
            reject(error);
        }
    });
}

//Function to remove image in file
function removeImageContent(user) {
    var context = 'Function removeImageContent';
    return new Promise((resolve, reject) => {
        try {
            const image = user.imageContent.split('/');

            const path = `/usr/src/app/img/users/${image[image.length - 1]}`;

            fs.unlink(path, (err) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    user.imageContent = '';
                    resolve(user);
                } else {
                    user.imageContent = '';
                    resolve(user);
                }
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

async function startUpdateUser(
    user,
    query,
    res,
    userId,
    clientName,
    clientType
) {
    const context = 'Function startUpdateUser';

    if (clientName === 'EVIO') {
        if (user.name || user.email || (user.name && user.email)) {
            if (user.email) {
                let params = {
                    email: user.email,
                    _id: { $ne: userId },
                    $or: [
                        { active: true },
                        { status: process.env.USERRREGISTERED },
                    ],
                    clientName: clientName,
                };

                User.findOne(params, (err, result) => {
                    if (err) {
                        console.error(`[${context}][] Error `, err.message);
                        ErrorHandler.ErrorHandler(err, res);
                    } else {
                        if (result) {
                            ErrorHandler.ErrorHandler({
                                auth: false,
                                code: 'server_email_taken',
                                message:
                                    'Email ' +
                                    user.email +
                                    ' is already registered',
                            }, res);
                        } else {
                            UserHandler.updateUsers(query, user)
                                .then((values) => {

                                    if (clientName == process.env.clientNameHyundai) {
                                        updateUserHyundai(userId);
                                    }

                                    return res
                                        .status(200)
                                        .send(values);

                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][updateUsers][.catch] Error `,
                                        error.message
                                    );
                                    ErrorHandler.ErrorHandler(error, res);
                                });
                        }
                    }
                });
            } else {
                UserHandler.updateUsers(query, user)
                    .then((values) => {

                        if (clientName == process.env.clientNameHyundai) {
                            updateUserHyundai(userId);
                        }

                        return res.status(200).send(values);
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][updateUsers][.catch] Error `,
                            error.message
                        );
                        ErrorHandler.ErrorHandler(error, res);
                    });
            }
        } else {
            UserHandler.updateUsers(query, user)
                .then((value) => {
                    if (value) {
                        if (clientName == process.env.clientNameHyundai)
                            updateUserHyundai(userId);

                        return res.status(200).send(value);
                    }
                    //return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
                    else
                        ErrorHandler.ErrorHandler({
                            auth: false,
                            code: 'server_user_not_updated',
                            message: 'User not updated',
                        }, res);
                })
                .catch((err) => {
                    console.error(
                        `[${context}][updateUsers][.catch] Error `,
                        err.message
                    );
                    ErrorHandler.ErrorHandler(err, res);
                });
        }
    } else if (process.env.clientNameLoginMobile.includes(clientName)) {
        console.log('clientName', clientName);
        if (user.name || user.email || (user.name && user.email)) {
            if (user.email) {
                let params = {
                    email: user.email,
                    _id: { $ne: userId },
                    $or: [
                        { active: true },
                        { status: process.env.USERRREGISTERED },
                    ],
                    clientName: clientName,
                };

                User.findOne(params, (err, result) => {
                    if (err) {
                        console.error(`[${context}][] Error `, err.message);
                        ErrorHandler.ErrorHandler(err, res);
                    } else {
                        if (result) {
                            ErrorHandler.ErrorHandler({
                                auth: false,
                                code: 'server_email_taken',
                                message:
                                    'Email ' +
                                    user.email +
                                    ' is already registered',
                            });
                        } else {
                            UserHandler.updateUsers(query, user)
                                .then((values) => {

                                    if (clientName == process.env.clientNameHyundai) {
                                        updateUserHyundai(userId);
                                    }

                                    return res
                                        .status(200)
                                        .send(values);
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][updateUsers][.catch] Error `,
                                        error.message
                                    );
                                    ErrorHandler.ErrorHandler(error, res);
                                });
                        }
                    }
                });
            } else {
                UserHandler.updateUsers(query, user)
                    .then((values) => {

                        if (clientName == process.env.clientNameHyundai) {
                            updateUserHyundai(userId);
                        }

                        return res.status(200).send(values);
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][updateUsers][.catch] Error `,
                            error.message
                        );
                        ErrorHandler.ErrorHandler(error, res);
                    });
            }
        } else {
            UserHandler.updateUsers(query, user)
                .then((value) => {
                    if (value) {
                        if (clientName == process.env.clientNameHyundai)
                            updateUserHyundai(userId);

                        return res.status(200).send(value);
                    }
                    //return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
                    else
                        ErrorHandler.ErrorHandler({
                            auth: false,
                            code: 'server_user_not_updated',
                            message: 'User not updated',
                        });
                })
                .catch((err) => {
                    console.error(
                        `[${context}][updateUsers][.catch] Error `,
                        err.message
                    );
                    ErrorHandler.ErrorHandler(err, res);
                });
        }
    } else if (
        process.env.CaetanoGOList.includes(clientName) &&
        !clientType.includes('BackOffice')
    ) {
        //console.log("user 1 ", user);

        try {
            let result;

            let userToUpdate = {
                name: user.name,
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                imageContent: user.imageContent,
            };

            switch (clientName) {
                case process.env.WhiteLabelGoCharge:
                    result = await updateUserCaetanoGO(userToUpdate, userId);

                    break;
                case process.env.WhiteLabelHyundai:
                    result = await updateUserCaetanoGO(userToUpdate, userId);

                    break;
                default:
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_clientName_unrecognized',
                            message: 'Unrecognized clientName',
                        });

                    break;
            }

            if (result) {
                UserHandler.updateUsersWl(query, userToUpdate)
                    .then((value) => {
                        if (value) {
                            /*User.findOne({ _id: value._id }, (err, userFound) => {
                                if (err) {
                                    console.error(`[${context}][ User.findOne] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                //return res.status(200).send(userFound);
                                let message = {};

                                return res.status(200).send({ user: userFound, message: message });
                            });*/

                            if (clientName == process.env.clientNameHyundai)
                                updateUserHyundai(userId);

                            return res.status(200).send(value);
                        } else
                            ErrorHandler.ErrorHandler(
                                {
                                    auth: false,
                                    code: 'server_user_not_updated',
                                    message: 'User not updated',
                                },
                                res
                            );
                        //return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
                    })
                    .catch((err) => {
                        console.error(
                            `[${context}][updateUsers][.catch] Error `,
                            err.message
                        );
                        ErrorHandler.ErrorHandler(err, res);
                        //return res.status(500).send(err.message);
                    });
            } else {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_user_not_updated',
                        message: 'User not updated',
                    });
            }
        } catch (error) {
            console.error(
                `[${context}][switch (clientName)] Error `,
                error.message
            );
            return res.status(500).send(error.message);
        }
    } else {
        console.log('user 2 ', user);

        if (
            user.name ||
            user.mobile ||
            user.internationalPrefix ||
            (user.name && user.mobile && user.internationalPrefix) ||
            (user.mobile && user.internationalPrefix)
        ) {
            if (
                user.mobile ||
                user.internationalPrefix ||
                (user.mobile && user.internationalPrefix)
            ) {
                var params = {
                    mobile: user.mobile,
                    internationalPrefix: user.internationalPrefix,
                    _id: { $ne: userId },
                    $or: [
                        { active: true },
                        { status: process.env.USERRREGISTERED },
                    ],
                    clientName: clientName,
                };

                //console.log("params", params);

                User.findOne(params, (err, result) => {
                    if (err) {
                        console.error(
                            `[${context}][findOne] Error `,
                            err.message
                        );
                        return res.status(500).send(err.message);
                    }

                    //console.log("result", result);
                    if (result) {
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_mobile_use',
                                message: 'Mobile is already in use!',
                            });
                    } else {
                        UserHandler.updateUsersWl(query, user)
                            .then((value) => {
                                if (value) {
                                    if (
                                        clientName ==
                                        process.env.clientNameHyundai
                                    )
                                        updateUserHyundai(userId);

                                    return res.status(200).send(value);
                                } else
                                    ErrorHandler.ErrorHandler(
                                        {
                                            auth: false,
                                            code: 'server_user_not_updated',
                                            message: 'User not updated',
                                        },
                                        res
                                    );
                            })
                            .catch((err) => {
                                console.error(
                                    `[${context}][updateUsers][.catch] Error `,
                                    err.message
                                );
                                ErrorHandler.ErrorHandler(err, res);
                            });
                    }
                });
            } else {
                UserHandler.updateUsersWl(query, user)
                    .then((value) => {
                        if (value) {
                            if (clientName == process.env.clientNameHyundai)
                                updateUserHyundai(userId);

                            return res.status(200).send(value);
                        } else
                            ErrorHandler.ErrorHandler(
                                {
                                    auth: false,
                                    code: 'server_user_not_updated',
                                    message: 'User not updated',
                                },
                                res
                            );
                    })
                    .catch((err) => {
                        console.error(
                            `[${context}][updateUsers][.catch] Error `,
                            err.message
                        );
                        ErrorHandler.ErrorHandler(err, res);
                    });
            }
        } else {
            UserHandler.updateUsersWl(query, user)
                .then((value) => {
                    if (value) {
                        if (clientName == process.env.clientNameHyundai)
                            updateUserHyundai(userId);

                        return res.status(200).send(value);
                    } else
                        ErrorHandler.ErrorHandler(
                            {
                                auth: false,
                                code: 'server_user_not_updated',
                                message: 'User not updated',
                            },
                            res
                        );
                })
                .catch((err) => {
                    console.error(
                        `[${context}][updateUsers][.catch] Error `,
                        err.message
                    );
                    ErrorHandler.ErrorHandler(err, res);
                });
        }
    }
}

async function startUpdateUserOld(
    user,
    query,
    res,
    userId,
    clientName,
    clientType
) {
    const context = 'Function startUpdateUser';

    if (clientName === 'EVIO') {
        if (user.name || user.email || (user.name && user.email)) {
            if (user.email) {
                let params = {
                    email: user.email,
                    _id: { $ne: userId },
                    $or: [
                        { active: true },
                        { status: process.env.USERRREGISTERED },
                    ],
                    clientName: clientName,
                };

                User.findOne(params, (err, result) => {
                    if (err) {
                        console.error(`[${context}][] Error `, err.message);
                        ErrorHandler.ErrorHandler(err, res);
                    } else {
                        if (result) {
                            ErrorHandler.ErrorHandler({
                                auth: false,
                                code: 'server_email_taken',
                                message:
                                    'Email ' +
                                    user.email +
                                    ' is already registered',
                            });
                        } else {
                            UserHandler.updateUsers(query, user)
                                .then((values) => {
                                    LdapServices.changeNameEmail(values.user)
                                        .then((result) => {
                                            if (result)
                                                //return res.status(200).send(values);
                                                return res
                                                    .status(200)
                                                    .send({
                                                        auth: true,
                                                        code: 'server_user_updated',
                                                        message: 'User updated',
                                                    });
                                            else
                                                ErrorHandler.ErrorHandler({
                                                    auth: false,
                                                    code: 'server_user_not_updated',
                                                    message: 'User not updated',
                                                });
                                        })
                                        .catch((error) => {
                                            console.error(
                                                `[${context}][changeNameEmail][.catch] Error `,
                                                error.message
                                            );
                                            ErrorHandler.ErrorHandler(
                                                error,
                                                res
                                            );
                                        });

                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][updateUsers][.catch] Error `,
                                        error.message
                                    );
                                    ErrorHandler.ErrorHandler(error, res);
                                });
                        }
                    }
                });
            } else {
                UserHandler.updateUsers(query, user)
                    .then((values) => {
                        changeName(values.user)
                            .then((result) => {
                                if (result)
                                    //return res.status(200).send(values);
                                    return res
                                        .status(200)
                                        .send({
                                            auth: true,
                                            code: 'server_user_updated',
                                            message: 'User updated',
                                        });
                                else
                                    ErrorHandler.ErrorHandler({
                                        auth: false,
                                        code: 'server_user_not_updated',
                                        message: 'User not updated',
                                    });
                            })
                            .catch((error) => {
                                console.error(
                                    `[${context}][updateUsers][.catch] Error `,
                                    error.message
                                );
                                ErrorHandler.ErrorHandler(error, res);
                            });

                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][updateUsers][.catch] Error `,
                            error.message
                        );
                        ErrorHandler.ErrorHandler(error, res);
                    });
            }
        } else {
            UserHandler.updateUsers(query, user)
                .then((value) => {
                    if (value)
                        //return res.status(200).send(value);
                        return res
                            .status(200)
                            .send({
                                auth: true,
                                code: 'server_user_updated',
                                message: 'User updated',
                            });
                    else
                        ErrorHandler.ErrorHandler({
                            auth: false,
                            code: 'server_user_not_updated',
                            message: 'User not updated',
                        });
                })
                .catch((err) => {
                    console.error(
                        `[${context}][updateUsers][.catch] Error `,
                        err.message
                    );
                    ErrorHandler.ErrorHandler(err, res);
                });
        }
    } else if (process.env.clientNameLoginMobile.includes(clientName)) {
        console.log('clientName', clientName);
        if (user.name || user.email || (user.name && user.email)) {
            if (user.email) {
                let params = {
                    email: user.email,
                    _id: { $ne: userId },
                    $or: [
                        { active: true },
                        { status: process.env.USERRREGISTERED },
                    ],
                    clientName: clientName,
                };

                User.findOne(params, (err, result) => {
                    if (err) {
                        console.error(`[${context}][] Error `, err.message);
                        ErrorHandler.ErrorHandler(err, res);
                    } else {
                        if (result) {
                            ErrorHandler.ErrorHandler({
                                auth: false,
                                code: 'server_email_taken',
                                message:
                                    'Email ' +
                                    user.email +
                                    ' is already registered',
                            });
                        } else {
                            UserHandler.updateUsers(query, user)
                                .then((values) => {

                                    return res
                                        .status(200)
                                        .send({
                                            auth: true,
                                            code: 'server_user_updated',
                                            message: 'User updated',
                                        });
                                })
                                .catch((error) => {
                                    console.error(
                                        `[${context}][updateUsers][.catch] Error `,
                                        error.message
                                    );
                                    ErrorHandler.ErrorHandler(error, res);
                                });
                        }
                    }
                });
            } else {
                UserHandler.updateUsers(query, user)
                    .then(() => {
                        return res
                            .status(200)
                            .send({
                                auth: true,
                                code: 'server_user_updated',
                                message: 'User updated',
                            });

                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][updateUsers][.catch] Error `,
                            error.message
                        );
                        ErrorHandler.ErrorHandler(error, res);
                    });
            }
        } else {
            UserHandler.updateUsers(query, user)
                .then((value) => {
                    if (value)
                        //return res.status(200).send(value);
                        return res
                            .status(200)
                            .send({
                                auth: true,
                                code: 'server_user_updated',
                                message: 'User updated',
                            });
                    else
                        ErrorHandler.ErrorHandler({
                            auth: false,
                            code: 'server_user_not_updated',
                            message: 'User not updated',
                        });
                })
                .catch((err) => {
                    console.error(
                        `[${context}][updateUsers][.catch] Error `,
                        err.message
                    );
                    ErrorHandler.ErrorHandler(err, res);
                });
        }
    } else if (
        process.env.CaetanoGOList.includes(clientName) &&
        !clientType.includes('BackOffice')
    ) {
        //console.log("user 1 ", user);

        try {
            let result;

            let userToUpdate = {
                name: user.name,
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                imageContent: user.imageContent,
            };

            switch (clientName) {
                case process.env.WhiteLabelGoCharge:
                    result = await updateUserCaetanoGO(userToUpdate, userId);

                    break;
                case process.env.WhiteLabelHyundai:
                    result = await updateUserCaetanoGO(userToUpdate, userId);

                    break;
                default:
                    return res
                        .status(400)
                        .send({
                            auth: false,
                            code: 'server_clientName_unrecognized',
                            message: 'Unrecognized clientName',
                        });

                    break;
            }

            if (result) {
                UserHandler.updateUsersWl(query, userToUpdate)
                    .then((value) => {
                        if (value) {
                            /*User.findOne({ _id: value._id }, (err, userFound) => {
                                if (err) {
                                    console.error(`[${context}][ User.findOne] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                //return res.status(200).send(userFound);
                                let message = {};

                                return res.status(200).send({ user: userFound, message: message });
                            });*/
                            return res.status(200).send(value);
                        } else
                            ErrorHandler.ErrorHandler(
                                {
                                    auth: false,
                                    code: 'server_user_not_updated',
                                    message: 'User not updated',
                                },
                                res
                            );
                        //return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
                    })
                    .catch((err) => {
                        console.error(
                            `[${context}][updateUsers][.catch] Error `,
                            err.message
                        );
                        ErrorHandler.ErrorHandler(err, res);
                        //return res.status(500).send(err.message);
                    });
            } else {
                return res
                    .status(400)
                    .send({
                        auth: false,
                        code: 'server_user_not_updated',
                        message: 'User not updated',
                    });
            }
        } catch (error) {
            console.error(
                `[${context}][switch (clientName)] Error `,
                error.message
            );
            return res.status(500).send(error.message);
        }
    } else {
        console.log('user 2 ', user);

        if (
            user.name ||
            user.mobile ||
            user.internationalPrefix ||
            (user.name && user.mobile && user.internationalPrefix) ||
            (user.mobile && user.internationalPrefix)
        ) {
            if (
                user.mobile ||
                user.internationalPrefix ||
                (user.mobile && user.internationalPrefix)
            ) {
                var params = {
                    mobile: user.mobile,
                    internationalPrefix: user.internationalPrefix,
                    _id: { $ne: userId },
                    $or: [
                        { active: true },
                        { status: process.env.USERRREGISTERED },
                    ],
                    clientName: clientName,
                };

                //console.log("params", params);

                User.findOne(params, (err, result) => {
                    if (err) {
                        console.error(
                            `[${context}][findOne] Error `,
                            err.message
                        );
                        return res.status(500).send(err.message);
                    }

                    //console.log("result", result);
                    if (result) {
                        return res
                            .status(400)
                            .send({
                                auth: false,
                                code: 'server_mobile_use',
                                message: 'Mobile is already in use!',
                            });
                    } else {
                        UserHandler.updateUsersWl(query, user)
                            .then((value) => {
                                if (value) {
                                    return res.status(200).send(value);
                                } else
                                    ErrorHandler.ErrorHandler(
                                        {
                                            auth: false,
                                            code: 'server_user_not_updated',
                                            message: 'User not updated',
                                        },
                                        res
                                    );
                            })
                            .catch((err) => {
                                console.error(
                                    `[${context}][updateUsers][.catch] Error `,
                                    err.message
                                );
                                ErrorHandler.ErrorHandler(err, res);
                            });
                    }
                });
            } else {
                UserHandler.updateUsersWl(query, user)
                    .then((value) => {
                        if (value) {
                            return res.status(200).send(value);
                        } else
                            ErrorHandler.ErrorHandler(
                                {
                                    auth: false,
                                    code: 'server_user_not_updated',
                                    message: 'User not updated',
                                },
                                res
                            );
                    })
                    .catch((err) => {
                        console.error(
                            `[${context}][updateUsers][.catch] Error `,
                            err.message
                        );
                        ErrorHandler.ErrorHandler(err, res);
                    });
            }
        } else {
            UserHandler.updateUsersWl(query, user)
                .then((value) => {
                    if (value) {
                        return res.status(200).send(value);
                    } else
                        ErrorHandler.ErrorHandler(
                            {
                                auth: false,
                                code: 'server_user_not_updated',
                                message: 'User not updated',
                            },
                            res
                        );
                })
                .catch((err) => {
                    console.error(
                        `[${context}][updateUsers][.catch] Error `,
                        err.message
                    );
                    ErrorHandler.ErrorHandler(err, res);
                });
        }
    }
}

//function to send a SMS with activation key
function userActivation(user, headers) {
    const context = 'Function userActivation';
    try {
        //Generating code
        var code = getRandomInt(10000, 100000);
        var activation = new Activation({
            code: code,
            userId: user._id,
        });
        Activation.createActivation(activation, async(error, result) => {
            if (error) {
                Sentry.captureException(error);
                reject(error);
            }

            if (result) {
                const isWhiteLabelB2C =
                    user.clientType === process.env.ClientTypeB2C &&
                    user.clientName !== process.env.clientNameEVIO;

                if (
                    user.clientType === process.env.ClientTypeB2B ||
                    isWhiteLabelB2C
                ) {
                    sendActivationEmail(
                        user,
                        code,
                        'activeAccount',
                        headers.clientname
                    )
                        .then(() => {
                            console.log(`[${context}] Email sent successfully!`);
                        })
                        .catch((error) => {
                            Sentry.captureException(error);
                            console.error(`[${context}] Email sent unsuccessfully for email=${user?.email} and clientName=${headers?.clientName}!`);
                        });
                } else {
                    await sendActivationSMS(user, code, headers.client);
                }
            } else console.log(`[${context}] SMS sent unsuccessfully!`);
        });
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error`, error);
    }
}

function userActivationWl(user, headers) {
    var context = 'Function userActivationWl';
    try {
        var code = getRandomInt(10000, 100000);
        var activation = new Activation({
            code: code,
            userId: user._id,
        });

        console.log('activation - ', activation);

        Activation.createActivation(activation, (error, result) => {
            if (error) reject(error);
            if (result) {
                console.log('user.clientName', user.clientName);
                sendActivationEmailWl(
                    user,
                    code,
                    'activeAccount',
                    user.clientName
                )
                    .then(() => {
                        console.log('Email sent successfully!');
                    })
                    .catch(() => {
                        console.log('Email sent unsuccessfully!');
                    });
            } else {
                console.log('SMS sent unsuccessfully!');
            }
        });
    } catch (error) {
        console.error(`[${context}] Error`, error);
    }
}

function userCodeChangeMobile(user, headers) {
    var context = 'Function userActivation';
    try {
        //Generating code
        var code = getRandomInt(10000, 100000);
        var activation = new Activation({
            code: code,
            userId: user._id,
        });
        Activation.createActivation(activation, (error, result) => {
            if (error) {
                console.error(`[${context}] Error`, error);
            }
            if (result) {
                sendNewMobileSMS(user, code, headers)
                    .then(() => {
                        console.log('SMS sent successfully!');
                    })
                    .catch(() => {
                        console.log('SMS sent unsuccessfully!');
                    });
            } else console.log('SMS sent unsuccessfully!');
        });
    } catch (error) {
        console.error(`[${context}] Error`, error);
    }
}

function userCodeChangeEmail(user, clientName) {
    var context = 'Function userCodeChangeEmail';
    try {
        //Generating code
        var code = getRandomInt(10000, 100000);

        var activation = new Activation({
            code: code,
            userId: user._id,
        });

        Activation.createActivation(activation, (error, result) => {
            if (error) {
                console.error(`[${context}] Error`, error);
            }
            if (result) {
                sendActivationEmail(
                    user,
                    code,
                    'activeAccountChangeEmail',
                    clientName
                )
                    .then(() => {
                        console.log('Email sent successfully!');
                    })
                    .catch(() => {
                        console.log('Email sent unsuccessfully!');
                    });
            } else console.log('Email sent unsuccessfully!');
        });
    } catch (error) {
        console.error(`[${context}] Error`, error);
    }
}

function userCodeChangeEmailWl(user, clientName) {
    var context = 'Function userCodeChangeEmailWl';
    try {
        var code = getRandomInt(10000, 100000);

        var activation = new Activation({
            code: code,
            userId: user._id,
        });

        console.log('clientName', clientName);

        Activation.createActivation(activation, (error, result) => {
            if (error) {
                console.error(`[${context}] Error`, error);
            }
            if (result) {
                sendActivationEmailWl(
                    user,
                    code,
                    'activeAccountChangeEmail',
                    clientName
                )
                    .then(() => {
                        console.log('Email sent successfully!');
                    })
                    .catch(() => {
                        console.log('Email sent unsuccessfully!');
                    });
            } else console.log('Email sent unsuccessfully!');
        });
    } catch (error) {
        console.error(`[${context}] Error`, error);
    }
}

function validateFieldsUsersPackages(usersPackages) {
    return new Promise((resolve, reject) => {
        if (!usersPackages)
            reject({
                auth: false,
                code: 'server_usersPackages_required',
                message: 'Users packages data is required',
            });
        else if (!usersPackages.packageId)
            reject({
                auth: false,
                code: 'server_packageId_required',
                message: 'Package id is required',
            });
        else if (!usersPackages.packageName)
            reject({
                auth: false,
                code: 'server_packageName_required',
                message: 'Package name is required',
            });
        else if (!usersPackages.packageType)
            reject({
                auth: false,
                code: 'server_packageType_required',
                message: 'Package type is required',
            });
        else if (!usersPackages.rfidCardsLimit)
            reject({
                auth: false,
                code: 'server_rfidCardsLimit_required',
                message: 'RFID Cards Limit is required',
            });
        else if (!usersPackages.fleetsLimit)
            reject({
                auth: false,
                code: 'server_fleetsLimit_required',
                message: 'Fleets limit is required',
            });
        else if (!usersPackages.evsLimit)
            reject({
                auth: false,
                code: 'server_evsLimit_required',
                message: 'EVs limit is required',
            });
        else if (!usersPackages.driversLimit)
            reject({
                auth: false,
                code: 'server_driversLimit_required',
                message: 'Drivers limit is required',
            });
        else if (!usersPackages.groupOfDriversLimit)
            reject({
                auth: false,
                code: 'server_groupOfDriversLimit_required',
                message: 'Group of drivers limit is required',
            });
        else if (!usersPackages.driversInGroupDriversLimit)
            reject({
                auth: false,
                code: 'server_driversInGroupDriversLimit_required',
                message: 'Drivers in group drivers limit is required',
            });
        else if (!usersPackages.chargingAreasLimit)
            reject({
                auth: false,
                code: 'server_chargingAreasLimit_required',
                message: 'Charging areas limit is required',
            });
        else if (!usersPackages.evioBoxLimit)
            reject({
                auth: false,
                code: 'server_evioBoxLimit_required',
                message: 'EVIO Box limit is required',
            });
        else if (!usersPackages.chargersLimit)
            reject({
                auth: false,
                code: 'server_chargersLimit_required',
                message: 'Chargers limit is required',
            });
        else if (!usersPackages.tariffsLimit)
            reject({
                auth: false,
                code: 'server_tariffsLimit_required',
                message: 'Tariffs limit is required',
            });
        else if (!usersPackages.chargersGroupsLimit)
            reject({
                auth: false,
                code: 'server_chargersGroupsLimit_required',
                message: 'Chargers groups limit is required',
            });
        else if (!usersPackages.userInChargerGroupsLimit)
            reject({
                auth: false,
                code: 'server_userInChargerGroupsLimit_required',
                message: 'User in charger groups limit is required',
            });
        else if (!usersPackages.searchLocationsLimit)
            reject({
                auth: false,
                code: 'server_searchLocationsLimit_required',
                message: 'Search locations limit is required',
            });
        else if (!usersPackages.searchChargersLimit)
            reject({
                auth: false,
                code: 'server_searchChargersLimit_required',
                message: 'Search chargers limit is required',
            });
        else if (!usersPackages.comparatorLimit)
            reject({
                auth: false,
                code: 'server_comparatorLimit_required',
                message: 'Comparator limit is required',
            });
        else if (!usersPackages.routerLimit)
            reject({
                auth: false,
                code: 'server_routerLimit_required',
                message: 'Router limit is required',
            });
        else resolve(true);
    });
}

//function to gereta a code of six digits
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

function getRandomIdTag(min, max) {
    return new Promise((resolve) => {
        let newMin = Math.ceil(min);
        let newMax = Math.floor(max);

        var random = Math.floor(Math.random() * (newMax - newMin)) + newMin;

        let query = {
            networks: {
                $elemMatch: {
                    tokens: {
                        $elemMatch: {
                            tokenType: process.env.TokensTypeApp_User,
                            $or: [
                                { idTagDec: random },
                                { idTagHexa: random },
                                { idTagHexaInv: random },
                            ],
                        },
                    },
                },
            },
        };

        Contract.find(query, (err, result) => {
            if (err) {
                console.error(`[] Error `, err.message);
                return err;
            } else {
                if (result.length > 0) {
                    getRandomIdTag(min, max).then((result) => {
                        resolve(result);
                    });
                } else {
                    resolve(random);
                }
            }
        });
    });
}

function sendActivationEmail(user, code, action, clientName) {
    var context = 'Function sendActivationEmail';
    return new Promise((resolve, reject) => {
        var host =
            process.env.HostNotifications +
            process.env.PathNotificationsSendEmail;

        console.log(user.name);

        var mailOptions = {
            to: user.email,
            message: {
                username: user.name,
                passwordCode: code,
            },
            type: action,
        };

        let headers = {
            clientname: clientName,
        };

        axios
            .post(host, { mailOptions }, { headers })
            .then((result) => {
                if (result) resolve();
                else reject();
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
}

function sendActivationEmailWl(user, code, action, clientName) {
    var context = 'Function sendActivationEmailWl';
    return new Promise((resolve, reject) => {
        try {
            var host =
                process.env.HostNotifications +
                process.env.PathNotificationsSendEmail;

            var mailOptions = {
                to: user.email,
                message: {
                    username: user.name,
                    passwordCode: code,
                },
                type: action,
            };

            let headers = {
                clientname: clientName,
            };
            console.log('headers', headers);

            axios
                .post(host, { mailOptions }, { headers })
                .then((result) => {
                    if (result) resolve();
                    else reject('email sent unsuccessfully!');
                })
                .catch((error) => {
                    if (error.response) {
                        console.error(
                            `[${context}][.catch] Error `,
                            error.response.data
                        );
                        reject(error);
                    } else {
                        console.error(
                            `[${context}][.catch] Error `,
                            error.message
                        );
                        reject(error);
                    }
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

function sendActivationChangeEmail(user, code) {
    var context = 'Function sendActivationChangeEmail';
    return new Promise((resolve, reject) => {
        var host =
            process.env.HostNotifications +
            process.env.NotificationsPathEmailChangeEmail;

        var data = {
            email: user.email,
            message: code,
        };

        axios
            .post(host, data)
            .then((result) => {
                if (result) resolve();
                else reject();
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
}

function sendNewMobileSMS(user, code, headers) {
    var context = 'Function sendNewMobileSMS';
    return new Promise((resolve, reject) => {
        var host =
            process.env.HostNotifications +
            process.env.PathNotificationsChangeNumber;
        var params = {
            user: user,
            message: code,
            headers: headers,
        };

        axios
            .post(host, params)
            .then((result) => {
                if (result) resolve();
                else reject();
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });
    });
}

function sendEmail(email, id, name, res) {
    var context = 'Function sendEmail';
    var transporter = nodemailer.createTransport({
        host: 'smtp.live.com',
        port: '25',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    var mailOptions = {
        source: '"evio Support" <support@go-evio.com>',
        from: '"evio Support" <support@go-evio.com>', // sender address
        to: email,
        subject: 'Validate Email',
        text: 'Validate Email', // plaintext body
        html:
            '<h2>Thanks for signing up to evio solution!</h2>' +
            '<h3>To get started, click the link below to confirm your account.</h3>' +
            '<a href="http://85.88.143.237:80/account/confirm-email/' +
            id +
            '/' +
            name +
            '">Confirm your account</a>',
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) console.error(`[${context}] Error `, error.message);
        else console.error(`[${context}] Email sent: `, info.response);
    });
}

function validateFields(user) {
    return new Promise((resolve, reject) => {
        let regexPasswordValidation =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/;
        if (!user)
            reject({
                auth: false,
                code: 'server_user_required',
                message: 'User data is required',
            });
        else if (!user.username)
            reject({
                auth: false,
                code: 'server_username_required',
                message: 'Username is required',
            });
        else if (!user.email)
            reject({
                auth: false,
                code: 'server_email_required',
                message: 'Email is required',
            });
        else if (!user.password)
            reject({
                auth: false,
                code: 'server_password_required',
                message: 'Password is required',
            });
        else if (!user.mobile)
            reject({
                auth: false,
                code: 'server_mobile_required',
                message: 'Mobile phone is required',
            });
        else if (!user.internationalPrefix)
            reject({
                auth: false,
                code: 'server_international_prefix_required',
                message: 'International mobile prefix is required',
            });
        else if (!regexPasswordValidation.test(user.password))
            reject({
                auth: false,
                code: 'server_invalid_password',
                message: 'Password is invalid',
            });
        else resolve(true);
    });
}

function validateFieldsWL(user) {
    return new Promise((resolve, reject) => {
        let regexPasswordValidation =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/;

        if (!user)
            reject({
                auth: false,
                code: 'server_user_required',
                message: 'User data is required',
            });
        else if (!user.username)
            reject({
                auth: false,
                code: 'server_username_required',
                message: 'Username is required',
            });
        else if (!user.email)
            reject({
                auth: false,
                code: 'server_email_required',
                message: 'Email is required',
            });
        else if (!user.password)
            reject({
                auth: false,
                code: 'server_password_required',
                message: 'Password is required',
            });
        /*
        else if (!user.mobile)
            reject({ auth: false, code: 'server_mobile_required', message: 'Mobile phone is required' });

        else if (!user.internationalPrefix)
            reject({ auth: false, code: 'server_international_prefix_required', message: 'International mobile prefix is required' });
        */ else if (!regexPasswordValidation.test(user.password))
            reject({
                auth: false,
                code: 'server_invalid_password',
                message: 'Password is invalid',
            });
        else resolve(true);
    });
}

function validateFieldsCompany(user) {
    return new Promise((resolve, reject) => {
        let regexPasswordValidation =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/;
        if (!user)
            reject({
                auth: false,
                code: 'server_user_required',
                message: 'User data is required',
            });
        else if (!user.username)
            reject({
                auth: false,
                code: 'server_username_required',
                message: 'Username is required',
            });
        else if (!user.email)
            reject({
                auth: false,
                code: 'server_email_required',
                message: 'Email is required',
            });
        else if (!user.password)
            reject({
                auth: false,
                code: 'server_password_required',
                message: 'Password is required',
            });
        else if (!user.mobile)
            reject({
                auth: false,
                code: 'server_mobile_required',
                message: 'Mobile phone is required',
            });
        else if (!user.paymentPeriod)
            reject({
                auth: false,
                code: 'server_paymentPeriod_required',
                message: 'Payment Period is required',
            });
        else if (!user.internationalPrefix)
            reject({
                auth: false,
                code: 'server_international_prefix_required',
                message: 'International mobile prefix is required',
            });
        else if (!regexPasswordValidation.test(user.password))
            reject({
                auth: false,
                code: 'server_invalid_password',
                message: 'Password is invalid',
            });
        else if (!Validator.validate(user.email))
            reject({
                auth: false,
                code: 'server_email_not_valid',
                message: 'Email not valid',
            });
        else resolve(true);
    });
}

function userFindOne(query) {
    var context = 'Function userFindOne';
    return new Promise((resolve, reject) => {
        User.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

//function to get details from users in data base
const getDetails = (elem) => {
    var context = 'Function getDetails';
    return new Promise((resolve, reject) => {
        var query = {
            mobile: elem.mobile,
            internationalPrefix: elem.internationalPrefix,
        };
        User.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}] findOne `, err.message);
                reject(err);
            } else {
                if (result) {
                    elem._id = result._id;
                    elem.imageContent = result.imageContent;
                    elem.internationalPrefix = result.internationalPrefix;
                    resolve(elem);
                } else {
                    elem._id = '';
                    elem.imageContent = '';
                    elem.internationalPrefix = '';
                    resolve(elem);
                }
            }
        });
    });
};

//function to edit a user
function updateUsers(query, user) {
    var context = 'Function updateUsers';
    return new Promise(async (resolve, reject) => {
        try {
            //User.updateUser(query, user, (err, result) => {
            let userFound;
            if (user.cardNumber) {
                user.cardNumber = user.cardNumber.replace(/\s/g, '');
                userFound = await User.findOne({
                    _id: { $ne: user._id },
                    cardNumber: user.cardNumber,
                    clientName: user.clientName,
                    active: true,
                });
            }

            if (userFound) {
                reject({
                    auth: false,
                    code: 'server_cardNumber_taken',
                    message:
                        'Card Number ' +
                        user.cardNumber +
                        ' already in use by another user',
                });
            } else {
                User.findOneAndUpdate(
                    query,
                    user,
                    { new: true },
                    async (err, result) => {
                        if (err) {
                            console.error(
                                `[${context}][updateUser] Error `,
                                err.message
                            );
                            reject(err);
                        }
                        if (result) {
                            if (
                                query.clientName === process.env.clientNameACP
                            ) {
                                let userResponse =
                                    await UserHandler.validateData(
                                        result,
                                        user.cardNumber
                                    );
                                console.log('userResponse', userResponse);
                                resolve(result);
                            } else {
                                user.mobile = result.mobile;
                                resolve(result);
                            }
                        } else resolve(false);
                    }
                );
            }
        } catch (err) {
            console.error(`[${context}] Error `, err.message);
            reject(err);
        }
    });
}

//function to vaildate password change
async function validatePassword(passwords) {
    return new Promise((resolve, reject) => {
        let regexPasswordValidation =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/;
        if (!passwords.password)
            reject({
                auth: false,
                code: 'server_password_req',
                message: 'Current password is required',
            });

        if (!passwords.newPassword)
            reject({
                auth: false,
                code: 'server_new_password_req',
                message: 'New password is required',
            });

        if (!passwords.confPassword)
            reject({
                auth: false,
                code: 'server_conf_password_req',
                message: 'Password confirmation is required',
            });

        if (!regexPasswordValidation.test(passwords.newPassword))
            reject({
                auth: false,
                code: 'server_invalid_password',
                message: 'New password is invalid',
            });

        if (passwords.newPassword !== passwords.confPassword)
            reject({
                auth: false,
                code: 'server_password_not_match',
                message: 'New password and confirmation password are different',
            });
        else resolve();
    });
}

function updateMobileAndName(user) {
    var context = 'Function updateMobileAndName';
    updateMobileContract(user);
    updateDrivers(user);
    updateGroupDrivers(user);
    updateGroupCSUsers(user);
    updateNameContract(user);
}

//Function to change name on Ldap
function changeName(user) {
    const context = 'Function changeName';
    return new Promise((resolve, reject) => {
        try {
            LdapServices.updateEmailAndName(user);
            resolve(user);
        } catch (err) {
            console.error(`[${context}] Error `, err.message);
            reject(err);
        }
    });
}

//Function to change mobile on mongo
function updateMobileMongo(user) {
    var context = 'Function updateMobileMongo';
    return new Promise((resolve, reject) => {
        try {
            var query = {
                _id: user._id,
            };

            if (user.clientType === process.env.ClientTypeb2c)
                user.active = false;

            User.updateUser(query, user, (err, result) => {
                if (err) {
                    console.error(
                        `[${context}][updateUser] Error `,
                        err.message
                    );
                    reject(err);
                } else {
                    if (result) resolve(true);
                    else resolve(false);
                }
            });
        } catch (ex) {
            console.error(`[${context}] Error `, ex);
            reject(ex);
        }
    });
}

function updateEmailMongo(user) {
    var context = 'Function updateEmailMongo';
    return new Promise((resolve, reject) => {
        try {
            var query = {
                _id: user._id,
            };

            if (user.clientType === process.env.ClientTypeb2c)
                user.active = false;

            User.updateUser(query, { $set: user }, (err, result) => {
                if (err) {
                    console.error(
                        `[${context}][updateUser] Error `,
                        err.message
                    );
                    reject(err);
                } else {
                    if (result) resolve(true);
                    else resolve(false);
                }
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

//Function to verify if work and home already exists
function verifyExistence(user, result) {
    var context = 'Function verifyExistence';
    return new Promise(async (resolve, reject) => {
        try {
            user.referencePlaces.forEach((referencePlace) => {
                var found = result.referencePlaces.find((place) => {
                    return place.type === referencePlace.type;
                });
                if (found == undefined)
                    result.referencePlaces.push(referencePlace);
                else {
                    if (found.type === 'HOME' || found.type === 'WORK')
                        result.referencePlaces = referencePlace;
                    else result.referencePlaces.push(referencePlace);
                }
            });
            const sendReply = () => {
                resolve(result);
            };
            await sendReply();
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

//Function to get chargers
function getChargersFavorites(favorites) {
    var context = 'Function getChargersFavorites';
    return new Promise((resolve, reject) => {
        try {
            var _id = [];
            var hwId = [];
            const getFavorites = (favorite) => {
                return new Promise((resolve) => {
                    _id.push(favorite.baseId);
                    hwId.push(favorite.hwId);
                    resolve(true);
                });
            };
            Promise.all(favorites.map((favorite) => getFavorites(favorite)))
                .then((value) => {
                    var host =
                        process.env.HostCharger +
                        process.env.PathChargerFavorites;
                    var data = {
                        $and: [
                            {
                                $or: [{ _id: _id }, { hwId: hwId }],
                            },
                            {
                                hasInfrastructure: true,
                                active: true,
                            },
                        ],
                    };
                    axios
                        .get(host, { data })
                        .then((value) => {
                            //console.log("value.data", value.data);
                            resolve(value.data);
                        })
                        .catch((error) => {
                            console.error(
                                `[${context}][get][.catch]`,
                                error.message
                            );
                            reject(error);
                        });
                })
                .catch((error) => {
                    console.error(
                        `[${context}][favorites.map][.catch] Error `,
                        error.message
                    );
                    reject(error);
                });
        } catch (error) {
            console.error(`[${context}] error `, error);
            reject(error);
        }
    });
}

//
function getChargersPublic(favoritesPublic) {
    var context = 'Function getChargersPublic';
    var publicFavorites = [];
    return new Promise((resolve, reject) => {
        const getFavoritesPublic = (favorite) => {
            return new Promise((resolve, reject) => {
                /*var service = hostList.find((host) => {
                    return host.chargerType == favorite.chargerType
                });

                if (service != undefined) {
                    */
                var host =
                    process.env.PublicNetworkHost +
                    process.env.PathPublicFavorites;
                var data = favorite;
                axios
                    .get(host, { data })
                    .then((value) => {
                        if (value.data.length != 0) {
                            publicFavorites.push(value.data[0]);
                        }
                        resolve(true);
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][${host}] Error `,
                            error.message
                        );
                        reject(error);
                    });
                /*}
                else
                    resolve(false);
*/
            });
        };

        Promise.all(
            favoritesPublic.map((favorite) => getFavoritesPublic(favorite))
        )
            .then((result) => {
                resolve(publicFavorites);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });
    });
}

//Function to verify if the user exist on driversDependencies
function userDriversDependencies(user) {
    const context = 'Function userDriversDependencies';

    var query = {
        drivers: {
            $elemMatch: {
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                registered: false,
            },
        },
        clientName: user.clientName,
    };

    DriversDependencies.find(query, (err, driverDependenciesFound) => {
        if (err) {
            Sentry.captureException(err);
            console.error(
                `[${context}][DriversDependencies.find] Error `,
                err.message
            );
        } else {
            if (driverDependenciesFound.length > 0) {
                userPoolDrivers(user);
                const getDriver = (driver) => {
                    return new Promise((resolve) => {
                        if (
                            driver.mobile == user.mobile &&
                            driver.internationalPrefix ==
                                user.internationalPrefix
                        ) {
                            driver.registered = true;
                            resolve(true);
                        } else resolve(false);
                    });
                };
                const getDriverDependencies = (driverDependencies) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            driverDependencies.drivers.map((driver) =>
                                getDriver(driver)
                            )
                        ).then(() => {
                            var newValue = { $set: driverDependencies };
                            var query = {
                                _id: driverDependencies._id,
                            };
                            DriversDependencies.updateDriversDependencies(
                                query,
                                newValue,
                                (err, result) => {
                                    if (err) {
                                        Sentry.captureException(err);
                                        console.error(
                                            `[${context}][updateDriversDependencies] Error `,
                                            err.message
                                        );
                                    } else {
                                        console.log(
                                            'Drivers Dependencies updated'
                                        );
                                    }
                                }
                            );
                            resolve(true);
                        });
                    });
                };
                Promise.all(
                    driverDependenciesFound.map((driverDependencies) =>
                        getDriverDependencies(driverDependencies)
                    )
                ).then(() => {
                    console.log('Drivers Dependencies updated');
                }).catch((err) => {
                    Sentry.captureException(err);
                    console.error(
                        `[${context}][getDriverDependencies] Error `,
                        err.message
                    );
                });
            } else {
                console.log('No pending pool drivers');
            }
        }
    });
}

//Function to update user on list of drivers on EV's
function userDriverEv(user) {
    let context = 'Function userDriverEv';

    let data = user;
    let host = process.env.HostEv + process.env.PathUpdateListOfDrivers;

    axios
        .patch(host, data)
        .then((result) => {
            if (result.data) {
                console.log("Drivers On EV's updated");
            } else {
                console.log("Drivers On EV's not updated");
            }
        })
        .catch((error) => {
            Sentry.captureException(error);
            console.error(`[${context}][${host}] Error `, error.message);
        });
}

function userPoolDrivers(user) {
    const context = 'Function userPoolDrivers';

    var query = {
        poolOfDrivers: {
            $elemMatch: {
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                active: false,
            },
        },
        clientName: user.clientName,
    };
    Drivers.find(query, (err, driverFound) => {
        if (err) {
            Sentry.captureException(err);
            console.error(`[${context}][Drivers.find] Error `, err.message);
        } else {
            if (driverFound.length > 0) {
                const getDriver = (driver) => {
                    return new Promise((resolve) => {
                        if (
                            driver.mobile == user.mobile &&
                            driver.internationalPrefix ==
                                user.internationalPrefix
                        ) {
                            driver.active = true;
                            driver.driverId = user._id;
                            resolve(true);
                        } else resolve(false);
                    });
                };
                const getDriverFound = (found) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            found.poolOfDrivers.map((driver) =>
                                getDriver(driver)
                            )
                        ).then(() => {
                            var newValue = { $set: found };
                            var query = {
                                _id: found._id,
                            };
                            Drivers.updateDrivers(
                                query,
                                newValue,
                                (err, result) => {
                                    if (err) {
                                        Sentry.captureException(err);
                                        console.error(
                                            `[${context}][updateDrivers] Error `,
                                            err.message
                                        );
                                    } else {
                                        console.log('Drivers updated');
                                    }
                                }
                            );
                            resolve(true);
                        });
                    });
                };
                Promise.all(
                    driverFound.map((found) => getDriverFound(found))
                ).then(() => {
                    console.log('Drivers updated');
                });
            } else {
                console.log('No pool drivers');
            }
        }
    });
}

//Function to verify if the user exist on groupsDriversDependencies
function userGroupDriversDependencies(user) {
    const context = 'Function userGroupDriversDependencies';

    var query = {
        drivers: {
            $elemMatch: {
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                registered: false,
            },
        },
        clientName: user.clientName,
    };

    GroupDriversDependencies.find(
        query,
        (err, groupDriversDependenciesFound) => {
            if (err) {
                Sentry.captureException(err);
                console.error(
                    `[${context}][GroupDriversDependencies.find] Error `,
                    err.message
                );
            }
            if (groupDriversDependenciesFound.length > 0) {
                userGroupDrivers(user);
                const getDriver = (driver) => {
                    return new Promise((resolve) => {
                        if (
                            driver.mobile == user.mobile &&
                            driver.internationalPrefix ==
                                user.internationalPrefix
                        ) {
                            driver.registered = true;
                            resolve(true);
                        } else resolve(false);
                    });
                };
                const getGroupDriversDependencies = (
                    groupDriversDependencies
                ) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            groupDriversDependencies.drivers.map((driver) =>
                                getDriver(driver)
                            )
                        ).then(() => {
                            var newValue = { $set: groupDriversDependencies };
                            var query = {
                                _id: groupDriversDependencies._id,
                            };
                            GroupDriversDependencies.updateGroupDriversDependencies(
                                query,
                                newValue,
                                (err, result) => {
                                    if (err) {
                                        Sentry.captureException(err);
                                        console.error(
                                            `[${context}][updateGroupDriversDependencies] Error `,
                                            err.message
                                        );
                                    } else {
                                        console.log(
                                            'Group Drivers Dependencies updated'
                                        );
                                    }
                                }
                            );
                            resolve(true);
                        });
                    });
                };
                Promise.all(
                    groupDriversDependenciesFound.map(
                        (groupDriversDependencies) =>
                            getGroupDriversDependencies(
                                groupDriversDependencies
                            )
                    )
                ).then(() => {
                    console.log('Group Drivers Dependencies updated');
                });
            } else {
                console.log('No pending Group drivers');
            }
        }
    );
}

//
function userGroupDrivers(user) {
    var context = 'Function userGroupDrivers';
    var query = {
        listOfDrivers: {
            $elemMatch: {
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                active: false,
            },
        },
        clientName: user.clientName,
    };
    GroupDrivers.find(query, (err, groupDriverFound) => {
        if (err) {
            console.error(
                `[${context}][GroupDrivers.find] Error `,
                err.message
            );
        } else {
            if (groupDriverFound.length > 0) {
                const getDriver = (driver) => {
                    return new Promise((resolve) => {
                        if (
                            driver.mobile == user.mobile &&
                            driver.internationalPrefix ==
                                user.internationalPrefix
                        ) {
                            driver.active = true;
                            driver.driverId = user._id;
                            resolve(true);
                        } else resolve(false);
                    });
                };
                const getGroupDriver = (groupDriver) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            groupDriver.listOfDrivers.map((driver) =>
                                getDriver(driver)
                            )
                        ).then(() => {
                            var newValue = { $set: groupDriver };
                            var query = {
                                _id: groupDriver._id,
                            };
                            GroupDrivers.updateGroupDrivers(
                                query,
                                newValue,
                                (err, result) => {
                                    if (err) {
                                        console.error(
                                            `[${context}][updateGroupDrivers] Error `,
                                            err.message
                                        );
                                    } else {
                                        console.log('Group Drivers updated');
                                    }
                                }
                            );
                            resolve(true);
                        });
                    });
                };
                Promise.all(
                    groupDriverFound.map((groupDriver) =>
                        getGroupDriver(groupDriver)
                    )
                ).then(() => {
                    console.log('Group Drivers updated');
                });
            } else {
                console.log('No group drivers');
            }
        }
    });
}

//Function to create a pool of drivers
function createPoolDriver(user) {
    var context = 'Function createPoolDriver';
    var drivers = new Drivers();
    drivers.userId = user._id;
    drivers.clientName = user.clientName;
    Drivers.createDrivers(drivers, (err, result) => {
        if (err) {
            Sentry.captureException(err);
            console.error(`[${context}][createDrivers] Error `, err.message);
        } else {
            console.log('Pool of drivers created');
        }
    });
}

//Function to verify if the user exist on groupsCSUsersDependencies
function userGroupCSUsersDependencies(user) {
    const context = 'Function userGroupCSUsersDependencies';
    console.info(`[${context}] Starting process`);
    var query = {
        users: {
            $elemMatch: {
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                registered: false,
            },
        },
        clientName: user.clientName,
    };
    GroupCSUsersDependencies.find(
        query,
        (err, groupCSUsersDependenciesFound) => {
            if (err) {
                Sentry.captureException(err);
                console.error(
                    `[${context}][GroupCSUsersDependencies.find] Error `,
                    err.message
                );
            } else {
                if (groupCSUsersDependenciesFound.length > 0) {
                    userGroupCSUsers(user);
                    const getUser = (userToAdd) => {
                        return new Promise((resolve) => {
                            if (
                                userToAdd.mobile == user.mobile &&
                                userToAdd.internationalPrefix ==
                                    user.internationalPrefix
                            ) {
                                userToAdd.registered = true;
                                resolve(true);
                            } else resolve(false);
                        });
                    };
                    const getGroupCSUsersDependencies = (
                        groupCSUsersDependencies
                    ) => {
                        return new Promise((resolve, reject) => {
                            Promise.all(
                                groupCSUsersDependencies.users.map(
                                    (userToAdd) => getUser(userToAdd)
                                )
                            ).then(() => {
                                var newValue = {
                                    $set: groupCSUsersDependencies,
                                };
                                var query = {
                                    _id: groupCSUsersDependencies._id,
                                };
                                GroupCSUsersDependencies.updateGroupCSUsersDependencies(
                                    query,
                                    newValue,
                                    (err, result) => {
                                        if (err) {
                                            console.error(
                                                `[${context}][updateGroupCSUsersDependencies] Error `,
                                                err.message
                                            );
                                            reject(err);
                                        } else {
                                            resolve(true);
                                        }
                                    }
                                );
                            })
                        }).catch((error) => {
                            Sentry.captureException(error);
                            console.error(
                                `[${context}][Promise.all] Error `,
                                error.message
                            );
                        });
                    };
                    Promise.all(
                        groupCSUsersDependenciesFound.map(
                            (groupCSUsersDependencies) =>
                                getGroupCSUsersDependencies(
                                    groupCSUsersDependencies
                                )
                        )
                    )
                        .then(() => {
                            console.log(
                                'Group of Charger Station Users Dependencies updated'
                            );
                        })
                        .catch((error) => {
                            Sentry.captureException(error);
                            console.error(
                                `[${context}][Promise.all] Error `,
                                error.message
                            );
                        });
                } else {
                    console.log('No pending Group charger station users');
                }
            }
        }
    );
}

//Functio to verify if the user exist on groupsCSUsers
function userGroupCSUsers(user) {
    const context = 'Function userGroupCSUsers';

    var query = {
        listOfUsers: {
            $elemMatch: {
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                active: false,
            },
        },
        clientName: user.clientName,
    };
    GroupCSUsers.find(query, (err, groupCSUsersFound) => {
        if (err) {
            Sentry.captureException(err);
            console.error(
                `[${context}][GroupCSUsers.find] Error `,
                err.message
            );
        } else {
            if (groupCSUsersFound.length > 0) {
                const getUser = (userToAdd) => {
                    return new Promise((resolve) => {
                        if (
                            userToAdd.mobile == user.mobile &&
                            userToAdd.internationalPrefix ==
                                user.internationalPrefix
                        ) {
                            userToAdd.active = true;
                            userToAdd.userId = user._id;
                            resolve(true);
                        } else resolve(false);
                    });
                };
                const getGroupCSUsers = (groupCSUsers) => {
                    return new Promise((resolve, reject) => {
                        Promise.all(
                            groupCSUsers.listOfUsers.map((userToAdd) =>
                                getUser(userToAdd)
                            )
                        ).then(() => {
                            var newValue = { $set: groupCSUsers };
                            var query = {
                                _id: groupCSUsers._id,
                            };
                            GroupCSUsers.updateGroupCSUsers(
                                query,
                                newValue,
                                (err, result) => {
                                    if (err) {
                                        Sentry.captureException(err);
                                        console.error(
                                            `[${context}][updateGroupCSUsers] Error `,
                                            err.message
                                        );
                                        reject(err);
                                    } else {
                                        resolve(true);
                                    }
                                }
                            );
                        });
                    });
                };
                Promise.all(
                    groupCSUsersFound.map((groupCSUsers) =>
                        getGroupCSUsers(groupCSUsers)
                    )
                )
                    .then(() => {
                        console.log('Group Charger Station Users updated');
                    })
                    .catch((error) => {
                        Sentry.captureException(error);
                        console.error(
                            `[${context}][ Promise.all] Error `,
                            error.message
                        );
                    });
            } else {
                console.log('No group charger station users');
            }
        }
    });
}

//Funtion to create a new contract
async function createContract(user, useLibFlag = false) {
    const context = 'Function createContract';
    try {
        let name = user.name.split(' ');
        let CEME = await CemeData.getCEMEEVIOADHOC(
            user.clientName,
            user.activePartner
        );
        let roamingTariffs = await Promise.all([
            CemeData.getCEMEEVIO(process.env.NetworkGireve),
            CemeData.getCEMEEVIO(process.env.NetworkHubject)
        ]) 
       
        let idTagDecEVIO = await getRandomIdTag(
            100_000_000_000,
            999_999_999_999
        );
        let idTagDecMobiE = await getRandomIdTag(
            100_000_000_000,
            999_999_999_999
        );
        let tariff = {
            power: 'all',
            planId: CEME.plan._id,
        };

        let contractIdInternationalNetwork = [
            {
                network: process.env.NetworkGireve,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeOTHER,
                    },
                ],
            },
        ];

        let tariffRoaming;
        if (roamingTariffs) {
            tariffRoaming = [
                {
                    network: process.env.NetworkGireve,
                    power: 'all',
                    planId: roamingTariffs[0].plan._id,
                },
                {
                    network: process.env.NetworkHubject,
                    power: 'all',
                    planId: roamingTariffs[1]?.plan?._id,
                }
            ];
        } else {
            tariffRoaming = [
                {
                    network: process.env.NetworkGireve,
                    power: 'all',
                    planId: '',
                },
                {
                    network: process.env.NetworkHubject,
                    power: 'all',
                    planId: '',
                }
            ];
        }

        let newContract = {
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            cardName: name[0] + ' ' + name[name.length - 1],
            cardType: process.env.CardTypeVirtual,
            userId: user._id,
            tariff: tariff,
            contractType: process.env.ContractTypeUser,
            tariffRoaming: tariffRoaming,
            contractIdInternationalNetwork: contractIdInternationalNetwork,
            clientName: user.clientName,
        };

        let contract = new Contract(newContract);

        if (process.env.NODE_ENV === 'production') {
            contract.imageCEME =
                process.env.HostProdContrac + `ceme/ceme${user.clientName}.jpg`; // For PROD server
            contract.imageCard =
                process.env.HostProdContrac + `card/card${user.clientName}.jpg`;
            contract.fontCardBlack = false;
        } else if (process.env.NODE_ENV === 'pre-production') {
            contract.imageCEME =
                process.env.HostPreProdContrac +
                `ceme/ceme${user.clientName}.jpg`; // For PROD server
            contract.imageCard =
                process.env.HostPreProdContrac +
                `card/card${user.clientName}.jpg`;
            contract.fontCardBlack = false;
        } else {
            //contract.imageCEME = process.env.HostLocalContract + `ceme/ceme${user.clientName}.jpg`; // For local host
            //contract.imageCard = process.env.HostLocalContract + `card/card${user.clientName}.jpg`;
            contract.imageCEME =
                process.env.HostQAContrac + `ceme/ceme${user.clientName}.jpg`; // For QA server
            contract.imageCard =
                process.env.HostQAContrac + `card/card${user.clientName}.jpg`;
            contract.fontCardBlack = false;
        }

        let networks = [
            {
                name: process.env.NetworkEVIO,
                networkName: 'server_evio_network',
                network: process.env.NetworkEVIO,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO,
                    },
                ],
                hasJoined: true,
                isVisible: true,
            },
            {
                name: process.env.NetworkMobiE,
                networkName: 'server_mobie_network',
                network: process.env.NetworkMobiE,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusInactive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecMobiE,
                    },
                ],
                hasJoined: false,
                isVisible: true,
            },
            {
                name: 'server_international_network_1',
                networkName: 'server_international_network_1',
                network: process.env.NetworkGireve,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeOTHER,
                        status: process.env.NetworkStatusInactive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO,
                    },
                ],
                hasJoined: false,
                isVisible: true,
            },
            {
                name: process.env.NetworkInternal,
                networkName: 'server_internal_network',
                network: process.env.NetworkInternal,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO,
                    },
                ],
                hasJoined: true,
                isVisible: false,
            },
            {
                name: process.env.NetworkGoCharge,
                networkName: 'server_goCharge_network',
                network: process.env.NetworkGoCharge,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO,
                    },
                ],
                hasJoined: true,
                isVisible:
                    user.clientName === process.env.WhiteLabelGoCharge ||
                    user.clientName === process.env.WhiteLabelHyundai
                        ? true
                        : false,
            },
            {
                name: process.env.NetworkHyundai,
                networkName: 'server_hyundai_network',
                network: process.env.NetworkHyundai,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO,
                    },
                ],
                hasJoined: true,
                isVisible:
                    user.clientName === process.env.WhiteLabelGoCharge ||
                    user.clientName === process.env.WhiteLabelHyundai
                        ? true
                        : false,
            },
            {
                name: process.env.NetworkKLC,
                networkName: 'server_klc_network',
                network: process.env.NetworkKLC,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO,
                    },
                ],
                hasJoined: true,
                isVisible: user.clientName === process.env.WhiteLabelKLC,
            },
            {
                name: process.env.NetworkKinto,
                networkName: 'server_kinto_network',
                network: process.env.NetworkKinto,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO,
                    },
                ],
                hasJoined: true,
                isVisible: user.clientName === process.env.WhiteLabelKinto,
            },
        ];

        contract.networks = networks;

        const result = await Contract.createContract(contract);
        //validateIfMobiEActive(result)
        if (useLibFlag) {
            await activateNetworksForVirtualUserContract({contract:result})
        } else {
            await activeMobiE(result, user.clientType);
        }
        console.log(`[${context}] Contract created`);
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error `, error.message);
    }
}

async function createCEMETariffEVIO(user) {
    const context = 'Function createCEMETariffEVIO';
    try {
        let cemeTariff = new CEMETariff();
        cemeTariff.userId = user._id;
        cemeTariff.name = 'EVIO Card';
        cemeTariff.CEME = process.env.NetworkEVIO;
        cemeTariff.clientName = user.clientName;
        cemeTariff.default = true;
        let card = {
            active: true,
            imageCard: '',
        };

        //let CEME = await CemeData.getCEMEEVIO(process.env.NetworkEVIO);
        let CEME = await CemeData.getCEMEEVIOADHOC(
            user.clientName,
            user.activePartner
        );

        let tariff = {
            power: 'all',
            planId: CEME.plan._id,
        };

        if (process.env.NODE_ENV === 'production') {
            cemeTariff.imageCEME =
                process.env.HostProdContrac + `ceme/ceme${user.clientName}.jpg`; // For PROD server
            card.imageCard =
                process.env.HostProdContrac + `card/card${user.clientName}.jpg`;
            card.fontCardBlack = false;
        } else if (process.env.NODE_ENV === 'pre-production') {
            cemeTariff.imageCEME =
                process.env.HostPreProdContrac +
                `ceme/ceme${user.clientName}.jpg`; // For PROD server
            card.imageCard =
                process.env.HostPreProdContrac +
                `card/card${user.clientName}.jpg`;
            card.fontCardBlack = false;
        } else {
            //cemeTariff.imageCEME = process.env.HostLocalContract +  `ceme/ceme${user.clientName}.jpg`; // For local host
            //card.imageCard = process.env.HostLocalContract + `card/card${user.clientName}.jpg`;
            cemeTariff.imageCEME =
                process.env.HostQAContrac + `ceme/ceme${user.clientName}.jpg`; // For QA server
            card.imageCard =
                process.env.HostQAContrac + `card/card${user.clientName}.jpg`;
            card.fontCardBlack = false;
        }

        cemeTariff.cards.push(card);
        cemeTariff.tariff = tariff;
        CEMETariff.createCEMETariff(cemeTariff, (err, result) => {
            if (err) {
                Sentry.captureException(err);
                console.error(
                    `[${context}][createCEMETariff] Error `,
                    err.message
                );
            } else {
                console.log(`[${context}] CEME Tariff created`);
            }
        });
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error `, error.message);
    }
}

function removeContract(userId) {
    var context = 'Function removeContract';
    var query = {
        userId: userId,
    };
    Contract.deleteMany(query, (err, result) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            console.log(`[${context}] Contracts removed`);
        }
    });
}

function removeCEMETariff(userId) {
    var context = 'Function removeCEMETariff';
    var query = {
        userId: userId,
    };

    CEMETariff.find(query, (err, CEMETariffFound) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            if (CEMETariffFound.length === 0) {
                console.log(`[${context}] No CEME tariff to remove`);
            } else {
                Promise.all(
                    CEMETariffFound.map((cemeTariff) => {
                        return new Promise((resolve, reject) => {
                            var query = {
                                _id: cemeTariff._id,
                            };
                            CEMETariff.removeCEMETariff(
                                query,
                                (err, result) => {
                                    if (err) {
                                        console.error(
                                            `[${context}][removeCEMETariff] Error `,
                                            err.message
                                        );
                                        reject(err);
                                    } else {
                                        resolve(true);
                                    }
                                }
                            );
                        });
                    })
                )
                    .then(() => {
                        console.log(`[${context}] CEME Tariff removed`);
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][.catch] Error `,
                            error.message
                        );
                    });
            }
        }
    });
}

function removeDrivers(userId) {
    var context = 'Function removeDrivers';
    var query = {
        userId: userId,
    };
    Drivers.find(query, (err, driversFound) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            if (driversFound.length === 0) {
                console.log(`[${context}] No pool drivers to remove`);
            } else {
                Promise.all(
                    driversFound.map((drivers) => {
                        return new Promise((resolve, reject) => {
                            var query = {
                                _id: drivers._id,
                            };
                            Drivers.removeDrivers(query, (err, result) => {
                                if (err) {
                                    console.error(
                                        `[${context}][removeDrivers] Error `,
                                        err.message
                                    );
                                    reject(err);
                                } else {
                                    resolve(true);
                                }
                            });
                        });
                    })
                )
                    .then((result) => {
                        console.log(`[${context}] Pool drivers removed`);
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][.catch] Error `,
                            error.message
                        );
                    });
            }
        }
    });
}

function removeGroupDrivers(userId) {
    var context = 'Function removeGroupDrivers';
    var query = {
        createUser: userId,
    };
    GroupDrivers.find(query, (err, groupDriversFound) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            if (groupDriversFound.length === 0) {
                console.log(`[${context}] No group drivers to remove`);
            } else {
                console.log('groupDriversFound', groupDriversFound);
                Promise.all(
                    groupDriversFound.map((groupDrivers) => {
                        return new Promise((resolve, reject) => {
                            var query = {
                                _id: groupDrivers._id,
                            };
                            removeGroupDriverFromEV(query);
                            removeGroupDriverDependencies(query);
                            GroupDrivers.removeGroupDrivers(
                                query,
                                (err, result) => {
                                    if (err) {
                                        console.error(
                                            `[${context}][removeGroupDrivers] Error `,
                                            err.message
                                        );
                                        reject(err);
                                    } else {
                                        resolve(true);
                                    }
                                }
                            );
                        });
                    })
                )
                    .then((result) => {
                        console.log(`[${context}] Group driver removed`);
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][.catch] Error `,
                            error.message
                        );
                    });
            }
        }
    });
}

function removeGroupCSUsers(userId) {
    var context = 'Function removeGroupCSUsers';
    var query = {
        createUser: userId,
    };
    GroupCSUsers.find(query, (err, groupCSUsersFound) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            if (groupCSUsersFound.length === 0) {
                console.log(
                    `[${context}] No group of charger station users to remove`
                );
            } else {
                console.log('groupCSUsersFound', groupCSUsersFound);
                Promise.all(
                    groupCSUsersFound.map((groupCSUsers) => {
                        return new Promise((resolve, reject) => {
                            var query = {
                                _id: groupCSUsers._id,
                            };
                            removeGroupCSUsersFromCharger(query);
                            removeGroupCSUsersDependencies(query);
                            GroupCSUsers.removeGroupCSUsers(
                                query,
                                (err, result) => {
                                    if (err) {
                                        console.error(
                                            `[${context}][removeGroupDrivers] Error `,
                                            err.message
                                        );
                                        reject(err);
                                    } else {
                                        resolve(true);
                                    }
                                }
                            );
                        });
                    })
                )
                    .then((result) => {
                        console.log(
                            `[${context}] Group of charger station users removed`
                        );
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][.catch] Error `,
                            error.message
                        );
                    });
            }
        }
    });
}

function removeGroupDriverFromEV(query) {
    var context = 'Function removeGroupDriverFromEV';
    var host = process.env.HostEv + process.env.PathRemoveGroupDriver;
    var data = {
        groupDriver: query._id,
    };
    axios
        .patch(host, data)
        .then((result) => {
            if (result.data) {
                console.log(`[${context}] Group driver removed from evs`);
            } else {
                console.log(`[${context}] Group driver not removed from evs`);
            }
        })
        .catch((error) => {
            console.error(`[${context}][ axios.patch] Error `, error.message);
        });
}

function removeGroupDriverDependencies(params) {
    var context = 'Function removeGroupDriverFromEV';
    var query = {
        groupId: params._id,
    };
    GroupDriversDependencies.removeGroupDriversDependencies(
        query,
        (err, result) => {
            if (err) {
                console.error(
                    `[${context}][removeGroupDriversDependencies] Error `,
                    err.message
                );
            } else {
                if (result) {
                    console.log(
                        `[${context}] Group driver dependencies successfully removed`
                    );
                } else {
                    console.log(
                        `[${context}] No group driver dependencies to remove`
                    );
                }
            }
        }
    );
}

function removeGroupCSUsersFromCharger(query) {
    var context = 'Function removeGroupCSUsersFromCharger';
    var data = {
        groupCSUsers: query._id,
    };
    var host = process.env.HostCharger + process.env.PathRemoveGroupCSUsers;
    axios
        .patch(host, data)
        .then((result) => {
            if (result.data) {
                console.log(
                    `[${context}] Group charger station users removed from chargers`
                );
            } else {
                console.log(
                    `[${context}] Group charger station users not removed from chargers`
                );
            }
        })
        .catch((error) => {
            console.error(`[${context}][ axios.patch] Error `, error.message);
        });
}

function removeGroupCSUsersDependencies(params) {
    var context = 'Function removeGroupCSUsersDependencies';
    var query = {
        groupId: params._id,
    };
    GroupCSUsersDependencies.removeGroupCSUsersDependencies(
        query,
        (err, result) => {
            if (err) {
                console.error(
                    `[${context}][removeGroupCSUsersDependencies] Error `,
                    err.message
                );
            } else {
                if (result) {
                    console.log(
                        `[${context}] Group charger station users dependencies successfully removed`
                    );
                } else {
                    console.log(
                        `[${context}] No group charger station users dependencies to remove`
                    );
                }
            }
        }
    );
}

function removeFromGroupDrivers(userFound) {
    var context = 'Function removeFromGroupDrivers';
    var query = {
        $or: [
            {
                listOfDrivers: {
                    $elemMatch: {
                        driverId: userFound._id,
                    },
                },
            },
            {
                listOfDrivers: {
                    $elemMatch: {
                        mobile: userFound.mobile,
                        internationalPrefix: userFound.internationalPrefix,
                    },
                },
            },
        ],
    };
    GroupDrivers.find(query, (err, groupDriversFound) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            if (groupDriversFound.length === 0) {
                console.log(`[${context}] No driver groups were found`);
            } else {
                Promise.all(
                    groupDriversFound.map((groupDrivers) => {
                        return new Promise((resolve, reject) => {
                            var query = {
                                _id: groupDrivers._id,
                            };
                            groupDrivers.listOfDrivers =
                                groupDrivers.listOfDrivers.filter((driver) => {
                                    return driver.driverId != userFound._id;
                                });
                            var newValues = { $set: groupDrivers };
                            GroupDrivers.updateGroupDrivers(
                                query,
                                newValues,
                                (err, result) => {
                                    if (err) {
                                        console.error(
                                            `[${context}][updateGroupDrivers] Error `,
                                            err.message
                                        );
                                        reject(err);
                                    } else {
                                        resolve(true);
                                    }
                                }
                            );
                        });
                    })
                )
                    .then((result) => {
                        console.log(`[${context}] Remove from group drivers`);
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][.catch] Error `,
                            error.message
                        );
                    });
            }
        }
    });
}

function removeFromGroupCSUsers(userFound) {
    var context = 'Function removeFromGroupCSUsers';
    var query = {
        $or: [
            {
                listOfUsers: {
                    $elemMatch: {
                        userId: userFound._id,
                    },
                },
            },
            {
                listOfUsers: {
                    $elemMatch: {
                        mobile: userFound.mobile,
                        internationalPrefix: userFound.internationalPrefix,
                    },
                },
            },
        ],
    };
    GroupCSUsers.find(query, (err, groupCSUsersFound) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            if (groupCSUsersFound.length === 0) {
                console.log(
                    `[${context}] No group of charger station users were found`
                );
            } else {
                console.log('groupCSUsersFound ', groupCSUsersFound);
                Promise.all(
                    groupCSUsersFound.map((groupCSUsers) => {
                        return new Promise((resolve, reject) => {
                            var query = {
                                _id: groupCSUsers._id,
                            };
                            groupCSUsers.listOfUsers =
                                groupCSUsers.listOfUsers.filter((user) => {
                                    return user.userId != userFound._id;
                                });
                            var newValues = { $set: groupCSUsers };
                            GroupCSUsers.updateGroupCSUsers(
                                query,
                                newValues,
                                (err, result) => {
                                    if (err) {
                                        console.error(
                                            `[${context}][updateGroupCSUsers] Error `,
                                            err.message
                                        );
                                        reject(err);
                                    } else {
                                        resolve(true);
                                    }
                                }
                            );
                        });
                    })
                )
                    .then((result) => {
                        console.log(
                            `[${context}] Remove from group of charger station users`
                        );
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][.catch] Error `,
                            error.message
                        );
                    });
            }
        }
    });
}

function removeFromPoolDrivers(userFound) {
    var context = 'Function removeFromPoolDrivers';
    var query = {
        $or: [
            {
                poolOfDrivers: {
                    $elemMatch: {
                        driverId: userFound._id,
                    },
                },
            },
            {
                poolOfDrivers: {
                    $elemMatch: {
                        mobile: userFound.mobile,
                        internationalPrefix: userFound.internationalPrefix,
                    },
                },
            },
        ],
    };

    Drivers.find(query, (err, driversFound) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            if (driversFound.length === 0) {
                console.log(`[${context}] No pool of drivers were found`);
            } else {
                Promise.all(
                    driversFound.map((driver) => {
                        return new Promise((resolve, reject) => {
                            var query = {
                                _id: driver._id,
                            };
                            driver.poolOfDrivers = driver.poolOfDrivers.filter(
                                (newDriver) => {
                                    return newDriver.driverId != userFound._id;
                                }
                            );
                            var newValues = { $set: driver };
                            Drivers.updateDrivers(
                                query,
                                newValues,
                                (err, result) => {
                                    if (err) {
                                        console.error(
                                            `[${context}][updateDrivers] Error `,
                                            err.message
                                        );
                                        reject(err);
                                    } else {
                                        resolve(true);
                                    }
                                }
                            );
                        });
                    })
                )
                    .then((result) => {
                        console.log(`[${context}] Remove from pool of drivers`);
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][.catch] Error `,
                            error.message
                        );
                    });
            }
        }
    });
}

function removeFleets(userId) {
    var context = 'Function removeFleets';
    var headers = {
        userid: userId,
    };
    var host = process.env.HostEv + process.env.PathRemoveFleet;
    axios
        .delete(host, { headers })
        .then((result) => {
            var fleet = result.data;
            if (fleet.length === 0) {
                console.log(`[${context}] No fleets to remove`);
            } else {
                console.log(`[${context}] Fleets Removed`);
            }
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function removeFromDriverEvs(userId) {
    var context = 'Function removeFromDriverEvs';
    var data = {
        userId: userId,
    };
    var host = process.env.HostEv + process.env.PathRemoveDriverEvs;
    axios
        .patch(host, data)
        .then((result) => {
            var evs = result.data;
            if (evs.length === 0) {
                console.log(`[${context}] No Driver evs to remove`);
            } else {
                console.log(`[${context}] Remove from drivers evs`);
            }
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function removeInfrastructure(userId) {
    var context = 'Function removeInfrastructure';
    var headers = {
        userid: userId,
    };
    var host = process.env.HostCharger + process.env.PathRemoveInfrastructure;
    axios
        .delete(host, { headers })
        .then((result) => {
            var evs = result.data;
            if (evs.length === 0) {
                console.log(`[${context}] No infrastructure to remove`);
            } else {
                console.log(`[${context}] Infrastructure removed`);
            }
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function removeTariff(userId) {
    var context = 'Function removeTariff';
    var headers = {
        userid: userId,
    };
    var host = process.env.HostTariff + process.env.PathRemoveTariff;
    axios
        .delete(host, { headers })
        .then((result) => {
            var tariffs = result.data;
            if (tariffs.length === 0) {
                console.log(`[${context}] No tariffs to remove`);
            } else {
                console.log(`[${context}] Tariffs removed`);
            }
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function createNotificataionsDefinition(user, headers) {
    var context = 'Function createNotificataionsDefinition';
    var host =
        process.env.HostNotificationsDefinition +
        process.env.PathNotificationsDefinition;
    var data = {
        userId: user._id,
        clientType: headers.client,
        clientName: user.clientName,
    };
    axios
        .post(host, data)
        .then((result) => {
            if (result.data) {
                console.log(`[${context}] Notifications Definition created`);
            } else {
                console.log(
                    `[${context}] Notifications Definition not created`
                );
            }
        })
        .catch((error) => {
            Sentry.captureException(error);
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function removeNotificationsDefinition(userId) {
    var context = 'Function createNotificataionsDefinition';
    var host =
        process.env.HostNotificationsDefinition +
        process.env.PathNotificationsDefinition;
    var data = {
        userId: userId,
    };
    axios
        .delete(host, { data })
        .then((result) => {
            if (result.data) {
                console.log(`[${context}] Notifications Definition deleted`);
            } else {
                console.log(
                    `[${context}] Notifications Definition not deleted`
                );
            }
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function createBillingProfile(user) {
    const context = 'Function createBillingProfile';
    return new Promise(async (resolve, reject) => {
        //check user address
        let billingProfile = {
            userId: user._id,
            billingPeriod:
                user.clientType === process.env.ClientTypeB2B
                    ? 'MONTHLY'
                    : 'AD_HOC',
            clientType:
                user.clientType === process.env.ClientTypeB2B
                    ? 'BUSINESSCUSTOMER'
                    : 'PRIVATECUSTOMER',
            name: user.name,
            billingName: user.name,
            email: user.email,
            clientName: user.clientName,
        };

        if (user.userType !== 'Company'){
            billingProfile.paymentConditions = constants.billingPaymentConditionsPrompt
        }

        const featureFlagEnabled = await toggle.isEnable('status-billing-profile-creating-b2b');
        if (featureFlagEnabled && user.clientType === process.env.ClientTypeB2B) {
            billingProfile.status = billingProfileStatus.ACTIVE;
        }

        let new_billingProfile = new BillingProfile(billingProfile);
        BillingProfile.createBillingProfile(
            new_billingProfile,
            (err, result) => {
                if (err) {
                    Sentry.captureException(err);
                    console.log(`[${context}] Billing profile not created`);
                    resolve('Billing profile not created');
                }
                if (result) {
                    console.log(`[${context}] Billing profile created`);
                    resolve('Billing profile created');
                } else {
                    console.log(`[${context}] Billing profile not created`);
                    resolve('Billing profile not created');
                }
            }
        );
    });
}

function createBillingProfileKinto(user) {
    const context = 'Function createBillingProfileKinto';
    return new Promise((resolve, reject) => {
        //check user address
        let billingProfile = {
            userId: user._id,
            billingPeriod: 'MONTHLY',
            clientType: 'BUSINESSCUSTOMER',
            name: process.env.KINTOBILLINGNAME,
            billingName: process.env.KINTOBILLINGNAME,
            email: process.env.KINTOBILLINGEMAIL,
            clientName: user.clientName,
            nif: process.env.KINTONIF,
            invoiceWithoutPayment: true,
            billingAddress: {
                street: process.env.KINTOBILLINGADDRESSSTREET,
                number: process.env.KINTOBILLINGADDRESSNUMBER,
                zipCode: process.env.KINTOBILLINGADDRESSZIPCODE,
                city: process.env.KINTOBILLINGADDRESSCITY,
                state: process.env.KINTOBILLINGADDRESSCITY,
                country: 'Portugal',
                countryCode: 'PT',
            }
        };

        if (user.userType !== 'Company'){
            billingProfile.paymentConditions = constants.billingPaymentConditionsPrompt
        }

        let new_billingProfile = new BillingProfile(billingProfile);
        BillingProfile.createBillingProfile(
            new_billingProfile,
            (err, result) => {
                if (err) {
                    Sentry.captureException(err);
                    console.log(`[${context}] Billing profile not created`);
                    resolve('Billing profile not created');
                }
                if (result) {
                    console.log(`[${context}] Billing profile created`);
                    resolve('Billing profile created');
                } else {
                    console.log(`[${context}] Billing profile not created`);
                    resolve('Billing profile not created');
                }
            }
        );
    });
}

function createWallet(user) {
    var context = 'Function createWallet';
    var host = process.env.HostPayments + process.env.PathWallet;
    var data = {
        userId: user._id,
        clientName: user.clientName,
    };
    axios
        .post(host, data)
        .then((result) => {
            if (result.data) {
                console.log(`[${context}] Wallet created`);
            } else {
                console.log(`[${context}] Wallet not created`);
            }
        })
        .catch((error) => {
            Sentry.captureException(error);
            console.error(`[${context}][.catch] Error `, error);
        });
}

function removeWallet(userId) {
    var context = 'Function removeWallet';
    var host = process.env.HostPayments + process.env.PathWallet;
    var data = {
        userId: userId,
    };
    axios
        .delete(host, { data })
        .then((result) => {
            if (result.data) {
                console.log(`[${context}] Wallet deleted`);
            } else {
                console.log(`[${context}] Wallet not deleted`);
            }
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function getCEMEEVIO(roamingName) {
    var context = 'Function getCEMEEVIO';
    return new Promise((resolve, reject) => {
        var params;
        if (roamingName) {
            params = {
                CEME: process.env.NetworkEVIO + ' ' + roamingName,
            };
        } else {
            params = {
                CEME: process.env.NetworkEVIO,
            };
        }

        var host =
            process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

        axios
            .get(host, { params })
            .then((result) => {
                resolve(result.data[0]);
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
}

//getRoamingTariffs(['Gireve', 'MobiE']);
function getRoamingTariffs(internationalNetwork) {
    var context = 'Function getRoamingTariffs';
    return new Promise((resolve, reject) => {
        let host =
            process.env.HostPublicTariff + process.env.PathGetRoamingTariffs;

        let params = {
            roamingType: internationalNetwork,
        };

        let data = {
            _id: 1,
            roamingType: 1,
        };
        axios
            .get(host, { data, params })
            .then((result) => {
                //console.log("result", result.data);
                ///console.log(result.data.find(tariff => { return tariff.roamingType === process.env.NetworkGireve })._id)
                if (result.data.length > 0) {
                    resolve(result.data);
                } else {
                    resolve([]);
                }
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                resolve([]);
            });
    });
}

function runFirstTime() {
    User.find({}, function (err, users) {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            if (users.length !== 0) {
                users.forEach((user) => {
                    createCEMETariffEVIO(user);
                });
            }
        }
    });
}

function updateMobileContract(user) {
    var context = 'Function updateMobileContract';

    let query = {
        userId: user._id,
    };

    let newValues = {
        $set: { mobile: user.mobile },
    };

    Contract.updateMany(query, newValues, (err, result) => {
        if (err) {
            console.error(`[${context}][.catch] Error `, err.message);
        } else console.log('Updated', result);
    });
}

function updateMobileDrivers(user) {
    var context = 'Function updateMobileDrivers';

    let query = {
        'poolOfDrivers.driverId': user._id,
    };

    let newValues = {
        $set: { 'poolOfDrivers.$.mobile': user.mobile },
    };

    Drivers.updateMany(query, newValues, (err, result) => {
        if (err) {
            console.error(`[${context}][.catch] Error `, err.message);
        } else console.log('Updated', result);
    });
}

function updateMobileGroupDrivers(user) {
    var context = 'Function updateMobileGroupDrivers';

    let query = {
        'listOfDrivers.driverId': user._id,
    };

    let newValues = {
        $set: { 'listOfDrivers.$.mobile': user.mobile },
    };

    GroupDrivers.updateMany(query, newValues, (err, result) => {
        if (err) {
            console.error(`[${context}][.catch] Error `, err.message);
        } else console.log('Updated', result);
    });
}

function updateMobileGroupCSUsers(user) {
    var context = 'Function updateMobileGroupCSUsers';

    let query = {
        'listOfUsers.userId': user._id,
    };

    let newValues = {
        $set: { 'listOfUsers.$.mobile': user.mobile },
    };

    GroupCSUsers.updateMany(query, newValues, (err, result) => {
        if (err) {
            console.error(`[${context}][.catch] Error `, err.message);
        } else console.log('Updated', result);
    });
}

function updateDrivers(user) {
    var context = 'Function updateDrivers';

    let query = {
        'poolOfDrivers.driverId': user._id,
    };

    let newValues = {
        $set: {
            'poolOfDrivers.$.name': user.name,
            'poolOfDrivers.$.mobile': user.mobile,
            'poolOfDrivers.$.internationalPrefix': user.internationalPrefix,
        },
    };

    Drivers.updateMany(query, newValues, (err, result) => {
        if (err) {
            console.error(`[${context}][.catch] Error `, err.message);
        } else console.log('Updated', result);
    });
}

function updateGroupDrivers(user) {
    var context = 'Function updateGroupDrivers';

    let query = {
        'listOfDrivers.driverId': user._id,
    };

    let newValues = {
        $set: {
            'listOfDrivers.$.name': user.name,
            'listOfDrivers.$.mobile': user.mobile,
            'listOfDrivers.$.internationalPrefix': user.internationalPrefix,
        },
    };

    GroupDrivers.updateMany(query, newValues, (err, result) => {
        if (err) {
            console.error(`[${context}][.catch] Error `, err.message);
        } else console.log('Updated', result);
    });
}

function cancelAllTokens(userId) {
    var context = 'Function cancelAllTokens';

    let data = {
        userId: userId,
    };

    let host = 'http://authorization:3001/api/validTokens';

    axios
        .patch(host, data)
        .then(() => {
            console.log('Tokens updated');
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function cancelTokens(token) {
    var context = 'Function cancelTokens';

    let data = {
        token: token,
    };

    let host = 'http://authorization:3001/api/validTokens/disableToken';

    axios
        .patch(host, data)
        .then(() => {
            console.log('Tokens updated');
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function cancelFirebaseTokens(userId) {
    var context = 'Function cancelFirebaseTokens';

    let data = {
        userId: userId,
    };

    //let host = "http://notifications:3008/api/private/firebase/firebaseUserTokens";
    let host =
        process.env.NotificationsHost +
        process.env.PathNotificationFirebaseUserTokens;

    axios
        .patch(host, data)
        .then(() => {
            console.log('Tokens firebase updated');
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function cancelFirebaseWLTokens(userId) {
    var context = 'Function cancelFirebaseWLTokens';

    let data = {
        userId: userId,
    };

    //let host = "http://notifications-firebase-wl:3032/api/private/firebase/firebaseUserTokens";
    let host =
        process.env.NotificationsFirebaseWLHost +
        process.env.PathNotificationFirebaseUserTokens;

    axios
        .patch(host, data)
        .then(() => {
            console.log('Tokens firebase updated');
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
}

function getNumberOfCards(userId) {
    var context = 'Function getNumberOfCards';
    return new Promise((resolve, reject) => {
        let query = {
            userId: userId,
            status: process.env.ContractStatusActive,
        };

        Contract.count(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                resolve(0);
            } else {
                resolve(result);
            }
        });
    });
}

function getNumberOfEVs(userId) {
    var context = 'Function getNumberOfEVs';
    return new Promise((resolve, reject) => {
        let query = {
            userId: userId,
            status: process.env.ContractStatusActive,
            contractType: process.env.ContractTypeFleet,
        };

        Contract.count(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                resolve(0);
            } else {
                resolve(result);
            }
        });
    });
}

function getNumberChargers(userId) {
    var context = 'Function getNumberChargers';
    return new Promise((resolve, reject) => {
        let host =
            process.env.HostCharger +
            process.env.PathGetNumberCharger +
            `/${userId}`;
        axios
            .get(host)
            .then((response) => {
                resolve(response.data);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve({
                    numberOfChargers: 0,
                    numberOfSessions: 0,
                });
            });
    });
}

function getNumberSessionMobiE(userId) {
    var context = 'Function getNumberSessionMobiE';
    return new Promise((resolve, reject) => {
        let host =
            process.env.HostMobie +
            process.env.PathGetNumberOfSessions +
            `/${userId}`;
        axios
            .get(host)
            .then((response) => {
                resolve(response.data.numberOfSessions);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve(0);
            });
    });
}

function getNumberOfTickets(userId) {
    var context = 'Function getNumberOfTickets';
    return new Promise((resolve, reject) => {
        //TODO
        resolve(0);
    });
}

//addUserPackage();
function addUserPackageb2b() {
    var context = 'Function addUserPackage';

    let query = {
        active: true,
        clientType: 'b2b',
    };

    let userPackage = {
        packageName: process.env.PackageNameFree,
        packageType: process.env.PackageTypeFree,
        rfidCardsLimit: 1,
        fleetsLimit: 1,
        evsLimit: 3,
        driversLimit: 1,
        groupOfDriversLimit: 1,
        driversInGroupDriversLimit: 1,
        chargingAreasLimit: 1,
        evioBoxLimit: 1,
        chargersLimit: 1,
        tariffsLimit: 1,
        chargersGroupsLimit: 1,
        userInChargerGroupsLimit: 1,
        searchLocationsLimit: 'UNLIMITED',
        searchChargersLimit: 'UNLIMITED',
        comparatorLimit: 'UNLIMITED',
        routerLimit: 'UNLIMITED',
        cardAssociationEnabled: false,
        billingTariffEnabled: false,
    };

    User.updateMany(
        query,
        { $set: { userPackage: userPackage } },
        (err, result) => {
            if (err) console.error(`[${context}] Error `, err.message);
            else console.log('Updated', result);
        }
    );
}

function addUserPackageb2c() {
    var context = 'Function addUserPackage';

    let query = {
        active: true,
        clientType: 'b2c',
    };

    let userPackage = {
        packageName: process.env.PackageNameFree,
        packageType: process.env.PackageTypeFree,
        rfidCardsLimit: 1,
        fleetsLimit: 1,
        evsLimit: 3,
        driversLimit: 1,
        groupOfDriversLimit: 1,
        driversInGroupDriversLimit: 1,
        chargingAreasLimit: 0,
        evioBoxLimit: 0,
        chargersLimit: 0,
        tariffsLimit: 0,
        chargersGroupsLimit: 0,
        userInChargerGroupsLimit: 0,
        searchLocationsLimit: 'UNLIMITED',
        searchChargersLimit: 'UNLIMITED',
        comparatorLimit: 'UNLIMITED',
        routerLimit: 'UNLIMITED',
        cardAssociationEnabled: false,
        billingTariffEnabled: false,
    };

    User.updateMany(
        query,
        { $set: { userPackage: userPackage } },
        (err, result) => {
            if (err) console.error(`[${context}] Error `, err.message);
            else console.log('Updated', result);
        }
    );
}

function contractsFind(query) {
    var context = 'Function contractsFind';
    return new Promise((resolve, reject) => {
        Contract.find(query, (err, contractsFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                reject(err);
            } else {
                resolve(contractsFound);
            }
        });
    });
}

function getPaymentMethods(userId) {
    var context = 'Function contractsFind';
    return new Promise((resolve, reject) => {
        try {
            var headers = {
                userid: userId,
            };

            var proxyPayments =
                process.env.HostPayments + process.env.PathGetPaymentMethods;

            axios
                .get(proxyPayments, { headers })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(
                        `[${context}][${proxyPayments}] Error `,
                        error.message
                    );
                    reject(error);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

function getTariffCEME(params) {
    var context = 'Function getTariffCEME';
    return new Promise((resolve, reject) => {
        var host = process.env.HostTariffCEME + process.env.PathTariffCEME;
        console.log(`[${context}] users `, params);
        axios
            .get(host, { params })
            .then((result) => {
                if (
                    Object.keys(result.data).length != 0 &&
                    result.data.schedule.tariffType ===
                        process.env.TariffTypeBiHour
                ) {
                    //Remove out of empty schedules
                    result.data = JSON.parse(JSON.stringify(result.data));
                    /*result.data.schedule.schedules = result.data.schedule.schedules.filter(schedule => {
                        return schedule.tariffType === process.env.TariffEmpty;
                    });*/
                    resolve(result.data);
                } else {
                    resolve(result.data);
                }
                // resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}] users Error `, error.message);
                reject(error);
            });
    });
}

function updateUserTariffs(received) {
    var context = 'Function updateUserTariffs';
    return new Promise((resolve, reject) => {
        let host =
            process.env.HostTariff + process.env.PathUpdateEvioCommissionTariff;

        let data = received;

        axios
            .patch(host, data)
            .then((result) => {
                //console.log(result.data);
                if (result.data) {
                    console.log('Tariffs updated');
                    resolve();
                } else {
                    console.log('Tariffs not updated');
                    resolve();
                }
            })
            .catch((error) => {
                console.error(`[${context}] [${host}]  Error `, error.message);
                reject(error);
            });
    });
}

function addEvioCommission() {
    var context = 'Function addEvioCommission';
    let query = {
        active: true,
    };

    let newUser = {
        evioCommission: {
            minAmount: {
                uom: 'un',
                value: 0,
            },
            transaction: {
                uom: 'percentage',
                value: 0,
            },
        },
    };

    User.updateMany(query, { $set: newUser }, (err, result) => {
        if (err) console.error(`[${context}] Error `, err.message);
        else console.log('Updated', result);
    });
}

function getTariffRoamingInfo(tariffRoaming) {
    var context = 'Function getTariffRoamingInfo';
    return new Promise(async (resolve, reject) => {
        //console.log("tariffRoaming", tariffRoaming);

        let plansId = [];

        await tariffRoaming.forEach((tariff) => {
            plansId.push(tariff.planId);
        });

        //console.log("plansId", plansId);

        let params = {
            _id: plansId,
        };

        let host =
            process.env.HostPublicTariff + process.env.PathGetRoamingTariffs;

        axios
            .get(host, { params })
            .then((result) => {
                //console.log("result", result.data);
                ///console.log(result.data.find(tariff => { return tariff.roamingType === process.env.NetworkGireve })._id)
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                resolve([]);
            });
    });
}

function getTariffCEMERoaming(tariffRoaming) {
    var context = 'Function getTariffCEMERoaming';
    return new Promise(async (resolve, reject) => {
        //console.log("tariffRoaming", tariffRoaming);

        let plansId = [];

        await tariffRoaming.forEach((tariff) => {
            plansId.push(tariff.planId);
        });

        let params = {
            _id: plansId,
        };

        var host =
            process.env.HostTariffCEME + process.env.PathTariffCEMEbyCEME;
        axios
            .get(host, { params })
            .then((result) => {
                //console.log("result.data", result.data);
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve([]);
            });
    });
}

function changePackagesLimitsB2BClients() {
    var context = 'Function changePackagesLimitsB2BClients';
    let query = {
        active: true,
        clientType: process.env.ClientTypeB2B,
    };

    let userPackage = {
        packageName: process.env.PackageNameFree,
        packageType: process.env.PackageTypeFree,
        rfidCardsLimit: 1,
        fleetsLimit: 100,
        evsLimit: 500,
        driversLimit: 500,
        groupOfDriversLimit: 500,
        driversInGroupDriversLimit: 500,
        chargingAreasLimit: 25,
        evioBoxLimit: 25,
        chargersLimit: 500,
        tariffsLimit: 500,
        chargersGroupsLimit: 100,
        userInChargerGroupsLimit: 500,
        searchLocationsLimit: 'UNLIMITED',
        searchChargersLimit: 'UNLIMITED',
        comparatorLimit: 'UNLIMITED',
        routerLimit: 'UNLIMITED',
        cardAssociationEnabled: false,
        billingTariffEnabled: false,
    };

    let newUser = {
        userPackage: userPackage,
    };

    User.updateMany(query, { $set: newUser }, (err, result) => {
        if (err) console.error(`[${context}] Error `, err.message);
        else console.log('Updated', result);
    });
}

//addTypeReferencePlaces()
function addTypeReferencePlaces() {
    var context = 'Function addTypeReferencePlaces';

    /*let query = {
        referencePlaces: {  $size:1 }
    };*/

    let query = {
        $where: 'this.referencePlaces.length > 0',
        active: true,
    };

    User.find(query, { referencePlaces: 1 }, (error, result) => {
        if (error) {
            console.error(`[${context}] Error `, error.message);
        } else {
            if (result.length > 0) {
                result.forEach(async (user) => {
                    if (user.referencePlaces.length >= 2) {
                        let indexOfHome = user.referencePlaces.indexOf(
                            user.referencePlaces.find((place) => {
                                return (
                                    place.name === 'home' ||
                                    place.name === 'Home' ||
                                    place.name === 'HOME'
                                );
                            })
                        );
                        let indexOfWork = user.referencePlaces.indexOf(
                            user.referencePlaces.find((place) => {
                                return (
                                    place.name === 'work' ||
                                    place.name === 'WORK' ||
                                    place.name === 'Work'
                                );
                            })
                        );
                        if (indexOfHome >= 0)
                            user.referencePlaces[indexOfHome].type = 'HOME';
                        if (indexOfWork >= 0)
                            user.referencePlaces[indexOfWork].type = 'WORK';

                        if (user.referencePlaces.length > 2) {
                            for (
                                let i = 2;
                                i < user.referencePlaces.length;
                                i++
                            ) {
                                user.referencePlaces[i].type = 'OTHER';
                                //console.log(i)
                                //console.log(user.referencePlaces[i])
                            }
                        }
                    } else {
                        let indexOfHome = user.referencePlaces.indexOf(
                            user.referencePlaces.find((place) => {
                                return (
                                    place.name === 'home' ||
                                    place.name === 'Home' ||
                                    place.name === 'HOME'
                                );
                            })
                        );

                        if (indexOfHome >= 0)
                            user.referencePlaces[indexOfHome].type = 'HOME';
                        else {
                            let indexOfWork = user.referencePlaces.indexOf(
                                user.referencePlaces.find((place) => {
                                    return (
                                        place.name === 'work' ||
                                        place.name === 'WORK' ||
                                        place.name === 'Work'
                                    );
                                })
                            );
                            if (indexOfWork >= 0)
                                user.referencePlaces[indexOfWork].type = 'WORK';
                        }
                    }

                    User.updateUser(
                        { _id: user._id },
                        { $set: user },
                        (error, result) => {
                            if (error) {
                                console.error(
                                    `[${context}] Error `,
                                    error.message
                                );
                            } else {
                                console.log('User updated');
                            }
                        }
                    );
                });
            }
        }
    });
}

function verifyContract() {
    var context = 'Function verifyContract';

    const query = {
        active: true,
    };

    User.find(query, (err, users) => {
        if (err) console.error(`[${context}] Error `, err.message);
        else {
            users.map((user) => {
                Contract.findOne(
                    { userId: user._id, contractType: 'user' },
                    (err, result) => {
                        if (err)
                            console.error(`[${context}] Error `, err.message);
                        else {
                            if (!result) {
                                createContract(user);
                            }
                        }
                    }
                );
            });
        }
    });
}

function validateIfMobiEActive(contract) {
    var context = 'Function validateIfMobiEActive';

    let query = {
        userId: contract.userId,
        contractType: process.env.ContractTypeFleet,
        networks: {
            $elemMatch: {
                network: process.env.NetworkMobiE,
                tokens: {
                    $elemMatch: {
                        tokenType: process.env.TokensTypeApp_User,
                        status: { $ne: process.env.NetworkStatusInactive },
                    },
                },
            },
        },
    };

    Contract.find(query, async (err, contractsFounds) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        } else {
            if (contractsFounds.length > 0) {
                let contractUserType = JSON.parse(
                    JSON.stringify(contractsFounds[0])
                );

                var network = contractUserType.networks.find(
                    (network) => network.network === process.env.NetworkMobiE
                );
                var token = network.tokens.find(
                    (token) =>
                        token.tokenType === process.env.TokensTypeApp_User
                );

                let countryCode = 'PT';
                let partyId = 'EVI';
                let appUserUid = await getTokenIdTag(
                    contract,
                    process.env.NetworkMobiE,
                    process.env.TokensTypeApp_User
                );
                if (!appUserUid)
                    appUserUid = await getTokenIdTag(
                        contract,
                        process.env.NetworkEVIO,
                        process.env.TokensTypeApp_User
                    );

                let body = {
                    country_code: countryCode,
                    party_id: partyId,
                    uid: appUserUid,
                    type: process.env.TokensTypeApp_User,
                    contract_id: contractUserType.contract_id,
                    issuer: 'EVIO - Electrical Mobility',
                    valid: true,
                    last_updated: '',
                    source: '',
                    whitelist: 'ALWAYS',
                    evId:
                        contract.contractType === 'fleet'
                            ? contract.evId
                            : '-1',
                    energy_contract: {
                        supplier_name: process.env.EnergyContractSupplierName,
                        contract_id:
                            process.env.NODE_ENV === 'production'
                                ? process.env.ProdEnergyContractDiaBi
                                : process.env.PreProdEnergyContractDiaBi,
                    },
                };

                createMobieToken(body, contractUserType.userId)
                    .then((result) => {
                        let query = {
                            _id: contract._id,
                        };

                        let newContract = {
                            'networks.$[i].tokens.$[j].refId': result.refId,
                            'networks.$[i].tokens.$[j].idTagDec': appUserUid,
                            'networks.$[i].tokens.$[j].status': token.status,
                            'networks.$[i].paymentMethod':
                                network.paymentMethod,
                            contract_id: contractUserType.contract_id,
                            nif: contractUserType.nif,
                            address: contractUserType.address,
                        };

                        let arrayFilters = [
                            { 'i.network': process.env.NetworkMobiE },
                            { 'j.tokenType': process.env.TokensTypeApp_User },
                        ];

                        Contract.updateContractWithFilters(
                            query,
                            { $set: newContract },
                            { arrayFilters: arrayFilters },
                            (err, doc) => {
                                if (err) {
                                    console.error(
                                        `[${context}][.then][updateContract] Error `,
                                        err.message
                                    );
                                } else {
                                    if (doc) {
                                        console.log('RFID token created');
                                    } else {
                                        console.log('RFID token not created');
                                    }
                                }
                            }
                        );
                    })
                    .catch((error) => {
                        console.error(
                            `[${context}][.catch][createMobieToken] Error `,
                            error.message
                        );
                    });
            } else {
                console.log('No contract with MobiE');
            }
        }
    });
}

function createMobieToken(body, userId) {
    return new Promise((resolve, reject) => {
        var context = 'Function createMobieToken';
        try {
            let config = {
                headers: {
                    userid: userId,
                    apikey: process.env.ocpiApiKey,
                },
            };
            let host = process.env.HostMobie + process.env.PathMobieTokens;

            axios
                .put(host, body, config)
                .then((response) => {
                    console.log(`MobiE ${body.type} ${body.uid} token created`);
                    resolve(response.data);
                })
                .catch((error) => {
                    if (error.response) {
                        console.error(
                            `[${context}][${host}][400] Error `,
                            error.response.data
                        );
                        reject(error);
                    } else {
                        console.error(
                            `[${context}][${host}] Error `,
                            error.message
                        );
                        reject(error);
                    }
                });
        } catch (error) {
            if (error.response) {
                console.error(`[${context}][400] Error `, error.response.data);
                reject(error);
            } else {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
        }
    });
}

function createListPaymentMethods(user) {
    var context = 'Function createListPaymentMethods';

    let host = process.env.HostPayments + process.env.PathPaymentMethods;

    const paymentMethod = user.isBankTransferEnabled ?
        ['Transfer']
        : user.clientType === process.env.ClientTypeB2B ? ['Card'] : [];

    let data = {
        userId: user._id,
        paymentMethod,
        userType: user.clientType,
        clientName: user.clientName,
    };

    axios
        .post(host, data)
        .then((result) => {
            console.log('Payment Methods created');
        })
        .catch((error) => {
            Sentry.captureException(error);
            console.error(`[${context}] Error `, error.message);
        });
}

function createListPaymentPeriods(user) {
    var context = 'Function createListPaymentPeriods';

    let host = process.env.HostPayments + process.env.PathPaymentPeriods;

    let data = {
        userId: user._id,
        paymentMethod: ['AD_HOC'],
        userType: user.clientType,
    };

    axios
        .post(host, data)
        .then((result) => {
            console.log('Payment Methods created');
        })
        .catch((error) => {
            Sentry.captureException(error);
            console.error(`[${context}] Error `, error.message);
        });
}

//addPaymentTypeB2B()
function addPaymentTypeB2B() {
    var context = 'Function addPaymentTypeB2B';

    let query = {
        clientType: 'b2b',
        active: true,
    };

    User.find(query, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        } else {
            if (result.length > 0) {
                result.map((user) => {
                    createListPaymentMethods(user);
                });
            } else {
                console.log('No users');
            }
        }
    });
}

//validateUser();
function validateUser() {
    var context = 'Function validateUser';

    let query = {
        active: true,
    };
    User.find(query, (err, usersFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        } else {
            if (usersFound.length > 0) {
                usersFound.forEach(async (user) => {
                    try {
                        let poolDrive = await Drivers.findOne({
                            userId: user._id,
                        });
                        if (poolDrive === null) {
                            console.log('createPoolDriver');
                            createPoolDriver(user);
                        }
                        let contract = await Contract.findOne({
                            userId: user._id,
                        });
                        if (contract === null) {
                            console.log('createContract');
                            createContract(user);
                        }
                        let CEMETariffEVIO = await CEMETariff.findOne({
                            userId: user._id,
                        });
                        if (CEMETariffEVIO === null) {
                            console.log('createCEMETariffEVIO');
                            createCEMETariffEVIO(user);
                        }
                        let billingProfile = await BillingProfile.findOne({
                            userId: user._id,
                        });
                        if (billingProfile === null) {
                            console.log('createBillingProfile');
                            createBillingProfile(user);
                        }

                        let notificataionsDefinition =
                            await getNotificataionsDefinition(user);
                        if (notificataionsDefinition === null) {
                            user = JSON.parse(JSON.stringify(user));
                            let headers = {
                                userid: user._id,
                                client: user.clientType,
                            };
                            console.log('createNotificataionsDefinition');
                            createNotificataionsDefinition(user, headers);
                        }
                        let wallet = await getWallet(user);
                        if (wallet === null) {
                            console.log('createWallet');
                            createWallet(user);
                        }

                        if (user.clientType === process.env.ClientTypeB2B) {
                            let listPaymentMethods =
                                await getListPaymentMethods(user);
                            if (listPaymentMethods === null) {
                                console.log('createListPaymentMethods');
                                createListPaymentMethods(user);
                            }
                        }
                    } catch (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                });
            }
        }
    });
}

function getNotificataionsDefinition(user) {
    var context = 'Function getNotificataionsDefinition';
    return new Promise((resolve, reject) => {
        var host =
            process.env.HostNotificationsDefinition +
            process.env.PathNotificationsDefinition;
        user = JSON.parse(JSON.stringify(user));
        let headers = {
            userid: user._id,
            client: user.clientType,
        };

        let params = {};
        axios
            .get(host, { params, headers })
            .then((result) => {
                resolve(result.data);
            })
            .catch((err) => {
                console.error(`[${context}] Error `, err.message);
                resolve(null);
            });
    });
}

function getWallet(user) {
    var context = 'Function getWallet';
    return new Promise((resolve, reject) => {
        var host = process.env.HostPayments + '/api/private/wallet/byUser';
        //console.log("host", host);
        user = JSON.parse(JSON.stringify(user));
        let headers = {
            userid: user._id,
        };
        let params = {};
        axios
            .get(host, { params, headers })
            .then((result) => {
                //console.log("host", result.data);
                resolve(result.data);
            })
            .catch((err) => {
                console.error(`[${context}] Error `, err.message);
                resolve(null);
            });
    });
}

function getListPaymentMethods(user) {
    var context = 'Function getListPaymentMethods';
    return new Promise((resolve, reject) => {
        var host = process.env.HostPayments + process.env.PathPaymentMethods;
        //console.log("host", host);
        user = JSON.parse(JSON.stringify(user));
        let headers = {
            userid: user._id,
        };
        let params = {};
        axios
            .get(host, { params, headers })
            .then((result) => {
                //console.log("host", result.data);
                resolve(result.data);
            })
            .catch((err) => {
                console.error(`[${context}] Error `, err.message);
                resolve(null);
            });
    });
}

function getCEMEEVIOADHOC(clientName) {
    const context = 'Function getCEMEEVIOADHOC';
    return new Promise((resolve, reject) => {
        let params;

        switch (clientName) {
            case process.env.WhiteLabelGoCharge:
                params = {
                    planName: 'server_plan_EVIO_ad_hoc_goCharge',
                };
                break;
            case process.env.WhiteLabelHyundai:
                params = {
                    planName: 'server_plan_EVIO_ad_hoc_hyundai',
                };
                break;
            default:
                params = {
                    planName: 'server_plan_EVIO_ad_hoc',
                };
                break;
        }

        let host =
            process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

        axios
            .get(host, { params })
            .then((result) => {
                resolve(result.data[0]);
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
}

async function findUsersContracts(usersFound, contractQuery, billingPeriod) {
    var context = 'Function findUsersContracts';
    try {
        let users = [];
        for (let user of usersFound) {
            let query = {
                ...contractQuery,
                userId: user._id,
                contractType: process.env.ContractTypeUser,
            };
            let foundBillingPeriod = true;
            if (billingPeriod) {
                foundBillingPeriod = await BillingProfile.findOne({
                    userId: user._id,
                    billingPeriod,
                }).lean();
            }

            let foundContract = true;
            if (Object.keys(contractQuery).length !== 0) {
                foundContract = await Contract.findOne(query, {
                    userId: 1,
                }).lean();
            }
            if (foundContract && foundBillingPeriod) {
                users.push(user);
            }
        }
        return users;
    } catch (error) {
        console.error(`[${context}][.catch] Error `, error.message);
        return [];
    }
}

function cemeTariffFind(query) {
    var context = 'Function cemeTariffFind';
    return new Promise((resolve, reject) => {
        CEMETariff.find(query, (err, cemeTariffFound) => {
            if (err) {
                console.error(`[${context}][findone] Error `, err.message);
                reject(err);
            } else {
                resolve(cemeTariffFound);
            }
        });
    });
}

//addClientNameUser()
function addClientNameUser() {
    var context = 'Function addClientNameUser';
    let query = {
        active: true,
    };
    User.updateMany(
        query,
        { $set: { clientName: 'EVIO' } },
        (err, usersUpdated) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            } else {
                console.log(usersUpdated);
            }
        }
    );
}

//addClientNameGuestUsers()
function addClientNameGuestUsers() {
    var context = 'Function addClientNameGuestUsers';
    let query = {
        active: true,
    };
    GuestUsers.updateMany(
        query,
        { $set: { clientName: 'EVIO' } },
        (err, guestUsersUpdated) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            } else {
                console.log(guestUsersUpdated);
            }
        }
    );
}

async function inactiveMobie(contractFound, userId, received) {
    const context = 'Function inactiveMobie';

    let appUserUid;
    let body;

    appUserUid = await getTokenIdTag(contractFound, 'MobiE', 'APP_USER');

    if (!appUserUid)
        appUserUid = await getTokenIdTag(contractFound, 'EVIO', 'APP_USER');

    body = {
        country_code: 'PT',
        party_id: 'EVI',
        type: 'APP_USER',
        uid: appUserUid,
        valid: false,
    };

    updateMobieToken(body, userId)
        .then(async (result) => {
            if (result.data.auth === false) {
                console.log('Result - updateMobieToken', result.data);
            } else {
                let found = contractFound.networks.find((network) => {
                    return network.tokens.find((token) => {
                        return (
                            token.tokenType === process.env.TokensTypeRFID &&
                            network.network === received.network &&
                            token.status !== process.env.NetworkStatusInactive
                        );
                    });
                });

                //console.log("Found", found);

                if (found) {
                    appUserUid = await getTokenIdTag(
                        contractFound,
                        'MobiE',
                        'RFID'
                    );

                    if (!appUserUid)
                        appUserUid = await getTokenIdTag(
                            contractFound,
                            'EVIO',
                            'RFID'
                        );

                    body = {
                        country_code: 'PT',
                        party_id: 'EVI',
                        type: process.env.TokensTypeRFID,
                        uid: appUserUid,
                        valid: false,
                    };

                    updateMobieToken(body, userId)
                        .then(async (response) => {
                            if (response.data.auth === false) {
                                console.log(
                                    'Result - updateMobieToken',
                                    response.data
                                );
                            } else {
                                console.log('Contract inactivated');
                            }
                        })
                        .catch((error) => {
                            console.error(
                                `[${context}][updateMobieToken] Error `,
                                error.message
                            );
                        });
                } else {
                    console.log('Contract inactivated');
                }
            }
        })
        .catch((error) => {
            console.error(
                `[${context}][updateMobieToken] Error `,
                error.message
            );
        });
}

function getTokenIdTag(obj, networkName, tokenType) {
    return new Promise((resolve, reject) => {
        for (let network of obj.networks) {
            if (network.network === networkName) {
                for (let token of network.tokens) {
                    if (token.tokenType === tokenType) {
                        if (token.idTagDec !== null && token.idTagDec !== '') {
                            resolve(token.idTagDec);
                        } else if (
                            token.idTagHexa !== null &&
                            token.idTagHexa !== ''
                        ) {
                            resolve(token.idTagHexa);
                        } else if (
                            token.idTagHexaInv !== null &&
                            token.idTagHexaInv !== ''
                        ) {
                            resolve(token.idTagHexaInv);
                        } else {
                            resolve(false);
                        }
                    }
                }
            }
        }
    });
}

function updateMobieToken(body, userId) {
    var context = 'Function updateMobieToken';

    let config = {
        headers: {
            userid: userId,
            apikey: process.env.ocpiApiKey,
        },
    };

    let host = process.env.HostMobie + process.env.PathMobieTokens;

    return new Promise((resolve, reject) => {
        axios
            .patch(host, body, config)
            .then((response) => {
                console.log(`MobiE ${body.type} token updated`);
                resolve(response);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });
    });
}

function getTokenIdTagHexa(obj, networkName, tokenType) {
    return new Promise((resolve, reject) => {
        for (let network of obj.networks) {
            if (network.network === networkName) {
                for (let token of network.tokens) {
                    if (token.tokenType === tokenType) {
                        resolve(token.idTagHexa);
                    }
                }
            }
        }
    });
}

function updateGireveToken(body, userId) {
    var context = 'Function updateGireveToken';

    let config = {
        headers: {
            userid: userId,
            apikey: process.env.ocpiApiKey,
        },
    };
    let host = process.env.HostMobie + process.env.PathGireveTokens;
    return new Promise((resolve, reject) => {
        axios
            .patch(host, body, config)
            .then((response) => {
                console.log(`Gireve ${body.type} token updated`);
                resolve(response);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                //resolve();
                reject(error);
            });
    });
}

//addClientName()
function addClientName() {
    var context = 'Function addClientName';

    User.find({}, (err, usersFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }

        if (usersFound.length > 0) {
            usersFound.forEach(async (user) => {
                try {
                    let drivers = await Drivers.updateMany(
                        { userId: user._id },
                        { $set: { clientName: user.clientName } }
                    );
                    let driversDependencies =
                        await DriversDependencies.updateMany(
                            { userId: user._id },
                            { $set: { clientName: user.clientName } }
                        );
                    let groupCSUsers = await GroupCSUsers.updateMany(
                        { createUser: user._id },
                        { $set: { clientName: user.clientName } }
                    );
                    let groupCSUsersDependencies =
                        await GroupCSUsersDependencies.updateMany(
                            { userId: user._id },
                            { $set: { clientName: user.clientName } }
                        );
                    let groupDrivers = await GroupDrivers.updateMany(
                        { createUser: user._id },
                        { $set: { clientName: user.clientName } }
                    );
                    let groupDriversDependencies =
                        await GroupDriversDependencies.updateMany(
                            { userId: user._id },
                            { $set: { clientName: user.clientName } }
                        );
                    let contract = await Contract.updateMany(
                        { userId: user._id },
                        { $set: { clientName: user.clientName } }
                    );
                    let cemeTariff = await CEMETariff.updateMany(
                        { userId: user._id },
                        { $set: { clientName: user.clientName } }
                    );

                    console.log('drivers', drivers);
                    console.log('driversDependencies', driversDependencies);
                    console.log('groupCSUsers', groupCSUsers);
                    console.log(
                        'groupCSUsersDependencies',
                        groupCSUsersDependencies
                    );
                    console.log('groupDrivers', groupDrivers);
                    console.log(
                        'groupDriversDependencies',
                        groupDriversDependencies
                    );
                    console.log('contract', contract);
                    console.log('cemeTariff', cemeTariff);
                } catch (error) {
                    console.error(`[${context}] Error `, err.message);
                }
            });
        }
    });
}

async function joinBillingProfile(user) {
    const context = 'Function joinBillingProfile';
    try {
        let userBillingProfile = await BillingProfile.findOne({
            userId: user._id,
        }).lean();
        return {
            userId: user._id,
            imageContent: user.imageContent,
            name: user.name,
            country: user.country,
            paymentPeriod: user.paymentPeriod,
            language: user.language,
            clientName: user.clientName,
            blocked: user.blocked,
            billingName: userBillingProfile.billingName,
            nif: userBillingProfile.nif,
            billingProfileId: userBillingProfile._id,
            billingAddress: userBillingProfile.billingAddress,
            billingEmail: userBillingProfile.email,
            billingPeriod: userBillingProfile.billingPeriod,
            purchaseOrder: userBillingProfile.purchaseOrder,
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return user;
    }
}

function updateUserCaetanoGO(user, userId) {
    const context = 'Function updateUserCaetanoGO';
    return new Promise(async (resolve) => {
        try {
            let userFound = await User.findOne(
                { _id: userId },
                { _id: 1, idGoData: 1 }
            );
            let data = {
                name: user.name,
                phone_number: user.mobile,
                phone_code: user.internationalPrefix.split('+')[1],
                sub_marketing: userFound.idGoData.sub_marketing,
            };

            let hostUser = `${host}${process.env.PathUpdateUserCaetanoGO}${userFound.idGoData.access_token}/`;

            let result = await axios.patch(hostUser, data, { auth });

            if (result.data._status === 'success') {
                resolve(true);
            } else {
                console.error(`[${context}] Error from axios `, result.data);
                resolve(false);
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(false);
        }
    });
}

async function updateReferencePlaces(
    userId,
    user,
    query,
    referencePlacesFound,
    clientName,
    res
) {
    const context = 'Function updateReferencePlaces';
    try {
        let listOfAddresses = await getAddressCaetanoGo(userId);
        let referencePlacesToUpdate;

        if (
            listOfAddresses.length === referencePlacesFound.length &&
            listOfAddresses.length === user.referencePlaces.length
        ) {
            referencePlacesToUpdate = await updateReferencePlacesCaetanoGo(
                referencePlacesFound,
                user.referencePlaces,
                userId,
                listOfAddresses
            );
        } else if (
            listOfAddresses.length === referencePlacesFound.length &&
            listOfAddresses.length < user.referencePlaces.length
        ) {
            referencePlacesToUpdate = await addReferencePlacesCaetanoGo(
                referencePlacesFound,
                user.referencePlaces,
                userId,
                listOfAddresses
            );
        } else if (
            listOfAddresses.length === referencePlacesFound.length &&
            listOfAddresses.length > user.referencePlaces.length
        ) {
            referencePlacesToUpdate = await removeReferencePlacesCaetanoGo(
                referencePlacesFound,
                user.referencePlaces,
                userId,
                listOfAddresses
            );
        } else {
            referencePlacesToUpdate = referencePlacesFound;
        }

        let newValue = {
            $set: {
                referencePlaces: referencePlacesToUpdate,
            },
        };

        let value = await updateUsers(query, newValue);

        if (value) {
            let userFound = await User.findOne(query, { referencePlaces: 1 });
            return res.status(200).send(userFound);
        } else
            return res
                .status(400)
                .send({
                    auth: false,
                    code: 'server_user_not_updated',
                    message: 'User not updated',
                });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

// TODO: refactor me, since this call seems duplicated
function getAddressCaetanoGo(userId) {
    const context = 'Function getAddressCaetanoGo';
    const fallback = [];
    return new Promise(async (resolve) => {
        try {
            let userFound = await User.findOne(
                { _id: userId },
                { _id: 1, idGoData: 1 }
            );

            if (!userFound?.idGoData?.access_token) {
                return resolve(fallback);
            }

            let hostAddresses = `${host}/user/${userFound.idGoData.access_token}/addresses/`;
            let resultAdrress = await axios.get(hostAddresses, { auth });

            if (resultAdrress.data._status === 'success') {
                resolve(resultAdrress.data.data);
            } else {
                resolve(fallback);
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(fallback);
        }
    });
}

function updateReferencePlacesCaetanoGo(
    referencePlacesFound,
    newReferencePlaces,
    userId,
    listOfAddresses
) {
    const context = 'Function updateReferencePlacesCaetanoGo';
    return new Promise(async (resolve) => {
        try {
            let userFound = await User.findOne(
                { _id: userId },
                { _id: 1, idGoData: 1 }
            );

            Promise.all(
                newReferencePlaces.map((place) => {
                    return new Promise(async (resolve, reject) => {
                        let found = referencePlacesFound.find((address) => {
                            return address._id == place._id;
                        });

                        //console.log("found", found);
                        if (found) {
                            place.addressIdCaetanoGo = found.addressIdCaetanoGo;

                            let adrressFound = listOfAddresses.find(
                                (address) => {
                                    return (
                                        address.id == found.addressIdCaetanoGo
                                    );
                                }
                            );

                            let hostAddresses = `${host}/user/${userFound.idGoData.access_token}/addresses/${found.addressIdCaetanoGo}/`;

                            let address = addressS.parseAddressStreetToString(
                                place.address
                            );

                            let data = {
                                custom_name: place.name,
                                name: adrressFound.name,
                                vat: adrressFound.vat,
                                address: address,
                                postal_code: place.address.zipCode,
                                locality: place.address.city,
                                district: place.address.state
                                    ? place.address.state
                                    : place.address.city,
                                country: place.address.country,
                            };

                            //console.log("data", data);

                            let resultAdrress = await axios.patch(
                                hostAddresses,
                                data,
                                { auth }
                            );

                            //console.log(resultAdrress.data)
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
                })
            ).then(() => {
                //console.log("newReferencePlaces", newReferencePlaces);
                resolve(newReferencePlaces);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(referencePlacesFound);
        }
    });
}

function addReferencePlacesCaetanoGo(
    referencePlacesFound,
    newReferencePlaces,
    userId,
    listOfAddresses
) {
    const context = 'Function addReferencePlacesCaetanoGo';
    return new Promise(async (resolve) => {
        try {
            let userFound = await User.findOne(
                { _id: userId },
                { _id: 1, idGoData: 1, name: 1 }
            );

            Promise.all(
                newReferencePlaces.map((place) => {
                    return new Promise(async (resolve, reject) => {
                        let found = referencePlacesFound.find((address) => {
                            return address._id == place._id;
                        });

                        //console.log("found", found);
                        if (found) {
                            place.addressIdCaetanoGo = found.addressIdCaetanoGo;

                            let adrressFound = listOfAddresses.find(
                                (address) => {
                                    return (
                                        address.id == found.addressIdCaetanoGo
                                    );
                                }
                            );

                            let hostAddresses = `${host}/user/${userFound.idGoData.access_token}/addresses/${found.addressIdCaetanoGo}/`;

                            let address = addressS.parseAddressStreetToString(
                                place.address
                            );

                            let data = {
                                custom_name: place.name,
                                name: adrressFound.name,
                                vat: adrressFound.vat,
                                address: address,
                                postal_code: place.address.zipCode,
                                locality: place.address.city,
                                district: place.address.state
                                    ? place.address.state
                                    : place.address.city,
                                country: place.address.country,
                            };

                            //console.log("data", data);

                            let resultAdrress = await axios.patch(
                                hostAddresses,
                                data,
                                { auth }
                            );
                            console.log('resultAdrress', resultAdrress.data);
                            //console.log(resultAdrress.data)
                            resolve(true);
                        } else {
                            let hostAddresses = `${host}/user/${userFound.idGoData.access_token}/addresses/`;

                            let address = addressS.parseAddressStreetToString(
                                place.address
                            );

                            let data = {
                                custom_name: place.name,
                                name: userFound.name,
                                vat: '',
                                address: address,
                                postal_code: place.address.zipCode,
                                locality: place.address.city,
                                district: place.address.state
                                    ? place.address.state
                                    : place.address.city,
                                country: place.address.country,
                            };

                            let resultAdrress = await axios.put(
                                hostAddresses,
                                data,
                                { auth }
                            );

                            console.log('resultAdrress', resultAdrress.data);

                            if (resultAdrress.data._status === 'success') {
                                place.addressIdCaetanoGo =
                                    resultAdrress.data.data.id;
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        }
                    });
                })
            ).then((result) => {
                //console.log("newReferencePlaces", newReferencePlaces);
                let list = result.filter((elem) => {
                    return elem === false;
                });
                if (list.length === 0) resolve(newReferencePlaces);
                else resolve(referencePlacesFound);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(referencePlacesFound);
        }
    });
}

function removeReferencePlacesCaetanoGo(
    referencePlacesFound,
    newReferencePlaces,
    userId,
    listOfAddresses
) {
    const context = 'Function removeReferencePlacesCaetanoGo';
    return new Promise(async (resolve) => {
        try {
            let userFound = await User.findOne(
                { _id: userId },
                { _id: 1, idGoData: 1, name: 1 }
            );

            let response = [];

            Promise.all(
                referencePlacesFound.map((place) => {
                    return new Promise(async (resolve, reject) => {
                        let found = newReferencePlaces.find((address) => {
                            return address._id == place._id;
                        });

                        //console.log("found", found);
                        if (found) {
                            found.addressIdCaetanoGo = place.addressIdCaetanoGo;

                            response.push(found);

                            let adrressFound = listOfAddresses.find(
                                (address) => {
                                    return (
                                        address.id == found.addressIdCaetanoGo
                                    );
                                }
                            );

                            let hostAddresses = `${host}/user/${userFound.idGoData.access_token}/addresses/${found.addressIdCaetanoGo}/`;

                            let address = addressS.parseAddressStreetToString(
                                place.address
                            );

                            let data = {
                                custom_name: place.name,
                                name: adrressFound.name,
                                vat: adrressFound.vat,
                                address: address,
                                postal_code: place.address.zipCode,
                                locality: place.address.city,
                                district: place.address.state
                                    ? place.address.state
                                    : place.address.city,
                                country: place.address.country,
                            };

                            //console.log("data", data);

                            let resultAdrress = await axios.patch(
                                hostAddresses,
                                data,
                                { auth }
                            );

                            //console.log(resultAdrress.data)
                            resolve(true);
                        } else {
                            let hostAddresses = `${host}/user/${userFound.idGoData.access_token}/addresses/${place.addressIdCaetanoGo}/`;
                            let resultAdrress = await axios.delete(
                                hostAddresses,
                                { auth }
                            );
                            resolve(true);
                        }
                    });
                })
            ).then((result) => {
                //console.log("response", response);
                resolve(response);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(referencePlacesFound);
        }
    });
}

function validateUserIdGo(user) {
    const context = 'Function validateUserIdGo';
    return new Promise(async (resolve, reject) => {
        try {
            let auth;
            let hostToken;
            switch (process.env.NODE_ENV) {
                case 'production':
                    console.log('Initing production environment');

                    auth = {
                        username: process.env.UserNameWebserviceGoCharge,
                        password: process.env.KeyWebserviceGoCharge,
                    };
                    hostToken = process.env.HostToken;

                    break;
                case 'development':
                    console.log('Initing dev environment');
                    auth = {
                        username: process.env.UserNameWebserviceGoChargePRE,
                        password: process.env.KeyWebserviceGoChargePRE,
                    };
                    hostToken = process.env.HostTokenTest;

                    break;
                case 'pre-production':
                    console.log('Initing pre environment');

                    auth = {
                        username: process.env.UserNameWebserviceGoChargePRE,
                        password: process.env.KeyWebserviceGoChargePRE,
                    };
                    hostToken = process.env.HostTokenTest;

                    break;
                default:
                    console.log('Unknown environment');

                    auth = {
                        username: process.env.UserNameWebserviceGoChargePRE,
                        password: process.env.KeyWebserviceGoChargePRE,
                    };
                    hostToken = process.env.HostTokenTest;

                    break;
            }

            let host = `${hostToken}/user/${user.idGoData.access_token}/`;

            let result = await axios.get(host, { auth });

            if (result.data._status === 'success') {
                resolve(true);
            } else {
                resolve(false);
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(false);
        }
    });
}

function refreshTokenIdGo(user) {
    const context = 'Function refreshTokenIdGo';
    return new Promise(async (resolve, reject) => {
        try {
            let host;
            let passwordOauth2, usernameOauth2;
            let auth;
            let hostToken;

            switch (process.env.NODE_ENV) {
                case 'production':
                    console.log('Initing production environment');
                    host = process.env.HostIdCaetanoGo;
                    passwordOauth2 = process.env.oAuth2;
                    usernameOauth2 = process.env.UserNameWebserviceGoCharge;
                    auth = {
                        username: process.env.UserNameWebserviceGoCharge,
                        password: process.env.KeyWebserviceGoCharge,
                    };
                    hostToken = process.env.HostToken;

                    break;
                case 'development':
                    console.log('Initing dev environment');
                    host = process.env.HostIdCaetanoGoTest;
                    passwordOauth2 = process.env.oAuth2PRE;
                    usernameOauth2 = process.env.UserNameWebserviceGoChargePRE;
                    auth = {
                        username: process.env.UserNameWebserviceGoChargePRE,
                        password: process.env.KeyWebserviceGoChargePRE,
                    };
                    hostToken = process.env.HostTokenTest;

                    break;
                case 'pre-production':
                    console.log('Initing pre environment');
                    host = process.env.HostIdCaetanoGoTest;
                    passwordOauth2 = process.env.oAuth2PRE;
                    usernameOauth2 = process.env.UserNameWebserviceGoChargePRE;
                    auth = {
                        username: process.env.UserNameWebserviceGoChargePRE,
                        password: process.env.KeyWebserviceGoChargePRE,
                    };
                    hostToken = process.env.HostTokenTest;

                    break;
                default:
                    console.log('Unknown environment');
                    host = process.env.HostIdCaetanoGoTest;
                    passwordOauth2 = process.env.oAuth2PRE;
                    usernameOauth2 = process.env.UserNameWebserviceGoChargePRE;
                    auth = {
                        username: process.env.UserNameWebserviceGoChargePRE,
                        password: process.env.KeyWebserviceGoChargePRE,
                    };
                    hostToken = process.env.HostTokenTest;

                    break;
            }

            let data = {
                grant_type: process.env.IDGOgrantTypeRefreshToken,
                refresh_token: user.idGoData.refresh_token,
            };

            let response = await axios.post(host, data, {
                auth: { username: usernameOauth2, password: passwordOauth2 },
            });

            console.log('response', response.data);

            let responseValidation = await validateFieldsIdGo(response.data);

            if (responseValidation) {
                let idGoData = response.data;

                if (!idGoData.sub_marketing) {
                    idGoData.sub_marketing = '1';
                }

                let userUpdated = await User.findByIdAndUpdate(
                    { _id: user._id },
                    { $set: { idGoData: idGoData } },
                    { new: true }
                );

                resolve(userUpdated);
            }
        } catch (error) {
            if (error.response) {
                console.error(`[${context}] Error `, error.response.data);
                if (error.response.data.error === 'invalid_grant') {
                    resolve(null);
                } else {
                    reject(error);
                }
            } else {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
        }
    });
}

function validateFieldsIdGo(response) {
    return new Promise((resolve, reject) => {
        if (!response)
            reject({
                auth: false,
                code: 'server_data_required',
                message: 'Data is required',
            });
        else if (!response.access_token)
            reject({
                auth: false,
                code: 'server_accessToken_required',
                message: 'Access token is required',
            });
        else if (!response.expires_in)
            reject({
                auth: false,
                code: 'server_expiration_date_required',
                message: 'Expiration date is required',
            });
        else if (!response.token_type)
            reject({
                auth: false,
                code: 'server_token_type_required',
                message: 'Token type is required',
            });
        else if (!response.refresh_token)
            reject({
                auth: false,
                code: 'server_refreshToken_required',
                message: 'Refresh token is required',
            });
        else resolve(true);
    });
}

var taskUserIdGoSchedule = null;

initUserIdGoSchedule('25 */3 * * *')
    .then(() => {
        taskUserIdGoSchedule.start();
        console.log('User IdGo Schedule Job Started');
    })
    .catch((error) => {
        console.log('Error starting User IdGo schedule Job: ' + error.message);
    });

function initUserIdGoSchedule(timer) {
    return new Promise((resolve, reject) => {
        console.log('timer - ', timer);

        taskUserIdGoSchedule = cron.schedule(
            timer,
            () => {
                console.log(
                    'Running Job User IdGo Schedule: ' +
                        new Date().toISOString()
                );

                userIdGoSchedule();
            },
            {
                scheduled: false,
            }
        );

        resolve();
    });
}

//userIdGoSchedule()
async function userIdGoSchedule() {
    const context = 'Funciton userIdGoSchedule';
    try {
        let query = {
            clientName: process.env.WhiteLabelGoCharge,
            clientType: 'b2c',
        };

        let usersFound = await User.find(query);
        console.log('usersFound', usersFound.length);
        if (usersFound.length > 0) {
            for (let i = 0; i < usersFound.length; i++) {
                let user = usersFound[i];

                //console.log("User.username", user.username)
                if (user.idGoData) {
                    let response = await refreshTokenIdGo(user);
                    if (response) {
                        console.log('User updated');
                    } else {
                        console.log('User not updated');
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function updateMobileGoCharge(user, mobile, internationalPrefix) {
    const context = 'Funciton updateMobileGoCharge';
    return new Promise(async (resolve, reject) => {
        try {
            let data = {
                name: user.name,
                phone_number: mobile,
                phone_code: internationalPrefix.split('+')[1],
                sub_marketing: user.idGoData.sub_marketing,
            };

            let hostUser = `${host}${process.env.PathUpdateUserCaetanoGO}${user.idGoData.access_token}/`;

            let result = await axios.patch(hostUser, data, { auth });

            if (result.data._status === 'success') {
                resolve(true);
            } else {
                console.error(`[${context}] Error from axios `, result.data);
                resolve(false);
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

async function unlockUserContract(userId) {
    const context = 'Function unlockUserContract';

    Contract.find({ userId: userId }, (err, contractsFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }

        if (contractsFound.length > 0) {
            contractsFound.map((contract) => {
                let mobieActive = contract.networks.find((network) => {
                    return network.tokens.find((token) => {
                        return (
                            network.network === process.env.NetworkMobiE &&
                            token.tokenType ===
                                process.env.TokensTypeApp_User &&
                            token.status !== process.env.NetWorkStatusInactive
                        );
                    });
                });

                let gireveActive = contract.networks.find((network) => {
                    return network.tokens.find((token) => {
                        return (
                            network.network === process.env.NetworkGireve &&
                            token.tokenType === process.env.TokensTypeOTHER &&
                            token.status !== process.env.NetWorkStatusInactive
                        );
                    });
                });

                if (mobieActive) {
                    activeMobie(contract, userId, {
                        network: process.env.NetworkMobiE,
                    });
                }

                if (gireveActive) {
                    gireveServices.activeGireve(contract, userId, {
                        network: process.env.NetworkGireve,
                    });
                }
            });
        }
    });
}

async function activeMobie(contractFound, userId, received) {
    const context = 'Function activeMobie';

    let appUserUid;
    let body;

    appUserUid = await getTokenIdTag(contractFound, 'MobiE', 'APP_USER');

    if (!appUserUid)
        appUserUid = await getTokenIdTag(contractFound, 'EVIO', 'APP_USER');

    body = {
        country_code: 'PT',
        party_id: 'EVI',
        type: 'APP_USER',
        uid: appUserUid,
        valid: true,
    };

    updateMobieToken(body, userId)
        .then(async (result) => {
            if (result.data.auth === false) {
                console.log('Result - updateMobieToken', result.data);
            } else {
                let found = contractFound.networks.find((network) => {
                    return network.tokens.find((token) => {
                        return (
                            token.tokenType === process.env.TokensTypeRFID &&
                            network.network === received.network &&
                            token.status !== process.env.NetWorkStatusInactive
                        );
                    });
                });

                //console.log("Found", found);

                if (found) {
                    appUserUid = await getTokenIdTag(
                        contractFound,
                        'MobiE',
                        'RFID'
                    );

                    if (!appUserUid)
                        appUserUid = await getTokenIdTag(
                            contractFound,
                            'EVIO',
                            'RFID'
                        );

                    body = {
                        country_code: 'PT',
                        party_id: 'EVI',
                        type: 'RFID',
                        uid: appUserUid,
                        valid: true,
                    };

                    updateMobieToken(body, userId)
                        .then(async (response) => {
                            if (response.data.auth === false) {
                                console.log(
                                    'Result - updateMobieToken',
                                    response.data
                                );
                            } else {
                                console.log('Contract inactivated');
                            }
                        })
                        .catch((error) => {
                            console.error(
                                `[${context}][updateMobieToken] Error `,
                                error.message
                            );
                        });
                } else {
                    console.log('Contract inactivated');
                }
            }
        })
        .catch((error) => {
            console.error(
                `[${context}][updateMobieToken] Error `,
                error.message
            );
        });
}

async function activeMobiE(contract, clientType) {
    let context = 'Function activeMobiE';
    try {
        let req = {
            body: {
                contractId: contract._id,
                network: process.env.NetworkMobiE,
            },
            headers: {
                userid: contract.userId,
                clientname: contract.clientName,
                usertype: clientType,
            },
        };

        ContractHandler.activeNetworks(req)
            .then((result) => {
                req = {
                    body: {
                        contractId: contract._id,
                        network: process.env.NetworkGireve,
                    },
                    headers: {
                        userid: contract.userId,
                        clientname: contract.clientName,
                        usertype: clientType,
                    },
                };

                ContractHandler.activeNetworks(req)
                    .then((result) => {
                        console.log(result.message);
                    })
                    .catch((error) => {
                        Sentry.captureException(error);
                        console.error(
                            `[${context}][ContractHandler.activeNetwork] Error `,
                            error.message
                        );
                    });
            })
            .catch((error) => {
                Sentry.captureException(error);
                console.error(
                    `[${context}][ContractHandler.activeNetwork] Error `,
                    error.message
                );
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

//addStatusUser()
async function addStatusUser() {
    let context = 'Function addStatusUser';
    try {
        let usersActiveUpdaed = await User.updateMany(
            { active: true },
            { $set: { status: process.env.USERRREGISTERED } }
        );
        let usersActiveFalseUpdaed = await User.updateMany(
            { active: false },
            { $set: { status: process.env.USERREMOVED } }
        );

        console.log('usersActiveUpdaed', usersActiveUpdaed);
        console.log('usersActiveFalseUpdaed', usersActiveFalseUpdaed);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

//validateDependencies()
async function validateDependencies() {
    let context = 'Function validateDependencies';
    try {
        let fields = {
            _id: 1,
            mobile: 1,
            internationalPrefix: 1,
            clientName: 1,
            name: 1,
        };
        let usersFound = await User.find(
            { active: true, status: process.env.USERRREGISTERED },
            fields
        );

        if (usersFound.length > 0) {
            usersFound.forEach((user) => {
                userDriversDependencies(user);
                userGroupDriversDependencies(user);
                userGroupCSUsersDependencies(user);
            });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

//activeNetworksb2c()
async function activeNetworksb2c() {
    let context = 'Function activeNetworksb2c';
    try {
        let query = {
            clientName: 'EVIO',
            clientType: 'b2c',
            status: 'REGISTERED',
        };

        let usersFounds = await User.find(query, { _id: 1 });

        console.log('usersFounds.length', usersFounds.length);
        if (usersFounds.length > 0) {
            for (let i = 0; i < usersFounds.length; i++) {
                setTimeout(async () => {
                    console.log('Active Networks - ', i, ' - ', new Date());
                    let user = usersFounds[i];

                    let query = {
                        userId: user._id,
                        status: 'active',
                        networks: {
                            $elemMatch: {
                                $or: [
                                    {
                                        network: process.env.NetworkMobiE,
                                        tokens: {
                                            $elemMatch: {
                                                tokenType:
                                                    process.env
                                                        .TokensTypeApp_User,
                                                status: process.env
                                                    .NetworkStatusInactive,
                                            },
                                        },
                                    },
                                    {
                                        network: process.env.NetworkGireve,
                                        tokens: {
                                            $elemMatch: {
                                                tokenType:
                                                    process.env.TokensTypeOTHER,
                                                status: process.env
                                                    .NetworkStatusInactive,
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                        contractType: 'user',
                    };

                    let contractFound = await Contract.findOne(query);
                    console.log('contractsFound - ', contractFound);

                    if (contractFound) {
                        let mobie = contractFound.networks.find((network) => {
                            return network.tokens.find((token) => {
                                return (
                                    network.network ===
                                        process.env.NetworkMobiE &&
                                    token.tokenType ===
                                        process.env.TokensTypeApp_User &&
                                    token.status !==
                                        process.env.NetworkStatusActive
                                );
                            });
                        });

                        let gireve = contractFound.networks.find((network) => {
                            return network.tokens.find((token) => {
                                return (
                                    network.network ===
                                        process.env.NetworkGireve &&
                                    token.tokenType ===
                                        process.env.TokensTypeOTHER &&
                                    token.status !==
                                        process.env.NetworkStatusActive
                                );
                            });
                        });

                        if (mobie && gireve) {
                            console.log('Mobie/Gireve');
                            activeMobiE(contractFound, 'b2c');
                        } else if (!mobie && gireve) {
                            console.log('Only Gireve');

                            let req = {
                                body: {
                                    contractId: contractFound._id,
                                    network: process.env.NetworkGireve,
                                },
                                headers: {
                                    userid: contractFound.userId,
                                    clientname: contractFound.clientName,
                                    usertype: 'b2c',
                                },
                            };

                            try {
                                let response =
                                    await ContractHandler.activeNetworks(req);

                                console.log(response.message);
                            } catch (error) {
                                console.error(
                                    `[${context}][GIREVE] Error `,
                                    error.message
                                );
                            }
                        } else if (mobie && !gireve) {
                            console.log('Only Mobie');

                            let req = {
                                body: {
                                    contractId: contractFound._id,
                                    network: process.env.NetworkMobiE,
                                },
                                headers: {
                                    userid: contractFound.userId,
                                    clientname: contractFound.clientName,
                                    usertype: 'b2c',
                                },
                            };
                            try {
                                let response =
                                    await ContractHandler.activeNetworks(req);

                                console.log(response.message);
                            } catch (error) {
                                console.error(
                                    `[${context}][MOBIE] Error `,
                                    error.message
                                );
                            }
                        }
                    }
                }, i * 5000);
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

//activeNetworksB2C()
async function activeNetworksB2C() {
    let context = 'Function activeNetworksB2C';
    try {
        let query = {
            status: 'active',
            clientName: 'EVIO',
            networks: {
                $elemMatch: {
                    $or: [
                        {
                            network: 'MobiE',
                            tokens: {
                                $elemMatch: {
                                    tokenType: 'APP_USER',
                                    status: 'inactive',
                                },
                            },
                        },
                        {
                            network: 'Gireve',
                            tokens: {
                                $elemMatch: {
                                    tokenType: 'OTHER',
                                    status: 'inactive',
                                },
                            },
                        },
                    ],
                },
            },
            contractType: 'user',
        };

        let contractsFound = await Contract.find(query);
        if (contractsFound.length > 0) {
            for (let i = 0; i < contractsFound.length; i++) {
                setTimeout(async () => {
                    console.log('Active Networks - ', i, ' - ', new Date());
                    let contractFound = contractsFound[i];

                    if (contractFound) {
                        let mobie = contractFound.networks.find((network) => {
                            return network.tokens.find((token) => {
                                return (
                                    network.network ===
                                        process.env.NetworkMobiE &&
                                    token.tokenType ===
                                        process.env.TokensTypeApp_User &&
                                    token.status !==
                                        process.env.NetworkStatusActive
                                );
                            });
                        });

                        let gireve = contractFound.networks.find((network) => {
                            return network.tokens.find((token) => {
                                return (
                                    network.network ===
                                        process.env.NetworkGireve &&
                                    token.tokenType ===
                                        process.env.TokensTypeOTHER &&
                                    token.status !==
                                        process.env.NetworkStatusActive
                                );
                            });
                        });

                        if (mobie && gireve) {
                            console.log('Mobie/Gireve');
                            activeMobiE(contractFound, 'b2c');
                        } else if (!mobie && gireve) {
                            console.log('Only Gireve');

                            let req = {
                                body: {
                                    contractId: contractFound._id,
                                    network: process.env.NetworkGireve,
                                },
                                headers: {
                                    userid: contractFound.userId,
                                    clientname: contractFound.clientName,
                                    usertype: 'b2c',
                                },
                            };

                            try {
                                let response =
                                    await ContractHandler.activeNetworks(req);

                                console.log(response.message);
                            } catch (error) {
                                console.error(
                                    `[${context}][GIREVE] Error `,
                                    error.message
                                );
                            }
                        } else if (mobie && !gireve) {
                            console.log('Only Mobie');

                            let req = {
                                body: {
                                    contractId: contractFound._id,
                                    network: process.env.NetworkMobiE,
                                },
                                headers: {
                                    userid: contractFound.userId,
                                    clientname: contractFound.clientName,
                                    usertype: 'b2c',
                                },
                            };
                            try {
                                let response =
                                    await ContractHandler.activeNetworks(req);

                                console.log(response.message);
                            } catch (error) {
                                console.error(
                                    `[${context}][MOBIE] Error `,
                                    error.message
                                );
                            }
                        }
                    }
                }, i * 30 * 1000);
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

//trimCardNumberACP()
async function trimCardNumberACP() {
    let context = 'Function trimCardNumberACP';

    try {
        let query = {
            clientName: 'ACP',
        };

        let usersFound = await User.find(query);

        if (usersFound.length > 0) {
            usersFound.forEach(async (user) => {
                if (user.cardNumber) {
                    console.log('user.cardNumber', user.cardNumber);

                    let cardNumber = user.cardNumber.replace(/\s/g, '');

                    console.log('cardNumber', cardNumber);
                    query = {
                        _id: user._id,
                    };

                    let userUpdated = await User.findOneAndUpdate(
                        query,
                        { $set: { cardNumber: cardNumber } },
                        { new: true }
                    );

                    console.log('User Updated');
                }
            });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function validarRFIDCard(user) {
    let context = 'Function validarRFIDCard';
    try {
        let card = await HYSibsCards.getSibsCardsByMobile(user.mobile);

        if (card) {
            let contractFound = await Contract.findOne({ userId: user._id });

            if (contractFound) {
                let data = {
                    cardNumber: contractFound.cardNumber,
                    nif: contractFound.nif,
                    contractId: contractFound._id,
                };

                let headers = {
                    userid: user._id,
                    clientname: user.clientName,
                };

                let host =
                    'http://identity:3003/api/private/contracts/validateCard';

                let response = await axios.patch(host, data, { headers });

                if (response) {
                    console.log('Sucess');
                }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function convertTags(idTag) {
    const context = 'Function convertTags';
    return new Promise((resolve, reject) => {
        try {
            let hexa = BigInt(idTag).toString(16).toUpperCase();

            while (hexa.length < 7 * 2) {
                hexa = '0' + hexa;
            }

            let hexaInvert = '';

            for (let i = hexa.length; i > 0; i -= 2) {
                const sub = String(hexa).substring(i, i - 2);
                hexaInvert += sub;
            }

            console.log('hexaInvert', hexaInvert);
            let decimalInvert = Converter.decimal(hexaInvert);

            let response = {
                tagDecimal: idTag,
                tagDecimalInvert: decimalInvert,
                tagHexa: hexa,
                tagHexaInvert: hexaInvert,
            };

            resolve(response);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

async function hyundaiGetToken() {
    var context = 'Function hyundaiGetToken';
    try {
        //TODO change rotes to only wotk on PROD?
        switch (process.env.NODE_ENV) {
            case 'production':
                break;
            case 'development':
                break;
            case 'pre-production':
                break;
            default:
                break;
        }

        let host = process.env.hyundaiGetToken;

        let keys = ['client_id', 'scope', 'client_secret', 'grant_type'];

        let values = [
            process.env.HYUNDAI_CLIENT_ID,
            process.env.HYUNDAI_CLIENT_SCOPE,
            process.env.HYUNDAI_CLIENT_SECRET,
            process.env.hyundaiGranType,
        ];

        let body = axiosS.getFromDataFormat(keys, values);

        return (result = await axiosS.axiosPostBody(host, body));
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null;
    }
}

async function updateUserHyundai(userId) {
    var context = 'Function hyundaiPutData';
    try {
        let tokenInfo = await hyundaiGetToken();

        let userFound = await User.findOne(
            { _id: userId },
            {
                _id: 1,
                idHyundaiCode: 1,
                idHyundai: 1,
                internationalPrefix: 1,
                mobile: 1,
                name: 1,
                email: 1,
            }
        );

        if (!userFound) {
            console.log('User not found!');
            return;
        }

        let billingProfileFound = await BillingProfile.findOne(
            { userId: userId },
            { userId: 1, nif: 1, idHyundai: 1, billingAddress: 1 }
        );

        if (!billingProfileFound) {
            console.log('Billing profile not found!');
            return;
        }

        let address = billingProfileFound.billingAddress.street
            ? billingProfileFound.billingAddress.street
            : '' + ',' + billingProfileFound.billingAddress.number
            ? billingProfileFound.billingAddress.number
            : '' + ',' + billingProfileFound.billingAddress.zipCode
            ? billingProfileFound.billingAddress.zipCode
            : '' + ',' + billingProfileFound.billingAddress.city
            ? billingProfileFound.billingAddress.city
            : '';

        let data = {
            telephone: userFound.internationalPrefix + userFound.mobile,
            nif: billingProfileFound.nif,
            address: address,
        };

        let names = userFound.name.split(' ');

        if (names.length >= 2) {
            data.firstName = names[0];
            data.lastName = names[names.length - 1];
        } else {
            data.firstName = userFound.name;
        }

        let headers = {
            Authorization: `Bearer ${tokenInfo.access_token}`,
            idClientCRM: userFound.idHyundaiCode,
            brand: process.env.hyundaiBrand,
        };

        let host = process.env.hyundaiPutData + userFound.idHyundaiCode;

        console.log('host login Hyundai');
        console.log(host);

        console.log('headers login Hyundai');
        console.log(headers);

        console.log('data login Hyundai');
        console.log(data);

        return (result = await axiosS.axiosPutBodyAndHeader(
            host,
            data,
            headers
        ));
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null;
    }
}

async function updateAddressModel() {
    const context = 'Function updateAddressModel';
    try {
        await User.updateMany(
            { 'referencePlaces.address.address': { $exists: true } },
            [
                {
                    $set: {
                        'referencePlaces.address.street': '$address.address',
                    },
                },
            ],
            (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                } else {
                    console.log(
                        'result referencePlaces.address.address to referencePlaces.address.street: ',
                        result
                    );
                }
            }
        );

        await User.updateMany(
            { 'referencePlaces.address.postCode': { $exists: true } },
            [
                {
                    $set: {
                        'referencePlaces.address.zipCode': '$address.postCode',
                    },
                },
            ],
            (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                } else {
                    console.log(
                        'result referencePlaces.address.postCode to referencePlaces.address.zipCode: ',
                        result
                    );
                }
            }
        );

        let users = await User.find({
            'referencePlaces.address.country': { $exists: true },
        });

        let unicCountries = [];

        for (let i = 0; i != users.length; i++) {
            if (users[i].referencePlaces)
                for (let j = 0; j != users[i].referencePlaces.length; j++) {
                    if (users[i].referencePlaces[j].address)
                        if (users[i].referencePlaces[j].address.country)
                            if (
                                unicCountries.indexOf(
                                    users[i].referencePlaces[j].address.country
                                ) == -1
                            ) {
                                unicCountries.push(
                                    users[i].referencePlaces[j].address.country
                                );
                            }
                }
        }

        let coutryCodes = [];

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]));
        }

        console.log('coutryCodes');
        console.log(coutryCodes);

        console.log('unicCountries');
        console.log(unicCountries);

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await User.updateMany(
                    { 'referencePlaces.address.country': unicCountries[i] },
                    [
                        {
                            $set: {
                                'referencePlaces.address.countryCode':
                                    coutryCodes[i],
                            },
                        },
                    ],
                    (err, result) => {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);
                        } else {
                            console.log(
                                'result ' +
                                    unicCountries[i] +
                                    ' to ' +
                                    coutryCodes[i] +
                                    ': ',
                                result
                            );
                        }
                    }
                );
            } else {
                console.log('WRONG Country found: ' + unicCountries[i]);
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error;
    }
}

async function addEnergyManagementEnabled() {
    const context = 'Function addEnergyManagementEnabled';
    try {
        const result = await User.updateMany(
            {},
            { $set: { 'userPackage.energyManagementEnabled': false } },
            { upsert: true, multi: true }
        );

        return {
            success: true,
            message:
                'Energy management enabled updated successfully for all users.',
            result,
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {
            success: false,
            message:
                'Failed to update energy management enabled for all users.',
            error: error.message,
        };
    }
}

module.exports = { router, createContract, createUserDependencies };
