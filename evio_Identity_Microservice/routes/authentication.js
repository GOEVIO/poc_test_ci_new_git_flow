import authenticationService from '../services/authentication'
import {BadRequest, errorResponse, setLanguageUser } from '../utils';
import User from '../models/user';
import GuestUsers from '../models/guestUsers';
import UserPasswords from '../models/userPasswords';
import { isZipAddressValidToCountry } from '../services/googleMaps';
import { clientNameEnum } from '../utils/enums/users';
import AppConfigurationService from '../services/configsService';
import toggle from 'evio-toggle';
import libraryIdentity from 'evio-library-identity';

const Sentry = require('@sentry/node')

require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const httpProxy = require('express-http-proxy');
const Validator = require('email-validator');
const Drivers = require('../models/drivers');
const DriversDependencies = require('../models/driversDependencies');
const GroupDriversDependencies = require('../models/groupDriversDependencies');
const GroupDrivers = require('../models/groupDrivers');
const GroupCSUsers = require('../models/groupCSUsers');
const GroupCSUsersDependencies = require('../models/groupCSUsersDependencies');
const Contract = require('../models/contracts');
const BillingProfile = require('../models/billingProfile');
const CEMETariff = require('../models/cemeTariff');
const axios = require("axios");
const MongoDb = require('../mongo');
const CemeData = require('../controllers/ceme');
const ContractHandler = require('../controllers/contracts');
const axiosS = require("../services/axios");
const countryList = require('country-list');
const { default: { getCardName } } = require('../utils/users');
const { logger } = require('../utils/constants');
const constants = require('../utils/constants').default;

console.log("process.env.NODE_ENV authentication", process.env.NODE_ENV);

const authorizationServiceProxy = httpProxy('http://authorization:3001/', {
    forwardPath: req => 'http://authorization:3001/api/authenticate'
});

const authorizationServiceProxyCaetanoGo = httpProxy('http://authorization:3001/', {
    forwardPath: req => 'http://authorization:3001/api/caetanoGo/authenticate'
});

const authorizationServiceProxyHyundai = httpProxy('http://authorization:3001/', {
    forwardPath: req => 'http://authorization:3001/api/hyundai/authenticate'
});


const authorizationOpManServiceProxy = httpProxy('http://authorization:3001/', {
    forwardPath: req => 'http://authorization:3001/api/opManagement/authenticate'
});

const authorizationExternalAPIServiceProxy = httpProxy('http://authorization:3001/', {
    forwardPath: req => 'http://authorization:3001/evioapi/authenticate'
});

async function hasValidCredentials(req, res, next) {
    const context = "Function hasValidCredentials";

    const client = req.headers.client;
    const clientName = req.headers.clientname;

    if (!clientName) {
        return res.status(400).send({ auth: false, code: 'server_missing_header', message: "Missing clientName" });
    }

    console.log(`[${context}] received client=${client}`);
    console.log(`[${context}] received clientName=${clientName}`);

    if (client === "BackOffice" || client === "EXTERNAL_API") {
        let query = {
            username: req.body.username,
            internationalPrefix: req.body.internationalPrefix,
            active: true,
            blocked: false,
            clientName: clientName
        };

        let fields = {
            clientType: 1
        };

        User.findOne(query, fields, async(err, userFound) => {
            if (err) {

                console.error(`[${context}][User.find] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {

                if (userFound) {

                    if (userFound.clientType === process.env.ClientTypeB2B) {

                        try {
                            console.log(`[${context}] Authenticating userId=${userFound?._id} ...`);
                            await UserPasswords.authenticate(userFound?._id, req.body.password);
                            delete req.body.password;

                            next();
                        } catch (error) {
                            console.log(`[${context}][authenticate] Error `, error.message);
                            return res.status(401).send({ auth: false, code: 'server_invalid_credentials', message: error.message });
                        }

                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_user_not_company', message: "User is not a company" });
                    }
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_users_not_found', message: "Users not found for given parameters" });
                }
            }

        });

    } else {
        let query = {
            username: req.body.username,
            active: true,
            blocked: false,
            clientName: clientName
        };

        User.findOne(query, async(err, userFound) => {
            if (err) {

                console.error(`[${context}][User.find] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {

                if (userFound) {

                    try {
                        console.log(`[${context}] Authenticating userId=${userFound?._id} ...`);
                        await UserPasswords.authenticate(userFound?._id, req.body.password);
                        delete req.body.password;

                        next();
                    } catch (error) {
                        console.log(`[${context}][authenticate] Error `, error.message);
                        return res.status(401).send({ auth: false, code: 'server_invalid_credentials', message: error.message });
                    }

                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_users_not_found', message: "Users not found for given parameters" });
                }
            }

        });

    }
}

function hasValidCredentialsExternalAPI(req, res, next) {
    var context = "Function hasValidCredentialsExternalAPI";
    try {
        var username = req.body.username;
        var password = req.body.password;
        let clientName = req.headers.clientname;
        let userIdToAuthenticate = '';
        if (!clientName) {
            return res.status(400).send({ auth: false, code: 'server_missing_header', message: "Missing clientName" });
        }

        if (Validator.validate(username)) {
            console.log("ClientName", clientName);
            let query = {
                email: username,
                active: true,
                blocked: false,
                clientName: clientName
            };

            const fields = {
                internationalPrefix: 1,
                username: 1,
                clientType: 1,
                active: 1,
                changedEmail: 1,
                _id: 1,
            };
            User.find(query, fields, async(err, userFound) => {
                if (err) {

                    console.error(`[${context}][User.find] Error `, err.message);
                    return res.status(500).send(err.message);

                };

                if (userFound.length === 0) {
                    console.log(`[${context}] User was not found using query=${JSON.stringify(query)}`);

                    query = {
                        email: username,
                        changedEmail: true,
                        clientName: clientName
                    };

                    User.find(query, fields, (err, userFound) => {
                        if (err) {
                            console.error(`[${context}][User.find] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (userFound.length === 0) {
                                query = {
                                    email: username,
                                    active: true,
                                    clientName: clientName
                                };

                                console.log(`[${context}] User was not found using query=${JSON.stringify(query)}, trying as a guest user using query ${JSON.stringify(query)}`);
                                GuestUsers.find(query, fields, async(err, guestUserFound) => {
                                    if (err) {

                                        console.error(`[${context}][User.find] Error `, err.message);
                                        return res.status(500).send(err.message);

                                    }
                                    else {
                                        if (guestUserFound.length === 0) {
                                            console.log(`[${context}] Guest user was not found using query=${JSON.stringify(query)}`);

                                            return res.status(401).send({ auth: false, code: 'server_invalid_credentials', message: "Invalid credentials" });

                                        } else {
                                            userIdToAuthenticate = guestUserFound?.[0]?._id;

                                            try {
                                                await UserPasswords.authenticate(userIdToAuthenticate, password);
                                                delete req.body.password;

                                                next();
                                            } catch (error) {
                                                return res.status(401).send({ auth: false, code: 'server_invalid_credentials', message: error.message });
                                            }
                                        }
                                    }
                                });
                            } else {

                                return res.status(400).send({ auth: false, code: 'server_user_not_active', message: "Activate your account using the activation code.", _id: userFound[0]._id, changedEmail: true });

                            };
                        };
                    });

                } else {
                    userIdToAuthenticate = userFound[0]?._id;
                    //if (userFound[0].active) {

                    if (userFound[0].clientType === process.env.ClientTypeB2B) {

                        try {
                            console.log(`[${context}] Authenticating userId=${userIdToAuthenticate} ...`);
                            await UserPasswords.authenticate(userIdToAuthenticate, password);
                            delete req.body.password;

                            next();
                        } catch (error) {
                            return res.status(401).send({ auth: false, code: 'server_invalid_credentials', message: error.message });
                        }

                    } else {
                        return res.status(400).send({ auth: false, code: 'server_user_not_company', message: "User is not a company" });
                    }
                }
            });

        } else {
            return res.status(400).send({ auth: false, code: 'server_email_not_valid', message: "Email not valid" });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ auth: false, code: 'server_error', message: "Internal Error" });
    }
};

const hasValidCredentialsAdmin = async(req, res, next) => {
    const context = "Function hasValidCredentialsAdmin";
    let username = req.body.username;
    let password = req.body.password;

    let client = req.headers.client;

    if (client === "BackOffice" && username === "admin") {

        try {
            const userFound = await User.findOne({ username });

            if (!userFound) {
                console.log(`[${context}] User admin was not found!`);
                return res.status(401).send({ auth: false, code: 'server_invalid_credentials', message: 'Invalid credentials' });
            }

            await UserPasswords.authenticate(userFound?._id, password);
            delete req.body.password;

            next();
        } catch (error) {
            console.log(`[${context}][authenticate] Error `, error.message);
            return res.status(401).send({ auth: false, code: 'server_invalid_credentials', message: error.message });
        }

    }
    else {
        return res.status(400).send({ auth: false, code: 'server_only_backOffice', message: "Only available for back office" });
    }

};

const impersonateUser = async(req, res, next) => {
    const context = "Function impersonateUser";
    try {
        const query = {
            email: req.body.clientEmail,
            active: true,
            clientName: req.headers.clientname,
        };

        const user = await libraryIdentity.getUserAndTokensByUserId(query);
        if (!user) { return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found: " + req.body.clientEmail });}
        if (!user.active) { return res.status(400).send({ auth: false, code: 'server_user_not_active', message: "Activate your account using the activation code.", _id: user._id, active: false });}

        req.body._id = user._id;
        req.body.language = user.language;
        req.body.name = user.name;
        req.body.imageContent = user.imageContent;
        req.body.active = user.active;
        req.body.mobile = user.mobile;
        req.body.internationalPrefix = user.internationalPrefix;
        req.body.clientType = user.clientType;
        req.body.requestUserId = process.env.OperationsManagementID;
        req.body.accountType = process.env.AccountTypeMaster;
        req.body.guestUser = false;
        req.body.token = user.token;
        req.body.refreshToken = user.refreshToken;


        console.log(`[${context}] req.body = ${JSON.stringify(req.body)}`);

        authorizationServiceProxy(req, res); 

    } catch (error) {
        console.error(`[${context}] Error ${error.message}`);
        return res.status(500).send({ auth: false, code: 'server_error', message: "Internal Error" });
    }
    
}

router.post('/api/authenticate', authenticationService.verifyCredentials, 
    async function (req, res) {
        try {
            const username = req.body.username;
            const clientName = req.headers.clientname;
            const isMobile = !!req.headers.evioappversion;
            
            const authenticationData = await authenticationService.authenticate(username, clientName, isMobile);
            
            Object.assign(req.body, authenticationData);
            authorizationServiceProxy(req, res);
        } catch (error) {
            return errorResponse(res, error, req.path);
        }
    }
);

router.post('/api/authenticate/selectAccount', impersonateUser);

router.use('/api/opManagement/authenticate', hasValidCredentials);
router.post('/api/opManagement/authenticate',
    function (req, res) {
        req.body._id = process.env.OperationsManagementID;
        req.body.name = req.body.username;
        req.body.language = process.env.OperationsManagementLanguage;
        req.body.requestUserId = process.env.OperationsManagementID;
        req.body.accountType = process.env.AccountTypeMaster;
        req.body.guestUser = false;
        authorizationOpManServiceProxy(req, res);
    }
);

router.use('/api/adminUser/authenticate', hasValidCredentialsAdmin);
router.post('/api/adminUser/authenticate',
    function (req, res) {

        var clientEmail = req.body.clientEmail;
        var clientName = req.headers.clientname;

        if (clientEmail === undefined || clientEmail === "") {

            var query = {
                clientType: process.env.ClientTypeB2B,
                active: true,
                clientName: clientName
            };

            var fields = {
                _id: 1,
                name: 1,
                email: 1,
                imageContent: 1,
                language: 1
            };

            User.find(query, fields, (err, listUsers) => {
                if (err) {
                    console.error(`[${context}][authenticate] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    return res.status(200).send(listUsers);
                };
            });

        } else {

            impersonateUser(req, res);

        };
    }

);

router.use('/evioapi/authenticate', hasValidCredentialsExternalAPI);
router.post('/evioapi/authenticate', (req, res) => {
    try {
        let query = {
            email: req.body.username,
            active: true,
            blocked: false,
            clientName: req.headers.clientname
        };
        //Get id of user on mongodb
        User.findOne(query, function (err, user) {

            if (err) return res.status(500).send({ auth: false, code: 'server_error', message: "Internal server error" });

            if (user) {
                if (user.active) {

                    req.body._id = user._id;
                    req.body.language = user.language;
                    req.body.name = user.name;
                    req.body.imageContent = user.imageContent;
                    req.body.active = user.active;
                    req.body.clientType = user.clientType;
                    req.body.requestUserId = user._id;
                    req.body.accountType = process.env.AccountTypeMaster;
                    authorizationExternalAPIServiceProxy(req, res);
                } else {

                    return res.status(401).send({ auth: false, code: 'server_user_inactive', message: "User is inactive" });

                };

            } else {

                query = {
                    email: req.body.username,
                    active: true,
                    "accessPlatform.api": true
                };

                GuestUsers.findOne(query, function (err, guestUser) {
                    if (err) return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found: " + req.body.username });
                    if (guestUser) {
                        // TODO: need to improve this check, when users start to have multiple guest from different clientNames
                        if (guestUser.users.length == 0) {
                            console.error('[Post /evioapi/authenticate] Error - guestUser without users' + guestUser);
                            return res.status(500).send({ auth: false, code: 'internal_error', message: 'Server internal error' });
                        }
                        //console.log("guestUser", guestUser);
                        User.findOne({ _id: guestUser.users[0].userId }, function (err, user) {
                            if (err) return res.status(500).send(err.message);

                            if (user) {

                                if (user.active) {

                                    req.body._id = user._id;
                                    req.body.language = user.language;
                                    req.body.name = user.name;
                                    req.body.imageContent = user.imageContent;
                                    req.body.active = user.active;
                                    req.body.clientType = user.clientType;
                                    req.body.requestUserId = guestUser._id;
                                    req.body.accountType = process.env.AccountTypeGuest;
                                    authorizationExternalAPIServiceProxy(req, res);


                                } else {

                                    return res.status(401).send({ auth: false, code: 'server_user_inactive', message: "User is inactive" });

                                };

                            } else {

                                return res.status(401).send({ auth: false, code: 'server_invalid_credentials', message: "Invalid credentials" });

                            };
                        });

                    } else {

                        return res.status(403).send({ auth: false, code: 'server_access_not_allowed', message: 'Access not allowed' });

                    };
                });

            };

        });
    } catch (error) {
        console.error(`[Post /evioapi/authenticate] Error `, error.message);
        return res.status(500).send({ auth: false, code: 'server_error', message: 'Internal error' });
    }
});


router.post('/api/hyundai/authenticate', async (req, res) => {
    let context = "POST /api/hyundai/authenticate";

    let clientName = req.headers['clientname'];
    let headers = req.headers;

    if (!req.body.code) {
        return res.status(400).send({ auth: false, code: 'server_code_data_required', message: "Code data required" });
    };

    if (!req.body.email) {
        return res.status(400).send({ auth: false, code: 'server_code_email_required', message: "Email required" });
    };

    let code = req.body.code;
    let email = req.body.email;


    console.log("code")
    console.log(code)

    try {

        let result = await hyundaiGetToken()

        console.log("result")
        console.log(result)

        let hyundaiToken = result.access_token;

        let hyundaiUser = await hyundaiGetData(hyundaiToken, code)

        console.log("hyundaiUser")
        console.log(hyundaiUser)

        if (!hyundaiUser)
            return res.status(400).send({ auth: false, code: 'user_not_fond', message: "User not fond!" })

        if (!hyundaiUser.telephone)
            return res.status(400).send({ auth: false, code: 'user_telephone_not_fond', message: "User telephone not fond!" })

        let userMobile = hyundaiUser.telephone.substr(hyundaiUser.telephone.length - 9, 9)
        let userInternationalPrefix = hyundaiUser.telephone.substr(0, hyundaiUser.telephone.length - 9)

        let name = ""
        if (hyundaiUser.firstName) {
            name += hyundaiUser.firstName
            if (hyundaiUser.lastName)
                name += " " + hyundaiUser.lastName
        }

        let userNIF = ""
        if (hyundaiUser.nif)
            userNIF = hyundaiUser.nif

        let userAddress = ""
        if (hyundaiUser.address)
            userAddress = hyundaiUser.address

        query = {
            email: email,
            clientName: clientName

        };
    
        // Get the app config
        const appConfig = await AppConfigurationService.getAppConfiguration(clientName);

        if (!appConfig) {
            throw { auth: false, code: 'app_config_not_found', message: 'AppConfigurations not found' };
        }

        // flag fleet-484-backend-go-charge-user-creation-is-sending-a-wrong-language
        const flagIsEnabledFleet484 = await toggle.isEnable('fleet-484-backend-go-charge-user-creation-is-sending-a-wrong-language');
        const userLanguage = flagIsEnabledFleet484 ? 'pt' : await setLanguageUser(user, appConfig, language);
        console.log(`${context} userLanguage set to: ${userLanguage} user email ${email}`);

        const { licenseServiceEnabled, licenseProductEnabled, licenseMarketingEnabled, unsubscribedLink } = appConfig.marketingAndPromotionNotifications;
        
        let userFound = await User.findOne(query);

        if (userFound) {

            console.log("user Found")

            if (name == "")
                name = userFound.name

            let newUser;

            newUser = {
                name: name,
                email: email,
                username: email,
                idHyundaiCode: code,
                active: true,
                licenseAgreement: true,
                licenseMarketing: true,
                licenseServices: true,
                licenseProducts: true,
                isEmailVerified: true,
                language: userFound.language || userLanguage
            };

            if (!licenseServiceEnabled) newUser.licenseServices = false;
            if (!licenseProductEnabled) newUser.licenseProducts = false;
            if (!licenseMarketingEnabled) newUser.licenseMarketing = false;
            
            if (licenseProductEnabled || licenseServiceEnabled || licenseMarketingEnabled) {
                newUser.unsubscribedLink = User.getUnsubscribedLink(userFound._id, clientName, unsubscribedLink);
            }
                
            let query = {
                _id: userFound._id
            };

            let userUpdated = await User.findOneAndUpdate(query, { $set: newUser }, { new: true });

            //update billing profile
            if (userNIF != "" || userAddress != "" || name != "") {
                updateBillingProfileHyundai(userNIF, userAddress, name, userFound._id, clientName)
            }


            if (userUpdated.active) {

                req.body._id = userUpdated._id;
                req.body.language = userUpdated.language;
                req.body.username = userUpdated.username;
                req.body.name = userUpdated.name;
                req.body.imageContent = userUpdated.imageContent;
                req.body.active = userUpdated.active;
                req.body.email = userUpdated.email;
                req.body.mobile = userUpdated.mobile;
                req.body.internationalPrefix = userUpdated.internationalPrefix;
                req.body.clientType = userUpdated.clientType;
                req.body.requestUserId = userUpdated._id;
                req.body.accountType = process.env.AccountTypeMaster;
                req.body.guestUser = false;
                return authorizationServiceProxyHyundai(req, res);

            } else {
                return res.status(400).send({ auth: false, code: 'server_user_not_active', message: "Activate your account using the activation code.", _id: userUpdated._id, active: false });
            };
        }

        //Crate user
        let newUser = new User({
            username: email,
            name: name,
            active: true,
            idHyundai: hyundaiToken,
            idHyundaiCode: code,
            email: email,
            mobile: userMobile,
            internationalPrefix: userInternationalPrefix,
            licenseAgreement: true,
            licenseMarketing: true,
            licenseServices: true,
            licenseProducts: true,
            isEmailVerified: true,
            language: userLanguage
        });

        if (!licenseServiceEnabled) newUser.licenseServices = false;
        if (!licenseProductEnabled) newUser.licenseProducts = false;
        if (!licenseMarketingEnabled) newUser.licenseMarketing = false;
        
        if (licenseProductEnabled || licenseServiceEnabled || licenseMarketingEnabled) {
            newUser.unsubscribedLink = User.getUnsubscribedLink(newUser._id, clientName, unsubscribedLink);
        }
        
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
            searchLocationsLimit: "UNLIMITED",
            searchChargersLimit: "UNLIMITED",
            comparatorLimit: "UNLIMITED",
            routerLimit: "UNLIMITED",
            cardAssociationEnabled: false,
            billingTariffEnabled: false
        };

        newUser.userPackage = userPackage;
        newUser.clientName = clientName;
        const mongocontroller = MongoDb();
        //console.log("newUser", newUser);
        await mongocontroller.addmongoHyundai(newUser)


        userDriversDependencies(newUser);
        userGroupDriversDependencies(newUser);
        userGroupCSUsersDependencies(newUser);
        userDriverEv(newUser);
        //TODO ver isto
        //if (user.clientType === process.env.ClientTypeB2B) {
        //    createListPaymentMethods(newUser);
        //};
        createPoolDriver(newUser);
        createContract(newUser);
        createCEMETariffEVIO(newUser);
        createNotificataionsDefinition(newUser, headers);
        createBillingProfileHyundai(newUser, userNIF, userAddress);
        createWallet(newUser);

        req.body._id = newUser._id;
        req.body.language = newUser.language;
        req.body.name = newUser.name;
        req.body.username = newUser.username;
        req.body.imageContent = newUser.imageContent;
        req.body.active = newUser.active;
        req.body.email = newUser.email;
        req.body.mobile = newUser.mobile;
        req.body.internationalPrefix = newUser.internationalPrefix;
        req.body.clientType = newUser.clientType;
        req.body.requestUserId = newUser._id;
        req.body.accountType = process.env.AccountTypeMaster;
        req.body.guestUser = false;
        return authorizationServiceProxyHyundai(req, res);

    } catch (error) {
        if (error.response) {
            console.error(`[${context}][${error.response.status}] Error `, error.response.data);
            return res.status(error.response.status).send(error.response.data);
        } else {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    };
});


router.post('/api/goCharge/authenticate', async (req, res) => {
    let context = "POST /api/goCharge/authenticate";

    let clientName = req.headers['clientname'];
    let headers = req.headers;
    const { language } = headers;

    if (!req.body.code) {
        return res.status(400).send({ auth: false, code: 'server_code_data_required', message: "Code data required" });
    };

    let code = req.body.code;

    try {

        let data = {
            grant_type: process.env.IDGOgrantType,
            code: code
        };

        let host;
        let passwordOauth2, usernameOauth2;
        let auth;
        let hostToken;
        switch (process.env.NODE_ENV) {
            case 'production':
                console.log("Initing production environment")
                host = process.env.HostIdCaetanoGo;
                passwordOauth2 = process.env.oAuth2;
                usernameOauth2 = process.env.UserNameWebserviceGoCharge;
                auth = {
                    username: process.env.UserNameWebserviceGoCharge,
                    password: process.env.KeyWebserviceGoCharge
                };
                hostToken = process.env.HostToken;

                break;
            case 'development':
                console.log("Initing dev environment")
                host = process.env.HostIdCaetanoGoTest;
                passwordOauth2 = process.env.oAuth2PRE;
                usernameOauth2 = process.env.UserNameWebserviceGoChargePRE;
                auth = {
                    username: process.env.UserNameWebserviceGoChargePRE,
                    password: process.env.KeyWebserviceGoChargePRE
                };
                hostToken = process.env.HostTokenTest;

                break;
            case 'pre-production':
                console.log("Initing pre environment")
                host = process.env.HostIdCaetanoGoTest;
                passwordOauth2 = process.env.oAuth2PRE;
                usernameOauth2 = process.env.UserNameWebserviceGoChargePRE;
                auth = {
                    username: process.env.UserNameWebserviceGoChargePRE,
                    password: process.env.KeyWebserviceGoChargePRE
                };
                hostToken = process.env.HostTokenTest;

                break;
            default:
                console.log("Unknown environment")
                host = process.env.HostIdCaetanoGoTest;
                passwordOauth2 = process.env.oAuth2PRE;
                usernameOauth2 = process.env.UserNameWebserviceGoChargePRE;
                auth = {
                    username: process.env.UserNameWebserviceGoChargePRE,
                    password: process.env.KeyWebserviceGoChargePRE
                };
                hostToken = process.env.HostTokenTest;

                break;
        };

        let response = await axios.post(host, data, { auth: { username: usernameOauth2, password: passwordOauth2 } });

        validateFields(response.data)
            .then(async () => {

                let idGoData = response.data;
                let host = `${hostToken}${process.env.PathToken}${idGoData.access_token}/`;
                let hostAddress = `${hostToken}/user/${idGoData.access_token}/addresses/`;
                let result;
                let resultAdrress;

                try {
                    result = await axios.get(host, { auth });
                    resultAdrress = await axios.get(hostAddress, { auth });
                } catch (error) {
                    console.error(`[${context}][${error.response.status}][] Error `, error.message);
                    Sentry.captureException(error)
                    return res.status(error.response.status).send({message:  error.message});
                }

                let listAddress = resultAdrress.data;
                let referencePlaces = [];
                let favAddress;

                if (listAddress._status === "success" && listAddress.data.length > 0) {
                    referencePlaces = await getReferencePlaces(listAddress.data);
                    favAddress = referencePlaces.find(address => { return address.favourite === '1' });

                    if (!favAddress) {
                        favAddress = null
                    }
                    else {


                        // Validating zipAddress and country(for us it's a countryCode)
                        // to avoid save wrong data from our side and force the user update the address on app
                        const isZipCodeValidToCountry = await isZipAddressValidToCountry(favAddress.address.zipCode, favAddress.address.countryCode);
                        if (!isZipCodeValidToCountry) {
                            favAddress = null;
                        }
                    }
                }

                if (result.data) {

                    if (result.data._status === "success") {

                        let user = result.data.data;
                        let email = user.basic.email;
                        let mobile;//= user.personal_data.phone_number;
                        let internationalPrefix;// = user.personal_data.phone_code;
                        idGoData.sub_marketing = user.basic.sub_marketing;
                        let sendRequestToMobile = false


                        if (user.personal_data) {
                            mobile = user.personal_data.phone_number;
                            internationalPrefix = user.personal_data.phone_code;
                        };

                        if (!user.personal_data) {

                            sendRequestToMobile = true
                            //return res.status(401).send({ auth: false, code: 'server_mobile_internationalPrefix_required', message: 'Mobile phone and international prefix are required' });

                        };
                        if (!mobile) {

                            sendRequestToMobile = true
                            //return res.status(401).send({ auth: false, code: 'server_mobile_required', message: 'Mobile phone is required' });

                        };
                        if (!internationalPrefix) {

                            sendRequestToMobile = true
                            //return res.status(401).send({ auth: false, code: 'server_internationalPrefix_required', message: 'Internationl prefix is required' });

                        };

                        let query;
                        if (sendRequestToMobile) {

                            query = {
                                username: email,
                                email: email,
                                clientName: clientName,
                                status: process.env.USERRREGISTERED
                            };

                        } else {
                            query = {
                                username: email,
                                email: email,
                                mobile: mobile,
                                internationalPrefix: `+${internationalPrefix}`,
                                clientName: clientName,
                                status: process.env.USERRREGISTERED
                            };
                        }

                        // Get the app config
                        const appConfig = await AppConfigurationService.getAppConfiguration(clientName);

                        if (!appConfig) {
                            throw { auth: false, code: 'app_config_not_found', message: 'AppConfigurations not found' };
                        }

                        // flag fleet-484-backend-go-charge-user-creation-is-sending-a-wrong-language
                        const flagIsEnabledFleet484 = await toggle.isEnable('fleet-484-backend-go-charge-user-creation-is-sending-a-wrong-language');
                        const userLanguage = flagIsEnabledFleet484 ? 'pt' : await setLanguageUser(user, appConfig, language);
                        console.log(`${context} userLanguage set to: ${userLanguage} user email ${email}`);

                        const { licenseServiceEnabled, licenseProductEnabled, licenseMarketingEnabled, unsubscribedLink } = appConfig.marketingAndPromotionNotifications;

                        let userFound = await User.findOne(query);

                        if (userFound) {

                            let newUser;

                            if (user.personal_data) {
                                newUser = {
                                    name: user.basic.name,
                                    email: email,
                                    username: email,
                                    mobile: user.personal_data.phone_number,
                                    internationalPrefix: `+${user.personal_data.phone_code}`,
                                    idCaetanoGo: user.basic.id,
                                    idGoData: idGoData,
                                    active: true,
                                    referencePlaces: referencePlaces,
                                    licenseAgreement: true,
                                    licenseMarketing: true,
                                    licenseServices: true,
                                    licenseProducts: true,
                                    isEmailVerified: true,
                                    language: userLanguage
                                };
                            } else {
                                newUser = {
                                    name: user.basic.name,
                                    email: email,
                                    username: email,
                                    idCaetanoGo: user.basic.id,
                                    idGoData: idGoData,
                                    active: true,
                                    referencePlaces: referencePlaces,
                                    licenseAgreement: true,
                                    licenseMarketing: true,
                                    licenseServices: true,
                                    licenseProducts: true,
                                    isEmailVerified: true,
                                    language: userLanguage
                                };
                            };

                            if (!licenseServiceEnabled) newUser.licenseServices = false;
                            if (!licenseProductEnabled) newUser.licenseProducts = false;
                            if (!licenseMarketingEnabled) newUser.licenseMarketing = false;
                            
                            if (licenseProductEnabled || licenseServiceEnabled || licenseMarketingEnabled) {
                                newUser.unsubscribedLink = User.getUnsubscribedLink(userFound._id, clientName, unsubscribedLink);
                            }

                            let query = {
                                _id: userFound._id
                            };

                            let userUpdated = await User.findOneAndUpdate(query, { $set: newUser }, { new: true });

                            if (favAddress) {
                                updateBillingProfile(favAddress, userFound._id, clientName)
                            }

                            if (userUpdated.active) {

                                req.body._id = userUpdated._id;
                                req.body.language = userUpdated.language;
                                req.body.name = userUpdated.name;
                                req.body.imageContent = userUpdated.imageContent;
                                req.body.active = userUpdated.active;
                                req.body.mobile = userUpdated.mobile;
                                req.body.internationalPrefix = userUpdated.internationalPrefix;
                                req.body.clientType = userUpdated.clientType;
                                req.body.requestUserId = userUpdated._id;
                                req.body.accountType = process.env.AccountTypeMaster;
                                req.body.username = userUpdated.username;
                                req.body.email = email;
                                req.body.sendRequestToMobile = sendRequestToMobile;
                                authorizationServiceProxyCaetanoGo(req, res);

                            } else {
                                return res.status(400).send({ auth: false, code: 'server_user_not_active', message: "Activate your account using the activation code.", _id: user._id, active: false });
                            };

                        } else {

                            let newUser;

                            if (user.personal_data) {
                                newUser = new User({
                                    name: user.basic.name,
                                    email: email,
                                    username: email,
                                    mobile: user.personal_data.phone_number,
                                    internationalPrefix: `+${user.personal_data.phone_code}`,
                                    active: true,
                                    idCaetanoGo: user.basic.id,
                                    idGoData: idGoData,
                                    referencePlaces: referencePlaces,
                                    licenseAgreement: true,
                                    licenseMarketing: true,
                                    licenseServices: true,
                                    licenseProducts: true,
                                    isEmailVerified: true,
                                    language: userLanguage
                                });
                            } else {
                                newUser = new User({
                                    name: user.basic.name,
                                    email: email,
                                    username: email,
                                    active: true,
                                    idCaetanoGo: user.basic.id,
                                    idGoData: idGoData,
                                    referencePlaces: referencePlaces,
                                    licenseAgreement: true,
                                    licenseMarketing: true,
                                    licenseServices: true,
                                    licenseProducts: true,
                                    isEmailVerified: true,
                                    language: userLanguage
                                });
                            };

                            if (!licenseServiceEnabled) newUser.licenseServices = false;
                            if (!licenseProductEnabled) newUser.licenseProducts = false;
                            if (!licenseMarketingEnabled) newUser.licenseMarketing = false;
                            
                            if (licenseProductEnabled || licenseServiceEnabled || licenseMarketingEnabled) {
                                newUser.unsubscribedLink = User.getUnsubscribedLink(newUser._id, clientName, unsubscribedLink);
                            }

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
                                searchLocationsLimit: "UNLIMITED",
                                searchChargersLimit: "UNLIMITED",
                                comparatorLimit: "UNLIMITED",
                                routerLimit: "UNLIMITED",
                                cardAssociationEnabled: false,
                                billingTariffEnabled: false
                            };

                            newUser.userPackage = userPackage;
                            newUser.clientName = clientName;
                            const mongocontroller = MongoDb();
                            //console.log("newUser", newUser);
                            mongocontroller.addmongoUserWlIdGo(newUser)
                                .then((newUser) => {

                                    userDriversDependencies(newUser);
                                    userGroupDriversDependencies(newUser);
                                    userGroupCSUsersDependencies(newUser);
                                    userDriverEv(newUser);
                                    if (user.clientType === process.env.ClientTypeB2B) {
                                        createListPaymentMethods(newUser);
                                    };
                                    createPoolDriver(newUser);
                                    createContract(newUser);
                                    createCEMETariffEVIO(newUser);
                                    createNotificataionsDefinition(newUser, headers);
                                    createBillingProfile(newUser, favAddress);
                                    createWallet(newUser);

                                    req.body._id = newUser._id;
                                    req.body.language = newUser.language;
                                    req.body.name = newUser.name;
                                    req.body.imageContent = newUser.imageContent;
                                    req.body.active = newUser.active;
                                    req.body.mobile = newUser.mobile;
                                    req.body.internationalPrefix = newUser.internationalPrefix;
                                    req.body.clientType = newUser.clientType;
                                    req.body.requestUserId = newUser._id;
                                    req.body.accountType = process.env.AccountTypeMaster;
                                    req.body.username = newUser.username;
                                    req.body.email = email;
                                    req.body.sendRequestToMobile = sendRequestToMobile;
                                    authorizationServiceProxyCaetanoGo(req, res);

                                })
                                .catch(error => {
                                    if (error.auth != undefined) {
                                        return res.status(400).send(error);
                                    }
                                    else {
                                        console.error(`[${context}] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    };
                                });

                        };


                    } else {
                        console.error(`[${context}] Error `, result.data.error);
                        return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given parameters" });
                    };

                } else {
                    return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given parameters" });
                };

            })
            .catch(error => {
                //console.error("ERROR", error);
                Sentry.captureException(error)
                if (error.auth === false)
                    return res.status(400).send(error);
                else if (error.response) {
                    console.error(`[${context}][${error.response.status}][validateFields] Error `, error.response);
                    return res.status(error.response.status).send(error.response);
                } else {
                    console.error(`[${context}][validateFields] Error `, error.message);
                    return res.status(500).send(error.message);
                }

            })

    } catch (error) {
        if (error.response) {
            console.error(`[${context}][${error.response.status}] Error `, error.response.data);
            return res.status(error.response.status).send(error.response.data);
        } else {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    };

});

function validateFields(response) {
    return new Promise((resolve, reject) => {
        if (!response)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!response.access_token)
            reject({ auth: false, code: 'server_accessToken_required', message: 'Access token is required' });

        else if (!response.expires_in)
            reject({ auth: false, code: 'server_expiration_date_required', message: 'Expiration date is required' });

        else if (!response.token_type)
            reject({ auth: false, code: 'server_token_type_required', message: 'Token type is required' });

        else if (!response.refresh_token)
            reject({ auth: false, code: 'server_refreshToken_required', message: 'Refresh token is required' });

        else
            resolve(true);
    });
};

//Function to verify if the user exist on driversDependencies
function userDriversDependencies(user) {

    var context = "Function userDriversDependencies";
    var query = {
        'drivers': {
            $elemMatch: {
                'mobile': user.mobile,
                'internationalPrefix': user.internationalPrefix,
                'registered': false
            }
        },
        clientName: user.clientName
    };

    DriversDependencies.find(query, (err, driverDependenciesFound) => {
        if (err) {
            console.error(`[${context}][DriversDependencies.find] Error `, err.message);
        }
        else {
            if (driverDependenciesFound.length > 0) {
                userPoolDrivers(user);
                const getDriver = (driver) => {
                    return new Promise((resolve) => {
                        if (driver.mobile == user.mobile && driver.internationalPrefix == user.internationalPrefix) {
                            driver.registered = true;
                            resolve(true);
                        }
                        else
                            resolve(false);
                    });
                };
                const getDriverDependencies = (driverDependencies) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            driverDependencies.drivers.map(driver => getDriver(driver))
                        ).then(() => {
                            var newValue = { $set: driverDependencies };
                            var query = {
                                _id: driverDependencies._id
                            };
                            DriversDependencies.updateDriversDependencies(query, newValue, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][updateDriversDependencies] Error `, err.message);
                                }
                                else {
                                    console.log("Drivers Dependencies updated");
                                }
                            });
                            resolve(true);
                        });
                    });
                };
                Promise.all(
                    driverDependenciesFound.map(driverDependencies => getDriverDependencies(driverDependencies))
                ).then(() => {
                    console.log("Drivers Dependencies updated");
                });
            }
            else {
                console.log("No pending pool drivers");
            }
        };
    });
};

//Function to verify if the user exist on groupsDriversDependencies
function userGroupDriversDependencies(user) {
    var context = "Function userGroupDriversDependencies";

    var query = {
        'drivers': {
            $elemMatch: {
                'mobile': user.mobile,
                'internationalPrefix': user.internationalPrefix,
                'registered': false
            }
        },
        clientName: user.clientName
    };

    GroupDriversDependencies.find(query, (err, groupDriversDependenciesFound) => {
        if (err) {
            console.error(`[${context}][GroupDriversDependencies.find] Error `, err.message);
        };
        if (groupDriversDependenciesFound.length > 0) {
            userGroupDrivers(user);
            const getDriver = (driver) => {
                return new Promise((resolve) => {
                    if (driver.mobile == user.mobile && driver.internationalPrefix == user.internationalPrefix) {
                        driver.registered = true;
                        resolve(true);
                    }
                    else
                        resolve(false);
                });
            };
            const getGroupDriversDependencies = (groupDriversDependencies) => {
                return new Promise((resolve) => {
                    Promise.all(
                        groupDriversDependencies.drivers.map(driver => getDriver(driver))
                    ).then(() => {
                        var newValue = { $set: groupDriversDependencies };
                        var query = {
                            _id: groupDriversDependencies._id
                        };
                        GroupDriversDependencies.updateGroupDriversDependencies(query, newValue, (err, result) => {
                            if (err) {
                                console.error(`[${context}][updateGroupDriversDependencies] Error `, err.message);
                            }
                            else {
                                console.log("Group Drivers Dependencies updated");
                            }
                        });
                        resolve(true);
                    });
                });
            };
            Promise.all(
                groupDriversDependenciesFound.map(groupDriversDependencies => getGroupDriversDependencies(groupDriversDependencies))
            ).then(() => {
                console.log("Group Drivers Dependencies updated");
            });
        } else {
            console.log("No pending Group drivers");
        };
    });

};

//Function to verify if the user exist on groupsCSUsersDependencies
function userGroupCSUsersDependencies(user) {
    var context = "Function userGroupCSUsersDependencies";
    var query = {
        'users': {
            $elemMatch: {
                'mobile': user.mobile,
                'internationalPrefix': user.internationalPrefix,
                'registered': false
            }
        },
        clientName: user.clientName
    };
    GroupCSUsersDependencies.find(query, (err, groupCSUsersDependenciesFound) => {
        if (err) {
            console.error(`[${context}][GroupCSUsersDependencies.find] Error `, err.message);
        }
        else {
            if (groupCSUsersDependenciesFound.length > 0) {
                userGroupCSUsers(user);
                const getUser = (userToAdd) => {
                    return new Promise((resolve) => {
                        if (userToAdd.mobile == user.mobile && userToAdd.internationalPrefix == user.internationalPrefix) {
                            userToAdd.registered = true;
                            resolve(true);
                        }
                        else
                            resolve(false);
                    });
                };
                const getGroupCSUsersDependencies = (groupCSUsersDependencies) => {
                    return new Promise((resolve, reject) => {
                        Promise.all(
                            groupCSUsersDependencies.users.map(userToAdd => getUser(userToAdd))
                        ).then(() => {
                            var newValue = { $set: groupCSUsersDependencies };
                            var query = {
                                _id: groupCSUsersDependencies._id
                            };
                            GroupCSUsersDependencies.updateGroupCSUsersDependencies(query, newValue, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][updateGroupCSUsersDependencies] Error `, err.message);
                                    reject(err);
                                }
                                else {
                                    resolve(true);
                                };
                            });
                        });
                    });
                };
                Promise.all(
                    groupCSUsersDependenciesFound.map(groupCSUsersDependencies => getGroupCSUsersDependencies(groupCSUsersDependencies))
                ).then(() => {
                    console.log("Group of Charger Station Users Dependencies updated");
                }).catch((error) => {
                    console.error(`[${context}][Promise.all] Error `, error.message);
                });
            }
            else {
                console.log("No pending Group charger station users");
            };
        };
    });
};

//Function to update user on list of drivers on EV's
function userDriverEv(user) {
    let context = "Function userDriverEv";

    let data = user;
    let host = process.env.HostEv + process.env.PathUpdateListOfDrivers;

    axios.patch(host, data)
        .then((result) => {
            if (result.data) {
                console.log("Drivers On EV's updated");
            }
            else {
                console.log("Drivers On EV's not updated");
            };
        })
        .catch(error => {
            console.error(`[${context}][${host}] Error `, error.message);
        });

};

function createListPaymentMethods(user) {
    var context = "Function createListPaymentMethods";

    let host = process.env.HostPayments + process.env.PathPaymentMethods;

    let data = {
        userId: user._id,
        paymentMethod: ['Transfer'],
        userType: user.clientType,
        clientName: user.clientName
    };

    axios.post(host, data)
        .then((result) => {
            console.log('Payment Methods created')
        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
        });

};

//Function to create a pool of drivers
function createPoolDriver(user) {
    var context = "Function createPoolDriver";
    var drivers = new Drivers();
    drivers.userId = user._id;
    drivers.clientName = user.clientName;
    Drivers.createDrivers(drivers, (err, result) => {
        if (err) {
            console.error(`[${context}][createDrivers] Error `, err.message);
        } else {
            console.log("Pool of drivers created");
        };
    });
};

//Funtion to create a new contract
async function createContract(user) {
    var context = "Function createContract";
    try {

        /*var query = {
            $or: [
                { email: user.email },
                { mobile: user.mobile }
            ],
            clientType: process.env.ContractTypeUser,
            clientName: user.clientName
        };*/

        /*Contract.find(query, async (err, contractsFound) => {
            if (err) {

                console.error(`[${context}][Contract.find] Error `, err.message);

            }
            else {
                //console.log("contractsFound", contractsFound.length);
                if (contractsFound.length === 0) {*/

        var name = user.name.split(" ");

        let CEME = await CemeData.getCEMEEVIOADHOC(user.clientName);
        let roamingTariffs = await Promise.all([
            CemeData.getCEMEEVIO(process.env.NetworkGireve),
            CemeData.getCEMEEVIO(process.env.NetworkHubject)
        ])
        //let roamingTariffs = await getRoamingTariffs(['Gireve']);

        let idTagDecEVIO = await getRandomIdTag(100_000_000_000, 999_999_999_999);
        let idTagDecMobiE = await getRandomIdTag(100_000_000_000, 999_999_999_999);

        var tariff = {
            power: "all",
            planId: CEME.plan._id
        };

        let contractIdInternationalNetwork = [
            {
                network: process.env.NetworkGireve,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeOTHER
                    }
                ]
            }
        ]

        var tariffRoaming; //= roamingTariff
        //console.log("roamingTariffs", roamingTariffs)
        if (roamingTariffs) {
            tariffRoaming = [
                {
                    network: process.env.NetworkGireve,
                    power: "all",
                    planId: roamingTariffs[0].plan._id
                },
                {
                    network: process.env.NetworkHubject,
                    power: "all",
                    planId: roamingTariffs[1]?.plan?._id
                }
            ]
        } else {
            tariffRoaming = [
                {
                    network: process.env.NetworkGireve,
                    power: "all",
                    planId: ""
                },
                {
                    network: process.env.NetworkHubject,
                    power: "all",
                    planId: ""
                }
            ]
        }

        var newContract = {
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            cardName: name[0] + " " + name[name.length - 1],
            cardType: process.env.CardTypeVirtual,
            userId: user._id,
            tariff: tariff,
            contractType: process.env.ContractTypeUser,
            tariffRoaming: tariffRoaming,
            contractIdInternationalNetwork: contractIdInternationalNetwork,
            clientName: user.clientName
        }

        var contract = new Contract(newContract);

        //console.log("process.env.NODE_ENV", process.env.NODE_ENV);

        if (process.env.NODE_ENV === 'production') {
            contract.imageCEME = process.env.HostProdContrac + `ceme/ceme${user.clientName}.jpg`; // For PROD server
            contract.imageCard = process.env.HostProdContrac + `card/card${user.clientName}.jpg`;
            contract.fontCardBlack = false;
        }
        else if (process.env.NODE_ENV === 'pre-production') {
            contract.imageCEME = process.env.HostPreProdContrac + `ceme/ceme${user.clientName}.jpg`; // For PROD server
            contract.imageCard = process.env.HostPreProdContrac + `card/card${user.clientName}.jpg`;
            contract.fontCardBlack = false;
        }
        else {
            //contract.imageCEME = process.env.HostLocalContract + `ceme/ceme${user.clientName}.jpg`; // For local host
            //contract.imageCard = process.env.HostLocalContract + `card/card${user.clientName}.jpg`;
            contract.imageCEME = process.env.HostQAContrac + `ceme/ceme${user.clientName}.jpg`; // For QA server
            contract.imageCard = process.env.HostQAContrac + `card/card${user.clientName}.jpg`;
            contract.fontCardBlack = false;
        };

        var networks = [
            {
                name: process.env.NetworkEVIO,
                networkName: "server_evio_network",
                network: process.env.NetworkEVIO,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: true
            },
            {
                name: process.env.NetworkMobiE,
                networkName: "server_mobie_network",
                network: process.env.NetworkMobiE,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusInactive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecMobiE
                    }
                ],
                hasJoined: false,
                isVisible: true
            },
            {
                name: "server_international_network_1",
                networkName: "server_international_network_1",
                network: process.env.NetworkGireve,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeOTHER,
                        status: process.env.NetworkStatusInactive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: false,
                isVisible: true
            },
            {
                name: process.env.NetworkInternal,
                networkName: "server_internal_network",
                network: process.env.NetworkInternal,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: false
            },
            {
                name: process.env.NetworkGoCharge,
                networkName: "server_goCharge_network",
                network: process.env.NetworkGoCharge,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: (user.clientName === process.env.WhiteLabelGoCharge || user.clientName === process.env.WhiteLabelHyundai) ? true : false
            },
            {
                name: process.env.NetworkHyundai,
                networkName: "server_hyundai_network",
                network: process.env.NetworkHyundai,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: (user.clientName === process.env.WhiteLabelGoCharge || user.clientName === process.env.WhiteLabelHyundai) ? true : false
            },
            {
                name: process.env.NetworkKLC,
                networkName: "server_klc_network",
                network: process.env.NetworkKLC,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: user.clientName === process.env.WhiteLabelKLC
            },
            {
                name: process.env.NetworkKinto,
                networkName: "server_kinto_network",
                network: process.env.NetworkKinto,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        // IdTagDec with 12 digits. The underscores just help us divide the number visually
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: user.clientName === process.env.clientNameKinto
            }
        ];

        contract.networks = networks;

        Contract.createContract(contract, (err, result) => {
            if (err) {
                console.error(`[${context}][createContract] Error `, err.message);
            }
            else {
                //validateIfMobiEActive(result)
                activeMobiE(result, user.clientType)
                console.log(`[${context}] Contract created`);
            };
        });

        /*}
        else {
            var newValues = { $set: { userId: user._id } };

            Contract.updateMany(query, newValues, (err, result) => {
                if (err) {

                    console.error(`[${context}][updateMany] Error `, err.message);

                }
                else {
                    console.log(`[${context}] Contract Updated`);
                };
            });

        };

    };

});*/

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

async function createCEMETariffEVIO(user) {
    var context = "Function createContract";
    try {
        var cemeTariff = new CEMETariff();
        cemeTariff.userId = user._id;
        cemeTariff.name = "EVIO Card";
        cemeTariff.CEME = process.env.NetworkEVIO;
        cemeTariff.clientName = user.clientName;
        cemeTariff.default = true;
        var card = {
            active: true,
            imageCard: ''
        };

        //let CEME = await CemeData.getCEMEEVIO(process.env.NetworkEVIO);
        let CEME = await CemeData.getCEMEEVIOADHOC(user.clientName);

        var tariff = {
            power: "all",
            planId: CEME.plan._id
        };

        if (process.env.NODE_ENV === 'production') {
            cemeTariff.imageCEME = process.env.HostProdContrac + `ceme/ceme${user.clientName}.jpg`; // For PROD server
            card.imageCard = process.env.HostProdContrac + `card/card${user.clientName}.jpg`;
            card.fontCardBlack = false;
        }
        else if (process.env.NODE_ENV === 'pre-production') {
            cemeTariff.imageCEME = process.env.HostPreProdContrac + `ceme/ceme${user.clientName}.jpg`; // For PROD server
            card.imageCard = process.env.HostPreProdContrac + `card/card${user.clientName}.jpg`;
            card.fontCardBlack = false;
        }
        else {
            //cemeTariff.imageCEME = process.env.HostLocalContract +  `ceme/ceme${user.clientName}.jpg`; // For local host
            //card.imageCard = process.env.HostLocalContract + `card/card${user.clientName}.jpg`;
            cemeTariff.imageCEME = process.env.HostQAContrac + `ceme/ceme${user.clientName}.jpg`; // For QA server
            card.imageCard = process.env.HostQAContrac + `card/card${user.clientName}.jpg`;
            card.fontCardBlack = false;
        };

        cemeTariff.cards.push(card);
        cemeTariff.tariff = tariff;
        CEMETariff.createCEMETariff(cemeTariff, (err, result) => {
            if (err) {
                console.error(`[${context}][createCEMETariff] Error `, err.message);
            }
            else {
                console.log(`[${context}] CEME Tariff created`);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

function createNotificataionsDefinition(user, headers) {
    var context = "Function createNotificataionsDefinition";
    var host = process.env.HostNotificationsDefinition + process.env.PathNotificationsDefinition;
    var data = {
        userId: user._id,
        clientType: headers.client
    };
    axios.post(host, data)
        .then((result) => {
            if (result.data) {
                console.log(`[${context}] Notifications Definition created`);
            }
            else {
                console.log(`[${context}] Notifications Definition not created`);
            };
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
};

function createBillingProfile(user, favAddress) {
    var context = "Function createBillingProfile";

    //check user address
    let billingAddress, name, billingName, nif;
    let email = user.email;
    let billingPeriod = (user.clientType === process.env.ClientTypeB2B) ? "MONTHLY" : "AD_HOC";
    let clientType = (user.clientType === process.env.ClientTypeB2B) ? "BUSINESSCUSTOMER" : "PRIVATECUSTOMER";

    if (favAddress) {
        name = favAddress.name
        billingName = favAddress.name
        nif = favAddress.vat
        billingAddress = {
            street: favAddress.address.street,
            zipCode: favAddress.address.zipCode,
            city: favAddress.address.city,
            country: favAddress.address.country,
            countryCode: favAddress.address.countryCode
        }
    }

    let billingProfile = {
        userId: user._id,
        name: name ? name : user.name,
        billingName: billingName ? billingName : user.name,
        nif: nif,
        billingAddress: billingAddress,
        clientName: user.clientName,
        email: email,
        billingPeriod: billingPeriod,
        clientType: clientType,
        paymentConditions: constants.billingPaymentConditionsPrompt
    };

    let new_billingProfile = new BillingProfile(billingProfile);
    BillingProfile.createBillingProfile(new_billingProfile, (err, result) => {
        if (err) {
            console.log(`[${context}] Billing profile not created`);

        }
        else {
            if (result) {
                console.log(`[${context}] Billing profile created`);

            } else {
                console.log(`[${context}] Billing profile not created`);

            }
        }
    })
};

function createBillingProfileHyundai(user, nif, adress) {
    var context = "Function createBillingProfile";

    //check user address
    let billingPeriod = (user.clientType === process.env.ClientTypeB2B) ? "MONTHLY" : "AD_HOC";
    let clientType = (user.clientType === process.env.ClientTypeB2B) ? "BUSINESSCUSTOMER" : "PRIVATECUSTOMER";


    let billingProfile = {
        userId: user._id,
        name: user.name,
        billingName: user.name,
        clientName: user.clientName,
        billingPeriod: billingPeriod,
        clientType: clientType,
        paymentConditions: constants.billingPaymentConditionsPrompt
    };

    if (nif != "")
        billingProfile.nif = nif

    if (adress != "")
        billingProfile.billingAddress = adress

    let new_billingProfile = new BillingProfile(billingProfile);
    BillingProfile.createBillingProfile(new_billingProfile, (err, result) => {
        if (err) {
            console.log(`[${context}] Billing profile not created`);

        }
        else {
            if (result) {
                console.log(`[${context}] Billing profile created`);

            } else {
                console.log(`[${context}] Billing profile not created`);

            }
        }
    })
};

function createBillingProfileKinto(user) {
    var context = "Function createBillingProfile";

    //check user address
    let billingPeriod = "MONTHLY";
    let clientType = (user.clientType === process.env.ClientTypeB2B) ? "BUSINESSCUSTOMER" : "PRIVATECUSTOMER";


    let billingProfile = {
        userId: user._id,
        name: user.name,
        billingName: user.name,
        clientName: user.clientName,
        billingPeriod: billingPeriod,
        clientType: clientType,
        nif: process.env.KINTONIF,
        billingAddress: process.env.KINTOBILLINGADDRESS
    };

    let new_billingProfile = new BillingProfile(billingProfile);
    BillingProfile.createBillingProfile(new_billingProfile, (err, result) => {
        if (err) {
            console.log(`[${context}] Billing profile not created`);

        }
        else {
            if (result) {
                console.log(`[${context}] Billing profile created`);

            } else {
                console.log(`[${context}] Billing profile not created`);

            }
        }
    })
};


function createWallet(user) {
    var context = "Function createWallet";
    var host = process.env.HostPayments + process.env.PathWallet;
    var data = {
        userId: user._id,
        clientName: user.clientName
    };
    axios.post(host, data)
        .then((result) => {
            if (result.data) {
                console.log(`[${context}] Wallet created`);
            }
            else {
                console.log(`[${context}] Wallet not created`);
            };
        })
        .catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
        });
};

function userGroupDrivers(user) {
    var context = "Function userGroupDrivers";
    var query = {
        'listOfDrivers': {
            $elemMatch: {
                'mobile': user.mobile,
                'internationalPrefix': user.internationalPrefix,
                'active': false
            }
        },
        clientName: user.clientName
    };
    GroupDrivers.find(query, (err, groupDriverFound) => {
        if (err) {
            console.error(`[${context}][GroupDrivers.find] Error `, err.message);
        }
        else {
            if (groupDriverFound.length > 0) {
                const getDriver = (driver) => {
                    return new Promise((resolve) => {
                        if (driver.mobile == user.mobile && driver.internationalPrefix == user.internationalPrefix) {
                            driver.active = true;
                            driver.driverId = user._id;
                            resolve(true);
                        }
                        else
                            resolve(false);
                    });
                };
                const getGroupDriver = (groupDriver) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            groupDriver.listOfDrivers.map(driver => getDriver(driver))
                        ).then(() => {
                            var newValue = { $set: groupDriver };
                            var query = {
                                _id: groupDriver._id
                            };
                            GroupDrivers.updateGroupDrivers(query, newValue, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][updateGroupDrivers] Error `, err.message);
                                }
                                else {
                                    console.log("Group Drivers updated");
                                }
                            });
                            resolve(true);
                        });
                    });
                }
                Promise.all(
                    groupDriverFound.map(groupDriver => getGroupDriver(groupDriver))
                ).then(() => {
                    console.log("Group Drivers updated");
                });
            }
            else {
                console.log("No group drivers");
            }
        };
    });
};

//Functio to verify if the user exist on groupsCSUsers
function userGroupCSUsers(user) {
    var context = "Function userGroupCSUsers";
    var query = {
        'listOfUsers': {
            $elemMatch: {
                'mobile': user.mobile,
                'internationalPrefix': user.internationalPrefix,
                'active': false
            }
        },
        clientName: user.clientName
    };
    GroupCSUsers.find(query, (err, groupCSUsersFound) => {
        if (err) {
            console.error(`[${context}][GroupCSUsers.find] Error `, err.message);
        }
        else {
            if (groupCSUsersFound.length > 0) {
                const getUser = (userToAdd) => {
                    return new Promise((resolve) => {
                        if (userToAdd.mobile == user.mobile && userToAdd.internationalPrefix == user.internationalPrefix) {
                            userToAdd.active = true;
                            userToAdd.userId = user._id;
                            resolve(true);
                        }
                        else
                            resolve(false);
                    });
                };
                const getGroupCSUsers = (groupCSUsers) => {
                    return new Promise((resolve, reject) => {
                        Promise.all(
                            groupCSUsers.listOfUsers.map(userToAdd => getUser(userToAdd))
                        ).then(() => {
                            var newValue = { $set: groupCSUsers };
                            var query = {
                                _id: groupCSUsers._id
                            };
                            GroupCSUsers.updateGroupCSUsers(query, newValue, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][updateGroupCSUsers] Error `, err.message);
                                    reject(err)
                                }
                                else {
                                    resolve(true);
                                };
                            });

                        });
                    });
                }
                Promise.all(
                    groupCSUsersFound.map(groupCSUsers => getGroupCSUsers(groupCSUsers))
                ).then(() => {
                    console.log("Group Charger Station Users updated");
                }).catch((error) => {
                    console.error(`[${context}][ Promise.all] Error `, error.message);
                });
            }
            else {
                console.log("No group charger station users");
            };
        };
    });
};

function getCEMEEVIOADHOC(clientName) {
    const context = "Function getCEMEEVIOADHOC";
    return new Promise((resolve, reject) => {

        let params;

        switch (clientName) {
            case process.env.WhiteLabelGoCharge:
                params = {
                    planName: "server_plan_EVIO_ad_hoc_goCharge"
                };
                break;
            case process.env.WhiteLabelHyundai:
                params = {
                    planName: "server_plan_EVIO_ad_hoc_hyundai"
                };
                break;
            default:
                params = {
                    planName: "server_plan_EVIO_ad_hoc"
                };
                break;
        };

        let host = process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data[0]);
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
};

function getCEMEEVIO(roamingName) {
    var context = "Function getCEMEEVIO";
    return new Promise((resolve, reject) => {

        var params;
        if (roamingName) {
            params = {
                CEME: process.env.NetworkEVIO + " " + roamingName
            };
        } else {
            params = {
                CEME: process.env.NetworkEVIO
            };
        };

        var host = process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data[0]);
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
};

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
                                { idTagHexaInv: random }
                            ]
                        }
                    }
                }
            }
        };

        Contract.find(query, (err, result) => {
            if (err) {
                console.error(`[] Error `, err.message);
                return err;
            }
            else {

                if (result.length > 0) {
                    getRandomIdTag(min, max)
                        .then((result) => {
                            resolve(result)
                        })
                }
                else {
                    resolve(random)
                };
            };
        });

    });
};

function validateIfMobiEActive(contract) {
    var context = "Function validateIfMobiEActive";

    let query = {
        userId: contract.userId,
        contractType: process.env.ContractTypeFleet,
        networks: {
            $elemMatch: {
                network: process.env.NetworkMobiE,
                tokens: {
                    $elemMatch: {
                        tokenType: process.env.TokensTypeApp_User,
                        status: { $ne: process.env.NetworkStatusInactive }
                    }
                }
            }
        }
    };

    Contract.find(query, async (err, contractsFounds) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {

            if (contractsFounds.length > 0) {

                let contractUserType = JSON.parse(JSON.stringify(contractsFounds[0]));

                var network = contractUserType.networks.find(network => network.network === process.env.NetworkMobiE);
                var token = network.tokens.find(token => token.tokenType === process.env.TokensTypeApp_User);

                let countryCode = "PT"
                let partyId = "EVI"
                let appUserUid = await getTokenIdTag(contract, process.env.NetworkMobiE, process.env.TokensTypeApp_User);
                if (!appUserUid)
                    appUserUid = await getTokenIdTag(contract, process.env.NetworkEVIO, process.env.TokensTypeApp_User);


                let body = {
                    "country_code": countryCode,
                    "party_id": partyId,
                    "uid": appUserUid,
                    "type": process.env.TokensTypeApp_User,
                    "contract_id": contractUserType.contract_id,
                    "issuer": "EVIO - Electrical Mobility",
                    "valid": true,
                    "last_updated": "",
                    "source": "",
                    "whitelist": "ALWAYS",
                    "evId": contract.contractType === 'fleet' ? contract.evId : '-1',
                    "energy_contract": {
                        "supplier_name": process.env.EnergyContractSupplierName,
                        "contract_id": (process.env.NODE_ENV === 'production') ? process.env.ProdEnergyContractDiaBi : process.env.PreProdEnergyContractDiaBi
                    },
                };

                createMobieToken(body, contractUserType.userId)
                    .then(result => {
                        let query = {
                            _id: contract._id
                        };

                        let newContract = {
                            'networks.$[i].tokens.$[j].refId': result.refId,
                            'networks.$[i].tokens.$[j].idTagDec': appUserUid,
                            'networks.$[i].tokens.$[j].status': token.status,
                            'networks.$[i].paymentMethod': network.paymentMethod,
                            contract_id: contractUserType.contract_id,
                            nif: contractUserType.nif,
                            address: contractUserType.address
                        };

                        let arrayFilters = [
                            { "i.network": process.env.NetworkMobiE },
                            { "j.tokenType": process.env.TokensTypeApp_User }
                        ];


                        Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters }, (err, doc) => {
                            if (err) {
                                console.error(`[${context}][.then][updateContract] Error `, err.message);

                            }
                            else {
                                if (doc) {
                                    console.log("RFID token created");

                                }
                                else {
                                    console.log("RFID token not created");
                                }
                            }
                        });
                    })
                    .catch(error => {
                        console.error(`[${context}][.catch][createMobieToken] Error `, error.message);
                    });

            }
            else {
                console.log("No contract with MobiE");
            };

        };
    });

};

function createMobieToken(body, userId) {

    return new Promise((resolve, reject) => {
        var context = "Function createMobieToken";
        try {

            let config = {
                headers: {
                    userid: userId,
                    apikey: process.env.ocpiApiKey
                }
            }
            let host = process.env.HostMobie + process.env.PathMobieTokens


            axios.put(host, body, config)
                .then((response) => {
                    console.log(`MobiE ${body.type} ${body.uid} token created`)
                    resolve(response.data)
                })
                .catch((error) => {
                    if (error.response) {
                        console.error(`[${context}][${host}][400] Error `, error.response.data);
                        reject(error)
                    }
                    else {
                        console.error(`[${context}][${host}] Error `, error.message);
                        reject(error)
                    };

                });


        }
        catch (error) {
            if (error.response) {
                console.error(`[${context}][400] Error `, error.response.data);
                reject(error)
            }
            else {
                console.error(`[${context}] Error `, error.message);
                reject(error)
            };
        }
    })
}

function getReferencePlaces(listAddress) {
    let context = "Function getReferencePlaces";
    return new Promise(async (resolve, reject) => {
        try {
            let referencePlaces = [];

            let addressFound = listAddress.find(address => { return address.favourite === '1' });
            // Yes, the country field it's our countryCode
            const sanitezedGoChargeCountryCode = addressFound?.country?.toUpperCase();

            let newListAddress = listAddress.filter(address => { return address.favourite !== '1' });

            if (!addressFound) {
                addressFound = newListAddress.shift();
            }

            let zipCode = addressFound.postal_code ? addressFound.postal_code : addressFound.zipCode

            let coordinatesAndCountryAndZipCode = await getCoordinates(zipCode);
            let newAddress = {
                name: addressFound.custom_name,
                type: "HOME",
                address: {
                    street: addressFound.address ? addressFound.address : addressFound.street,
                    zipCode: coordinatesAndCountryAndZipCode.zipCode || zipCode,
                    city: addressFound.locality,
                    state: addressFound.district,
                    country: coordinatesAndCountryAndZipCode.country,
                    countryCode: sanitezedGoChargeCountryCode || countryList.getCode(coordinatesAndCountryAndZipCode.country),
                },
                geometry: {
                    type: "Point",
                    coordinates: [coordinatesAndCountryAndZipCode.lng, coordinatesAndCountryAndZipCode.lat]
                },
                addressIdCaetanoGo: addressFound.id,
                vat: addressFound.vat,
                favourite: addressFound.favourite
            };

            referencePlaces.push(newAddress);



            if (newListAddress.length > 0) {

                Promise.all(
                    newListAddress.map((address, index) => {
                        return new Promise(async (resolve) => {

                            let zipCode = addressFound.postal_code ? addressFound.postal_code : addressFound.zipCode

                            let coordinatesAndCountryAndZipCode = await getCoordinates(zipCode);
                            // Yes, the country field it's our countryCode
                            const sanitezedGoChargeCountryCode = address.country.toUpperCase();

                            let newAddress = {
                                name: address.custom_name,
                                type: index === 0 ? "WORK" : "OTHER",
                                address: {
                                    street: address.address ? address.address : address.street,
                                    zipCode: coordinatesAndCountryAndZipCode.zipCode || zipCode,
                                    city: address.locality,
                                    state: address.district,
                                    country: coordinatesAndCountryAndZipCode.country,
                                    countryCode: sanitezedGoChargeCountryCode || countryList.getCode(coordinatesAndCountryAndZipCode.country),
                                },
                                geometry: {
                                    type: "Point",
                                    coordinates: [coordinatesAndCountryAndZipCode.lng, coordinatesAndCountryAndZipCode.lat]
                                },
                                addressIdCaetanoGo: address.id,
                                vat: addressFound.vat,
                                favourite: address.favourite
                            };

                            referencePlaces.push(newAddress);
                            resolve();

                        })

                    }))
                    .then(() => {
                        resolve(referencePlaces);
                    }).catch((error) => {
                        console.error(`[${context}][.catch] Error `, error.message);
                        resolve([]);
                    });

            } else {

                resolve(referencePlaces);

            };
        } catch (error) {
            console.error(`[${context}][.catch] Error `, error.message);
            Sentry.captureException(error)
            resolve([]);
        }
    })
};

/**
 * Returns lat, lng and country code from a given zipcode
 * @param zipcode
 * @returns {Promise<unknown>}
 */
function getCoordinates(zipcode) {
    return new Promise(async (resolve) => {
        let lat = 0.0;
        let lng = 0.0;
        try {

            let host = `https://maps.googleapis.com/maps/api/geocode/json?address=${zipcode}&key=${process.env.MAPS_APIKEY}`

            let result = await axios.get(host);
            if (result.data.status === "OK") {
                const fetchedData = result.data.results[0];
                const countryData = fetchedData.address_components.find(component => component.types.includes('country'));
                const zipCodeData = fetchedData.address_components.find(component => component.types.includes('postal_code'));

                resolve({
                    lat: fetchedData.geometry.location.lat,
                    lng: fetchedData.geometry.location.lng,
                    country: countryData.long_name,
                    zipCode: zipCodeData.long_name
                });

            } else {
                resolve({
                    lat: lat,
                    lng: lng
                });
            };

        } catch (error) {
            resolve({
                lat: lat,
                lng: lng
            })
        }
    });
};

function updateBillingProfile(favAddress, userId, clientName) {
    let context = "Function updateBillingProfile";
    let query = { userId: userId };

    let newData = {
        nif: favAddress.vat,
        billingAddress: {
            street: favAddress.address.street,
            zipCode: favAddress.address.zipCode,
            city: favAddress.address.city,
            country: favAddress.address.country,
            countryCode: favAddress.address.countryCode
        },
        clientName: clientName
    };

    console.log("favAddress", favAddress);

    BillingProfile.updateBillingProfile(query, { $set: newData }, { new: true }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        };

        console.log("Billing Profile Updated")
    });

};


function updateBillingProfileHyundai(nif, address, userName, userId, clientName) {
    let context = "Function updateBillingProfileHyundai";
    let query = { userId: userId };

    let newData = {
        clientName: clientName
    };

    if (userName != "")
        newData.name = userName

    if (nif != "")
        newData.nif = nif

    if (address != "")
        newData.billingAddress = address

    BillingProfile.updateBillingProfile(query, { $set: newData }, { new: true }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        };

        console.log("Billing Profile Updated")
    });

};

async function activeMobiE(contract, clientType) {
    let context = "Function activeMobiE";
    try {

        let req = {
            body: {
                contractId: contract._id,
                network: process.env.NetworkMobiE
            },
            headers: {
                userid: contract.userId,
                clientname: contract.clientName,
                usertype: clientType
            }
        }

        ContractHandler.activeNetworks(req)
            .then((result) => {

                req = {
                    body: {
                        contractId: contract._id,
                        network: process.env.NetworkGireve
                    },
                    headers: {
                        userid: contract.userId,
                        clientname: contract.clientName,
                        usertype: clientType
                    }
                };

                ContractHandler.activeNetworks(req)
                    .then((result) => {

                        console.log(result.message)
                    })
                    .catch((error) => {

                        console.error(`[${context}][ContractHandler.activeNetwork] Error `, error.message);

                    });

            })
            .catch((error) => {

                console.error(`[${context}][ContractHandler.activeNetwork] Error `, error.message);

            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);

    };
}

function userPoolDrivers(user) {
    var context = "Function userPoolDrivers";
    var query = {
        'poolOfDrivers': {
            $elemMatch: {
                'mobile': user.mobile,
                'internationalPrefix': user.internationalPrefix,
                'active': false
            }
        },
        clientName: user.clientName
    };
    Drivers.find(query, (err, driverFound) => {
        if (err) {
            console.error(`[${context}][Drivers.find] Error `, err.message);
        }
        else {
            if (driverFound.length > 0) {
                const getDriver = (driver) => {
                    return new Promise((resolve) => {
                        if (driver.mobile == user.mobile && driver.internationalPrefix == user.internationalPrefix) {
                            driver.active = true;
                            driver.driverId = user._id;
                            resolve(true);
                        }
                        else
                            resolve(false);
                    });
                };
                const getDriverFound = (found) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            found.poolOfDrivers.map(driver => getDriver(driver))
                        ).then(() => {
                            var newValue = { $set: found };
                            var query = {
                                _id: found._id
                            };
                            Drivers.updateDrivers(query, newValue, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][updateDrivers] Error `, err.message);
                                }
                                else {
                                    console.log("Drivers updated");
                                }
                            });
                            resolve(true);
                        });
                    });
                }
                Promise.all(
                    driverFound.map(found => getDriverFound(found))
                ).then(() => {
                    console.log("Drivers updated");
                });
            }
            else {
                console.log("No pool drivers");
            }
        };
    });
};

//HYUNDAI API
async function hyundaiGetToken() {
    var context = "Function hyundaiGetToken";
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
        };

        let host = process.env.hyundaiGetToken;

        let keys = ['client_id', 'scope', 'client_secret', 'grant_type'];

        let values = [
            process.env.HYUNDAI_CLIENT_ID,
            process.env.HYUNDAI_CLIENT_SCOPE,
            process.env.HYUNDAI_CLIENT_SECRET,
            process.env.hyundaiGranType,
        ];


        let body = axiosS.getFromDataFormat(keys, values)

        return await axiosS.axiosPostBody(host, body);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }

}

async function hyundaiGetData(token, clientId) {
    var context = "Function hyundaiGetData";
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
        };

        let host = process.env.hyundaiGetData + clientId;

        let headers = { Authorization: `Bearer ${token}`, idClientCRM: clientId, brand: process.env.hyundaiBrand }

        console.log("host - ", host)

        console.log("token - ", token)

        console.log("headers - ", headers)

        let result = await axiosS.axiosGetHeaders(host, headers)

        console.log("result - ", result)

        return result

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

module.exports = router;
