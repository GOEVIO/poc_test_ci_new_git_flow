// Services
import contractServices from '../services/contracts';
import gireveServices from '../services/gireve';
import { editAssociatedPhysicalCard } from '../services/edit-associated-physical-card'
import { activateNetworkFleet, activateNetworksFleet } from '../services/activate-network-fleet'
import { activateUserContracts } from '../services/activate-user-contracts'
import { activateAssociateCard } from '../services/activate-associate-card';
const usersService = require('../services/users').default;
import { DeletionReason } from '../enums/deletionReason';
import { associatePhysicalCard } from '../services/associate-physical-card';
import { TokenStatus, TokenType } from '../enums/tokenStatusService.enum';
import TokenStatusService from '../services/tokenStatus.service';
import { associatePhysicalCard } from '../services/associate-physical-card';
import {createActiveRfidTokens} from "../services/create-activate-rfid-tokens";
require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const axios = require("axios");
const Sentry = require('@sentry/node');
const Commons = require('evio-library-commons').default;
const checkDigitMobility = require('../digitCalculation/digitCalculation')
const path = require("path");
const fs = require("fs");
const rawdata = fs.readFileSync(path.resolve(__dirname, "../digitCalculation/lists.json"));
const checkDigitLists = JSON.parse(rawdata);
const User = require('../models/user');
const Contract = require('../models/contracts');
const ContractHandler = require('../controllers/contracts');
const GroupCSUsers = require('../models/groupCSUsers');
const moment = require('moment');
const { calculateUserDebt } = require('evio-library-payments').default;
const toggle = require('evio-toggle').default
const ReasonForBlockUser = require('../utils/enums/ReasonForBlockUser').ReasonForBlockUser;
const ReasonForUnblockUser = require('../utils/enums/ReasonForUnblockUser').ReasonForUnblockUser;
const { TokenStatusChangeReason } = require('../utils/enums/TokenStatusChangeReason');
const AxiosHandler = require('../services/axios');
const { billingProfileStatus } = require('../constants/env').default;
const { Enums } = require('evio-library-commons').default;
const { paymentValidationEnum } = require('../constants/env').default;

const CEMETariff = require('../models/cemeTariff');
const GroupDrivers = require('../models/groupDrivers');
const ErrorHandler = require('../controllers/errorHandler');
const BillingProfileHandler = require('../controllers/billingProfile');
const SCSibsCards = require('../controllers/scSibsCards');
const HYSibsCards = require('../controllers/hySibsCards');
const ACPSibsCards = require('../controllers/acpSibsCards');
const ToProcessCards = require('../controllers/toProcessCards');
const SCCetelemCards = require('../controllers/scCetelemCards');
const UserHandler = require('../controllers/user');
const crypto = require('crypto');
const Converter = require('hexadecimal-to-decimal')
const notificationsHost = 'http://notifications:3008';
const sendEmailRequest = `${notificationsHost}/api/private/sendEmail`;
const contractsJHandler = require("../handlers/contracts");
const { getCode, getName } = require('country-list');
const { validateUserPerClientName } = require('../auth/auth');
const { createContract : createUserContract } = require('./users')
const { logger } = require('../utils/constants');
const { default: { registerMetric } } = require('../services/sentryMetric');
const { default: { getCardName } } = require('../utils/users');
const { default: { deleteCachedContractsByUser } } = require('../services/contracts');
const ExternalRequestsHandler = require('../controllers/externalRequests');
const Constants = require('../utils/constants').default;

const { notifyAccountSuspension, notifyAccountReactivation } = require('evio-library-notifications').default;

//========== JOBS ==========
if (process.env.NODE_ENV === 'production') {
    contractsJHandler.startDelteExtraContractsJob()
};



//========== POST ==========
//Endpoint to create a virtual card public
router.post('/api/public/contract', (req, res, next) => {
    var context = "POST /api/public/contract";
    try {
        var received = req.body;

        if (!received.name) {
            return res.status(400).send({ auth: false, code: 'contract_name_required', message: 'Contract name is required' });
        }

        if (!received.address) {
            return res.status(400).send({ auth: false, code: 'contract_address_required', message: 'Contract address is required' });
        }

        if (!received.address.street) {
            return res.status(400).send({ auth: false, code: 'contract_street_required', message: 'Contract street is required' });
        }

        if (!received.address.zipCode) {
            return res.status(400).send({ auth: false, code: 'contract_postal_code_required', message: 'Contract postal code is required' });
        }

        if (!received.address.country) {
            return res.status(400).send({ auth: false, code: 'contract_country_required', message: 'Contract country is required' });
        }

        /*if (!received.address.countryCode) {
            return res.status(400).send({ auth: false, code: 'contract_country_code_required', message: 'Contract country code is required' });
        }*/

        if (!received.internationalPrefix) {
            return res.status(400).send({ auth: false, code: 'contract_international_prefix_required', message: 'Contract international prefix is required' });
        }

        if (!received.nif) {
            return res.status(400).send({ auth: false, code: 'contract_nif_required', message: 'Contract nif is required' });
        }

        if (!received.mobile) {
            return res.status(400).send({ auth: false, code: 'contract_mobile_required', message: 'Contract mobile is required' });
        }

        if (!received.email) {
            return res.status(400).send({ auth: false, code: 'contract_email_required', message: 'Contract email is required' });
        }

        User.findOne({ mobile: received.mobile }, function (err, user) {
            if (err) {
                console.log(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                let userId = '';
                if (user) {
                    userId = user._id;
                }

                createVirtualCard(received, userId)
                    .then(newContract => {

                        Contract.createContract(newContract, (err, result) => {
                            if (err) {
                                console.log(`[${context}][createContract] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (result) {

                                    //OCPI REQUEST para ativar o Mobie tokenType
                                    //Necessario atualizar o contract

                                    //enviar email com pedido de adesão
                                    // let email;
                                    // if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'pre-production') {
                                    //     email = process.env.EMAIL1
                                    // }
                                    // else {
                                    //     email = process.env.EMAIL2
                                    // };

                                    // let mailOptions = {
                                    //     to: email,
                                    //     subject: "Pedido de Adesão",
                                    //     message: {
                                    //         "subject" : "Pedido de Adesão",
                                    //         "username" : received.name ,
                                    //         "street" : received.address.street ,
                                    //         "zipCode" : received.address.zipCode ,
                                    //         "country" : received.address.country ,
                                    //         "nif" : received.nif ,
                                    //         "mobile" : received.mobile ,
                                    //         "userEmail" : received.email ,
                                    //         "userId" : result.userId
                                    //     },
                                    //     type : "evioRequest"
                                    // }

                                    // axios.post(sendEmailRequest, { mailOptions })
                                    //     .then((response) => {
                                    //         if (response) {
                                    //             console.log("[Success] Mail Notification success");
                                    //         } else {
                                    //             console.log("[Error] Mail Notification error");
                                    //         }
                                    //     });

                                    return res.status(200).send({ auth: false, code: 'server_contract_created', message: "Contract created with success" });

                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_contract_not_created', message: "Contract not created" });
                                }
                            };
                        });

                    })
                    .catch(err => {
                        console.log(`[${context}][createVirtualCard] Error `, err.message);
                        return res.status(500).send(err.message);
                    });

            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to create a virtual card Private
router.post('/api/private/contracts', async (req, res, next) => {
    let context = "POST /api/private/contracts";
    try {
        const useLibFlag = await toggle.isEnable('charge-652-rework-post-apiprivatecontract')

        //TODO
        let received = req.body;

        let clientName;

        let userFound = await User.findOne({ _id: received.userId });

        let userContract = await getUserContractCEME(received.userId);

        if(!userContract){
            await createUserContract(userFound, useLibFlag);
            userContract = await getUserContractCEME(received.userId);
        }

        if (req.headers['clientname'])
            clientName = req.headers['clientname'];
        else
            clientName = userContract.clientName


        var name = userFound.name.split(" ");

        let idTagDecEVIO = await getRandomIdTag(100_000_000_000, 999_999_999_999);
        let idTagDecMobiE = await getRandomIdTag(100_000_000_000, 999_999_999_999);

        var tariff = {
            power: userContract.tariff.power,
            planId: userContract.tariff.planId
        };

        const tariffRoaming = userContract.tariffRoaming

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

        var newContract

        if (received.evId !== undefined && received.evId !== "") {
            newContract = {
                name: userFound.name,
                email: userFound.email,
                mobile: userFound.mobile,
                cardName: received.licensePlate,
                cardType: process.env.CardTypeVirtual,
                userId: userFound._id,
                evId: received.evId.toString(),
                fleetId: received.fleetId,
                tariff: tariff,
                contractType: process.env.ContractTypeFleet,
                tariffRoaming,
                contractIdInternationalNetwork: contractIdInternationalNetwork,
                clientName: clientName
            };
        } else {
            newContract = {
                name: userFound.name,
                email: userFound.email,
                mobile: userFound.mobile,
                cardName: name[0] + " " + name[name.length - 1],
                cardType: process.env.CardTypeVirtual,
                userId: userFound._id,
                evId: received.evId?.toString() ?? '-1',
                fleetId: received.fleetId,
                tariff: tariff,
                contractType: process.env.ContractTypeUser,
                tariffRoaming: tariffRoaming,
                contractIdInternationalNetwork: contractIdInternationalNetwork,
                clientName: clientName
            };
        };

        var contract = new Contract(newContract);

        if (process.env.NODE_ENV === 'production') {
            contract.imageCEME = process.env.HostProdContrac + `ceme/ceme${clientName}.jpg`; // For PROD server
            contract.imageCard = process.env.HostProdContrac + `card/card${clientName}.jpg`;
            contract.fontCardBlack = false;
        }
        else if (process.env.NODE_ENV === 'pre-production') {
            contract.imageCEME = process.env.HostPreProdContrac + `ceme/ceme${clientName}.jpg`; // For PROD server
            contract.imageCard = process.env.HostPreProdContrac + `card/card${clientName}.jpg`;
            contract.fontCardBlack = false;
        } else {
            contract.imageCEME = process.env.HostQAContrac + `ceme/ceme${clientName}.jpg`; // For QA server
            contract.imageCard = process.env.HostQAContrac + `card/card${clientName}.jpg`;
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
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: (clientName === process.env.WhiteLabelGoCharge || clientName === process.env.WhiteLabelHyundai) ? true : false
            },
            {
                name: process.env.NetworkHyundai,
                networkName: "server_hyundai_network",
                network: process.env.NetworkHyundai,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: (clientName === process.env.WhiteLabelGoCharge || clientName === process.env.WhiteLabelHyundai) ? true : false
            },
            {
                name: process.env.NetworkKLC,
                networkName: "server_klc_network",
                network: process.env.NetworkKLC,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: clientName === process.env.WhiteLabelKLC
            },
            {
                name: process.env.NetworkKinto,
                networkName: "server_kinto_network",
                network: process.env.NetworkKinto,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusActive,
                        idTagDec: idTagDecEVIO
                    }
                ],
                hasJoined: true,
                isVisible: clientName === process.env.WhiteLabelKinto
            }
        ];

        contract.networks = networks;

        const result = await Contract.createContract(contract);

        if (result.contractType === process.env.ContractTypeFleet) {
            if (useLibFlag) {
                await activateNetworksFleet({
                    fleetContract: result,
                    userContract,
                    networkNames: [Commons.Enums.ChargerNetworks.Mobie, Commons.Enums.ChargerNetworks.Gireve],
                    path: 'POST /api/private/contracts'
                })
            } else {
                validateIfMobiEActive(result);
                validateIfInternationalNetworkActive(result);
            }
        }

        await contractServices.deleteCachedContractsByUser(received.userId);

        return res.status(200).send(result);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/contracts/runFirstTime', async (req, res, next) => {
    let context = "POST /api/private/contracts/runFirstTime";
    try {

        const result = {
            address: [],
            shippingAddress: []
        }

        //runFirstTime();
        //changeCardNameContractFleet()
        //addInternacionalNetwork()
        //addPlanToRoaming()
        //addTariffRoaming()
        //addRFIDToGireve()
        //inactiveGireveOnContractTypeFleet();
        //addContractEV()
        //blockUser();
        //addHasJoinedCOntracts()
        //changeCemeContract();
        //changeCemeTariffs();
        //changeCemeTariffsNotMobiE();
        //changeCemeTariffsWithMobiE();
        //addNewNetworks();
        //addPhysicalCardState();
        //changeCardDateFormat();
        //updateAddressModel();
        //updateshippingAddressModel();
        /*result.address = await updateZipCodeAddress()
        result.shippingAddress = await updateZipCodeShippingAddress()
        removePostCodeAddress()
        removePostCodeShippingAddress()*/
        //updateCardDateFormats();
        await updateFieldNames();
        return res.status(200).send(result);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to activate MobiE network
router.post('/api/private/contracts/activeNetworks', (req, res, next) => {
    const context = "POST /api/private/contracts/activeNetworks";
    try {

        ContractHandler.activeNetworks(req)
            .then((result) => {

                return res.status(200).send(result);

            })
            .catch((error) => {

                console.log(`[${context}][ContractHandler.activeNetwork] Error `, error.message);
                ErrorHandler.ErrorHandler(error, res);

            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/contracts/activateContracts', async (req, res, next) => {
    var context = "POST /api/private/contracts/activateContracts";
    try {
        const userId = req.body.userId;
        const clientRequest = req.headers.client;
        let bypassNotification = req.body.bypassNotification

        if (clientRequest === "Postman") {

            if (await toggle.isEnable('charge-564-activate-contracts-rework')) {
                await activateUserContracts(userId)

                if (bypassNotification !== true) {
                    notifyAccountReactivation(userId)
                }

                return res.status(200).send({ auth: true, code: 'server_contracts_deactivated', message: "Contracts successfully activated" })
            }

            // this code will be removed after testing the new code above under feature flag
            Contract.markAllAsActive(userId, (err, result) => {
                if (err) {
                    console.log(`[${context}][markAllAsInactive] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {

                    var query = {
                        _id: userId,
                        blocked: true
                    };

                    User.findOne(query, (err, userFound) => {
                        if (err) {
                            console.log(`[${context}][findOne] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (userFound) {

                                User.unlockUser(userId, ReasonForUnblockUser.ContractActivated, (err, result) => {
                                    if (err) {
                                        console.log(`[${context}][unlockUser] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {
                                        if (bypassNotification !== true) {
                                            notifyAccountReactivation(userFound._id)
                                        }
                                        unlockUserContract(userId);
                                        return res.status(200).send({ auth: true, code: 'server_contracts_deactivated', message: "Contracts successfully activated" });
                                    };
                                });

                            }
                            else {

                                unlockUserContract(userId);
                                return res.status(200).send({ auth: true, code: 'server_contracts_deactivated', message: "Contracts successfully activated" });

                            };
                        };
                    });

                };
            });

        } else {

            return res.status(400).send({ auth: false, code: 'server_not_authorized_access_externalAPI', message: 'Not authorized to access' });

        };

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Endpoint to check if given idTag is valid  - internal endpoint
router.get('/api/private/contracts/idTag', (req, res, next) => {
    const context = "GET /api/private/contracts/idTag";
    try {

        let userId = req.query.userId;
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });

        let idTag = req.query.idTag.toUpperCase();
        if (!idTag)
            return res.status(400).send({ auth: false, code: 'server_id_tag_required', message: 'Id tag is required' });

        let networkType = req.query.networkType
        if (!networkType)
            return res.status(400).send({ auth: false, code: 'server_networkType_required', message: 'Network Type is required' });

        let evId = req.query.evId;

        if (evId === undefined || evId == "-1") {
            evId = "";
        };

        let query = {
            $or: [
                {
                    $and: [
                        { userId: userId },
                        {
                            networks: {
                                $elemMatch: {
                                    network: networkType,
                                    tokens: {
                                        $elemMatch: {
                                            $or: [
                                                { idTagDec: idTag },
                                                { idTagHexa: idTag },
                                                { idTagHexaInv: idTag }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    ]
                },
                {
                    $and: [
                        { evId: evId },
                        {
                            networks: {
                                $elemMatch: {
                                    network: networkType,
                                    tokens: {
                                        $elemMatch: {
                                            $or: [
                                                { idTagDec: idTag },
                                                { idTagHexa: idTag },
                                                { idTagHexaInv: idTag }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    ]
                }
            ],
            active: true
        };

        console.log("query", query);
        Contract.findOne(query, (err, contract) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (contract)
                    return res.status(200).send({ contract });
                else
                    return res.status(200).send(null);
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/contracts/idTag/all', (req, res, next) => {
    const context = "GET /api/private/contracts/idTag/all";
    try {

        let arrayIdTags = req.body.arrayIdTags;
        console.log("EXTERNALAPI_TEMP_LOG ArrayIdTags: ", arrayIdTags)

        let query = {
            $or: arrayIdTags.map(arrayIdTag => ({
                active: true,
                clientName: arrayIdTag.clientName,
                'networks': {
                    $elemMatch: {
                        network: arrayIdTag.networkType,
                        tokens: {
                            $elemMatch: {
                                $or: [
                                    { idTagDec: arrayIdTag.idTag },
                                    { idTagHexa: arrayIdTag.idTag },
                                    { idTagHexaInv: arrayIdTag.idTag }
                                ]
                            }
                        }
                    }
                }
            })),
        };

        Contract.find(query, (err, contractList) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (contractList && contractList.length > 0) {
                    console.log('EXTERNALAPI_TEMP_LOG: contractList.', contractList);
                    return res.status(200).send({contractList});
                } else {
                    return res.status(404).send({ message: 'No matching contracts found' });
                }
            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/contracts/byId/:contratId', (req, res, next) => {
    const context = "GET /api/private/contracts/byId/:contratId";
    try {

        let contratId = req.params.contratId;

        let query = {
            _id: contratId,
            active: true
        };

        Contract.findOne(query, (err, contract) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (contract)
                    return res.status(200).send(contract);
                else
                    return res.status(200).send(null);
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to check if given idTag is valid  - internal endpoint
router.get('/api/private/contracts/checkIdTag', async (req, res, next) => {
    const context = "GET /api/private/contracts/checkIdTag";
    try {

        let idTag = req.query.idTag.toUpperCase();
        let hwId = req.query.hwId;
        let chargerType = req.query.chargerType;

        let networkQuery;

        switch (chargerType) {
            case "011":
                networkQuery = process.env.NetworkGoCharge
                break;
            case "012":
                networkQuery = process.env.NetworkHyundai
                break;
            case process.env.chargerTypeKLC:
                networkQuery = process.env.NetworkKLC
                break;
            case process.env.chargerTypeKinto:
                networkQuery = process.env.NetworkKinto
                break;
            default:
                networkQuery = process.env.NetworkEVIO
                break;
        }

        let query = {
            networks: {
                $elemMatch: {
                    network: networkQuery,
                    tokens: {
                        $elemMatch: {
                            $or: [
                                { idTagDec: idTag },
                                { idTagHexa: idTag },
                                { idTagHexaInv: idTag }
                            ]
                        }
                    }
                }
            },
            active: true
        };

        let params = {
            hwId: hwId,
            hasInfrastructure: true,
            active: true
        };

        let host = process.env.HostCharger + process.env.PathGetCharger;

        let result = await axios.get(host, { params });
        let chargerFound = result.data;

        if (!idTag)
            return res.status(400).send({ auth: false, code: 'server_id_tag_required', message: 'Id tag is required' });


        Contract.findOne(query, async (err, contract) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {

                if (contract) {
                    let driverId = contract.userId;
                    let ownerBilling = true
                    if (contract.contractType === process.env.ContractTypeFleet) {

                        let evFound = await getEv(contract.evId);
                        if (evFound) {
                            if (evFound.listOfGroupDrivers.length === 0 && evFound.listOfDrivers.length === 1) {
                                if (evFound.listOfDrivers[0].userId) {
                                    driverId = evFound.listOfDrivers[0].userId;
                                    ownerBilling = evFound.listOfDrivers[0]?.billingBy == "owner"
                                }
                            }
                        };

                    };

                    //valida se o posto está disponivel
                    let userIdOwnerContract = contract.userId
                    contract.userIdToBilling = ownerBilling ? contract.userId : driverId;
                    contract.userId = driverId;
                    //Validar se o dono do posto é o mesmo que o do contrato
                    if (chargerFound.createUser === contract.userId) {
                        return res.status(200).send({ contract });
                    }
                    else {

                        //Validar se o contrato está ativo ou cancelado
                        if (contract.status === process.env.ContractStatusActive) {

                            //Validar o availability type
                            if (chargerFound.availability.availabilityType === process.env.ChargerAvailabilityAlways) {

                                //valida o contrato e o charger
                                validateContractAndCharger(contract, chargerFound, userIdOwnerContract)
                                    .then((result) => {

                                        if (result) {

                                            return res.status(200).send({ contract });

                                        } else {

                                            return res.status(200).send(null);

                                        };

                                    })
                                    .catch((error) => {

                                        console.log(`[${context}][validateContractAndCharger] Error `, error.message);
                                        return res.status(500).send(error.message);

                                    });

                            }
                            else if (chargerFound.availability.availabilityType === process.env.ChargerAvailabilityCustom) {

                                //TODO
                                //Faz o mesmo que o always
                                validateContractAndCharger(contract, chargerFound, userIdOwnerContract)
                                    .then((result) => {

                                        if (result) {

                                            return res.status(200).send({ contract });

                                        }
                                        else {

                                            return res.status(200).send(null);

                                        };

                                    })
                                    .catch((error) => {

                                        console.log(`[${context}][validateContractAndCharger] Error `, error.message);
                                        return res.status(500).send(error.message);

                                    });

                            }
                            else {

                                return res.status(200).send(null);

                            };

                        }
                        else {

                            return res.status(200).send(null);

                        };

                    };

                    /*}
                    else {

                        return res.status(200).send(null);

                    };
                    */

                }
                else {

                    return res.status(200).send(null);

                };

            };
        }).lean();

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/contracts', async (req, res, next) => {
    const context = "GET /api/private/contracts";

    try {
        let userId = req.headers['userid'];
        console.log(`[${context}] called with userId: ${userId}`);

        const featureFlagEnabled = await toggle.isEnable('fleet-363-responses');

        if (featureFlagEnabled) {
            console.log(`[${context}] Feature flag 'fleet-363-responses' is enabled, using new response format.`);
            const result = await ContractHandler.getMyContractsWithRfidUiState(userId, req);

            if (!result.length) {
                throw new Error({ auth: false, code: 'server_contracts_not_found', message: 'No contracts found for the user' });
            }

            return res.status(200).send(result);
        }
        else {
            const startDate = new moment();
            const sendMetricToSentry = () => {
                const endDate = new moment();
                const totalTimeInMillis = endDate.diff(startDate);
                console.log(`${context} Processing time: ${totalTimeInMillis} ms`);
                registerMetric("get_contracts_processing_time", totalTimeInMillis, 'ms');
            };

            const cachedResult = await contractServices.getCachedContractsByUser(userId);

            if (cachedResult) {
                console.log(`[${context}] Serving cached content for userId: ${userId}`);
                sendMetricToSentry();
                return res.status(200).send(cachedResult);
            } else {
                ContractHandler.getMyContracts(userId, req)
                    .then(async (result) => {
                        console.log(`[${context}] Fetching data to userId: ${userId} result: ${result}`);
                        sendMetricToSentry();
                        await contractServices.createCacheContractsByUser(userId, result);
                        return res.status(200).send(result);

                    })
                    .catch((error) => {
                        sendMetricToSentry();
                        console.log(`[${context}][ContractHandler.getMyContracts] Error `, error.message);
                        ErrorHandler.ErrorHandler(error, res);
                    });
            }
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res);
    }
});

//Endpoit to get all cards of a particular user
router.get('/api/private/contracts/byEv', async (req, res, next) => {
    const context = "GET /api/private/contracts/byEv";
    try {
        const userId = req.headers['userid'];
        const evId = req.query.evId;
        const contractsFound = await contractsFind({
            evId: evId,
            contractType: process.env.ContractTypeFleet,
            active: true
        });
        if (contractsFound.length === 0) {
            return res.status(200).send(contractsFound);
        }
        const paymentMethods = await getPaymentMethods(userId);
        await Promise.all(contractsFound.map(async (contract) => {
            const netWork = contract.networks.find(netWork => netWork.network === process.env.NetworkMobiE);
            if (netWork) {
                netWork.paymentMethodInfo = netWork.paymentMethod && paymentMethods.find(payment => payment.id === netWork.paymentMethod) || {};
            }
            if (contract.tariff) {
                try {
                    const tariffInfo = await getTariffCEME({_id: contract.tariff.planId});
                    contract.tariffRoamingInfo = await getTariffCEMERoaming(contract.tariffRoaming);
                    if (tariffInfo && Object.keys(tariffInfo).length !== 0) {
                        contract.tariffInfo = tariffInfo;
                        contract.tariffInfo.plan.tariff.filter(tariff => tariff.power === contract.tariff.power);
                    }
                } catch (error) {
                    console.error(`[GET /api/private/contracts/byEv][getTariffCEME/getTariffCEMERoaming] Error `, error.message);
                    throw error;
                }
            } else {
                contract.tariffInfo = {};
            }
        }));
        contractsFound.sort((x, y) => y.default - x.default);
        return res.status(200).send(contractsFound);
    } catch (error) {
        console.error(`[GET /api/private/contracts/byEv] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/contracts/byEvLandingPage', (req, res, next) => {
    var context = "GET /api/private/contracts/byEvLandingPage";
    try {

        var userId = req.headers['userid'];

        var evs = req.body.evs;
        var groupDrivers = req.body.groupDrivers;
        var dateNow = new Date();

        var listOfEvs = [];
        Promise.all(
            evs.map(ev => {

                return new Promise(async (resolve) => {
                    try {
                        var query = {
                            evId: ev._id,
                            contractType: process.env.ContractTypeFleet,
                            active: true
                        };

                        let contract = await Contract.findOne(query, { _id: 1 });

                        if (ev.userId === userId) {

                            if (contract) {
                                ev.contractId = contract._id;
                            };

                            listOfEvs.push(ev);
                            resolve(true);

                        } else {

                            if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length == 0)) {

                                getValidationDriver(ev, userId, dateNow)
                                    .then((result) => {

                                        if (result) {

                                            if (contract) {
                                                //first element
                                                ev.contractId = contract._id;
                                            };

                                            listOfEvs.push(ev);

                                            resolve(true);

                                        } else {

                                            resolve(false);

                                        };

                                    });

                            } else if ((ev.listOfDrivers.length == 0) && (ev.listOfGroupDrivers.length != 0)) {

                                getValidationGroupDrivers(ev, dateNow, groupDrivers)
                                    .then((result) => {

                                        if (result) {

                                            getGroupsDrivers(ev)
                                                .then((newListOfGroupDrivers) => {

                                                    ev.listOfGroupDrivers = newListOfGroupDrivers;
                                                    if (contract) {
                                                        //first element
                                                        ev.contractId = contract._id;
                                                    };

                                                    listOfEvs.push(ev);
                                                    resolve(true);

                                                })
                                                .catch((error) => {

                                                    console.log(`[${context}] Error `, error.message);
                                                    resolve(false);

                                                });

                                        } else {

                                            resolve(false);

                                        };

                                    });

                            } else if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length != 0)) {
                                getValidationDriver(ev, userId, dateNow)
                                    .then((result) => {
                                        if (result) {

                                            getGroupsDrivers(ev)
                                                .then((newListOfGroupDrivers) => {

                                                    ev.listOfGroupDrivers = newListOfGroupDrivers;
                                                    if (contract.length) {
                                                        //first element
                                                        ev.contractId = contract._id;
                                                    };
                                                    listOfEvs.push(ev);
                                                    resolve(true);

                                                })
                                                .catch((error) => {

                                                    console.log(`[${context}] Error `, error.message);
                                                    resolve(false);

                                                });

                                        } else {

                                            getValidationGroupDrivers(ev, dateNow, groupDrivers)
                                                .then((result) => {
                                                    if (result) {
                                                        getGroupsDrivers(ev)
                                                            .then((newListOfGroupDrivers) => {

                                                                ev.listOfGroupDrivers = newListOfGroupDrivers;

                                                                if (contract) {
                                                                    //first element
                                                                    ev.contractId = contract._id;
                                                                };

                                                                listOfEvs.push(ev);
                                                                resolve(true);

                                                            })
                                                            .catch((error) => {

                                                                console.log(`[${context}] Error `, error.message);
                                                                resolve(false);

                                                            })
                                                    } else {

                                                        resolve(false);

                                                    };
                                                });

                                        };
                                    });
                            } else {

                                resolve(false);

                            };

                        };

                    }
                    catch (error) {

                        console.log(`[${context}] Error `, error.message);
                        resolve(false);

                    };

                });

            })
        ).then(() => {

            return res.status(200).send(listOfEvs);

        }).catch((error) => {

            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);

        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get contract find one by idtag
router.get('/api/private/contracts/byIdTag', (req, res, next) => {
    var context = "GET /api/private/contracts/byIdTag";
    try {
        let query

        if (Object.keys(req.body).length > 0)
            query = req.body
        else
            query = req.query


        query.active = true;
        console.log("query: ", query)
        contractsFindOne(query)
            .then(async (contractsFound) => {
                if (contractsFound) {

                    if (contractsFound.tariff !== undefined) {
                        var params = {
                            _id: contractsFound.tariff.planId
                        };
                        contractsFound = JSON.parse(JSON.stringify(contractsFound));
                        let tariffInfo = await getTariffCEME(params);
                        //let tariffRoamingInfo = await getTariffRoamingInfo(contract.tariffRoaming);
                        let tariffRoamingInfo = await getTariffCEMERoaming(contractsFound.tariffRoaming);
                        contractsFound.tariffRoamingInfo = tariffRoamingInfo;
                        /*let tariffRoamingInfo = await getTariffRoamingInfo(contractsFound.tariffRoaming);

                        contractsFound.tariffRoamingInfo = tariffRoamingInfo;*/
                        //.then((tariffInfo) => {
                        if (Object.keys(tariffInfo).length !== 0) {

                            if (contractsFound.tariff != undefined) {
                                tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                    return tariff.power = contractsFound.tariff.power
                                });
                            }
                            contractsFound.tariffInfo = tariffInfo;
                            return res.status(200).send(contractsFound);
                        }
                        else {
                            contractsFound.tariffInfo = {};
                            return res.status(200).send(contractsFound);
                        };
                        /*})
                        .catch((error) => {
                            console.log(`[${context}][getTariffCEME] Error `, error.message);
                            return res.status(500).send(error.message);
                        });*/

                    } else {

                        contractsFound.tariffInfo = {};
                        return res.status(200).send(contractsFound);

                    };

                }
                else {
                    return res.status(200).send({});
                };

            })
            .catch((error) => {
                console.log(`[${context}][contractsFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get contract find one by idtag - POST Version
router.post('/api/private/contracts/byIdTag', (req, res, next) => {
    var context = "GET /api/private/contracts/byIdTag";
    try {
        if (!req.body.query) return false;
        const query = req.body.query
        query.active = true;
        contractsFindOne(query)
            .then(async (contractsFound) => {
                if (contractsFound) {

                    if (contractsFound.tariff !== undefined) {
                        var params = {
                            _id: contractsFound.tariff.planId
                        };
                        contractsFound = JSON.parse(JSON.stringify(contractsFound));
                        let tariffInfo = await getTariffCEME(params);
                        let tariffRoamingInfo = await getTariffCEMERoaming(contractsFound.tariffRoaming);
                        contractsFound.tariffRoamingInfo = tariffRoamingInfo;
                        if (Object.keys(tariffInfo).length !== 0) {

                            if (contractsFound.tariff != undefined) {
                                tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                    return tariff.power = contractsFound.tariff.power
                                });
                            }
                            contractsFound.tariffInfo = tariffInfo;
                            return res.status(200).send(contractsFound);
                        }
                        else {
                            contractsFound.tariffInfo = {};
                            return res.status(200).send(contractsFound);
                        };

                    } else {

                        contractsFound.tariffInfo = {};
                        return res.status(200).send(contractsFound);

                    };

                }
                else {
                    return res.status(200).send({});
                };

            })
            .catch((error) => {
                console.log(`[${context}][contractsFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to get all contracts
router.get('/api/private/contracts/allContracts', (req, res, next) => {
    var context = "GET /api/private/contracts/allContracts";
    try {

        var query = {};
        contractsFind(query)
            .then((contractsFound) => {
                return res.status(200).send(contractsFound);
                /*
                if (contractsFound.length == 0)
                    return res.status(200).send(contractsFound);
                else {
                    contractsFound = JSON.parse(JSON.stringify(contractsFound));
                    Promise.all(
                        contractsFound.map(contract => {
                            return new Promise((resolve, reject) => {
                                if (contract.tariff !== undefined) {
                                    var params = {
                                        _id: contract.tariff.planId
                                    };
                                    getTariffCEME(params)
                                        .then((tariffInfo) => {
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
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getTariffCEME] Error `, error.message);
                                            reject(error);
                                        });
                                }
                                else {
                                    contract.tariffInfo = {};
                                    resolve(true);
                                }
                            });
                        })
                    ).then(() => {
                        return res.status(200).send(contractsFound);
                    });
                };
                */
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to get all contracts
router.get('/api/private/contracts/checkIdTagRFIDMobiE', (req, res, next) => {
    var context = "GET /api/private/contracts/checkIdTagRFIDMobiE";
    try {

        let received = req.query;

        console.log("idTag", received.idTag);

        var query = {
            networks: {
                $elemMatch: {
                    network: process.env.NetworkMobiE,
                    tokens: {
                        $elemMatch: {
                            status: process.env.NetworkStatusActive,
                            $or: [
                                { idTagDec: received.idTag },
                                { idTagHexa: received.idTag },
                                { idTagHexaInv: received.idTag }
                            ]
                        }
                    }
                }
            },
            active: true
        };

        //console.log("query", query);
        contractsFindOne(query)
            .then((result) => {
                if (result) {

                    return res.status(200).send(result);

                }
                else {

                    return res.status(200).send(null);

                };
            })
            .catch((error) => {

                console.log(`[${context}][contractsFindOne] Error `, error.message);
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/contracts/fleets', (req, res, next) => {
    var context = "GET /api/private/contracts/fleets";
    try {

        let userId = req.headers['userid'];
        let received = req.query;

        let query = {
            evId: received.evsId,
            active: true
        };

        Contract.find(query, async (err, contractsFound) => {
            if (err) {

                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);

            } else {

                let paymentMethods = await getPaymentMethods(userId);

                contractsFound = JSON.parse(JSON.stringify(contractsFound));
                let newListOvContracts = []
                //console.log("contractsFound", contractsFound);
                //return res.status(200).send(contractsFound);
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

                            console.log("contract", contract);

                            if (Object.keys(contract.tariff).length != 0) {
                                var params = {
                                    _id: contract.tariff.planId
                                };

                                let tariffInfo = await getTariffCEME(params);
                                let tariffRoamingInfo = await getTariffCEMERoaming(contract.tariffRoaming);
                                contract.tariffRoamingInfo = tariffRoamingInfo;

                                console.log("tariffInfo", tariffInfo);

                                if (Object.keys(tariffInfo).length != 0) {

                                    tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                        return tariff.power === contract.tariff.power
                                    });
                                    contract.tariffInfo = tariffInfo;
                                    newListOvContracts.push(contract)
                                    resolve(true);

                                } else {

                                    newListOvContracts.push(contract)
                                    resolve(false);

                                };

                            } else {

                                contract.tariffInfo = {};
                                newListOvContracts.push(contract)
                                resolve(true);

                            };

                        });
                    })
                ).then(() => {

                    newListOvContracts.sort((x, y) => { return x.default - y.default });
                    newListOvContracts.reverse();

                    return res.status(200).send(newListOvContracts);


                });
            };
        });


    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/contracts/checkPaymentMethodContract', (req, res, next) => {
    var context = "GET /api/private/contracts/checkPaymentMethodContract";
    try {

        let received = req.query;

        var query = {
            userId: received.userId,
            networks: {
                $elemMatch: {
                    paymentMethod: received.paymentMethod
                }
            },
            active: true
        };


        Contract.find(query, (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(result);
            };

        });

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//Endpoint to get all contracts with open physical card solicitations
router.get('/api/private/contracts/requestedPhysicalStateCards', (req, res, next) => {
    var context = "GET /api/private/contracts/requestedPhysicalStateCards";
    try {

        let query = {
            cardPhysicalState: false,
            networks: {
                $elemMatch: {
                    tokens: {
                        $elemMatch: {
                            tokenType: process.env.TokensTypeRFID,
                            idTagDec: { $exists: false },
                            idTagHexa: { $exists: false },
                            idTagHexaInv: { $exists: false },
                            $or: [
                                { status: process.env.NetworkStatusInactive },
                                { status: process.env.NetworkStatusToRequest },
                            ]
                        }
                    }
                }
            },
            active: true
        }

        Contract.find(query, (err, contracts) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }

            if (contracts) {
                if (contracts.length > 0) {

                    contracts.map(elem => {
                        elem.contract_id = elem.cardNumber
                    })

                    return res.status(200).send(contracts);
                } else {
                    return res.status(200).send([]);
                }
            } else {
                return res.status(400).send([]);
            }

        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/contracts/byParams', (req, res, next) => {
    var context = "GET /api/private/contracts/byParams";
    try {
        let query = req.query
        query.active = true
        contractsFind(query)
            .then((contractsFound) => {
                return res.status(200).send(contractsFound);
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/contracts/cardsOfUser', (req, res, next) => {
    contractsJHandler.getByUser(req, res)
});

router.get('/api/private/contracts/cardsOfAdmin', (req, res, next) => {
    contractsJHandler.getByAdmin(req, res)
});

router.get('/api/private/contracts/getEVIds', (req, res, next) => {
    contractsJHandler.getEVIds(req, res)
});

router.delete('/api/private/contracts/deleteContractWithoutEv', (req, res, next) => {
    contractsJHandler.deleteContractWithoutEv(req, res)
});

router.get('/api/private/contracts/:userId', async (req, res, next) => {
    var context = "GET /api/private/contracts";
    try {

        const userId = req.params.userId;

        contractsFind({ userId: userId, contractType: process.env.ContractTypeUser, active: true })
            .then(async (contractsFound) => {
                if (contractsFound.length == 0)
                    return res.status(200).send(contractsFound);
                else {

                    let paymentMethods = [];
                    contractsFound = JSON.parse(JSON.stringify(contractsFound));

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
                                    //let tariffRoamingInfo = await getTariffRoamingInfo(contract.tariffRoaming);
                                    let tariffRoamingInfo = await getTariffCEMERoaming(contract.tariffRoaming);
                                    contract.tariffRoamingInfo = tariffRoamingInfo;
                                    /*let tariffRoamingInfo = await getTariffRoamingInfo(contract.tariffRoaming);
                                    //.then((tariffInfo) => {
                                    //console.log("tariffInfo", tariffInfo);
                                    contract.tariffRoamingInfo = tariffRoamingInfo;*/
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
                                    /*})
                                    .catch((error) => {
                                        console.log(`[${context}][getTariffCEME] Error `, error.message);
                                        reject(error);
                                    });*/
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
                        
                        return res.status(200).send(contractsFound);


                    });
                };
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/contracts/networks/:evId', (req, res, next) => {
    var context = "GET /api/private/contracts/networks";

    const evId = req.params.evId;


    const query = {
        evId: evId,
        active: true
    };

    const fields = {
        networks: 1
    }

    Contract.findOne(query, fields, (err, contractsFound) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
            return res.status(500).send(err.message);
        }

        return res.status(200).send(contractsFound);
    })

});

//========== PATCH ==========
//Set Default contract
router.patch('/api/private/contracts/setDefault', (req, res, next) => {
    var context = "PATCH /api/private/contracts/setDefault";
    try {

        var contractId = req.body._id;
        var userId = req.headers['userid'];

        Contract.markAllAsNotDefault(userId, (err, result) => {
            if (err) {
                console.log(`[${context}][markAllAsNotDefault] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                Contract.markAsDefaultContract(contractId, userId, (err, result) => {
                    if (err) {
                        console.log(`[${context}][markAsDefaultContract] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {

                        var query = {
                            userId: userId
                        };

                        contractsFind(query)
                            .then((contractsFound) => {

                                contractsFound.sort((x, y) => { return x.default - y.default });
                                contractsFound.reverse();
                                return res.status(200).send(contractsFound);

                            })
                            .catch((error) => {
                                console.log(`[${context}] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                    };
                });
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Edit contract
router.patch('/api/private/contracts', (req, res, next) => {
    var context = "PATCH /api/private/contracts";
    try {
        //TODO
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Edit payment method in contract
router.patch('/api/private/contracts/paymentMethod', (req, res, next) => {
    var context = "PATCH /api/private/paymentMethod";
    try {
        var received = req.body;
        var userId = req.headers['userid'];
        var userType = req.headers['usertype'];

        if (!received.paymentMethod && userType !== 'b2b') {
            return res.status(400).send({ auth: false, code: 'contract_paymentMethod_required', message: 'Contract paymentMethod is required' });
        }
        var paymentMethod = received.paymentMethod;

        let query = {
            userId: userId,
            active: true,
            'networks.network': process.env.NetworkMobiE
        };

        let values = {
            'networks.$.paymentMethod': paymentMethod
        };

        Contract.findOne({ _id: received.contractId }, (err, contractFound) => {
            if (err) {

                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {
                if (contractFound) {

                    let mobie = contractFound.networks.find(network => {
                        return network.network === process.env.NetworkMobiE
                    });

                    let found = mobie.tokens.find(token => {
                        return (token.tokenType === process.env.TokensTypeApp_User && token.status !== process.env.NetworkStatusInactive);
                    });

                    if (found) {
                        Contract.updateMany(query, { $set: values }, (err, result) => {
                            if (err) {

                                console.log(`[${context}] Error `, err.message);
                                return res.status(500).send(err.message);

                            }
                            else {

                                if (result.n > 0) {
                                    return res.status(200).send({ auth: true, code: 'server_contract_updated', message: "Contract updated" });
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_contract_not_updated', message: "Contract not updated" });
                                };

                            };
                        });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_mobie_not_active', message: 'MobiE is not active' });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
                };
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Deactivate user contracts
router.patch('/api/private/deactivateContracts', async (req, res, next) => {
    const context = "PATCH /api/private/deactivateContracts";
    try {
        console.info(`[${context}] | Starting process`);
        const userId = req.headers['userid'];
        const message = req.body;

        const data = {
            userId: userId,
            message: message
        };

        const userFound = await User.findOne({ _id: userId });
        console.info(`[${context}] | User found: ${userId}`);

        //Verify accountDeletionRequested flag
        if(userFound && userFound.accountDeletionRequested) {
            console.log(`[${context}] | Processing account deletion for user: ${userId}`);
            await usersService.processAccountDeletion(userFound);
        }

        if(!UserHandler.isValidUserToBlock(userFound)) {
            console.error(`[${context}] | User can not be blocked: ${userId}`);
            return res.status(400).send({
                auth: false,
                code: 'user_can_not_be_blocked',
                message: 'User can not be blocked'
            });
        }

        await User.blockUser(userId, ReasonForBlockUser.ClientHasDebts);
        console.info(`[${context}] User blocked successfully | User: ${userId}`);

        if (message.bypassNotification !== true) {
            const debtValue = await calculateUserDebt(userId);
            console.info(`[${context}] | Debt value:`, JSON.stringify(debtValue));
            const dataValues = {
                currency: debtValue.currency,
                debtValue: debtValue.value.toString()
            }
            await notifyAccountSuspension(dataValues, userId);
        }

        const featureFlagEnabled = await toggle.isEnable('fleet-363-deactivate-and-activate-contracts');

        if (featureFlagEnabled) {
            console.log(`[${context}] Feature flag 'fleet-363-deactivate-and-activate-contracts' is enabled`);
            const tokenStatusService = new TokenStatusService();
            const tokensUpdated = await tokenStatusService.switchReasonByUserId({
                userId,
                activeBlock: true,
                reason: TokenStatusChangeReason.Debt,
                requestUserId: userId
            });

            if (!tokensUpdated) {
                console.error(`[${context}] | Error updating token status for user: ${userId}`);
                return res.status(400).send({
                    auth: false,
                    code: 'server_error',
                    message: "Internal server error"
                });
            }
        } else {
            await contractServices.updateContractStatusExternalNetworks(userId, false);
            console.info(`[${context}] | Contract status updated in external networks`);

            await contractServices.deleteCachedContractsByUser(userId);
            const tokenStatus = 'inactive';
            await Promise.all([
                contractServices.updateTokenStatusByUserId(userId, tokenStatus, TokenStatusChangeReason.DebtIncurred),
                usersService.handleStatusRfidCard(userFound, tokenStatus)
            ]);
        }

        console.log(`[${context}] | Process completed successfully for user: ${userId}`);
        return res.status(200).send({
            auth: true,
            code: 'server_contracts_deactivated',
            message: "Contracts successfully deactivated"
        });

    } catch (error) {
        console.error(`[${context}] Error`, error);
        Sentry.captureException(error);
        return res.status(500).send(error);
    }
});

//Active user contracts
router.patch('/api/private/activateContracts', async (req, res, next) => {
    var context = "PATCH /api/private/activateContracts";
    try {
        const userId = req.headers['userid'];
        let bypassNotification = req.body.bypassNotification;
        let userFound = await User.findOne({ _id: userId });

        var query = {
            _id: userId,
            blocked: true
        };
        const featureFlagEnabled = await toggle.isEnable('fleet-363-deactivate-and-activate-contracts');
        const tokenStatusService = new TokenStatusService();

        User.findOne(query, async (err, userFound) => {
            if (err) {
                console.log(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }

            if (!userFound) {
                console.log(`[${context}] | User not found for ID: ${userId}`);

                if (featureFlagEnabled) {
                    console.log(`[${context}] Feature flag 'fleet-363-deactivate-and-activate-contracts' is enabled`);
                    const tokensUpdated = await tokenStatusService.switchReasonByUserId({
                        userId,
                        activeBlock: false,
                        reason: TokenStatusChangeReason.Debt,
                        requestUserId: userId
                    });

                    if (!tokensUpdated) {
                        console.log(`[${context}] | No tokens updated for user: ${userId}`);
                        return res.status(400).send({
                            auth: false,
                            code: 'server_error',
                            message: "Tokens not updated"
                        });
                    }
                }
                else {
                    unlockUserContract(userId);
                }
                return res.status(200).send({ auth: true, code: 'server_contracts_activated', message: "Contracts successfully activated" });
            }

            User.unlockUser(userId, ReasonForUnblockUser.ContractActivated, async (err, result) => {
                if (err) {
                    console.log(`[${context}][unlockUser] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                if(!userFound.accountDeletionRequested && !featureFlagEnabled) {
                    const tokenStatus = 'active';
                    await Promise.all([
                        contractServices.updateTokenStatusByUserId(userId, tokenStatus, TokenStatusChangeReason.DebtCleared),
                        usersService.handleStatusRfidCard(userFound, tokenStatus)
                    ])
                }

                if (bypassNotification !== true) {
                    notifyAccountReactivation(userId);
                }

                if (featureFlagEnabled) {
                    const tokensUpdated = await tokenStatusService.switchReasonByUserId({
                        userId,
                        activeBlock: false,
                        reason: TokenStatusChangeReason.Debt,
                        requestUserId: userId
                    });

                    if (!tokensUpdated) {
                        console.log(`[${context}] | No tokens updated for user: ${userId}`);
                        return res.status(400).send({
                            auth: false,
                            code: 'server_error',
                            message: "Tokens not updated"
                        });
                    }
                }
                else {
                    await unlockUserContract(userId);
                }

                if (userFound.accountDeletionRequested) {
                    const lastClearance = userFound.deletionClearance?.at(-1);
                    const userRequestedDate = userFound.deletionClearance
                        ?.filter(clearance => clearance.reason === DeletionReason.USER_REQUESTED)
                        .at(-1)?.actionDate;

                    if (lastClearance && !lastClearance.isCleared && (lastClearance.reason === DeletionReason.USER_BLOCKED_DEBT || lastClearance.reason === DeletionReason.USER_BLOCKED) && userRequestedDate) {
                        try {
                            await usersService.adjustDeletionCountdownAfterDebtClearance(
                                userFound,
                                lastClearance.actionDate,
                                userRequestedDate
                            );
                        } catch (adjustError) {
                            console.log(`[${context}][adjustDeletionCountdownAfterDebtClearance] Error `, adjustError.message);
                            return res.status(500).send(adjustError.message);
                        }
                    }
                }

                await contractServices.deleteCachedContractsByUser(userId);

                return res.status(200).send({ auth: true, code: 'server_contracts_activated', message: "Contracts successfully activated" });
            });
        });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        Sentry.captureException(error);
        return res.status(500).send(error.message);
    }
});


router.patch('/api/private/contracts/updatePaymentRequestPhysicalCard', async (req, res, next) => {
    const context = "PATCH /api/private/contracts/updatePaymentRequestPhysicalCard";
    try {

        let payment = req.body;

        ContractHandler.updatePaymentRequestPhysicalCard(payment)
            .then((result) => {

                return res.status(200).send(result);

            })
            .catch((error) => {

                console.log(`[${context}][ContractHandler.updatePaymentRequestPhysicalCard] Error `, error.message);
                ErrorHandler.ErrorHandler(error, res);

            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//update payment method on MobiE whem payment method are removed
router.patch('/api/private/contracts/removePaymentMethod', async (req, res, next) => {
    var context = "PATCH /api/private/contracts/removePaymentMethod";
    try {
        var contract = req.body;
        var userId = req.headers['userid'];

        var query = {
            userId: userId,
            networks: {
                $elemMatch: {
                    paymentMethod: contract.paymentMethodId
                }
            }
        };

        var newValues = {
            $set: {
                'networks.$.paymentMethod': contract.newPaymentMethodId
            }
        };

        contractUpdate(query, newValues)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.log(`[${context}][contractUpdate] Error `, error.message);
                return res.status(500).send(error.message);
            });


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//update payment method on MobiE whem payment method are add
router.patch('/api/private/contracts/addPaymentMethod', async (req, res, next) => {
    var context = "PATCH /api/private/contracts/addPaymentMethod";
    try {

        var contract = req.body;
        var userId = req.headers['userid'];

        console.log("contract", contract);
        console.log("userId", userId);
        var query = {
            userId: userId,
            networks: {
                $elemMatch: {
                    network: process.env.NetworkMobiE,
                    paymentMethod: { "$exists": true, "$eq": "" },
                    tokens: {
                        $elemMatch: {
                            tokenType: process.env.TokensTypeApp_User,
                            status: { $ne: process.env.NetworkStatusInactive }
                        }
                    }
                }
            }
        };

        var newValues = {
            $set: {
                'networks.$.paymentMethod': contract.paymentMethodId
            }
        };

        contractUpdate(query, newValues)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.log(`[${context}][contractUpdate] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Internal Endpoint
router.patch('/api/private/contracts/updateLicensePlaceFleetContract', (req, res, next) => {
    var context = "PATCH /api/private/contracts/updateLicensePlaceFleetContract";
    try {

        let received = req.body;

        let query = {
            evId: received.evId
        };
        let newValues = {
            $set: {
                cardName: received.licensePlate
            }
        };

        Contract.updateContract(query, newValues, async (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                await deleteCachedContractsByUser(result?.userId);
                return res.status(200).send(result);
            }
        });


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Associate physical card
router.patch('/api/private/contracts/associatePhysicalCard', (req, res, next) => {
    const context = "PATCH /api/private/contracts/associatePhysicalCard";
    try {
        let userId = req.headers['userid'];

        let received = req.body;
        if (!received.idTagDec) {
            return res.status(400).send({ auth: false, code: 'idTagDec_required', message: 'idTagDec value is required' });
        }
        if (!received.idTagHexa) {
            return res.status(400).send({ auth: false, code: 'idTagHexa_required', message: 'idTagHexa value is required' });
        }
        if (!received.idTagHexaInv) {
            return res.status(400).send({ auth: false, code: 'idTagHexaInv_required', message: 'idTagHexaInv value is required' });
        }
        if (!received.contractId) {
            return res.status(400).send({ auth: false, code: 'contractId_required', message: 'contractId is required' });
        }

        let countryCode = "PT";
        let partyId = "EVI";
        let idTagDec = received.idTagDec;
        let idTagHexa = received.idTagHexa.toUpperCase();
        let idTagHexaInv = received.idTagHexaInv.toUpperCase()
        let cardNumber = received.cardNumber;

        let query = {
            $or: [
                {
                    networks: {
                        $elemMatch: {
                            tokens: {
                                $elemMatch: {
                                    idTagHexa: idTagHexa
                                }
                            }
                        }
                    }
                },
                {
                    networks: {
                        $elemMatch: {
                            tokens: {
                                $elemMatch: {
                                    idTagDec: idTagDec
                                }
                            }
                        }
                    }
                },
                {
                    networks: {
                        $elemMatch: {
                            tokens: {
                                $elemMatch: {
                                    idTagHexaInv: idTagHexaInv
                                }
                            }
                        }
                    }
                }
            ]
        };

        Contract.find(query, (err, result) => {
            if (err) {
                console.log(`[${context}][Contract.find] Error `, err.message);
                return res.status(500).send(err.message);
            };
            if (result.length > 0) {
                return res.status(400).send({ auth: false, code: 'server_card_tags_already_use', message: 'Card already in use in another contract' });
            } else {


                query = {
                    _id: received.contractId
                };

                Contract.findOne(query, async (err, contractFound) => {
                    if (err) {
                        console.log(`[${context}][Contract.find] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    if (contractFound) {

                        try {
                            const updatedContract = await associatePhysicalCard({
                                contract: contractFound,
                                cardNumber,
                                idTagDec,
                                idTagHexa,
                                idTagHexaInv
                            })
                            return res.status(200).send(updatedContract)
                        } catch (e) {
                            console.log(`[${context}] Error `, e.message);
                            return res.status(500).send(e.message);
                        }

                    } else {
                        return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
                    };

                });

            };

        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Edit associate physical card
router.patch('/api/private/contracts/editAssociatePhysicalCard', (req, res, next) => {
    var context = "PATCH /api/private/contracts/editAssociatePhysicalCard";

    var received = req.body;
    if (!received.idTagDec) {
        return res.status(400).send({ auth: false, code: 'idTagDec_required', message: 'idTagDec value is required' });
    }
    if (!received.idTagHexa) {
        return res.status(400).send({ auth: false, code: 'idTagHexa_required', message: 'idTagHexa value is required' });
    }
    if (!received.idTagHexaInv) {
        return res.status(400).send({ auth: false, code: 'idTagHexaInv_required', message: 'idTagHexaInv value is required' });
    }
    if (!received.contractId) {
        return res.status(400).send({ auth: false, code: 'contractId_required', message: 'contractId is required' });
    }

    let countryCode = "PT";
    let partyId = "EVI";
    let idTagDec = received.idTagDec;
    let idTagHexa = received.idTagHexa.toUpperCase();
    let idTagHexaInv = received.idTagHexaInv.toUpperCase()
    let cardNumber = received.cardNumber;

    let query = {
        _id: { $ne: received.contractId },
        $or: [
            {
                networks: {
                    $elemMatch: {
                        tokens: {
                            $elemMatch: {
                                idTagHexa: idTagHexa
                            }
                        }
                    }
                }
            },
            {
                networks: {
                    $elemMatch: {
                        tokens: {
                            $elemMatch: {
                                idTagDec: idTagDec
                            }
                        }
                    }
                }
            },
            {
                networks: {
                    $elemMatch: {
                        tokens: {
                            $elemMatch: {
                                idTagHexaInv: idTagHexaInv
                            }
                        }
                    }
                }
            }
        ]
    };

    Contract.find(query, (err, result) => {
        if (err) {
            console.log(`[${context}][Contract.find] Error `, err.message);
            return res.status(500).send(err.message);
        } else {

            if (result.length > 0) {
                return res.status(400).send({ auth: false, code: 'server_card_tags_already_use_edit', message: 'Card already in use in another contract' });
            } else {

                query = {
                    _id: received.contractId,
                    networks: {
                        $elemMatch: {
                            tokens: {
                                $elemMatch: {
                                    tokenType: process.env.TokensTypeRFID,
                                    wasAssociated: true
                                }
                            }
                        }
                    }
                };

                Contract.findOne(query, async (err, contractFound) => {
                    if (err) {

                        console.log(`[${context}][Contract.find] Error `, err.message);
                        return res.status(500).send(err.message);

                    } else {

                        if (contractFound) {

                            if (cardNumber === undefined || cardNumber === "") {
                                cardNumber = contractFound.cardNumber;
                            };

                            try {
                                const updatedContract = await editAssociatedPhysicalCard({
                                    contract: contractFound,
                                    cardNumber,
                                    idTagDec, idTagHexa, idTagHexaInv
                                })
                                return res.status(200).send(contractFound);
                            } catch (e) {
                                console.error(`[${context}] unexpected error`, e?.message)
                                return res.status(500).send(`Unexpected error ${e?.message}`)
                            }

                        } else {
                            return res.status(400).send({ auth: false, code: 'server_card_cannot_edited', message: 'Card cannot be edited' });
                        };

                    };
                });

            };

        };
    });

});

/**
 * @deprecated Since version 2.7.0. Will be deleted in version 3.0.0. Use xxx instead.
 */
router.patch('/api/private/contracts/validateCard_old', (req, res, next) => {
    var context = "PATCH /api/private/contracts/validateCard_old";
    console.warn("/api/private/contracts/validateCard_old - Calling deprecated function!");
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            userId: userId,
            cardNumber: received.cardNumber,
            nif: received.nif
        };
        contractsFindOne(query)
            .then(async (contractFound) => {
                if (contractFound) {

                    const clientName = contractFound.clientName;
                    //console.log("contractFound", contractFound);
                    contractFound.cardPhysicalState = true;

                    Promise.all(
                        contractFound.networks.map(network => {
                            return new Promise(async (resolve, reject) => {

                                if (network.network === process.env.NetworkEVIO) {
                                    console.log(network.network);

                                    let indexEVIO = network.tokens.indexOf(network.tokens.find(token => {
                                        return token.tokenType === process.env.TokensTypeRFID
                                    }))

                                    if (indexEVIO >= 0) {

                                        network.tokens[indexEVIO].status = process.env.NetworkStatusActive;
                                        resolve(true);

                                    } else {

                                        resolve(true);

                                    };

                                } else if (network.network === process.env.NetworkMobiE) {
                                    console.log(network.network);

                                    let { notInactive } = mobieNotInactive(contractFound, process.env.TokensTypeApp_User);

                                    if (notInactive) {

                                        let RFIDUid = await getTokenIdTag(contractFound, process.env.NetworkMobiE, process.env.TokensTypeRFID)
                                        let body = {
                                            "country_code": "PT",
                                            "party_id": "EVI",
                                            "type": process.env.TokensTypeRFID,
                                            "uid": RFIDUid,
                                            "valid": true
                                        }
                                        await updateMobieToken(body, contractFound.userId)
                                            .then(result => {
                                                if (result.data.code == 'success') {
                                                    //newValue = { $set: updateContractTokenStatus(contractFound, process.env.NetworkMobiE, 'active', process.env.TokensTypeRFID) };
                                                    //console.log(result.data.message)

                                                    // Send email to client with card activation
                                                    let indexMobiE = network.tokens.indexOf(network.tokens.find(token => {
                                                        return token.tokenType === process.env.TokensTypeRFID
                                                    }))

                                                    if (indexMobiE >= 0) {

                                                        network.tokens[indexMobiE].status = process.env.NetworkStatusActive;
                                                        resolve(true);

                                                    } else {

                                                        resolve(true);

                                                    };
                                                    let mailOptions = {
                                                        to: contractFound.email,
                                                        message: {
                                                            "username": contractFound.name,
                                                        },
                                                        type: "activeCard"
                                                    };
                                                    sendEmailClient(mailOptions, clientName)
                                                    resolve(true);
                                                }
                                            })
                                            .catch(err => {
                                                //envia email
                                                let email;
                                                if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'pre-production') {
                                                    email = process.env.EMAIL1
                                                }
                                                else {
                                                    email = process.env.EMAIL3
                                                };
                                                // Send email to EVIO with error card activation
                                                let mailOptions = {
                                                    to: email,
                                                    //subject: `EVIO - Erro Pedido Ativação Cartão`,
                                                    message: {
                                                        "username": contractFound.name,
                                                        "message": err.message
                                                    },
                                                    type: "activeCardError"
                                                };
                                                sendEmailClient(mailOptions, clientName)
                                                console.log(err.message)
                                                resolve(false);
                                            })

                                    } else {
                                        resolve(true);
                                    };

                                } else {

                                    console.log(network.network);

                                    let { notInactive } = internationNetworkNotInactive(contractFound, process.env.TokensTypeOTHER, network.network);

                                    if (notInactive) {

                                        let RFIDUid = await getTokenIdTagHexa(contractFound, network.network, process.env.TokensTypeRFID);

                                        let body = {
                                            "country_code": "PT",
                                            "party_id": "EVI",
                                            "type": process.env.TokensTypeRFID,
                                            "uid": RFIDUid,
                                            "valid": true
                                        };
                                        //console.log(RFIDUid)
                                        updateGireveToken(body, contractFound.userId)
                                            .then(() => {
                                                let indexInternationalNetwork = network.tokens.indexOf(network.tokens.find(token => {
                                                    return token.tokenType === process.env.TokensTypeRFID
                                                }))

                                                if (indexInternationalNetwork >= 0) {

                                                    network.tokens[indexInternationalNetwork].status = process.env.NetworkStatusActive;
                                                    resolve(true);

                                                } else {

                                                    resolve(true);

                                                };
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][contractsFindOne] Error `, error.message);
                                                reject(error);
                                            });

                                    } else {

                                        resolve(true);

                                    };

                                };

                            })
                        })
                    ).then(() => {

                        query = { _id: contractFound._id };
                        let newValues = { $set: contractFound };

                        Contract.findOneAndUpdate(query, newValues, { new: true }, (err, newContractFound) => {
                            if (err) {
                                console.log(`[${context}][contractsFindOne] Error `, err.message);
                                return res.status(500).send(err.message);
                            } else {
                                return res.status(200).send(newContractFound);
                            }
                        });

                    }).catch((error) => {
                        console.log(`[${context}][contractsFindOne] Error `, error.message);
                        return res.status(500).send(error.message);
                    })

                } else {
                    return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'NIF or card number not valid' });
                }
            })
            .catch((error) => {
                console.log(`[${context}][contractsFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to validate a card (Active card)
router.patch('/api/private/contracts/validateCard', async (req, res, next) => {
    const context = "PATCH /api/private/contracts/validateCard";

    try {

        const userId = req.headers['userid'];
        const clientName = req.headers['clientname'];
        const received = req.body;

        console.log("clientName", clientName);

        await contractServices.deleteCachedContractsByUser(userId);

        if (received.cardNumber)
            received.cardNumber = received.cardNumber.toUpperCase()

        switch (clientName) {

            case process.env.WhiteLabel:

                validateCardEVIO(userId, received, clientName, res);

                break;

            case process.env.WhiteLabelGoCharge:

                validateCardGoCharge(userId, received, clientName, res);

                break;

            case process.env.WhiteLabelHyundai:

                validateCardHyundai(userId, received, clientName, res);

                break;

            case process.env.WhiteLabelACP:

                validateCardACP(userId, received, clientName, res);

                break;

            case process.env.WhiteLabelKLC:

                validateCardEVIO(userId, received, clientName, res);

                break;

            case process.env.WhiteLabelKinto:

                validateCardEVIO(userId, received, clientName, res);

                break;

            default:

                validateCardEVIO(userId, received, clientName, res);

                break;

        };

    } catch (error) {

        console.log(`[${context}] Error`, error.message);
        return res.status(500).send(error.code && error.message ? error : { code: 'server_error', message: error.message });

    };

});

// Activates a specific network for a contract
router.patch('/api/private/contracts/activeNetwork', async (req, res) => {
    const context = "PATCH /api/private/contracts/activeNetwork";
    const ContractTypeUser = Commons.Enums.ContractTypes.User
    const NetworksCantInactivate = Commons.Constants.NetworksCantInactivate
    try {
        const userId = req.headers['userid'];
        const { network, contractId } = req.body;

        if (NetworksCantInactivate.includes(network)) {
            return res.status(400).send({ auth: false, code: 'server_contract_action_permited', message: 'Action not permited' });
        }

        const [contractFound, contractUserType] = await Promise.all([
            Contract.findOne({ _id: contractId, userId }).lean(),
            Contract.findOne({ userId, contractType: ContractTypeUser }).lean()
        ])

        if (!contractFound || !contractUserType) {
            return res.status(400).send({
                auth: false,
                code: 'server_contract_not_found',
                message: 'Contract not found for given parameters'
            });
        }

        const updatedContract = await activateNetworkFleet({
            fleetContract: contractFound,
            userContract: contractUserType,
            networkName: network,
            path: 'PATCH /api/private/contracts/activeNetwork'
        })
        return res.status(200).send(updatedContract)

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to inactive network
router.patch('/api/private/contracts/inactiveNetwork', async (req, res, next) => {
    const context = "PATCH /api/private/contracts/inactiveNetwork";
    try {

        let userId = req.headers['userid'];
        let received = req.body;

        let query = {
            _id: received.contractId,
            userId: userId
        };

        if (process.env.NetworksCantInactivate.includes(received.network)) {

            return res.status(400).send({ auth: false, code: 'server_contract_action_permited', message: 'Action not permited' });

        } else {

            const featureFlagEnabled = await toggle.isEnable('fleet-363-deactivate-and-activate-network');
            if (featureFlagEnabled) {
                console.log(`[${context}] Feature flag 'fleet-363-deactivate-and-activate-network' is enabled`);
                const { network: networkName, contractId } = received;
                const tokenStatusService = new TokenStatusService();
                const contract = await tokenStatusService.switchBlockNetwork({
                    contractId,
                    networkNames: [networkName],
                    activeBlock: true,
                    requestUserId: userId,
                    path: 'api/private/contracts/inactiveNetwork'
                });
                return res.status(200).send(contract);
            }

            contractsFindOne(query)
                .then(async (contractFound) => {

                    if (contractFound) {

                        query = {
                            _id: received.contractId
                        };

                        let appUserUid;
                        let body;

                        if (received.network === process.env.NetworkMobiE) {
                            //MobiE

                            appUserUid = await getTokenIdTag(contractFound, "MobiE", "APP_USER");

                            if (!appUserUid)
                                appUserUid = await getTokenIdTag(contractFound, "EVIO", "APP_USER");
                            body = {
                                "country_code": "PT",
                                "party_id": "EVI",
                                "type": "APP_USER",
                                "uid": appUserUid,
                                "valid": false
                            };

                            updateMobieToken(body, userId)
                                .then(async result => {

                                    if (result.data.auth === false) {
                                        return res.status(400).send(result.data);
                                    } else {

                                        let newContract = {
                                            'networks.$[i].tokens.$[j].status': process.env.NetworkStatusInactive
                                        };

                                        let arrayFilters = [
                                            { "i.network": process.env.NetworkMobiE },
                                            { "j.tokenType": "APP_USER" }
                                        ];

                                        Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters, new: true }, async (err, result) => {
                                            if (err) {
                                                console.log(`[${context}][] Error `, err.message);
                                                return res.status(500).send(err.message);
                                            }

                                            let found = contractFound.networks.find(network => {
                                                return network.tokens.find(token => {
                                                    return token.tokenType === process.env.TokensTypeRFID && network.network === received.network && token.status !== process.env.NetworkStatusInactive;
                                                })
                                            });

                                            if (found) {
                                                let token = found.tokens.find(tokens => tokens.tokenType == 'RFID')
                                                if (token.refId !== '') {
                                                    appUserUid = await getTokenIdTag(contractFound, "MobiE", "RFID");

                                                    if (!appUserUid)
                                                        appUserUid = await getTokenIdTag(contractFound, "EVIO", "RFID");

                                                    body = {
                                                        "country_code": "PT",
                                                        "party_id": "EVI",
                                                        "type": "RFID",
                                                        "uid": appUserUid,
                                                        "valid": false
                                                    };

                                                    updateMobieToken(body, userId)
                                                        .then(async response => {

                                                            if (response.data.auth === false) {
                                                                return res.status(400).send(response.data);
                                                            } else {

                                                                arrayFilters = [
                                                                    { "i.network": process.env.NetworkMobiE },
                                                                    { "j.tokenType": "RFID" }
                                                                ];

                                                                Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters, new: true }, async (err, newContract) => {
                                                                    if (err) {
                                                                        console.log(`[${context}][] Error `, err.message);
                                                                        return res.status(500).send(err.message);
                                                                    }

                                                                    await contractServices.deleteCachedContractsByUser(userId);

                                                                    return res.status(200).send(newContract);
                                                                });

                                                            }

                                                        })
                                                        .catch(error => {

                                                            if (error.response) {
                                                                return res.status(400).send(error.response.data);
                                                            } else {
                                                                console.log(`[${context}][updateMobieToken] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            };

                                                        })
                                                } else {
                                                    console.log("Hello???")
                                                    // DCL 26/07/2023 - case where was requested an RFID card but the card is in Status "toRequest" without any refId
                                                    arrayFilters = [
                                                        { "i.network": process.env.NetworkMobiE },
                                                        { "j.tokenType": "RFID" }
                                                    ];

                                                    Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters, new: true }, async (err, newContract) => {
                                                        if (err) {
                                                            console.log(`[${context}][] Error `, err.message);
                                                            return res.status(500).send(err.message);
                                                        }

                                                        await contractServices.deleteCachedContractsByUser(userId);

                                                        return res.status(200).send(newContract);
                                                    });
                                                }
                                            } else {
                                                await contractServices.deleteCachedContractsByUser(userId);

                                                return res.status(200).send(result);
                                            }

                                        });
                                    };

                                })
                                .catch(error => {

                                    if (error.response) {
                                        return res.status(400).send(error.response.data);
                                    } else {
                                        console.log(`[${context}][updateMobieToken] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    };

                                });

                        } else if (received.network === process.env.NetworkGireve) {
                            //International Network

                            console.log("received.network", received.network);

                            var RFIDUid = await getTokenIdTag(contractFound, received.network, process.env.TokensTypeOTHER);

                            console.log("RFIDUid", RFIDUid);
                            body = {
                                "type": process.env.TokensTypeOTHER,
                                "uid": RFIDUid,
                                "valid": false
                            };

                            updateGireveToken(body, userId)
                                .then(async result => {

                                    if (result.data.auth === false) {
                                        return res.status(400).send(result.data);
                                    } else {

                                        var newContract = {
                                            'networks.$[i].tokens.$[j].status': process.env.NetworkStatusInactive
                                        };

                                        var arrayFilters = [
                                            { "i.network": received.network },
                                            { "j.tokenType": "OTHER" }
                                        ];

                                        Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters, new: true }, async (err, newContract) => {
                                            if (err) {
                                                console.log(`[${context}][] Error `, err.message);
                                                return res.status(500).send(err.message);
                                            }

                                            let found = contractFound.networks.find(network => {
                                                return network.tokens.find(token => {
                                                    return token.tokenType === process.env.TokensTypeRFID && network.network === received.network && token.status !== process.env.NetworkStatusInactive;
                                                })
                                            });

                                            if (found) {


                                                RFIDUid = await getTokenIdTagHexa(contractFound, received.network, process.env.TokensTypeRFID);

                                                body = {
                                                    "type": process.env.TokensTypeRFID,
                                                    "uid": RFIDUid,
                                                    "valid": false
                                                };

                                                updateGireveToken(body, userId)
                                                    .then(async result => {

                                                        newContract = {
                                                            'networks.$[i].tokens.$[j].status': process.env.NetworkStatusInactive
                                                        };

                                                        arrayFilters = [
                                                            { "i.network": received.network },
                                                            { "j.tokenType": "RFID" }
                                                        ];

                                                        Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters, new: true }, async (err, newContract) => {
                                                            if (err) {
                                                                console.log(`[${context}][] Error `, err.message);
                                                                return res.status(500).send(err.message);
                                                            }

                                                            await contractServices.deleteCachedContractsByUser(userId);

                                                            return res.status(200).send(newContract);
                                                        });

                                                    })
                                                    .catch(error => {

                                                        if (error.response) {
                                                            return res.status(400).send(error.response.data);
                                                        } else {
                                                            console.log(`[${context}][updateMobieToken] Error `, error.message);
                                                            return res.status(500).send(error.message);
                                                        };

                                                    });

                                            } else {
                                                await contractServices.deleteCachedContractsByUser(userId);

                                                return res.status(200).send(newContract);
                                            }

                                        });
                                    }

                                })
                                .catch(error => {

                                    if (error.response) {
                                        return res.status(400).send(error.response.data);
                                    } else {
                                        console.log(`[${context}][updateMobieToken] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    };

                                });

                        } else if (received.network === process.env.NetworkEVIO) {

                            console.log("received.network", received.network)

                            let newContract = {
                                'networks.$[i].tokens.$[j].status': process.env.NetworkStatusInactive,
                                'networks.$[k].tokens.$[j].status': process.env.NetworkStatusInactive,
                                'networks.$[l].tokens.$[j].status': process.env.NetworkStatusInactive,
                                'networks.$[m].tokens.$[j].status': process.env.NetworkStatusInactive,
                                'networks.$[n].tokens.$[j].status': process.env.NetworkStatusInactive,
                            };

                            let arrayFilters = [
                                { "i.network": received.network },
                                { "k.network": process.env.NetworkGoCharge },
                                { "l.network": process.env.NetworkHyundai },
                                { "m.network": process.env.NetworkKLC },
                                { "n.network": process.env.NetworkKinto },
                                { "j.tokenType": "APP_USER" }
                            ];

                            Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters, new: true }, async (err, result) => {
                                if (err) {
                                    console.log(`[${context}][] Error `, err.message);
                                    return res.status(500).send(err.message);
                                };

                                let found = contractFound.networks.find(network => {
                                    return network.tokens.find(token => {
                                        return token.tokenType === process.env.TokensTypeRFID && network.network === received.network && token.status !== process.env.NetworkStatusInactive;
                                    })
                                });

                                if (found) {

                                    arrayFilters = [
                                        { "i.network": received.network },
                                        { "k.network": process.env.NetworkGoCharge },
                                        { "l.network": process.env.NetworkHyundai },
                                        { "m.network": process.env.NetworkKLC },
                                        { "n.network": process.env.NetworkKinto },
                                        { "j.tokenType": "RFID" }
                                    ];

                                    Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters, new: true }, async (err, newContract) => {
                                        if (err) {
                                            console.log(`[${context}][] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }

                                        await contractServices.deleteCachedContractsByUser(userId);

                                        return res.status(200).send(newContract);
                                    });

                                } else {
                                    await contractServices.deleteCachedContractsByUser(userId);

                                    return res.status(200).send(result);
                                }

                            });

                        } else {

                            console.log("received.network", received.network)

                            let newContract = {
                                'networks.$[i].tokens.$[j].status': process.env.NetworkStatusInactive
                            };

                            let arrayFilters = [
                                { "i.network": received.network },
                                { "j.tokenType": "APP_USER" }
                            ];

                            Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters, new: true }, async (err, result) => {
                                if (err) {
                                    console.log(`[${context}][] Error `, err.message);
                                    return res.status(500).send(err.message);
                                };

                                let found = contractFound.networks.find(network => {
                                    return network.tokens.find(token => {
                                        return token.tokenType === process.env.TokensTypeRFID && network.network === received.network && token.status !== process.env.NetworkStatusInactive;
                                    })
                                });

                                if (found) {

                                    arrayFilters = [
                                        { "i.network": received.network },
                                        { "j.tokenType": "RFID" }
                                    ];

                                    Contract.updateContractWithFilters(query, { $set: newContract }, { arrayFilters: arrayFilters, new: true }, async (err, newContract) => {
                                        if (err) {
                                            console.log(`[${context}][] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }
                                        await contractServices.deleteCachedContractsByUser(userId);

                                        return res.status(200).send(newContract);
                                    });

                                } else {
                                    await contractServices.deleteCachedContractsByUser(userId);

                                    return res.status(200).send(result);
                                }

                            });

                        }

                    } else {
                        return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
                    };

                })
                .catch((error) => {
                    console.log(`[${context}][contractsFindOne] Error `, error.message);
                    return res.status(500).send(error.message);
                });
        };

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Cancel RFID card
router.patch('/api/private/contracts/cancelRFID', async (req, res, next) => {
    const context = "PATCH /api/private/contracts/cancelRFID";
    try {
        let contractId = req.body.contractId;
        let reason = req.body.reason;
        const isNewCard = req.body.isNewCard ?? false
        const userId = req.headers.userid

        if (isNewCard && !(await validatePaymentMethod(userId))) {
            return res.status(400).send({ code: 'server_paymentMethod_or_wallet_required', message: "Payment method or Wallet with more than 30€ required", redirect: "payments" })
        }

        const contract = await ContractHandler.cancelRFID(contractId, reason, userId, isNewCard);

        await contractServices.deleteCachedContractsByUser(contract?.userId);

        const tokenStatusService = new TokenStatusService();
        return res.status(200).send({
            contract: {
                ...contract,
                rfidUIState: tokenStatusService.getRfidUIStateDisabled()
            },
            message: { success: true, code: 'cancel_card_success', message: 'The card has been cancelled. All set!' }
        });
    } catch (error) {
        console.log(`[${context}][ContractHandler.cancelRFID] Error `, error.message);
        Sentry.captureException(error);
        return res.status(500).send({
            success: false,
            code: 'cancel_card_failure',
            message: "Looks like the cancellation didn’t go through. Let’s try again!"
        });
    };
});

//Update card physical state info
router.patch('/api/private/contracts/cardPhysicalStateInfo', (req, res, next) => {
    const context = "PATCH /api/private/contracts/cardPhysicalStateInfo";
    try {

        ContractHandler.updateCardPhysicalStateInfo(req.body)
            .then((result) => {

                return res.status(200).send(result);

            })
            .catch((error) => {

                console.log(`[${context}][ContractHandler.updateCardPhysicalStateInfo] Error `, error.message);
                ErrorHandler.ErrorHandler(error, res);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res);
    };
});

router.patch('/api/private/contracts/blockRFIDCard', async (req, res, next) => {
    const context = "PATCH /api/private/contracts/blockRFIDCard";
    try {
        ContractHandler.blockRFID(req)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.log(`[${context}][ContractHandler.blockRFID] Error `, error.message);
                ErrorHandler.ErrorHandler(error, res);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res);
    };
});

router.patch('/api/private/contracts/unlockRFIDCard', async (req, res, next) => {
    const context = "PATCH /api/private/contracts/unlockRFIDCard";
    try {
        ContractHandler.unlockRFID(req)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.log(`[${context}][ContractHandler.unlockRFIDCard] Error `, error.message);
                ErrorHandler.ErrorHandler(error, res);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res);
    };
});

//========== PUT ==========
//Endpoint to Change the ceme tariff on a user's contracts
router.put('/api/private/contracts', (req, res, next) => {
    var context = "PUT /api/private/contracts";
    try {

        const userId = req.body.userId;
        const planCemeId = req.body.planCemeId;
        const power = req.body.power;

        if (!userId) {
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });
        };

        if (!planCemeId) {
            return res.status(400).send({ auth: false, code: 'server_plan_ceme_id_required', message: 'Plan ceme id is required' });
        };

        if (!power) {
            return res.status(400).send({ auth: false, code: 'server_power_required', message: 'Power is required' });
        };

        var tariff = {
            tariff: {
                planId: planCemeId,
                power: power
            }
        };

        Contract.updateMany({ userId: userId }, { $set: tariff }, (err, result) => {
            if (err) {
                console.log(`[${context}][] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result.n === result.nModified) {
                    return res.status(200).send({ auth: false, code: 'server_contracts_updated', message: 'Contracts updated' });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_contracts_not_updated', message: 'Contracts nor updateds' });
                }
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoit to reset contract in virtual type
router.put('/api/private/contracts/toVirtualType', (req, res, next) => {
    var context = "PUT /api/private/contracts/toVirtualType";
    try {

        var received = req.body;

        const query = {
            _id: received.contractId
        };
        const fields = {
            _id: 1,
            cardPhysicalState: 1,
            cardType: 1,
            networks: 1,
            contractIdInternationalNetwork: 1,
            userId: 1,
            contractType: 1
        }

        Contract.findOne(query, fields, (err, contractFound) => {
            if (err) {
                console.log(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (contractFound) {
                    Promise.all(
                        contractFound.networks.map(network => {
                            return new Promise((resolve, reject) => {

                                network.tokens = network.tokens.filter(token => {
                                    return token.tokenType !== process.env.TokensTypeRFID;
                                })
                                resolve(true);
                            })
                        })
                    ).then(() => {
                        Promise.all(
                            contractFound.contractIdInternationalNetwork.map(contractId => {
                                return new Promise((resolve, reject) => {

                                    contractId.tokens = contractId.tokens.filter(token => {
                                        return token.tokenType !== process.env.TokensTypeRFID;
                                    })
                                    resolve(true);
                                })
                            })
                        ).then(() => {
                            contractFound.cardPhysicalState = false;
                            contractFound.cardType = process.env.CardTypeVirtual;

                            Contract.findOneAndUpdate(query, { $set: contractFound }, { new: true }, (err, newContract) => {
                                if (err) {
                                    console.log(`[${context}][findOneAndUpdate] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                else {
                                    return res.status(200).send(newContract);
                                }
                            });
                        });
                    })

                } else {
                    return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
                };
            }
        })

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.put('/api/private/contracts/updatePaymentMethod', async (req, res, next) => {
    let context = "PATCH /api/private/contracts/updatePaymentMethod";
    try {

        ContractHandler.updatePaymentMethod(req)
            .then((result) => {

                return res.status(200).send(result);

            })
            .catch((error) => {

                console.log(`[${context}][ContractHandler.updatePaymentMethod] Error `, error.message);
                ErrorHandler.ErrorHandler(error, res);

            });
        /*let paymentMethodId = req.body.paymentMethodId;
        let userId = req.body.userId;

        /*console.log("contract", paymentMethodId);
        console.log("userId", userId);
        let query = {
            userId: userId,
            networks: {
                $elemMatch: {
                    //network: process.env.NetworkMobiE,
                    //paymentMethod: { "$exists": true, "$eq": "" },
                    tokens: {
                        $elemMatch: {
                            tokenType: process.env.TokensTypeApp_User,
                            status: { $ne: process.env.NetworkStatusInactive }
                        }
                    }
                }
            }
        };

        let newValues = {
            $set: {
                'networks.$.paymentMethod': paymentMethodId
            }
        };

        Contract.updateMany(query, newValues)
            .then((result) => {
                //console.log(result);
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.log(`[${context}][contractUpdate] Error `, error.message);
                return res.status(500).send(error.message);
            });*/

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.put('/api/private/contracts/cancelPhysicalCards', (req, res, next) => {
    contractsJHandler.putCancelPhysicalCard(req, res)
});

router.put('/api/private/contracts/cardsToProcessStatusUpdate', (req, res, next) => {
    contractsJHandler.putChangeStatusToProcess(req, res)
});

router.put('/api/private/contracts/cardsChangeCard', (req, res, next) => {
    contractsJHandler.putCard(req, res)
});

//========== DELETE ==========
//Endpoint to remove a contract
router.delete('/api/private/contracts', (req, res, next) => {
    const context = "DELETE /api/private/contracts";

    try {

        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id,
            userId: userId
        };

        contractDelete(query)
            .then(async (result) => {

                await contractServices.deleteCachedContractsByUser(userId);

                var query = {
                    userId: userId
                };

                contractsFind(query)
                    .then((contractsFound) => {

                        contractsFound.sort((x, y) => { return x.default - y.default });
                        contractsFound.reverse();
                        return res.status(200).send(contractsFound);

                    })
                    .catch((error) => {
                        console.log(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });


            })
            .catch((error) => {
                console.log(`[${context}][contractDelete] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Deactivate contract fleet
router.delete('/api/private/contracts/contractTypeFleet', (req, res, next) => {
    var context = "DELETE /api/private/contracts/contractTypeFleet";
    try {

        let query = req.body;
        console.log("query", query);

        let newValues = {
            $set: {
                status: process.env.ContractStatusInactive,
                active: false
            }
        };

        Contract.updateContract(query, newValues, (err, reuslt) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(reuslt);
            };
        });


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Delete contract fleet
router.delete('/api/private/contracts/deleteContractTypeFleet', (req, res, next) => {
    var context = "DELETE /api/private/contracts/deleteContractTypeFleet";
    try {

        let query = req.body;

        deactivateContract(query)

        Contract.findOneAndDelete(query, async (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                console.debug(`[${context}] Contract deleted: ${result}`);
                if (result && result.userId) {
                    await contractServices.deleteCachedContractsByUser(result.userId);
                } else {
                    console.log(`[${context}] Contract not found using query=${query}`, { query });
                }

                return res.status(200).send(result);
            }
        });


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//========== FUNCTION ==========

function mobieNotInactive(contract, tokenType) {
    for (const network of contract.networks) {
        if (network.network === process.env.NetworkMobiE) {
            for (const token of network.tokens) {
                if (token.tokenType === tokenType && token.status !== 'inactive') {
                    return { notInactive: true }
                }
            }
            return { notInactive: false }
        }
    }
};

function internationNetworkNotInactive(contract, tokenType, networkToFound) {

    for (const network of contract.networks) {
        if (network.network === networkToFound) {
            for (const token of network.tokens) {
                if (token.tokenType === tokenType && token.status !== 'inactive') {
                    return { notInactive: true }
                }
            }
            return { notInactive: false }
        }
    }


};

function contractsFindOne(query) {
    var context = "Function contractsFindOne";
    return new Promise(async (resolve, reject) => {
        const contractFound = await Contract.findOne(query).lean();
        resolve(contractFound);
    });
};

function getTokenIdTag(obj, networkName, tokenType) {
    return new Promise((resolve, reject) => {
        for (let network of obj.networks) {
            if (network.network === networkName) {
                for (let token of network.tokens) {
                    if (token.tokenType === tokenType) {
                        if (token.idTagDec !== null && token.idTagDec !== '') {
                            resolve(token.idTagDec);
                        } else if (token.idTagHexa !== null && token.idTagHexa !== '') {
                            resolve(token.idTagHexa);
                        } else if (token.idTagHexaInv !== null && token.idTagHexaInv !== '') {
                            resolve(token.idTagHexaInv);
                        } else {
                            resolve(false);
                        }
                    }
                }
            }
        }
    });

};

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

};

function contractUpdate(query, newValue) {
    var context = "Function contractUpdate";
    return new Promise((resolve, reject) => {
        Contract.updateContract(query, newValue, (err, result) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function getTariffCEME(params) {
    const context = "Function getTariffCEME";
    const host = `${process.env.HostTariffCEME}${process.env.PathTariffCEME}`;

    console.log(`[${context}] contracts `, params);

    return axios.get(host, { params })
        .then((result) => {
            if (Object.keys(result.data).length !== 0 && result.data.schedule.tariffType === process.env.TariffTypeBiHour) {
                // Remove out of empty schedules
                result.data = JSON.parse(JSON.stringify(result.data));
                /*result.data.schedule.schedules = result.data.schedule.schedules.filter(schedule => {
                        return schedule.tariffType === process.env.TariffEmpty;
                });*/
            }

            return result.data;
        })
        .catch((error) => {
            console.log(`[${context}] contracts Error `, error.message);
            throw error;
        });
}

//Function to get all all groups of charger station users by query
function groupCSUsersFind(query) {
    var context = "Function groupCSUsersFind";
    return new Promise((resolve, reject) => {
        GroupCSUsers.find(query, (err, groupCSUsersFound) => {
            if (err) {
                console.log(`[${context}][findOnde] Error `, err.message);
                reject(err);
            }
            else {
                resolve(groupCSUsersFound);
            };
        });
    });
};

//Funtion to find one group
function groupCSUsersFindOne(query) {
    var context = "Function groupCSUsersFindOne";
    return new Promise((resolve, reject) => {
        GroupCSUsers.findOne(query, (err, groupCSUsersFound) => {
            if (err) {
                console.log(`[${context}][findOnde] Error `, err.message);
                reject(err);
            }
            else {
                resolve(groupCSUsersFound);
            };
        });
    });
};

function contractDelete(query) {
    var context = "Function contractDelete";
    return new Promise((resolve, reject) => {
        Contract.removeContracts(query, (err, result) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

//Create virutal card
function createVirtualCard(form, userId) {
    return new Promise(async (resolve, reject) => {

        var name = form.name.split(" ");

        let CEME = await getCEMEEVIOADHOC("EVIO");


        let idTagDecEVIO = await getRandomIdTag(100_000_000_000, 999_999_999_999);
        let idTagDecMobiE = await getRandomIdTag(100_000_000_000, 999_999_999_999);

        var tariff = {
            power: "all",
            planId: CEME.plan._id
        };

        var newContract = new Contract(form);

        newContract.cardName = name[0] + " " + name[name.length - 1];
        newContract.cardType = process.env.CardTypeVirtual;
        newContract.userId = userId;
        newContract.tariff = tariff;

        if (process.env.NODE_ENV === 'production') {
            newContract.imageCEME = process.env.HostProdContrac + 'ceme/cemeEVIO.jpg'; // For PROD server
            newContract.imageCard = process.env.HostProdContrac + 'card/cardEVIO.jpg';
            newContract.fontCardBlack = false;
        }
        else if (process.env.NODE_ENV === 'pre-production') {
            newContract.imageCEME = process.env.HostPreProdContrac + 'ceme/cemeEVIO.jpg'; // For PROD server
            newContract.imageCard = process.env.HostPreProdContrac + 'card/cardEVIO.jpg';
            newContract.fontCardBlack = false;
        } else {
            newContract.imageCEME = process.env.HostQAContrac + 'ceme/cemeEVIO.jpg'; // For QA server
            newContract.imageCard = process.env.HostQAContrac + 'card/cardEVIO.jpg';
            newContract.fontCardBlack = false;
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
                isVisible: false
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
                isVisible: (clientName === process.env.WhiteLabelGoCharge || clientName === process.env.WhiteLabelHyundai) ? true : false
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
                isVisible: clientName === process.env.WhiteLabelKLC
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
                isVisible: clientName === process.env.WhiteLabelKinto
            }
        ];

        newContract.networks = networks;

        resolve(newContract);
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
                console.log(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
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
            case process.env.WhiteLabelKLC:
                params = {
                    planName: "server_plan_EVIO_ad_hoc_klc"
                };
                break;
            case process.env.WhiteLabelKinto:
                params = {
                    planName: "server_plan_EVIO_ad_hoc_kinto"
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
                console.log(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
};

function getCEMEEVIONormal(planName) {
    var context = "Function getCEMEEVIONormal";
    return new Promise((resolve, reject) => {

        var params = {
            planName: planName
        };

        var host = process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data[0]);
            })
            .catch((error) => {
                console.log(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
};

export async function updateCemeTariff(newContractUpdate) {
    var context = "Function updateCemeTariff";

    return new Promise(async (resolve, reject) => {

        let user = await User.findOne({ _id: newContractUpdate.userId }, { _id: 1, userType: 1, clientName: 1 });

        let cemeEVIO;

        /*switch (user.clientName) {
            case process.env.WhiteLabelGoCharge:
                if (user.userType === process.env.UserTypeCompany) {
                    cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_company_goCharge");
                } else {
                    cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_finalCostumer_goCharge");
                };
                break;
            case process.env.WhiteLabelHyundai:
                if (user.userType === process.env.UserTypeCompany) {
                    cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_company_hyundai");
                } else {
                    cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_finalCostumer_hyundai");
                };
                break;
            default:
                if (user.userType === process.env.UserTypeCompany) {
                    cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_company");
                } else {
                    cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO");
                };
                break;
        };*/

        switch (user.clientName) {
            case process.env.WhiteLabelGoCharge:
                cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_ad_hoc_goCharge");
                break;
            case process.env.WhiteLabelHyundai:
                cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_ad_hoc_hyundai");
                break;
            case process.env.WhiteLabelKLC:
                cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_ad_hoc_klc");
                break;
            case process.env.WhiteLabelKinto:
                cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_ad_hoc_kinto");
                break;
            default:
                cemeEVIO = await getCEMEEVIONormal("server_plan_EVIO_ad_hoc");
                break;
        };

        let newValues = {
            tariff: {
                power: 'all',
                planId: cemeEVIO.plan._id
            }
        }

        Contract.findOneAndUpdate({ _id: newContractUpdate._id }, { $set: newValues }, { new: true }, (err, contractUpdated) => {
            if (err) {
                console.log(`[${context}][ Contract.updateContract] Error `, err.message);
                resolve(newContractUpdate);
            } else {

                if (contractUpdated) {
                    CEMETariff.updateCEMETariff({ userId: newContractUpdate.userId }, { $set: newValues }, (err, result) => {

                        if (err) {
                            console.log(`[${context}] Error `, err.message);
                            resolve(contractUpdated);
                        }
                        if (result) {
                            console.log("Session updated")
                            resolve(contractUpdated);
                        } else {
                            console.log("Session not updated")
                            resolve(contractUpdated);
                        }

                    });

                } else {
                    console.log("Session not updated");
                    resolve(newContractUpdate);
                }

            };
        });

    })

};

function getUserContractCEME(userId) {
    var context = "Function getUserContractCEME";
    return new Promise((resolve, reject) => {

        let query = {
            userId: userId,
            contractType: process.env.ContractTypeUser
        }

        Contract.findOne(query, (err, userContract) => {
            if (err) {
                console.error(`[] Error `, err.message);
                reject(err.message);
            }
            else {
                if (userContract) {
                    resolve(userContract)
                }
                else {
                    resolve();
                };
            };
        });

    });
};

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
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

function requestPhysicalCard(contract, userId) {
    const context = "Function requestPhysicalCard";
    return new Promise(async (resolve, reject) => {
        try {

            let query = {
                _id: contract._id
            };

            let contractFound = await contractsFindOne(query);

            contractFound.shippingAddress = contract.address;

            let response = await contractUpdate(query, { $set: { shippingAddress: contract.address } });

            if (contractFound) {

                if (contractFound.firstPhysicalCard || contractFound.cardPhysicalPaymentStateInfo === process.env.CARDPHYSICALPAYMENTSTATEINFOFREE) {

                    let found = contractFound.networks.find(network => {
                        return network.network === process.env.NetworkMobiE && network.tokens.find(token => {
                            return token.tokenType === process.env.TokensTypeRFID && (token.status === process.env.NetworkStatusToRequest || token.status === process.env.NetworkStatusActive)
                        })
                    });

                    if (found) {

                        resolve(contractFound);

                    } else {

                        var newToken = {
                            tokenType: process.env.TokensTypeRFID,
                            status: 'toRequest',
                            refId: ""
                        }

                        contractFound.cardType = process.env.CardTypeVirtualPhysical;
                        contractFound.cardPhysicalStateInfo = process.env.CARDPHYSICALSTATEINFOREQUESTEDBYCUSTOMER;
                        contractFound.requestDate = new Date();

                        Promise.all(
                            contractFound.networks.map(network => {
                                return new Promise(async (resolve, reject) => {

                                    if (process.env.NetworksEVIO.includes(network.network)) {

                                        network.paymentMethod = contract.paymentMethod;
                                        network.tokens.push(newToken);
                                        resolve(true);

                                    } else if (network.network === process.env.NetworkMobiE) {

                                        let { notInactive } = mobieNotInactive(contractFound, process.env.TokensTypeApp_User)
                                        network.paymentMethod = contract.paymentMethod;
                                        newToken.status = notInactive ? 'toRequest' : 'inactive'
                                        network.tokens.push(newToken);
                                        resolve(true);

                                    } else {

                                        let index = contractFound.contractIdInternationalNetwork.indexOf(contractFound.contractIdInternationalNetwork.find(contract => {
                                            return contract.network === network.network;
                                        }));

                                        if (index >= 0) {
                                            contractFound.contractIdInternationalNetwork[index].tokens.push({ tokenType: process.env.TokensTypeRFID, contract_id: "" })
                                        }
                                        let { notInactive } = internationNetworkNotInactive(contractFound, process.env.TokensTypeOTHER, network.network);

                                        network.paymentMethod = contract.paymentMethod;
                                        newToken.status = notInactive ? 'toRequest' : 'inactive';
                                        network.tokens.push(newToken);
                                        resolve(true);

                                    };
                                });
                            })
                        ).then(() => {

                            let newValues = { $set: contractFound };
                            contractUpdate(query, newValues)
                                .then(async (result) => {

                                    let contractFound = await contractsFindOne(query);

                                    sendEmailEVIO(contractFound, contract.address);

                                    resolve(contractFound);

                                })
                                .catch((error) => {
                                    console.log(`[${context}][contractUpdate] Error `, error.message);
                                    reject(error);
                                });

                        }).catch(error => {
                            console.log(`[${context}] Error `, error.message);
                            reject(error);
                        })

                    };

                } else {
                    // this should be temporary
                    reject({ auth: false, code: 'server_failed_request_physicalCard', message: 'User already has an active RFID Card' });

                    // The following code is still not tested so it can't be active in prod
                    /*
                    let excl_vat = contractFound.amountChargeToRequestPayent.value - (contractFound.amountChargeToRequestPayent.value * 0.23);

                    let userFound = await User.findOne({ _id: contractFound.userId })
                    let body = {
                        amount: contractFound.amountChargeToRequestPayent,
                        userId: contractFound.userId,
                        totalPrice: {
                            excl_vat: excl_vat,
                            incl_vat: contractFound.amountChargeToRequestPayent.value
                        },
                        clientName: contractFound.clientName,
                        userIdToBilling: contractFound.userId,
                        contractId: contractFound._id,
                        clientType: userFound.clientType
                    }

                    let payment = await createPayment(body)

                    //console.log("payment", payment);

                    switch (payment) {

                        case process.env.PAYMENTRESPONSEPAID:

                            let billingProfile = await BillingProfileHandler.getBillingProfile(contractFound.userId);

                            if (billingProfile.billingPeriod === process.env.PaymentPeriodAD_HOC) {
                                sendToBilling(contractFound)
                            }

                            let found = contractFound.networks.find(network => {
                                return network.network === process.env.NetworkMobiE && network.tokens.find(token => {
                                    return token.tokenType === process.env.TokensTypeRFID && (token.status === process.env.NetworkStatusToRequest || token.status === process.env.NetworkStatusActive)
                                })
                            });

                            //console.log("found", found)
                            if (found) {

                                resolve(contractFound);

                            } else {

                                var newToken = {
                                    tokenType: process.env.TokensTypeRFID,
                                    status: 'toRequest',
                                    refId: ""
                                }

                                contractFound.cardType = process.env.CardTypeVirtualPhysical;
                                contractFound.cardPhysicalPaymentStateInfo = process.env.CARDPHYSICALPAYMENTSTATEINFOPAID;
                                contractFound.cardPhysicalStateInfo = process.env.CARDPHYSICALSTATEINFOREQUESTEDBYCUSTOMER;
                                contractFound.requestDate = moment(new Date()).format("DD-MM-YYYY");
                                contractFound.cardPhysicalPaymentId = payment._id

                                console.log("contractFound.cardPhysicalPaymentId", contractFound.cardPhysicalPaymentId);

                                Promise.all(
                                    contractFound.networks.map(network => {
                                        return new Promise(async (resolve, reject) => {

                                            //if (network.network === process.env.NetworkEVIO) {
                                            if (process.env.NetworksEVIO.includes(network.network)) {

                                                network.paymentMethod = contract.paymentMethod;
                                                network.tokens.push(newToken);
                                                resolve(true);

                                            } else if (network.network === process.env.NetworkMobiE) {

                                                let { notInactive } = mobieNotInactive(contractFound, process.env.TokensTypeApp_User)
                                                network.paymentMethod = contract.paymentMethod;
                                                newToken.status = notInactive ? 'toRequest' : 'inactive'
                                                network.tokens.push(newToken);
                                                resolve(true);

                                            } else {

                                                let index = contractFound.contractIdInternationalNetwork.indexOf(contractFound.contractIdInternationalNetwork.find(contract => {
                                                    return contract.network === network.network;
                                                }));

                                                if (index >= 0) {
                                                    contractFound.contractIdInternationalNetwork[index].tokens.push({ tokenType: process.env.TokensTypeRFID, contract_id: "" })
                                                }
                                                //console.log("index", index);
                                                let { notInactive } = internationNetworkNotInactive(contractFound, process.env.TokensTypeOTHER, network.network);

                                                network.paymentMethod = contract.paymentMethod;
                                                newToken.status = notInactive ? 'toRequest' : 'inactive';
                                                network.tokens.push(newToken);
                                                resolve(true);

                                            };
                                        });
                                    })
                                ).then(() => {

                                    //console.log("contractFound", contractFound);
                                    let newValues = { $set: contractFound };
                                    contractUpdate(query, newValues)
                                        .then(async (result) => {

                                            let contractFound = await contractsFindOne(query);

                                            //Send email to EVIO
                                            sendEmailEVIO(contractFound, contract.address);

                                            //Send email to client
                                            //sendEmailClient(contractFound);

                                            resolve(contractFound);

                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][contractUpdate] Error `, error.message);
                                            reject(error);
                                        });

                                }).catch(error => {
                                    console.log(`[${context}] Error `, error.message);
                                    reject(error);
                                })

                            };

                            break;

                        case process.env.PAYMENTRESPONSEWAITPAYMENT:

                            contractFound.cardPhysicalPaymentStateInfo = process.env.CARDPHYSICALPAYMENTSTATEINFOPROCESSING;
                            let newValues = { $set: contractFound };
                            contractUpdate(query, newValues)
                                .then(async (result) => {

                                    let contractFound = await contractsFindOne(query);
                                    resolve(contractFound);

                                })
                                .catch((error) => {
                                    console.log(`[${context}][contractUpdate] Error `, error.message);
                                    reject(error);
                                });


                            break;

                        default:

                            let mailOptions = {
                                to: contractFound.email,
                                subject: `EVIO - Erro na Solicitação do Cartão`,
                                message: {
                                    "username": contractFound.name,
                                },
                                type: "errorRequestCard"
                            };
                            sendEmailClient(mailOptions, contractFound.clientName);

                            reject({ auth: false, code: 'server_failed_request_physicalCard', message: 'We inform you that it was not possible to charge for the issue of the 2nd copy of the card, due to insufficient balance or/and absence of a valid credit card. It is therefore requested that a valid payment method be entered and that the request be repeated again.' });

                            break;

                    };
                    */
                };

            } else {

                reject({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });

            };

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function createMobieToken(body, userId) {

    return new Promise((resolve, reject) => {
        var context = "Function createMobieToken";
        try {

            console.log("createMobieToken")
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
                        console.log("body error", body);
                        console.log(`[${context}][${host}][400] Error `, error.response.data);
                        reject(error)
                    }
                    else {
                        console.log(`[${context}][${host}] Error `, error.message);
                        reject(error)
                    };

                });


        }
        catch (error) {
            if (error.response) {
                console.log(`[${context}][400] Error `, error.response.data);
                reject(error)
            }
            else {
                console.log(`[${context}] Error `, error.message);
                reject(error)
            };
        }
    })
};

function updateMobieToken(body, userId) {
    var context = "Function updateMobieToken";

    let config = {
        headers: {
            userid: userId,
            apikey: process.env.ocpiApiKey
        }
    };

    let host = process.env.HostMobie + process.env.PathMobieTokens;
    return new Promise((resolve, reject) => {

        axios.patch(host, body, config)
            .then((response) => {
                console.log(`MobiE ${body.type} token updated`)
                resolve(response)
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                reject(error)
            });

    })
};

function updateGireveToken(body, userId) {
    var context = "Function updateGireveToken";

    let config = {
        headers: {
            userid: userId,
            apikey: process.env.ocpiApiKey
        }
    }
    let host = process.env.HostMobie + process.env.PathGireveTokens

    console.log("body", body);
    console.log("userId", userId);

    return new Promise((resolve, reject) => {
        axios.patch(host, body, config)
            .then((response) => {
                console.log(`Gireve ${body.type} token updated`)
                resolve(response)
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                reject(error)
            });
    })
};

function sendEmailEVIO(contractFound, address) {
    const context = "Function sendEmailEVIO";

    let email;
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'pre-production') {
        email = process.env.EMAIL1
    }
    else {
        email = process.env.EMAIL3
    };

    let mailOptions = {
        to: email,
        subject: `EVIO - Solicitação do Cartão userId:${contractFound.userId} contractId:${contractFound._id}`,
        message: {
            "username": contractFound.name,
        },
        type: "requestCard"
    };

    let headers = {
        clientname: contractFound.clientName ? contractFound.clientName : "EVIO"
    }

    axios.post(sendEmailRequest, { mailOptions }, { headers })
        .then((response) => {
            //TODO verify
            //Send email to client
            mailOptions = {
                to: contractFound.email,
                subject: `EVIO - Solicitação do Cartão`,
                message: {
                    "username": contractFound.name,
                },
                type: "requestCard"
            };

            sendEmailClient(mailOptions, contractFound.clientName);
            if (response)
                console.log(`[${context}] Email sent`);
            else
                console.log(`[${context}] Email not sent`);
        })
        .catch((error) => {
            console.log(`[${context}] Error `, error.message);
        });

};

export function sendEmailClient(mailOptions, clientName) {
    var context = "Function sendEmailClient";

    let headers = {
        clientname: clientName ? clientName : "EVIO"
    }

    axios.post(sendEmailRequest, { mailOptions }, { headers })
        .then((response) => {
            if (response)
                console.log(`[${context}] Email sent`);
            else
                console.log(`[${context}] Email not sent`);
        })
        .catch((error) => {
            console.log(`[${context}] Error `, error.message);
        });

};

function contractsFind(query) {
    var context = "Function contractsFind";
    return new Promise((resolve, reject) => {
        Contract.find(query, (err, contractsFound) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                reject(err);
            }
            else {
                resolve(contractsFound);
            };
        });
    });
};

function getPaymentMethods(userId) {
    var context = "Function contractsFind";
    return new Promise((resolve, reject) => {
        try {

            var headers = {
                userid: userId
            };

            var proxyPayments = process.env.HostPayments + process.env.PathGetPaymentMethods;

            axios.get(proxyPayments, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.log(`[${context}][${proxyPayments}] Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function validateContractAndCharger(contract, chargerFound, userIdOwnerContract) {
    var context = "Function validateContractAndCharger";
    return new Promise((resolve, reject) => {

        //Escolhe o tipo de contrato
        switch (contract.contractType) {

            case process.env.ContractTypeFleet:

                //Tipo de contrato fleet
                //Valida se a fleet do contrato está associado ao charger
                validateContractTypeFleet(contract, chargerFound, userIdOwnerContract)
                    .then((result) => {

                        resolve(result);

                    });

                break;
            case process.env.ContractTypeUser:

                //Tipo de contrato users
                //Valida se o user do contrato está associado ao cahrger
                validateContractTypeUser(contract, chargerFound, userIdOwnerContract)
                    .then((result) => {

                        resolve(result);

                    });

                break;
            default:

                resolve(false);

                break;

        };

    });
};

function validateContractTypeUser(contract, chargerFound, userIdOwnerContract) {
    const context = "Function validateContractTypeUser";
    return new Promise(async (resolve, reject) => {

        let networkType = "";

        switch (chargerFound.chargerType) {
            case "011":
                networkType = 'Go.Charge'
                break;
            case "012":
                networkType = 'Hyundai'
                break;
            case process.env.chargerTypeKLC:
                networkType = process.env.NetworkKLC
                break;
            case process.env.chargerTypeKinto:
                networkType = process.env.NetworkKinto
                break;
            default:
                networkType = 'EVIO'
                break;
        }

        let networkActive = contract.networks.some(network => {
            return network.network === networkType && network.tokens.some(token => {
                return token.tokenType === process.env.AuthTypeApp_User && token.status === process.env.NetworkStatusActive
            })
        });

        let query;
        let groupsCsUsers;

        //Valida o accessType do charger
        switch (chargerFound.accessType) {

            case process.env.ChargerAccessPublic:

                if (networkActive || userIdOwnerContract === chargerFound.createUser) {
                    resolve(true);
                } else {

                    query = {
                        listOfUsers: {
                            $elemMatch: {
                                userId: contract.userId
                            }
                        }
                    };

                    groupsCsUsers = await groupCSUsersFind(query);

                    if (groupsCsUsers.length == 0) {

                        resolve(false);

                    } else {

                        Promise.all(
                            groupsCsUsers.map(groupUsers => {
                                return new Promise((resolve, reject) => {

                                    var found = chargerFound.listOfGroups.indexOf(chargerFound.listOfGroups.find(group => {
                                        return group.groupId == groupUsers._id;
                                    }));

                                    if (found >= 0) {
                                        resolve(true);
                                    }
                                    else {
                                        resolve(false);
                                    };
                                });
                            })
                        ).then((result) => {

                            let listOfTrue = result.filter(elem => {

                                return elem === true;

                            });

                            if (listOfTrue.length === 0) {

                                resolve(false);

                            }
                            else {

                                resolve(true);

                            };

                        });

                    };

                };

                break;
            case process.env.ChargerAccessFreeCharge:

                if (networkActive || userIdOwnerContract === chargerFound.createUser) {
                    resolve(true);
                } else {

                    query = {
                        listOfUsers: {
                            $elemMatch: {
                                userId: contract.userId
                            }
                        }
                    };

                    groupsCsUsers = await groupCSUsersFind(query);

                    if (groupsCsUsers.length == 0) {

                        resolve(false);

                    } else {

                        Promise.all(
                            groupsCsUsers.map(groupUsers => {
                                return new Promise((resolve, reject) => {

                                    var found = chargerFound.listOfGroups.indexOf(chargerFound.listOfGroups.find(group => {
                                        return group.groupId == groupUsers._id;
                                    }));

                                    if (found >= 0) {
                                        resolve(true);
                                    }
                                    else {
                                        resolve(false);
                                    };
                                });
                            })
                        ).then((result) => {

                            let listOfTrue = result.filter(elem => {

                                return elem === true;

                            });

                            if (listOfTrue.length === 0) {

                                resolve(false);

                            }
                            else {

                                resolve(true);

                            };

                        });

                    };

                };

                break;
            case process.env.ChargerAccessRestrict:

                //Valida se o user tem algum grupo de CSUsers e se algum desses grupos está associado ao charger
                query = {
                    listOfUsers: {
                        $elemMatch: {
                            userId: contract.userId
                        }
                    }
                };

                groupsCsUsers = await groupCSUsersFind(query);

                if (groupsCsUsers.length == 0) {

                    resolve(false);

                } else {

                    Promise.all(
                        groupsCsUsers.map(groupUsers => {
                            return new Promise((resolve, reject) => {

                                var found = chargerFound.listOfGroups.indexOf(chargerFound.listOfGroups.find(group => {
                                    return group.groupId == groupUsers._id;
                                }));

                                if (found >= 0) {
                                    resolve(true);
                                }
                                else {
                                    resolve(false);
                                };
                            });
                        })
                    ).then((result) => {

                        let listOfTrue = result.filter(elem => {

                            return elem === true;

                        });

                        if (listOfTrue.length === 0) {

                            resolve(false);

                        }
                        else {

                            resolve(true);

                        };

                    });

                };

                break;
            case process.env.ChargerAccessPrivate:

                if (userIdOwnerContract === chargerFound.createUser)
                    resolve(true)
                else
                    resolve(false);

                break;
            default:

                resolve(false);

                break;

        };

    });
};

function validateContractTypeFleet(contract, chargerFound, userIdOwnerContract) {
    const context = "Function validateContractTypeFleet";
    return new Promise(async (resolve, reject) => {

        let networkType = "";

        switch (chargerFound.chargerType) {
            case "011":
                networkType = 'Go.Charge'
                break;
            case "012":
                networkType = 'Hyundai'
                break;
            case process.env.chargerTypeKLC:
                networkType = process.env.NetworkKLC
                break;
            case process.env.chargerTypeKinto:
                networkType = process.env.NetworkKinto
                break;
            default:
                networkType = 'EVIO'
                break;
        }

        let networkActive = contract.networks.some(network => {
            return network.network === networkType && network.tokens.some(token => {
                return token.tokenType === process.env.AuthTypeApp_User && token.status === process.env.NetworkStatusActive
            })
        });

        //Valida o accessType do charger
        switch (chargerFound.accessType) {

            case process.env.ChargerAccessPublic:

                if (networkActive || userIdOwnerContract === chargerFound.createUser) {
                    resolve(true);
                } else {
                    if (chargerFound.listOfFleets.length === 0) {

                        resolve(false);

                    } else {

                        //Verifica se a fleet do ev está associado ao grupo
                        let found = chargerFound.listOfFleets.find(fleet => {

                            return fleet.fleetId === contract.fleetId;

                        });

                        if (found) {

                            resolve(true);

                        } else {

                            resolve(false);

                        };

                    };
                }

                break;
            case process.env.ChargerAccessFreeCharge:

                if (networkActive || userIdOwnerContract === chargerFound.createUser) {
                    resolve(true);
                } else {

                    if (chargerFound.listOfFleets.length === 0) {

                        resolve(false);

                    } else {

                        //Verifica se a fleet do ev está associado ao grupo
                        let found = chargerFound.listOfFleets.find(fleet => {

                            return fleet.fleetId === contract.fleetId;

                        });

                        if (found) {

                            resolve(true);

                        } else {

                            resolve(false);

                        };

                    };
                }

                break;
            case process.env.ChargerAccessRestrict:

                if (chargerFound.listOfFleets.length === 0) {

                    resolve(false);

                } else {

                    //Verifica se a fleet do ev está associado ao grupo
                    let found = chargerFound.listOfFleets.find(fleet => {

                        return fleet.fleetId === contract.fleetId;

                    });

                    if (found) {

                        resolve(true);

                    } else {

                        resolve(false);

                    };

                };

                break;
            case process.env.ChargerAccessPrivate:

                if (userIdOwnerContract === chargerFound.createUser)
                    resolve(true)
                else
                    resolve(false);

                break;
            default:

                resolve(false);

                break;

        };

    });
};

function validateIfMobiEActive(contract) {
    var context = "Function validateIfMobiEActive";

    let query = {
        userId: contract.userId,
        contractType: process.env.ContractTypeUser,
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
            console.log(`[${context}] Error `, err.message);
        } else {

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
                            'networks.$[i].hasJoined': true,
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
                                console.log(`[${context}][.then][updateContract] Error `, err.message);

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
                        console.log(`[${context}][.catch][createMobieToken] Error `, error.message);
                    });

            }
            else {
                console.log("No contract with MobiE");
            };

        };
    });

};

function validateIfInternationalNetworkActive(contract) {
    var context = "Function validateIfInternationalNetworkActive";

    let query = {
        userId: contract.userId,
        contractType: process.env.ContractTypeUser
    };

    Contract.findOne(query, async (err, contractsFounds) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        } else {

            if (contractsFounds) {
                contractsFounds.networks.forEach(network => {
                    if (!process.env.NetworksNotInternational.includes(network.network)) {
                        network.tokens.forEach(token => {
                            if (token.tokenType === process.env.TokensTypeOTHER && token.status !== process.env.NetworkStatusInactive) {
                                let idTagDec = contract.networks.find(network => { return network.network === process.env.NetworkEVIO }).tokens.find(token => { return token.tokenType === process.env.TokensTypeApp_User }).idTagDec
                                activeTokenInternationalNetwork(contract, idTagDec, network.network, process.env.TokensTypeOTHER, true)
                                    .then((result) => {
                                        let query = {
                                            _id: contract._id
                                        };

                                        let newValues = {
                                            $set: {
                                                "networks.$[i].tokens.$[j].idTagDec": idTagDec,
                                                "networks.$[i].tokens.$[j].refId": result.refId,
                                                "networks.$[i].tokens.$[j].status": process.env.NetworkStatusActive,
                                                "networks.$[i].hasJoined": true
                                            }
                                        };

                                        let arrayFilters = [
                                            { "i.network": network.network },
                                            { "j.tokenType": process.env.TokensTypeOTHER }
                                        ];

                                        Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                                            if (err) {
                                                console.log(`[${context}] Error `, err.message);
                                            }
                                            else {
                                                console.log("Token International Network created");
                                            };
                                        })
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][activeTokenInternationalNetwork] Error `, error.message);
                                    });
                            }
                        });
                    }
                })

            } else {
                console.log("No contract type User");
            };

        };
    });

};

function runFirstTime() {
    contractsFind({})
        .then((result) => {

            if (result.length != 0) {
                result.map(contract => {
                    var query = {
                        _id: contract._id
                    };

                    var newValues = {
                        $set: {
                            cardName: contract.cards[0].name,
                            name: contract.cards[0].name,
                            cardType: process.env.CardTypeVirtual,
                            imageCard: contract.cards[0].imageCard,
                            status: process.env.ContractStatusActive,
                            networks: [
                                {
                                    network: process.env.NetworkEVIO,
                                    tokens: [
                                        {
                                            tokenType: process.env.TokensTypeApp_User,
                                            status: process.env.NetworkStatusActive,
                                            idTagHexa: contract.cards[0].idTag,
                                            idTagDec: contract.cards[0].idTag,
                                        }
                                    ]
                                },
                                {
                                    network: process.env.NetworkMobiE,
                                    tokens: [
                                        {
                                            tokenType: process.env.TokensTypeApp_User,
                                            status: process.env.NetworkStatusInactive
                                        }
                                    ]
                                },
                            ],
                            contractType: process.env.ContractTypeUser
                        }
                    };

                    Contract.updateContract(query, newValues, (err, result) => {
                        if (err) {
                            console.error(`[][updateContract] Error `, err.message);
                        }
                        else {
                            console.log("[updateContract] Updated");
                        };
                    });

                })
            };

        })
        .catch((error) => {
            console.error(`[][contractsFind] Error `, error.message);
        });
};

function changeCardNameContractFleet() {
    var context = "Function changeCardNameContractFleet";

    let query = {
        contractType: process.env.ContractTypeFleet,
    };

    Contract.find(query, (err, result) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        } else {
            if (result.length > 0) {
                result.map(contract => {
                    let host = process.env.HostEv + '/api/private/evs/geral'
                    let params = {
                        _id: contract.evId
                    };

                    axios.get(host, { params })
                        .then((result) => {

                            let ev = result.data[0];

                            let query = {
                                _id: contract._id
                            };

                            let newValues = { $set: { cardName: ev.licensePlate } };

                            Contract.updateContract(query, newValues, (err, result) => {
                                if (err) {
                                    console.log(`[${context}] Error `, err.message);
                                }
                                else {

                                    console.log("Contract updated ", ev.licensePlate);

                                };
                            });

                        })
                        .catch((error) => {
                            console.log(`[${context}] Error `, error.message);
                        });
                });
            };
        };
    });
};

async function addInternacionalNetwork() {

    let roamingTariffs = await getRoamingTariffs(['Gireve' , process.env.NetworkHubject]);

    let tariffRoaming = [
        {
            network: process.env.NetworkGireve,
            power: "all",
            planId: roamingTariffs.find(tariff => { return tariff.roamingType === process.env.NetworkGireve })._id
        },
        {
            network: process.env.NetworkHubject,
            power: "all",
            planId: roamingTariffs.find(tariff => { return tariff.roamingType === process.env.NetworkHubject })?._id
        }
    ]

    let internalNetwork = {
        $push: {
            networks: {
                name: "server_international_network_1",
                networkName: "server_international_network_1",
                network: process.env.NetworkGireve,
                tokens: [
                    {
                        tokenType: process.env.TokensTypeOTHER,
                        status: process.env.NetworkStatusInactive
                    }
                ]
            }
        },
        $set: {
            tariffRoaming: tariffRoaming,
            contractIdInternationalNetwork: [
                {
                    network: process.env.NetworkGireve,
                    tokens: [
                        {
                            tokenType: process.env.TokensTypeOTHER
                        }
                    ]
                }
            ]
        }
    };

    let arrayFilters = [
        { "i.name": process.env.NetworkMobiE },
        { "k.name": process.env.NetworkEVIO }
    ];

    Contract.updateMany({}, internalNetwork, (err, result) => {
        if (err) {
            console.error(`[][find] Error `, err.message);
        } else {
            internalNetwork = {
                $set: {
                    "networks.$[i].network": process.env.NetworkMobiE,
                    "networks.$[k].network": process.env.NetworkEVIO,
                    "networks.$[i].networkName": "server_mobie_network",
                    "networks.$[k].networkName": "server_evio_network"
                }
            };
            Contract.updateMany({}, internalNetwork, { arrayFilters: arrayFilters, new: true }, (err, result) => {
                if (err) {
                    console.error(`[][find] Error `, err.message);
                }
                else {

                    console.log("Contrat updated", result);

                };
            });


        };
    });

};

async function addPlanToRoaming() {

    let roamingTariffs = await Promise.all(
        [
            getCEMEEVIO(process.env.NetworkGireve),
            getCEMEEVIO(process.env.NetworkHubject)
        ]
    )

    let tariffRoaming = [
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
    ];

    let internalNetwork = {
        $set: {
            tariffRoaming: tariffRoaming
        }
    };

    Contract.updateMany({}, internalNetwork, (err, result) => {
        if (err) {
            console.error(`[][find] Error `, err.message);
        } else {

            console.log("Contrat updated", result);

        };
    });

    /*let internalNetwork = {
        $set: {
            tariffRoaming: {
                power: "all",
                planId: roamingTariffs.plan._id
            }
        }
    };

    Contract.updateMany({}, internalNetwork, (err, result) => {
        if (err) {
            console.error(`[][find] Error `, err.message);
        }
        else {

            console.log("Contrat updated", result);

        };
    });*/
};

//addContractEV();
function addContractEV() {
    var context = "Function addContractEV";
    try {
        let host = process.env.HostEv + process.env.PathGetEVGeral;
        let params = {
            hasFleet: true
        }

        axios.get(host, { params })
            .then((result) => {

                //console.log("result", result.data.length);
                if (result.data.length > 0) {

                    result.data.map(ev => {

                        Contract.findOne({ evId: ev._id }, async (err, contractFound) => {

                            if (err) {
                                console.log(`[${context}][] Error `, err.message);
                            } else {

                                if (!contractFound) {


                                    let received = {
                                        evId: ev._id,
                                        fleetId: ev.fleet,
                                        userId: ev.userId,
                                        licensePlate: ev.licensePlate
                                    };

                                    let userFound = await User.findOne({ _id: received.userId });

                                    let userContract = await getUserContractCEME(received.userId);

                                    //let roamingTariffs = await getRoamingTariffs(['Gireve']);

                                    let roamingTariffs = await Promise.all(
                                        [
                                            getCEMEEVIO(process.env.NetworkGireve),
                                            getCEMEEVIO(process.env.NetworkHubject)
                                        ]
                                    )

                                    var name = userFound.name.split(" ");

                                    let idTagDecEVIO = await getRandomIdTag(100_000_000_000, 999_999_999_999);
                                    let idTagDecMobiE = await getRandomIdTag(100_000_000_000, 999_999_999_999);

                                    var tariff = {
                                        power: userContract.tariff.power,
                                        planId: userContract.tariff.planId
                                    };

                                    var tariffRoaming = [
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

                                    var newContract

                                    if (received.evId !== undefined && received.evId !== "") {
                                        newContract = {
                                            name: userFound.name,
                                            email: userFound.email,
                                            mobile: userFound.mobile,
                                            cardName: received.licensePlate,
                                            cardType: process.env.CardTypeVirtual,
                                            userId: userFound._id,
                                            evId: received.evId,
                                            fleetId: received.fleetId,
                                            tariff: tariff,
                                            contractType: process.env.ContractTypeFleet,
                                            tariffRoaming: tariffRoaming,
                                            contractIdInternationalNetwork: contractIdInternationalNetwork
                                        };
                                    }
                                    else {
                                        newContract = {
                                            name: userFound.name,
                                            email: userFound.email,
                                            mobile: userFound.mobile,
                                            cardName: name[0] + " " + name[name.length - 1],
                                            cardType: process.env.CardTypeVirtual,
                                            userId: userFound._id,
                                            evId: received.evId,
                                            fleetId: received.fleetId,
                                            tariff: tariff,
                                            contractType: process.env.ContractTypeUser,
                                            tariffRoaming: tariffRoaming,
                                            contractIdInternationalNetwork: contractIdInternationalNetwork
                                        };
                                    };

                                    var contract = new Contract(newContract);

                                    if (process.env.NODE_ENV === 'production') {
                                        contract.imageCEME = process.env.HostProdContrac + 'ceme/cemeEVIO.jpg'; // For PROD server
                                        contract.imageCard = process.env.HostProdContrac + 'card/cardEVIO.jpg';
                                        contract.fontCardBlack = false;
                                    }
                                    else if (process.env.NODE_ENV === 'pre-production') {
                                        contract.imageCEME = process.env.HostPreProdContrac + 'ceme/cemeEVIO.jpg'; // For PROD server
                                        contract.imageCard = process.env.HostPreProdContrac + 'card/cardEVIO.jpg';
                                        contract.fontCardBlack = false;
                                    }
                                    else {
                                        contract.imageCEME = process.env.HostQAContrac + 'ceme/cemeEVIO.jpg'; // For QA server
                                        contract.imageCard = process.env.HostQAContrac + 'card/cardEVIO.jpg';
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
                                            hasJoined: true
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
                                            hasJoined: false
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
                                            hasJoined: false
                                        }
                                    ];

                                    contract.networks = networks;

                                    Contract.createContract(contract, (err, result) => {
                                        if (err) {
                                            console.log(`[${context}][createContract] Error `, err.message);
                                        }
                                        else {
                                            if (result.contractType === process.env.ContractTypeFleet) {
                                                validateIfMobiEActive(result);
                                                validateIfInternationalNetworkActive(result);
                                            };
                                        };
                                    });

                                };
                            };

                        });
                    });

                };

            })
            .catch((error) => {
                console.log(`[${context}][${host}] Error `, error.message);
            });

    } catch (error) {
        console.log(`[${context}][${host}] Error `, error.message);
    };

};

async function addTariffRoaming() {

    let roamingTariffs = await getRoamingTariffs(['Gireve', process.env.NetworkHubject]);

    let tariffRoaming = [
        {
            network: process.env.NetworkGireve,
            power: "all",
            planId: roamingTariffs.find(tariff => { return tariff.roamingType === process.env.NetworkGireve })._id
        },
        {
            network: process.env.NetworkHubject,
            power: "all",
            planId: roamingTariffs.find(tariff => { return tariff.roamingType === process.env.NetworkHubject })?._id
        }
    ]

    let internalNetwork = {
        $set: {
            tariffRoaming: tariffRoaming
        }
    };

    Contract.updateMany({}, internalNetwork, (err, result) => {
        if (err) {
            console.error(`[][find] Error `, err.message);
        } else {

            console.log("Contrat updated", result);

        };
    });
}

function updateCardContract(received, statusMobiE) {
    var context = "Function updateCardContract";
    return new Promise((resolve, reject) => {

        let idTagDec = received.idTagDec;
        let idTagHexa = received.idTagHexa.toUpperCase();
        let idTagHexaInv = received.idTagHexaInv.toUpperCase();

        let EVIORFID = {
            tokenType: process.env.TokensTypeRFID,
            status: process.env.NetworkStatusActive,
            idTagDec: idTagDec,
            idTagHexa: idTagHexa,
            idTagHexaInv: idTagHexaInv,
            wasAssociated: true
        };

        let MobiERFID = {
            tokenType: process.env.TokensTypeRFID,
            status: statusMobiE,
            idTagDec: idTagDec,
            idTagHexa: idTagHexa,
            idTagHexaInv: idTagHexaInv,
            wasAssociated: true
        };
        var newValues

        if (received.cardNumber !== undefined && received.cardNumber !== "") {
            newValues = {
                $set: {
                    'cardNumber': received.cardNumber,
                    'cardType': process.env.CardTypeVirtualPhysical,
                    'cardPhysicalState': true,
                    'cardPhysicalStateInfo': process.env.CARDPHYSICALSTATEINFOACTIVE
                    //TODO Insert idTagHexaInv in the future
                },
                $push: {
                    'networks.$[i].tokens': MobiERFID,
                    'networks.$[k].tokens': EVIORFID,
                }
            };
        } else {
            newValues = {
                $set: {

                    'cardType': process.env.CardTypeVirtualPhysical,
                    'cardPhysicalState': true,
                    'cardPhysicalStateInfo': process.env.CARDPHYSICALSTATEINFOACTIVE
                    //TODO Insert idTagHexaInv in the future
                },
                $push: {
                    'networks.$[i].tokens': MobiERFID,
                    'networks.$[k].tokens': EVIORFID,
                }
            };
        };

        let query = {
            _id: received.contractId
        };

        var arrayFilters = [
            { "i.network": process.env.NetworkMobiE },
            { "k.network": process.env.NetworkEVIO }
        ];

        Contract.updateContractWithFilters(query, newValues, { arrayFilters: arrayFilters, new: true }, (err, doc) => {
            if (err) {
                console.log(`[${context}][.then][updateContract] Error `, err.message);
                reject(err);
            }
            else {
                resolve(doc);
            };
        });

    });
};

function getEv(evId) {
    var context = "Function getEv";
    return new Promise((resolve, reject) => {
        try {
            var proxyEV = process.env.HostEv + process.env.PathGetEVById;
            var params = {
                _id: evId
            };

            axios.get(proxyEV, { params })
                .then((result) => {
                    if (result.data) {
                        resolve(result.data);
                    }
                    else {
                        resolve(null);
                    };

                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve(null);
                });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve(null);
        };
    });
};

function createEvioRfidToken(contractFound, idTagDec, idTagHexa, idTagHexaInv) {
    var context = "Function createEvioRfidToken";
    return new Promise((resolve, reject) => {

        try {
            let EVIORFID = {
                tokenType: process.env.TokensTypeRFID,
                status: process.env.NetworkStatusActive,
                idTagDec: idTagDec,
                idTagHexa: idTagHexa,
                idTagHexaInv: idTagHexaInv
            };

            let newValues = {
                $push: {
                    'networks.$[k].tokens': EVIORFID,
                }
            };

            let query = {
                _id: contractFound._id
            };

            var arrayFilters = [
                { "k.network": process.env.NetworkEVIO },
                { "k.network": process.env.NetworkInternal },
                { "k.network": process.env.NetworkHyundai },
                { "k.network": process.env.NetworkGoCharge },
            ];
            let existsEVIOToken = checkIfTokenExists(contractFound, process.env.NetworkEVIO, process.env.TokensTypeRFID)
            if (!existsEVIOToken) {
                Contract.updateContractWithFilters(query, newValues, { arrayFilters: arrayFilters }, (err, doc) => {
                    if (err) {
                        console.log(`[${context}][.then][updateContract] Error `, err.message);
                        resolve(false)
                    }
                    else {
                        resolve(true)
                    };
                });
            } else {
                console.log(`[${context}][.then][updateContract] EVIO RFID Token already exists `);
                resolve(false)
            }
        } catch (error) {
            console.log(`[${context}][.then][updateContract] Error `, error);
            resolve(false)
        }
    });
}

function checkIfTokenExists(contract, networkName, tokenType) {
    for (const network of contract.networks) {
        if (network.network === networkName) {
            for (const token of network.tokens) {
                if (token.tokenType === tokenType) {
                    return true
                }
            }
            return false
        }
    }
}

//Query for tests
/*
let query = {
    networks: {
        $elemMatch: {
            name: "EVIO",
            tokens: {
                $elemMatch: {
                    idTagDec: { "$exists": false },
                    idTagHexa: { "$exists": false },
                    idTagHexaInv: { "$exists": false }
                }
            }
        }
    };

    let arrayFilters = [
        { "i.network": network },
        { "j.tokenType": tokenType }
    ];


    Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        }
        else {
            console.log("Result", result);
        }
    });

};
*/

function getRoamingTariffs(internationalNetwork) {
    var context = "Function getRoamingTariffs";
    return new Promise((resolve, reject) => {
        let host = process.env.HostPublicTariff + process.env.PathTariffCEME;

        let params = {
            roamingType: internationalNetwork
        };

        let data = {
            _id: 1,
            roamingType: 1
        }
        axios.get(host, { data, params })
            .then((result) => {
                resolve(result.data);

            })
            .catch((error) => {
                console.log(`[${context}][.catch] Error `, error.message);
                resolve([
                    {
                        roamingType: process.env.NetworkGireve,
                        _id: ""
                    }
                ]);
            });
    });
};

function getTariffCEMERoaming(tariffRoaming) {
    const context = "Function getTariffCEMERoaming";
    const plansId = tariffRoaming.map(tariff => tariff.planId);
    const params = { _id: plansId };
    const host = process.env.HostTariffCEME + process.env.PathTariffCEMEbyCEME;

    return axios.get(host, { params })
        .then(result => result.data)
        .catch(error => {
            console.log(`[${context}] Error `, error.message);
            return [];
        });
}

function activeTokenInternationalNetwork(contract, idTagDec, network, tokenType, valid) {
    var context = "Function activeTokenInternationalNetwork";
    return new Promise((resolve, reject) => {
        try {
            let host = process.env.HostMobie + process.env.PathGireveTokens;

            let config = {
                headers: {
                    userid: contract.userId,
                    apikey: process.env.ocpiApiKey
                }
            };

            let appUserUid;
            if (tokenType === process.env.TokensTypeOTHER) {
                //Add idTagDecima from other
                appUserUid = idTagDec
            } else {
                //Add idTagHexa from RFID
                appUserUid = idTagDec

            };

            let countryCode = "PT"
            let partyId = "EVI"
            let random8Int = getRandomInt(10000000, 99999999)
            let checkDigit = checkDigitMobility(countryCode + partyId + "C" + random8Int, checkDigitLists)
            let contract_id = `${countryCode}-${partyId}-C${random8Int}-${checkDigit}`;

            let body = {
                "uid": appUserUid,
                "type": tokenType,
                "contract_id": contract_id,
                "issuer": "EVIO - Electrical Mobility",
                "valid": valid,
                "last_updated": "",
                "source": "",
                "whitelist": "NEVER",
                "evId": contract.contractType === 'fleet' ? contract.evId : '-1',
            };

            axios.put(host, body, config)
                .then((response) => {

                    if (tokenType == process.env.TokensTypeOTHER) {
                        updateContractInternationalNetwork(contract, network, tokenType, contract_id);
                        console.log(`${network} ${body.type} ${body.uid} token created`)
                        resolve(response.data)
                    } else {
                        resolve(body)
                    }

                })
                .catch((error) => {
                    if (error.response) {

                        console.log(`[${context}][${host}][400] Error `, error.response.data);
                        reject(error)
                    } else {

                        console.log(`[${context}][${host}] Error `, error.message);
                        reject(error)

                    };

                });

        } catch (error) {

            if (error.response) {
                console.log(`[${context}][400] Error `, error.response.data.message);
                reject(error)
            }
            else {
                console.log(`[${context}] Error `, error.message);
                reject(error)
            };

        };
    });
};

function updateContractInternationalNetwork(contract, network, tokenType, contract_id) {
    var context = "Function updateContractInternationalNetwork";


    let query = {
        _id: contract._id
    };

    let newValues = {
        $set: {
            "contractIdInternationalNetwork.$[i].tokens.$[j].contract_id": contract_id
        }
    };

    let arrayFilters = [
        { "i.network": network },
        { "j.tokenType": tokenType }
    ];

    Contract.updateContractWithFilters(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        } else {
            console.log("Contract updated");
        }
    });

};

function getTariffRoamingInfo(tariffRoaming) {
    var context = "Function getTariffRoamingInfo";
    return new Promise(async (resolve, reject) => {

        let plansId = [];

        await tariffRoaming.forEach(tariff => {
            plansId.push(tariff.planId);
        });

        let params = {
            _id: plansId
        };

        let host = process.env.HostPublicTariff + process.env.PathGetRoamingTariffs;

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data);

            })
            .catch((error) => {
                console.log(`[${context}][.catch] Error `, error.message);
                resolve([]);
            });

    });
};

function isEmptyObject(obj) {
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}

function addRFIDToGireve() {
    var context = "Function addRFIDToGireve";

    let query = {
        cardType: 'Virtual_Physical'
    }

    Contract.find(query, (err, contractsFound) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        } else {
            if (contractsFound.length > 0) {
                contractsFound.forEach(contract => {
                    query = { _id: contract._id };

                    let EVIONetwork = contract.networks.find(network => {
                        return network.tokens.find(token => {
                            return token.tokenType === process.env.TokensTypeRFID && network.network === process.env.NetworkEVIO;
                        })
                    });

                    let indexGireve = contract.networks.indexOf(contract.networks.find(network => {
                        return network.network === process.env.NetworkGireve
                    }));


                    let TokenRFID;
                    if (EVIONetwork) {

                        let EVIOToken = EVIONetwork.tokens.find(token => {
                            return token.tokenType === process.env.TokensTypeRFID
                        })

                        TokenRFID = {
                            wasAssociated: false,
                            tokenType: process.env.TokensTypeRFID,
                            status: process.env.NetworkStatusInactive,
                            refId: '',
                            idTagDec: EVIOToken.idTagDec,
                            idTagHexa: EVIOToken.idTagHexa,
                            idTagHexaInv: EVIOToken.idTagHexaInv
                        };

                        contract.networks[indexGireve].tokens.push(TokenRFID)
                    } else {

                        let MobiENetwork = contract.networks.find(network => {
                            return network.tokens.find(token => {
                                return token.tokenType === process.env.TokensTypeRFID && network.network === process.env.NetworkMobiE;
                            })
                        });

                        if (MobiENetwork) {

                            let MobiEToken = MobiENetwork.tokens.find(token => {
                                return token.tokenType === process.env.TokensTypeRFID
                            })

                            TokenRFID = {
                                wasAssociated: false,
                                tokenType: process.env.TokensTypeRFID,
                                status: process.env.NetworkStatusInactive,
                                refId: '',
                                idTagDec: MobiEToken.idTagDec,
                                idTagHexa: MobiEToken.idTagHexa,
                                idTagHexaInv: MobiEToken.idTagHexaInv
                            };
                            contract.networks[indexGireve].tokens.push(TokenRFID)
                        } else {
                            console.log("MobiENetwork", MobiENetwork);
                        };
                    };

                    let indexInteNetwork = contract.contractIdInternationalNetwork.indexOf(contract.contractIdInternationalNetwork.find(network => {
                        return network.network === process.env.NetworkGireve;
                    }));

                    contract.contractIdInternationalNetwork[indexInteNetwork].tokens.push({ tokenType: process.env.TokensTypeRFID, contract_id: "" });

                    Contract.updateContract(query, { $set: contract }, (err, result) => {

                        if (err) {

                            console.log(`[${context}] Error `, err.message);

                        } else {

                            console.log("Contracts Updated")

                        };

                    });

                });

            } else {

                console.log("No contracts found");

            };
        };
    });
};

function inactiveGireveOnContractTypeFleet() {
    var context = "Function addRFIDToGireve";

    var newValues = {
        $set: {
            "networks.$[i].tokens.$[j].status": process.env.NetworkStatusInactive
        }
    };

    var arrayFilters = [
        { "i.network": 'Gireve' },
        { "j.tokenType": process.env.TokensTypeOTHER }
    ];

    Contract.find({}, (err, result) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        }
        result.forEach(contract => {
            let query = { _id: contract._id };

            Contract.findOneAndUpdate(query, newValues, { arrayFilters, arrayFilters }, (err, result) => {
                if (err) {
                    console.log(`[${context}] Error `, err.message);
                } else {
                    console.log("Contract updated")
                }
            })
        })

    })
}

async function getGroupUserChargers(contractFound) {
    const context = "Function getGroupUserChargers";
    try {
        let chargers = []
        let query = {
            "listOfUsers.userId": contractFound.userId
        };
        let groupsCsUsers = await groupCSUsersFind(query);
        for (let group of groupsCsUsers) {
            let host = process.env.HostCharger + process.env.PathGetChargerByGroupId
            let groupChargers = await getChargers(host, { params: { groupId: group._id.toString() } })
            chargers.push(...groupChargers)
        }
        return chargers
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getFleetChargers(contractFound) {
    const context = "Function getFleetChargers";
    try {
        let host = process.env.HostCharger + process.env.PathGetChargerByFleetId
        let fleetChargers = await getChargers(host, { params: { fleetId: contractFound.fleetId } })
        return fleetChargers
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}



async function getFleetsGroupIdtags(listOfFleets) {
    const context = "Function getFleetsGroupIdtags";
    try {
        let idTagsArray = []
        for (let fleet of listOfFleets) {
            let contractsQuery = {
                fleetId: fleet.fleetId,
                contractType: process.env.ContractTypeFleet
            }
            let allContracts = await contractsFind(contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getUsersGroupIdtags(listOfGroups) {
    const context = "Function getUsersGroupIdtags";
    try {
        let listOfUsers = await getListOfUsersArray(listOfGroups)
        let idTags = await getListOfUsersIdTags(listOfUsers)
        return idTags
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getListOfUsersArray(listOfGroups) {
    const context = "Function getListOfUsersArray";
    try {
        let listOfUsers = []
        for (let group of listOfGroups) {
            let groupQuery = {
                _id: group.groupId
            }
            let usersGroup = await groupCSUsersFindOne(groupQuery)
            if (usersGroup) {
                listOfUsers.push(...usersGroup.listOfUsers)
            }
        }
        return listOfUsers
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getListOfUsersIdTags(listOfUsers) {
    const context = "Function getListOfUsersIdTags";
    try {
        let idTagsArray = []
        for (let user of listOfUsers) {
            let contractsQuery = {
                userId: user.userId,
                contractType: process.env.ContractTypeUser
            }
            let allContracts = await contractsFind(contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function getIdTags(allContracts, networkEnum, tokenType, tokenStatus) {
    const context = "Function getIdTags";
    try {
        let idTags = []
        for (let contract of allContracts) {
            let token = getSpecificToken(contract, networkEnum, tokenType)
            let idTagsArray = token ? retrieveIdTagsFromToken(token, tokenStatus) : []
            idTags.push(...idTagsArray)
        }
        return idTags
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function getSpecificToken(contract, networkEnum, tokenType) {
    return contract.networks.find(network => network.network === networkEnum).tokens.find(token => token.tokenType === tokenType)
}

function retrieveIdTagsFromToken(token, status) {
    const context = "Function retrieveIdTagsFromToken";
    try {
        const idTagInfoStatus = {
            "active": "Accepted",
            "inactive": "Blocked",
            "toRequest": "Blocked",
        }
        if (token.status === status) {
            if (token.tokenType === process.env.AuthTypeRFID) {
                let returnTokens = []
                if (token.idTagDec) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status]))
                }
                if (token.idTagHexa) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagHexa, idTagInfoStatus[status]))
                }
                if (token.idTagHexaInv) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagHexaInv, idTagInfoStatus[status]))
                }
                return returnTokens
            } else if (token.tokenType === process.env.AuthTypeApp_User) {
                let returnTokens = []
                if (token.idTagDec) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status]))
                }
                return returnTokens
            }
        } else {
            return []
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }

}

function formatIdTagToWhitelist(idTag, status) {
    return {
        idTag: idTag,
        idTagInfo: {
            status: status
        }
    }
}

async function getChargers(host, query) {
    const context = "Function getChargers";
    try {
        let resp = await axios.get(host, query)
        if (resp.data) {
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function removeRepeatedIdTags(authorizationArray) {
    /**
        If eventually there're repeated idTags, we can't send them, else the charger will return an error
        when updating local authorization list
    */
    return authorizationArray.filter((obj, index, self) =>
        index === self.findIndex((t) => (
            t.idTag === obj.idTag
        ))
    )
};

async function inactiveMobie(contractFound, userId, received) {
    const context = "Function inactiveMobie";

    let appUserUid;
    let body;

    appUserUid = await getTokenIdTag(contractFound, "MobiE", "APP_USER");

    if (!appUserUid)
        appUserUid = await getTokenIdTag(contractFound, "EVIO", "APP_USER");

    body = {
        "country_code": "PT",
        "party_id": "EVI",
        "type": "APP_USER",
        "uid": appUserUid,
        "valid": false
    };

    updateMobieToken(body, userId)
        .then(async result => {

            if (result.data.auth === false) {

                console.log("Result - updateMobieToken", result.data);

            } else {

                let found = contractFound.networks.find(network => {
                    return network.tokens.find(token => {
                        return token.tokenType === process.env.TokensTypeRFID && network.network === received.network && token.status !== process.env.NetworkStatusInactive;
                    })
                });

                if (found) {
                    appUserUid = await getTokenIdTag(contractFound, "MobiE", "RFID");

                    if (!appUserUid)
                        appUserUid = await getTokenIdTag(contractFound, "EVIO", "RFID");

                    body = {
                        "country_code": "PT",
                        "party_id": "EVI",
                        "type": "RFID",
                        "uid": appUserUid,
                        "valid": false
                    };

                    updateMobieToken(body, userId)
                        .then(async response => {

                            if (response.data.auth === false) {
                                console.log("Result - updateMobieToken", response.data);
                            } else {

                                console.log("Contract inactivated");

                            };

                        })
                        .catch(error => {

                            console.log(`[${context}][updateMobieToken] Error `, error.message);

                        })

                } else {

                    console.log("Contract inactivated");

                };


            };

        })
        .catch(error => {

            console.log(`[${context}][updateMobieToken] Error `, error.message);

        });
};

async function inactiveGireve(contractFound, userId, received) {
    const context = "Function inactiveGireve";

    let body;

    console.log("received.network", received.network);

    var RFIDUid = await getTokenIdTag(contractFound, received.network, process.env.TokensTypeOTHER);

    console.log("RFIDUid", RFIDUid);
    body = {
        "type": process.env.TokensTypeOTHER,
        "uid": RFIDUid,
        "valid": false
    };

    updateGireveToken(body, userId)
        .then(async result => {

            if (result.data.auth === false) {
                console.log("Result - updateGireveToken", result.data);
            } else {

                let found = contractFound.networks.find(network => {
                    return network.tokens.find(token => {
                        return token.tokenType === process.env.TokensTypeRFID && network.network === received.network && token.status !== process.env.NetworkStatusInactive;
                    })
                });

                if (found) {


                    RFIDUid = await getTokenIdTagHexa(contractFound, received.network, process.env.TokensTypeRFID);

                    body = {
                        "type": process.env.TokensTypeRFID,
                        "uid": RFIDUid,
                        "valid": false
                    };

                    updateGireveToken(body, userId)
                        .then(async result => {

                            console.log("Contract inactivated");

                        })
                        .catch(error => {

                            console.log(`[${context}][] Error `, error.message);

                        });

                } else {

                    console.log("Contract inactivated");

                };

            };

        })
        .catch(error => {

            console.log(`[${context}][] Error `, error.message);

        });

};

async function unlockUserContract(userId) {
    const context = "Function unlockUserContract";
    console.info(`[${context}] Starting process for userId: ${userId}`);

    Contract.find({ userId: userId }, (err, contractsFound) => {
        if (err) {
            console.error(`[${context}] Error finding contracts: ${err.message}`);
        };

        console.info(`[${context}] Found ${contractsFound.length} contract(s) for userId: ${userId}`);

        if (contractsFound.length > 0) {
            contractsFound.map(contract => {
                console.info(`[${context}] Processing contractId: ${contract._id}`);

                let mobieActive = contract.networks.find(network => {
                    return network.tokens.find(token => {
                        return network.network === process.env.NetworkMobiE && token.tokenType === process.env.TokensTypeApp_User && token.status !== process.env.NetworkStatusInactive;
                    })
                });

                let gireveActive = contract.networks.find(network => {
                    return network.tokens.find(token => {
                        return network.network === process.env.NetworkGireve && token.tokenType === process.env.TokensTypeOTHER && token.status !== process.env.NetworkStatusInactive;
                    });
                });

                if (mobieActive) {
                    console.info(`[${context}] Activating Mobi.E for contractId: ${contract._id}`);
                    activeMobie(contract, userId, { network: process.env.NetworkMobiE });
                } else {
                    console.info(`[${context}] No active Mobi.E token found for contractId: ${contract._id}`);
                }

                if (gireveActive) {
                    console.info(`[${context}] Activating GIREVE for contractId: ${contract._id}`);
                    gireveServices.activeGireve(contract, userId, { network: process.env.NetworkGireve });
                } else {
                    console.info(`[${context}] No active GIREVE token found for contractId: ${contract._id}`);
                }
            });
        } else {
            console.info(`[${context}] No contracts found for userId: ${userId}`);
        }
    });
};

async function activeMobie(contractFound, userId, received) {
    const context = "Function activeMobie";

    let appUserUid;
    let body;

    appUserUid = await getTokenIdTag(contractFound, "MobiE", "APP_USER");

    if (!appUserUid)
        appUserUid = await getTokenIdTag(contractFound, "EVIO", "APP_USER");

    body = {
        "country_code": "PT",
        "party_id": "EVI",
        "type": "APP_USER",
        "uid": appUserUid,
        "valid": true
    };

    updateMobieToken(body, userId)
        .then(async result => {

            if (result.data.auth === false) {

                console.log("Result - updateMobieToken", result.data);

            } else {

                let found = contractFound.networks.find(network => {
                    return network.tokens.find(token => {
                        return token.tokenType === process.env.TokensTypeRFID && network.network === received.network && token.status !== process.env.NetworkStatusInactive;
                    })
                });

                if (found) {
                    appUserUid = await getTokenIdTag(contractFound, "MobiE", "RFID");

                    if (!appUserUid)
                        appUserUid = await getTokenIdTag(contractFound, "EVIO", "RFID");

                    body = {
                        "country_code": "PT",
                        "party_id": "EVI",
                        "type": "RFID",
                        "uid": appUserUid,
                        "valid": true
                    };

                    updateMobieToken(body, userId)
                        .then(async response => {

                            if (response.data.auth === false) {
                                console.log("Result - updateMobieToken", response.data);
                            } else {

                                console.log("Contract inactivated");

                            };

                        })
                        .catch(error => {

                            console.log(`[${context}][updateMobieToken] Error `, error.message);

                        })

                } else {

                    console.log("Contract inactivated");

                };


            };

        })
        .catch(error => {

            console.log(`[${context}][updateMobieToken] Error `, error.message);

        });
};

function deactivateContract(query) {
    Contract.findOne(query, async (err, contract) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
            return;
        };

        if (contract) {

            let mobieActive = contract.networks.find(network => {
                return network.tokens.find(token => {
                    return network.network === process.env.NetworkMobiE && token.tokenType === process.env.TokensTypeApp_User && token.status !== process.env.NetworkStatusInactive;
                })
            });

            let gireveActive = contract.networks.find(network => {
                return network.tokens.find(token => {
                    return network.network === process.env.NetworkGireve && token.tokenType === process.env.TokensTypeOTHER && token.status !== process.env.NetworkStatusInactive;
                });
            });

            if (mobieActive) {
                inactiveMobie(contract, contract.userId, { network: process.env.NetworkMobiE });
            };

            if (gireveActive) {
                inactiveGireve(contract, contract.userId, { network: process.env.NetworkGireve });
            };

            if (contract.clientName == process.env.clientNameSC) {
                await SCSibsCards.updateNotInUse(contract.cardNumber);
            }
        }
    });
}

function activateInternationaNetwork(contract, received) {
    const context = "Function activateInternationaNetwork";

    return new Promise((resolve, reject) => {
        let idTagDec = contract.networks.find(network => { return network.network === process.env.NetworkEVIO }).tokens.find(token => { return token.tokenType === process.env.TokensTypeApp_User }).idTagDec

        activeTokenInternationalNetwork(contract, idTagDec, received.network, process.env.TokensTypeOTHER, true)
            .then((result) => {

                ;
                let query = {
                    _id: contract._id
                };

                var newValues = {
                    $set: {
                        "networks.$[i].tokens.$[j].refId": result.refId,
                        "networks.$[i].tokens.$[j].idTagDec": idTagDec,
                        "networks.$[i].tokens.$[j].status": process.env.NetworkStatusActive,
                        "networks.$[i].hasJoined": true
                    }
                };

                var arrayFilters = [
                    { "i.network": received.network },
                    { "j.tokenType": process.env.TokensTypeOTHER }
                ];

                Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                    if (err) {

                        console.log(`[${context}] Error `, err.message);
                        reject(err);

                    } else {
                        ;
                        if (contract.cardType === process.env.CardTypeVirtualPhysical) {

                            //connection to ocpi for Gireve integration RFID
                            let tokenRFIDEVIO = contract.networks.find(network => {
                                return network.network === process.env.NetworkEVIO;
                            }).tokens.find(token => {
                                return token.tokenType === process.env.TokensTypeRFID;
                            });

                            if (tokenRFIDEVIO.status === process.env.NetworkStatusActive) {

                                activeTokenInternationalNetwork(contract, tokenRFIDEVIO.idTagHexa, received.network, process.env.TokensTypeRFID, true)
                                    .then((result) => {

                                        var internationalNetworkRFID = {
                                            tokenType: process.env.TokensTypeRFID,
                                            status: tokenRFIDEVIO.status,
                                            idTagDec: tokenRFIDEVIO.idTagDec,
                                            idTagHexa: tokenRFIDEVIO.idTagHexa,
                                            idTagHexaInv: tokenRFIDEVIO.idTagHexaInv,
                                            wasAssociated: false
                                        };

                                        var contractIdInternationalNetworkRFID = {
                                            tokenType: process.env.TokensTypeRFID,
                                            contract_id: result.contract_id
                                        }

                                        var newValues = {
                                            $set: {
                                                'networks.$[i].tokens.$[j].refId': result.refId,
                                                'networks.$[i].tokens.$[j].status': tokenRFIDEVIO.status,
                                                'networks.$[i].tokens.$[j].idTagDec': tokenRFIDEVIO.idTagDec,
                                                'networks.$[i].tokens.$[j].idTagHexa': tokenRFIDEVIO.idTagHexa,
                                                'networks.$[i].tokens.$[j].idTagHexaInv': tokenRFIDEVIO.idTagHexaInv,
                                                'networks.$[i].tokens.$[j].wasAssociated': false,
                                                'contractIdInternationalNetwork.$[i].tokens.$[j].contract_id': result.contract_id,
                                                "networks.$[i].hasJoined": true
                                            }
                                        };

                                        var arrayFilters = [
                                            { "i.network": received.network },
                                            { "j.tokenType": process.env.TokensTypeRFID }
                                        ];

                                        Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                                            if (err) {

                                                console.log(`[${context}] Error `, err.message);
                                                reject(err);

                                            } else {

                                                resolve(true);

                                            };

                                        });

                                    })
                                    .catch((error) => {

                                        console.log(`[${context}][activeTokenInternationalNetwork] Error `, error.message);
                                        resolve(false);

                                    });

                            } else {
                                var internationalNetworkRFID = {
                                    tokenType: process.env.TokensTypeRFID,
                                    status: tokenRFIDEVIO.status,
                                    wasAssociated: false
                                };

                                var contractIdInternationalNetworkRFID = {
                                    tokenType: process.env.TokensTypeRFID,
                                    contract_id: ""
                                };

                                var newValues = {
                                    $set: {
                                        'networks.$[i].tokens.$[j].status': tokenRFIDEVIO.status,
                                        'networks.$[i].tokens.$[j].wasAssociated': false,
                                        'contractIdInternationalNetwork.$[i].tokens.$[j].contract_id': "",
                                        "networks.$[i].hasJoined": true
                                    }
                                };

                                var arrayFilters = [
                                    { "i.network": received.network },
                                    { "j.tokenType": process.env.TokensTypeRFID }
                                ];

                                Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                                    if (err) {

                                        console.log(`[${context}] Error `, err.message);
                                        reject(err);

                                    } else {

                                        resolve(true);

                                    };

                                });

                            };


                        } else {

                            resolve(true);

                        };

                    };
                });

            })
            .catch((error) => {

                console.log(`[${context}][activeTokenInternationalNetwork] Error `, error.message);
                resolve(false);

            });

    });

};

function addHasJoinedCOntracts() {
    const context = "Function addHasJoinedCOntracts";
    Contract.find({}, (err, contractsFound) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        } else {
            if (contractsFound.length > 0) {
                contractsFound.forEach(contract => {
                    let mobieActive = contract.networks.find(network => {
                        return network.tokens.find(tokens => {
                            return network.network === process.env.NetworkMobiE && tokens.tokenType === process.env.TokensTypeApp_User && tokens.status != process.env.NetworkStatusInactive
                        })
                    });

                    let gireveActive = contract.networks.find(network => {
                        return network.tokens.find(tokens => {
                            return network.network === process.env.NetworkGireve && tokens.tokenType === process.env.TokensTypeOTHER && tokens.status != process.env.NetworkStatusInactive
                        })
                    });

                    if (mobieActive) {
                        let query = { _id: contract._id };
                        var newValues = {
                            $set: {
                                "networks.$[i].hasJoined": true
                            }
                        };

                        var arrayFilters = [
                            { "i.network": process.env.NetworkMobiE }
                        ];

                        Contract.updateContractWithFilters(query, newValues, { arrayFilters: arrayFilters }, (err, doc) => {
                            if (err) {
                                console.log(`[${context}][.then][updateContract] Error `, err.message);

                            } else {
                                console.log("Active");
                            };
                        });
                    } else {
                        let query = { _id: contract._id };
                        var newValues = {
                            $set: {
                                "networks.$[i].hasJoined": false
                            }
                        };

                        var arrayFilters = [
                            { "i.network": process.env.NetworkMobiE }
                        ];

                        Contract.updateContractWithFilters(query, newValues, { arrayFilters: arrayFilters }, (err, doc) => {
                            if (err) {
                                console.log(`[${context}][.then][updateContract] Error `, err.message);

                            } else {
                                console.log("Active");
                            };
                        });
                    }


                    if (gireveActive) {
                        let query = { _id: contract._id };
                        var newValues = {
                            $set: {
                                "networks.$[i].hasJoined": true
                            }
                        };

                        var arrayFilters = [
                            { "i.network": process.env.NetworkGireve }
                        ];

                        Contract.updateContractWithFilters(query, newValues, { arrayFilters: arrayFilters }, (err, doc) => {
                            if (err) {
                                console.log(`[${context}][.then][updateContract] Error `, err.message);

                            } else {
                                console.log("Active");
                            };
                        });
                    } else {
                        let query = { _id: contract._id };
                        var newValues = {
                            $set: {
                                "networks.$[i].hasJoined": false
                            }
                        };

                        var arrayFilters = [
                            { "i.network": process.env.NetworkGireve }
                        ];

                        Contract.updateContractWithFilters(query, newValues, { arrayFilters: arrayFilters }, (err, doc) => {
                            if (err) {
                                console.log(`[${context}][.then][updateContract] Error `, err.message);

                            } else {
                                console.log("Active");
                            };
                        });
                    }

                })
            };
        };
    });
};

function changeCemeContract() {
    const context = "Function changeCemeContract";

    var query = {
        networks: {
            $elemMatch: {
                network: process.env.NetworkMobiE,
                tokens: {
                    $elemMatch: {
                        tokenType: process.env.TokensTypeApp_User,
                        status: { $ne: process.env.NetworkStatusActive }
                    }
                }
            }
        }
    };


    Contract.find(query, async (err, contractsFound) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        } else {
            if (contractsFound.length > 0) {

                contractsFound.forEach(async contract => {

                    let cemeEVIOAdHoc = await getCEMEEVIOADHOC(contract.clientName);

                    let newValues = {
                        tariff: {
                            power: 'all',
                            planId: cemeEVIOAdHoc.plan._id
                        }
                    }

                    Contract.updateContract({ _id: contract._id }, { $set: newValues }, (err, result) => {
                        if (err) {
                            console.log(`[${context}] Error `, err.message);
                        }
                        if (result) {
                            CEMETariff.updateCEMETariff({ userId: contract.userId }, { $set: newValues }, (err, result) => {

                                if (err) {
                                    console.log(`[${context}] Error `, err.message);
                                }
                                if (result) {
                                    console.log("Session updated")
                                } else
                                    console.log("Session not updated")

                            });

                        } else
                            console.log("Session not updated")

                    });

                });
            }
        }
    });

};

function getValidationDriver(ev, userId, dateNow) {
    return new Promise(resolve => {
        var found = ev.listOfDrivers.indexOf(ev.listOfDrivers.find(driver => {
            return driver.userId == userId
        }));
        if (found >= 0) {
            if (ev.listOfDrivers[found].period.periodType === 'always') {
                resolve(true);
            }
            else {
                if ((ev.listOfDrivers[found].period.period.startDate <= dateNow) && (ev.listOfDrivers[found].period.period.stopDate >= dateNow)) {
                    resolve(true);
                }
                else {
                    resolve(false);
                };
            };
        } else {
            resolve(false);
        };
    });
};

function getValidationGroupDrivers(ev, dateNow, groupDrivers) {
    return new Promise(resolve => {
        var isValid = [];
        Promise.all(
            groupDrivers.map(groupDriver => {
                return new Promise(resolve => {
                    var found = ev.listOfGroupDrivers.indexOf(ev.listOfGroupDrivers.find(group => {
                        return group.groupId == groupDriver;
                    }));
                    if (found >= 0) {

                        if (ev.listOfGroupDrivers[found].period.periodType === 'always') {
                            isValid.push(ev.listOfGroupDrivers[found]);
                            console.log("ev.listOfGroupDrivers[found]", ev.listOfGroupDrivers[found])
                            resolve(true);
                        }
                        else {
                            if ((ev.listOfGroupDrivers[found].period.period.startDate <= dateNow) && (ev.listOfGroupDrivers[found].period.period.stopDate >= dateNow)) {
                                isValid.push(ev.listOfGroupDrivers[found]);
                                resolve(true);
                            }
                            else {
                                resolve(false);
                            };
                        };
                    }
                    else {
                        resolve(false);
                    };
                });
            })
        ).then(() => {
            if (isValid.length > 0) {
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
    });
};

function getGroupsDrivers(evFound) {
    var context = "Function getGroupsDrivers";
    return new Promise((resolve, reject) => {
        try {

            var newListOfGroupDrivers = [];

            Promise.all(
                evFound.listOfGroupDrivers.map(groupDrivers => {
                    return new Promise((resolve, reject) => {
                        var query = {
                            _id: groupDrivers.groupId
                        };

                        GroupDrivers.findOne(query, (err, groupDriversFound) => {
                            if (err) {
                                console.log(`[${context}][findOnde] Error `, err.message);
                                reject(err);
                            } else {

                                if (!groupDriversFound) {

                                    newListOfGroupDrivers.push(groupDrivers);
                                    resolve(true);

                                } else if (groupDriversFound.listOfDrivers.length == 0) {

                                    newListOfGroupDrivers.push(groupDrivers);
                                    resolve(true);

                                } else {

                                    getDrivers(groupDriversFound, groupDrivers)
                                        .then((groupDriversFound) => {

                                            newListOfGroupDrivers.push(groupDriversFound);
                                            resolve(true);

                                        })
                                        .catch((error) => {

                                            console.log(`[${context}][getDrivers][.catch] Error `, error.message);
                                            resolve(false);

                                        });

                                };

                            };
                        });

                    });
                })
            ).then(() => {
                resolve(newListOfGroupDrivers);

            }).catch((error) => {

                console.log(`[${context}][Promise.all] Error `, error.message);
                reject(error);

            });

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

function getDrivers(groupsDriversFound, groupDrivers) {
    var context = "Function getDrivers";
    return new Promise((resolve, reject) => {
        try {
            var driverId = []
            const getDriver = (drivers) => {
                return new Promise((resolve) => {
                    if (drivers.driverId == undefined) {
                        driverId.push(drivers);
                        resolve(false);
                    }
                    else if (drivers.driverId == '') {
                        driverId.push(drivers);
                        resolve(false);
                    }
                    else {
                        var query = {
                            _id: drivers.driverId
                        };

                        var fields = {
                            _id: 1,
                            name: 1,
                            internationalPrefix: 1,
                            mobile: 1,
                            imageContent: 1
                        }
                        User.findOne(query, fields, (err, userFound) => {
                            if (err) {
                                console.log(`[${context}][findOne] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (userFound) {
                                    userFound = JSON.parse(JSON.stringify(userFound));
                                    userFound.driverId = userFound._id;
                                    userFound.userId = userFound._id;
                                    driverId.push(userFound);
                                    resolve(true);
                                }
                                else {
                                    driverId.push(drivers);
                                    resolve(false);
                                };
                            };
                        });
                    };
                });
            };
            Promise.all(
                groupsDriversFound.listOfDrivers.map(drivers => getDriver(drivers))
            ).then(() => {
                groupDrivers.listOfDrivers = driverId;
                var newGroupsDriversFound = {
                    _id: groupsDriversFound._id,
                    name: groupsDriversFound.name,
                    imageContent: groupsDriversFound.imageContent,
                    createUser: groupsDriversFound.createUser,
                    listOfDrivers: driverId
                };
                resolve(groupDrivers);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function changeCemeTariffs() {
    const context = "Function changeCemeTariffs";

    var query = {
        status: process.env.ContractStatusActive,
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


    Contract.find(query, async (err, contractsFound) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        } else {

            if (contractsFound.length > 0) {

                contractsFound.forEach(async contract => {

                    let user = await User.findOne({ _id: contract.userId }, { _id: 1, userType: 1 });

                    if (!user) {
                        console.log("contract.userId ", contract.userId)
                        console.log("user", user)
                    }

                    let newValues = {
                        tariff: {
                            power: contract.tariff.power,
                            planId: contract.tariff.planId
                        }
                    }

                    CEMETariff.updateCEMETariff({ userId: contract.userId }, { $set: newValues }, (err, result) => {

                        if (err) {
                            console.log(`[${context}] Error `, err.message);
                        }
                        if (result) {
                            console.log("Session updated")
                        } else
                            console.log("Session not updated")

                    });

                });
            };

        };
    });

};

function changeCemeTariffsNotMobiE() {
    const context = "Function changeCemeTariffsNotMobiE";

    var query = {
        status: process.env.ContractStatusActive,
        contractType: process.env.ContractTypeUser,
        networks: {
            $elemMatch: {
                network: process.env.NetworkMobiE,
                hasJoined: false
                /*tokens: {
                    $elemMatch: {
                        tokenType: process.env.TokensTypeApp_User,
                        status: process.env.NetworkStatusInactive
                    }
                }*/
            }
        }
    };


    Contract.find(query, async (err, contractsFound) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        } else {

            console.log(`[${context}] contractsFound.length ${contractsFound.length}`);

            if (contractsFound.length > 0) {


                contractsFound.forEach(async contract => {

                    let cemeEVIOAdHoc = await getCEMEEVIOADHOC(contract.clientName)

                    if (contract.userId) {
                        let user = await User.findOne({ _id: contract.userId }, { _id: 1, userType: 1, clientType: 1 });
                        if (user) {
                            let tariff = {
                                power: "all",
                                planId: cemeEVIOAdHoc.plan._id
                            };

                            let contracts = await Contract.updateMany({ userId: user._id }, { $set: { tariff: tariff } });
                            let cemeTariff = await CEMETariff.updateMany({ userId: user._id, CEME: "EVIO" }, { $set: { tariff: tariff } });

                            console.log("contracts", contracts);
                            console.log("cemeTariff", cemeTariff);
                            console.log("CEME updated");

                        };
                    };

                });

            };

        };
    });

};

async function prioritizeIdTags(idTagsInfoArray, hwId) {
    const context = "Function prioritizeIdTags"
    try {
        let host = process.env.HostCharger + process.env.PathGetPriorityIdTags
        let data = {
            idTagsInfoArray,
            hwId
        }
        let resp = await axios.get(host, { data })
        if (resp.data) {
            return resp.data
        } else {
            return idTagsInfoArray
        }
    } catch (error) {
        console.log(`[${context}][.catch] Error `, error.message);
        return idTagsInfoArray
    }
};

function validateCardEVIO(userId, received, clientName, res) {
    const context = "Function validateCardEVIO"
    try {

        let query = {
            userId: userId,
            cardNumber: received.cardNumber,
            nif: received.nif,
            clientName: clientName
        };
        contractsFindOne(query)
            .then(async (contractFound) => {
                if (contractFound) {

                    if(contractFound.cardPhysicalStateInfo !== process.env.CARDPHYSICALSTATEINFOASSOCIATED) {
                        return res.status(400).send({ auth: false, code: 'server_card_not_ready_to_activate', message: 'Card is not ready to activate' });
                    }

                    const updatedContract = await activateAssociateCard({
                       contract: contractFound,
                       cardNumber: received.cardNumber
                   })

                    const tokenStatusService = new TokenStatusService();
                    const userContract = await User.findOne({ _id: updatedContract.userId }, { clientType: 1 });
                    const rfidUIState = userContract ? tokenStatusService.getRfidUIState({ contract: updatedContract, clientType: userContract.clientType, requestUserId: userId }) : tokenStatusService.getRfidUIStateDisabled();
                    return res.status(200).send({
                        ...updatedContract,
                        rfidUIState
                    });
                } else {
                    console.log("Contract not found")
                    return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'NIF or card number not valid' });
                }
            })
            .catch((error) => {
                console.log(`[${context}][contractsFindOne] Error `, error.message);
                return res.status(500).send(error.message && error.code ? error : { code: 'server_error', message: error.message || 'Internal server error' });
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message && error.code ? error : { code: 'server_error', message: error.message || 'Internal server error' });
    };
};

async function validateCardGoCharge(userId, received, clientName, res) {
    const context = "Function validateCardGoCharge"
    try {

        let cardNumber = received.cardNumber.toUpperCase();
        let tags;
        let user = await User.findOne({ _id: userId }, { _id: 1, name: 1 });
        if (cardNumber.startsWith("PTCGOCE")) {

            //get tags from file
            tags = await getIdTagsCardGoCharge(cardNumber);


        } else if (cardNumber.startsWith("5")) {

            //get tags from file CETELEM
            tags = await getIdTagsCardsCetelem(user.name, received.nif, cardNumber);

        } else {

            return res.status(400).send({ auth: false, code: 'server_card_unrecognized', message: 'Unrecognized card type' });

        };

        console.log("Tags", tags)

        if (tags) {

            let query;

            if (received.contractId) {
                query = {
                    _id: received.contractId,
                    clientName: clientName
                };
            } else {
                query = {
                    nif: received.nif,
                    email: received.email,
                    contractType: process.env.ContractTypeUser,
                    clientName: clientName
                };
            };

            let contractFound = await contractsFindOne(query);
            if (contractFound) {

                let data = {
                    cardNumber: cardNumber,
                    idTagDec: tags.tagDecimalInvert,
                    idTagHexa: tags.tagHexa,
                    idTagHexaInv: tags.tagHexaInvert,
                    contractId: contractFound._id
                };

                console.log("data", data);

                const dataToResponse = await createActiveRfidTokens({
                    contract: contractFound,
                    idTagDec: tags.tagDecimalInvert,
                    idTagHexa: tags.tagHexa,
                    idTagHexaInv: tags.tagHexaInvert,
                    cardNumber: cardNumber,
                    path: 'PATCH /api/private/contracts/validateCard'
                })

                if (cardNumber.startsWith("PTCGOCE")) {

                    updateCardSibs(cardNumber)

                } else if (cardNumber.startsWith("5")) {

                    console.log("1")
                    updateCardCetelem(user.name, received.nif, cardNumber);

                }

                const featureFlagEnabled = await toggle.isEnable('fleet-363-responses');
                if (featureFlagEnabled) {
                    console.log(`[${context}] Feature flag 'fleet-363-responses' is enabled`);
                    const tokenStatusService = new TokenStatusService();
                    const userContract = await User.findOne({ _id: dataToResponse.userId }, { clientType: 1 });
                    dataToResponse.rfidUIState = userContract ? tokenStatusService.getRfidUIState({ contract: dataToResponse, clientType: userContract.clientType, requestUserId: userId }) : tokenStatusService.getRfidUIStateDisabled();
                }

                return res.status(200).send(dataToResponse);


            } else {
                return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
            };

        } else {

            return res.status(400).send({ auth: false, code: 'server_tags_not_found', message: 'Tags for card not found' });

        };

    } catch (error) {
        if (error.auth === false) {
            return res.status(400).send(error);
        } else if (error.response) {
            return res.status(400).send(error.response.data);
        } else {
            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message && error.code ? error : { code: 'server_error', message: error.message || 'Internal server error' });
        };
    };
};

async function validateCardHyundai(userId, received, clientName, res) {
    const context = "Function validateCardHyundai"
    try {

        let cardNumber = received.cardNumber;
        let tags;

        if (cardNumber.startsWith("PTHBLUE")) {

            //get tags from file
            tags = await getIdTagsCardHyundai(cardNumber);

        } else if (cardNumber.startsWith("5")) {

            //get tags from file CETELEM
            let user = await User.findOne({ _id: userId }, { _id: 1, name: 1 });
            tags = await getIdTagsCardsCetelem(user.name, received.nif);

        } else {

            return res.status(400).send({ auth: false, code: 'server_card_unrecognized', message: 'Unrecognized card type' });

        };

        if (tags) {

            let query = {
                _id: received.contractId,
                clientName: clientName
            };

            let contractFound = await contractsFindOne(query);
            if (contractFound) {

                let data = {
                    cardNumber: cardNumber,
                    idTagDec: tags.tagDecimalInvert,
                    idTagHexa: tags.tagHexa,
                    idTagHexaInv: tags.tagHexaInvert,
                    contractId: received.contractId
                }

                const dataToResponse = await createActiveRfidTokens({
                    contract: contractFound,
                    idTagDec: tags.tagDecimalInvert,
                    idTagHexa: tags.tagHexa,
                    idTagHexaInv: tags.tagHexaInvert,
                    cardNumber: cardNumber,
                    path: 'PATCH /api/private/contracts/validateCard'
                })


                if (cardNumber.startsWith("PTHBLUE")) {

                    updateCardSibsHyundai(cardNumber, userId)

                }

                const featureFlagEnabled = await toggle.isEnable('fleet-363-responses');
                if (featureFlagEnabled) {
                    console.log(`[${context}] Feature flag 'fleet-363-responses' is enabled`);
                    const tokenStatusService = new TokenStatusService();
                    const userContract = await User.findOne({ _id: dataToResponse.userId }, { clientType: 1 });
                    dataToResponse.rfidUIState = userContract ? tokenStatusService.getRfidUIState({ contract: dataToResponse, clientType: userContract.clientType, requestUserId: userId }) : tokenStatusService.getRfidUIStateDisabled();
                }
                return res.status(200).send(dataToResponse);

            } else {
                return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
            };

        } else {

            return res.status(400).send({ auth: false, code: 'server_tags_not_found', message: 'Tags for card not found' });

        };

    } catch (error) {
        Sentry.captureException(error);
        if (error.response) {
            return res.status(400).send(error.response.data);
        } else {

            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message && error.code ? error : { code: 'server_error', message: error.message || 'Internal server error' });
        };

    };
};

async function validateCardACP(userId, received, clientName, res) {
    const context = "Function validateCardACP"
    try {

        let cardNumber = received.cardNumber;
        let tags = await getIdTagsCardACP(cardNumber);

        console.log("tags", tags);

        if (tags) {

            let query;

            if (received.contractId) {
                query = {
                    _id: received.contractId,
                    clientName: clientName
                };
            } else {
                query = {
                    nif: received.nif,
                    email: received.email,
                    contractType: process.env.ContractTypeUser,
                    clientName: clientName
                };
            };

            let contractFound = await contractsFindOne(query);
            if (contractFound) {

                let data = {
                    cardNumber: cardNumber,
                    idTagDec: tags.idTagDec,
                    idTagHexa: tags.idTagHexa,
                    idTagHexaInv: tags.idTagHexaInv,
                    contractId: contractFound._id
                };

                const dataToResponse = await createActiveRfidTokens({
                    contract: contractFound,
                    idTagDec: tags.idTagDec,
                    idTagHexa: tags.idTagHexa,
                    idTagHexaInv: tags.idTagHexaInv,
                    cardNumber: cardNumber,
                    path: 'PATCH /api/private/contracts/validateCard'
                })

                let updateRFIDContract = await updateRFIDContracts(contractFound);
                updateCardSibsACP(cardNumber)

                const featureFlagEnabled = await toggle.isEnable('fleet-363-responses');
                if (featureFlagEnabled) {
                    console.log(`[${context}] Feature flag 'fleet-363-responses' is enabled`);
                    const tokenStatusService = new TokenStatusService();
                    const userContract = await User.findOne({ _id: dataToResponse.userId }, { clientType: 1 });
                    dataToResponse.rfidUIState = userContract ? tokenStatusService.getRfidUIState({ contract: dataToResponse, clientType: userContract.clientType, requestUserId: userId }) : tokenStatusService.getRfidUIStateDisabled();
                }
                return res.status(200).send(dataToResponse);

            } else {
                return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
            };

        } else {

            return res.status(400).send({ auth: false, code: 'server_tags_not_found', message: 'Tags for card not found' });

        };

    } catch (error) {
        if (error.auth === false) {
            return res.status(400).send(error);
        } else if (error.response) {
            return res.status(400).send(error.response.data);
        } else {
            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message && error.code ? error : { code: 'server_error', message: error.message || 'Internal server error' });
        };
    };
};

function getIdTagsCardGoCharge(cardNumber) {
    const context = "Function getIdTagsCardGoCharge";
    return new Promise(async (resolve, reject) => {
        try {

            let card = await SCSibsCards.getCard(cardNumber);
            let idTag = card.dec;
            let tags = await convertTags(idTag);
            resolve(tags)

        } catch (error) {

            if (error.auth === false) {
                reject(error);
            } else {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }

        };
    });
};

export async function updateCardSibs(cardNumber) {
    const context = "Function updateCardSibs";
    try {

        let card = await SCSibsCards.updateCard(cardNumber);

        console.log('Card updated');

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    };

};

function getIdTagsCardACP(cardNumber) {
    const context = "Function getIdTagsCardACP";
    return new Promise(async (resolve, reject) => {
        try {
            let card = await ToProcessCards.getCard(cardNumber);
            let tags = card.tags;
            resolve(tags)
        } catch (error) {
            if (error.auth === false) {
                reject(error);
            } else {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        };
    });
};

async function updateCardSibsACP(cardNumber) {
    const context = "Function updateCardSibsACP";
    try {

        let card = await ToProcessCards.updateCardACP(cardNumber);

        console.log('Card updated');

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    };

};

async function updateCardSibsHyundai(cardNumber, userId) {
    const context = "Function updateCardSibsHyundai";
    try {

        let card = await HYSibsCards.updateCard(cardNumber, userId);

        console.log('Card updated');

    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error `, error.message);
    };

};

function getIdTagsCardsCetelem(name, nif, cardNumber) {
    const context = "Function getIdTagsCardsCetelem";
    return new Promise(async (resolve, reject) => {
        try {

            let firstName = name.split(" ")[0].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

            let hash = crypto.createHash('SHA256').update(nif + firstName).digest('hex').substring(0, 40).toUpperCase();

            let lastFour = cardNumber.substr(cardNumber.length - 4);

            let card = await SCCetelemCards.getCard(hash + lastFour);
            let idTag = card.dec;
            let tags = await convertTagsCetelem(idTag);

            resolve(tags)

        } catch (error) {

            if (error.auth === false) {
                reject(error);
            } else {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }

        };
    });
};

async function updateCardCetelem(name, nif, cardNumber) {
    const context = "Function updateCardCetelem";
    try {

        let firstName = name.split(" ")[0].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

        let hash = crypto.createHash('SHA256').update(nif + firstName).digest('hex').substring(0, 40).toUpperCase();

        let lastFour = id.substr(cardNumber.length - 4);

        let card = await SCCetelemCards.updateCard(hash + lastFour);
        console.log('Card updated');

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    };

};

function getIdTagsCardHyundai(cardNumber) {
    const context = "Function getIdTagsCardHyundai";
    return new Promise(async (resolve, reject) => {
        try {

            //TODO get idTag from file

            let card = await HYSibsCards.getCard(cardNumber);
            let idTag = card.dec;

            let tags = await convertTags(idTag);
            resolve(tags)

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};


/*convertTags("1246540352745857")
    .then(result => {
        console.log("convertTags", result);
    });*/

function convertTags(idTag) {
    const context = "Function convertTags"
    return new Promise((resolve, reject) => {
        try {

            let hexa = (BigInt(idTag).toString(16)).toUpperCase();

            while (hexa.length < 7 * 2) {
                hexa = "0" + hexa
            };

            let hexaInvert = "";

            for (let i = hexa.length; i > 0; i -= 2) {
                const sub = String(hexa).substring(i, i - 2);
                hexaInvert += sub;
            };

            console.log("hexaInvert", hexaInvert);
            let decimalInvert = Converter.decimal(hexaInvert)

            let response = {
                tagDecimal: idTag,
                tagDecimalInvert: decimalInvert,
                tagHexa: hexa,
                tagHexaInvert: hexaInvert

            };

            resolve(response);

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

/*convertTagsCetelem("00001563761252778496")
    .then(result => {
        console.log("convertTagsCetelem", result);
    });*/

function convertTagsCetelem(idTag) {
    const context = "Function convertTagsCetelem"
    return new Promise((resolve, reject) => {
        try {

            let hexa = (BigInt(idTag).toString(16)).toUpperCase();

            while (hexa.length < 7 * 2) {
                hexa = "0" + hexa
            };

            let hexaInvert = "";

            for (let i = hexa.length; i > 0; i -= 2) {
                const sub = String(hexa).substring(i, i - 2);
                hexaInvert += sub;
            };

            let decimalInvert = Converter.decimal(hexaInvert)

            let response = {
                tagDecimal: idTag,
                tagDecimalInvert: decimalInvert,
                tagHexa: hexa,
                tagHexaInvert: hexaInvert

            };

            resolve(response);

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};


function activeRoaming(contractsFound, received) {
    const context = "Function activeRoaming"
    return new Promise((resolve, reject) => {
        try {

            Promise.all(
                contractsFound.map(contract => {
                    return new Promise((resolve, reject) => {

                        let idTagDec = contract.networks.find(network => { return network.network === process.env.NetworkEVIO }).tokens.find(token => { return token.tokenType === process.env.TokensTypeApp_User }).idTagDec

                        activeTokenInternationalNetwork(contract, idTagDec, received.network, process.env.TokensTypeOTHER, true)
                            .then((result) => {

                                let query = {
                                    _id: contract._id
                                };

                                let newValues = {
                                    $set: {
                                        "networks.$[i].tokens.$[j].refId": result.refId,
                                        "networks.$[i].tokens.$[j].idTagDec": idTagDec,
                                        "networks.$[i].tokens.$[j].status": process.env.NetworkStatusActive,
                                        "networks.$[i].hasJoined": true
                                    }
                                };

                                let arrayFilters = [
                                    { "i.network": received.network },
                                    { "j.tokenType": process.env.TokensTypeOTHER }
                                ];

                                Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                                    if (err) {

                                        console.log(`[${context}] Error `, err.message);
                                        reject(err);

                                    }
                                    if (contract.cardType === process.env.CardTypeVirtualPhysical) {

                                        //connection to ocpi for Gireve integration RFID
                                        let tokenRFIDEVIO = contract.networks.find(network => {
                                            return network.network === process.env.NetworkEVIO;
                                        }).tokens.find(token => {
                                            return token.tokenType === process.env.TokensTypeRFID;
                                        });

                                        //console.log("3.1", tokenRFIDEVIO);

                                        if (tokenRFIDEVIO.status === process.env.NetworkStatusActive) {

                                            activeTokenInternationalNetwork(contract, tokenRFIDEVIO.idTagHexa, received.network, process.env.TokensTypeRFID, true)
                                                .then((result) => {

                                                    let internationalNetworkRFID = {
                                                        tokenType: process.env.TokensTypeRFID,
                                                        status: tokenRFIDEVIO.status,
                                                        idTagDec: tokenRFIDEVIO.idTagDec,
                                                        idTagHexa: tokenRFIDEVIO.idTagHexa,
                                                        idTagHexaInv: tokenRFIDEVIO.idTagHexaInv,
                                                        wasAssociated: false
                                                    };

                                                    let contractIdInternationalNetworkRFID = {
                                                        tokenType: process.env.TokensTypeRFID,
                                                        contract_id: result.contract_id
                                                    }

                                                    let newValues = {
                                                        $set: {
                                                            'networks.$[i].tokens.$[j].refId': result.refId,
                                                            'networks.$[i].tokens.$[j].status': tokenRFIDEVIO.status,
                                                            'networks.$[i].tokens.$[j].idTagDec': tokenRFIDEVIO.idTagDec,
                                                            'networks.$[i].tokens.$[j].idTagHexa': tokenRFIDEVIO.idTagHexa,
                                                            'networks.$[i].tokens.$[j].idTagHexaInv': tokenRFIDEVIO.idTagHexaInv,
                                                            'networks.$[i].tokens.$[j].wasAssociated': false,
                                                            'contractIdInternationalNetwork.$[i].tokens.$[j].contract_id': result.contract_id,
                                                            "networks.$[i].hasJoined": true
                                                        }
                                                    };

                                                    let arrayFilters = [
                                                        { "i.network": received.network },
                                                        { "j.tokenType": process.env.TokensTypeRFID }
                                                    ];

                                                    //console.log("3.1", result);

                                                    Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                                                        if (err) {

                                                            console.log(`[${context}] Error `, err.message);
                                                            reject(err);

                                                        } else {

                                                            resolve(true);

                                                        };

                                                    });

                                                })
                                                .catch((error) => {

                                                    console.log(`[${context}][activeTokenInternationalNetwork] Error `, error.message);
                                                    resolve(false);

                                                });

                                        } else {

                                            //console.log("3.2", tokenRFIDEVIO);
                                            let internationalNetworkRFID = {
                                                tokenType: process.env.TokensTypeRFID,
                                                status: tokenRFIDEVIO.status,
                                                wasAssociated: false
                                            };

                                            let contractIdInternationalNetworkRFID = {
                                                tokenType: process.env.TokensTypeRFID,
                                                contract_id: ""
                                            };

                                            let newValues = {
                                                $set: {
                                                    'networks.$[i].tokens.$[j].status': tokenRFIDEVIO.status,
                                                    'networks.$[i].tokens.$[j].wasAssociated': false,
                                                    'contractIdInternationalNetwork.$[i].tokens.$[j].contract_id': "",
                                                    "networks.$[i].hasJoined": true
                                                }
                                            };

                                            let arrayFilters = [
                                                { "i.network": received.network },
                                                { "j.tokenType": process.env.TokensTypeRFID }
                                            ];

                                            Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                                                if (err) {

                                                    console.log(`[${context}] Error `, err.message);
                                                    reject(err);

                                                } else {

                                                    resolve(true);

                                                };

                                            });

                                        };


                                    } else {

                                        resolve(true);

                                    };


                                });

                            })
                            .catch((error) => {

                                console.log(`[${context}][activeTokenInternationalNetwork] Error `, error.message);
                                resolve(false);

                            });

                    });
                })
            ).then((response) => {

                resolve(response);

            }).catch((error) => {

                console.log(`[${context}][promisse.all] Error `, error.message);
                reject(error);

            });

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

function activeRoamingAsync(contract, received) {
    const context = "Function activeRoamingAsync"
    return new Promise((resolve, reject) => {
        try {

            let idTagDec = contract.networks.find(network => { return network.network === process.env.NetworkEVIO }).tokens.find(token => { return token.tokenType === process.env.TokensTypeApp_User }).idTagDec

            activeTokenInternationalNetwork(contract, idTagDec, received.network, process.env.TokensTypeOTHER, true)
                .then((result) => {

                    let query = {
                        _id: contract._id
                    };

                    let newValues = {
                        $set: {
                            "networks.$[i].tokens.$[j].refId": result.refId,
                            "networks.$[i].tokens.$[j].idTagDec": idTagDec,
                            "networks.$[i].tokens.$[j].status": process.env.NetworkStatusActive,
                            "networks.$[i].hasJoined": true
                        }
                    };

                    let arrayFilters = [
                        { "i.network": received.network },
                        { "j.tokenType": process.env.TokensTypeOTHER }
                    ];

                    Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                        if (err) {

                            console.log(`[${context}] Error `, err.message);
                            reject(err);

                        }
                        if (contract.cardType === process.env.CardTypeVirtualPhysical) {

                            //connection to ocpi for Gireve integration RFID
                            let tokenRFIDEVIO = contract.networks.find(network => {
                                return network.network === process.env.NetworkEVIO;
                            }).tokens.find(token => {
                                return token.tokenType === process.env.TokensTypeRFID;
                            });

                            //console.log("3.1", tokenRFIDEVIO);

                            if (tokenRFIDEVIO.status === process.env.NetworkStatusActive) {

                                activeTokenInternationalNetwork(contract, tokenRFIDEVIO.idTagHexa, received.network, process.env.TokensTypeRFID, true)
                                    .then((result) => {

                                        let internationalNetworkRFID = {
                                            tokenType: process.env.TokensTypeRFID,
                                            status: tokenRFIDEVIO.status,
                                            idTagDec: tokenRFIDEVIO.idTagDec,
                                            idTagHexa: tokenRFIDEVIO.idTagHexa,
                                            idTagHexaInv: tokenRFIDEVIO.idTagHexaInv,
                                            wasAssociated: false
                                        };

                                        let contractIdInternationalNetworkRFID = {
                                            tokenType: process.env.TokensTypeRFID,
                                            contract_id: result.contract_id
                                        }

                                        let newValues = {
                                            $set: {
                                                'networks.$[i].tokens.$[j].refId': result.refId,
                                                'networks.$[i].tokens.$[j].status': tokenRFIDEVIO.status,
                                                'networks.$[i].tokens.$[j].idTagDec': tokenRFIDEVIO.idTagDec,
                                                'networks.$[i].tokens.$[j].idTagHexa': tokenRFIDEVIO.idTagHexa,
                                                'networks.$[i].tokens.$[j].idTagHexaInv': tokenRFIDEVIO.idTagHexaInv,
                                                'networks.$[i].tokens.$[j].wasAssociated': false,
                                                'contractIdInternationalNetwork.$[i].tokens.$[j].contract_id': result.contract_id,
                                                "networks.$[i].hasJoined": true
                                            }
                                        };

                                        let arrayFilters = [
                                            { "i.network": received.network },
                                            { "j.tokenType": process.env.TokensTypeRFID }
                                        ];

                                        //console.log("3.1", result);

                                        Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                                            if (err) {

                                                console.log(`[${context}] Error `, err.message);
                                                reject(err);

                                            } else {

                                                resolve(true);

                                            };

                                        });

                                    })
                                    .catch((error) => {

                                        console.log(`[${context}][activeTokenInternationalNetwork] Error `, error.message);
                                        resolve(false);

                                    });

                            } else {

                                //console.log("3.2", tokenRFIDEVIO);
                                let internationalNetworkRFID = {
                                    tokenType: process.env.TokensTypeRFID,
                                    status: tokenRFIDEVIO.status,
                                    wasAssociated: false
                                };

                                let contractIdInternationalNetworkRFID = {
                                    tokenType: process.env.TokensTypeRFID,
                                    contract_id: ""
                                };

                                let newValues = {
                                    $set: {
                                        'networks.$[i].tokens.$[j].status': tokenRFIDEVIO.status,
                                        'networks.$[i].tokens.$[j].wasAssociated': false,
                                        'contractIdInternationalNetwork.$[i].tokens.$[j].contract_id': "",
                                        "networks.$[i].hasJoined": true
                                    }
                                };

                                let arrayFilters = [
                                    { "i.network": received.network },
                                    { "j.tokenType": process.env.TokensTypeRFID }
                                ];

                                Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters }, (err, result) => {
                                    if (err) {

                                        console.log(`[${context}] Error `, err.message);
                                        reject(err);

                                    } else {

                                        resolve(true);

                                    };

                                });

                            };


                        } else {

                            resolve(true);

                        };


                    });

                })
                .catch((error) => {

                    console.log(`[${context}][activeTokenInternationalNetwork] Error `, error.message);
                    resolve(false);

                });

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve(false)
        };
    });
};

//addNewNetworks()
async function addNewNetworks() {
    const context = "Function addNewNetworks";
    try {
        let contracts = await Contract.find({});

        if (contracts.length > 0) {

            contracts.forEach(async contract => {

                let found = contract.networks.find(network => { return network.network === process.env.NetworkEVIO });

                if (found) {
                    let newNetworks;

                    let query = {
                        _id: contract._id
                    };

                    let newValues;

                    if (found.tokens.length === 1) {

                        newNetworks = [
                            {
                                name: process.env.NetworkInternal,
                                networkName: "server_internal_network",
                                network: process.env.NetworkInternal,
                                tokens: [
                                    {
                                        tokenType: process.env.TokensTypeApp_User,
                                        status: process.env.NetworkStatusActive,
                                        idTagDec: found.tokens[0].idTagDec
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
                                        idTagDec: found.tokens[0].idTagDec
                                    }
                                ],
                                hasJoined: true,
                                isVisible: (contract.clientName === process.env.WhiteLabelGoCharge || contract.clientName === process.env.WhiteLabelHyundai) ? true : false
                            },
                            {
                                name: process.env.NetworkHyundai,
                                networkName: "server_hyundai_network",
                                network: process.env.NetworkHyundai,
                                tokens: [
                                    {
                                        tokenType: process.env.TokensTypeApp_User,
                                        status: process.env.NetworkStatusActive,
                                        idTagDec: found.tokens[0].idTagDec
                                    }
                                ],
                                hasJoined: true,
                                isVisible: (contract.clientName === process.env.WhiteLabelGoCharge || contract.clientName === process.env.WhiteLabelHyundai) ? true : false
                            },
                            {
                                name: process.env.NetworkKLC,
                                networkName: "server_klc_network",
                                network: process.env.NetworkKLC,
                                tokens: [
                                    {
                                        tokenType: process.env.TokensTypeApp_User,
                                        status: process.env.NetworkStatusActive,
                                        idTagDec: found.tokens[0].idTagDec
                                    }
                                ],
                                hasJoined: true,
                                isVisible: contract.clientName === process.env.WhiteLabelKLC
                            },
                            {
                                name: process.env.NetworkKinto,
                                networkName: "server_kinto_network",
                                network: process.env.NetworkKinto,
                                tokens: [
                                    {
                                        tokenType: process.env.TokensTypeApp_User,
                                        status: process.env.NetworkStatusActive,
                                        idTagDec: found.tokens[0].idTagDec
                                    }
                                ],
                                hasJoined: true,
                                isVisible: contract.clientName === process.env.WhiteLabelKinto
                            }
                        ];

                        newValues = {
                            "$push": {
                                "networks": {
                                    "$each": newNetworks
                                }
                            }
                        };

                    } else if (found.tokens.length > 1) {

                        newNetworks = [
                            {
                                name: process.env.NetworkInternal,
                                networkName: "server_internal_network",
                                network: process.env.NetworkInternal,
                                tokens: found.tokens,
                                hasJoined: true,
                                isVisible: false
                            },
                            {
                                name: process.env.NetworkGoCharge,
                                networkName: "server_goCharge_network",
                                network: process.env.NetworkGoCharge,
                                tokens: found.tokens,
                                hasJoined: true,
                                isVisible: (contract.clientName === process.env.WhiteLabelGoCharge || contract.clientName === process.env.WhiteLabelHyundai) ? true : false
                            },
                            {
                                name: process.env.NetworkHyundai,
                                networkName: "server_hyundai_network",
                                network: process.env.NetworkHyundai,
                                tokens: found.tokens,
                                hasJoined: true,
                                isVisible: (contract.clientName === process.env.WhiteLabelGoCharge || contract.clientName === process.env.WhiteLabelHyundai) ? true : false
                            },
                            {
                                name: process.env.NetworkKLC,
                                networkName: "server_klc_network",
                                network: process.env.NetworkKLC,
                                tokens: found.tokens,
                                hasJoined: true,
                                isVisible: contract.clientName === process.env.WhiteLabelKLC
                            },
                            {
                                name: process.env.NetworkKinto,
                                networkName: "server_kinto_network",
                                network: process.env.NetworkKinto,
                                tokens: found.tokens,
                                hasJoined: true,
                                isVisible: contract.clientName === process.env.WhiteLabelKinto
                            }
                        ];

                        newValues = {
                            "$push": {
                                "networks": {
                                    "$each": newNetworks
                                }
                            }
                        };

                    };

                    let contractUpdated = await Contract.findOneAndUpdate(query, newValues, { new: true });

                    if (contractUpdated)
                        console.log("Contract Updated");
                    else
                        console.log("Contract Not Updated");

                };

            })
        };

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    };
};


function updateIdTagsMobie(contractFound, network, index, idTagDec, idTagHexa, idTagHexaInv, countryCode, partyId) {
    const context = "Function updateIdTagsMobie"
    return new Promise((resolve, reject) => {

        let oldCard = {
            idTagDec: network.tokens[index].idTagDec,
            idTagHexa: network.tokens[index].idTagHexa,
            idTagHexaInv: network.tokens[index].idTagHexaInv
        }

        if (network.tokens[index].status !== process.env.NetworkStatusInactive) {

            let body = {
                "country_code": "PT",
                "party_id": "EVI",
                "type": process.env.TokensTypeRFID,
                "uid": oldCard.idTagDec,
                "valid": false
            };

            updateMobieToken(body, contractFound.userId)
                .then(async result => {

                    if (result.data.auth === false) {
                        console.log("Result", result.data);
                        reject(false);
                    } else {

                        body = {
                            "country_code": countryCode,
                            "party_id": partyId,
                            "uid": idTagDec,
                            "type": process.env.TokensTypeRFID,
                            "contract_id": contractFound.contract_id,
                            "issuer": "EVIO - Electrical Mobility",
                            "valid": true,
                            "last_updated": "",
                            "source": "",
                            "whitelist": "ALWAYS",
                            "evId": (contractFound.contractType === 'fleet') ? contractFound.evId : '-1',
                            "energy_contract": {
                                "supplier_name": process.env.EnergyContractSupplierName,
                                "contract_id": (process.env.NODE_ENV === 'production') ? process.env.ProdEnergyContractDiaBi : process.env.PreProdEnergyContractDiaBi
                            },
                        };

                        //console.log("body", body);

                        createMobieToken(body, contractFound.userId)
                            .then(result => {

                                let response = {
                                    idTagDec: idTagDec,
                                    idTagHexa: idTagHexa,
                                    idTagHexaInv: idTagHexaInv
                                };

                                resolve(response);

                            })
                            .catch(error => {
                                if (error.response) {
                                    console.log(`[${context}][400][] Error `, error.response.data);
                                    reject(false);
                                }
                                else {
                                    console.log(`[${context}][.catch][createMobieToken] Error `, error.message);
                                    reject(false);
                                };
                            });

                    }
                })
                .catch(error => {

                    if (error.response) {
                        console.log(`[${context}][updateMobieToken][400] Error `, error.response.data);
                        reject(false);
                    } else {
                        console.log(`[${context}][updateMobieToken] Error `, error.message);
                        reject(false);
                    };

                });

        } else {

            let response = {
                idTagDec: idTagDec,
                idTagHexa: idTagHexa,
                idTagHexaInv: idTagHexaInv
            };

            resolve(response);

        };
    });
};

async function sendToBilling(data) {
    const context = "Function sendToBilling";
    try {

        let host = process.env.HostPayments + process.env.PathBillingPhysucalCard
        let payment = await axios.patch(host, data);

        console.log("Send to billing")


    } catch (error) {

        console.log(`[${context}] Error `, error.message);

    };
};

function updateIdTagsRoaming(contractFound, network, index, idTagDec, idTagHexa, idTagHexaInv) {
    const context = "Function updateIdTagsRoaming"
    return new Promise((resolve, reject) => {

        let oldCard = {
            idTagDec: network.tokens[index].idTagDec,
            idTagHexa: network.tokens[index].idTagHexa,
            idTagHexaInv: network.tokens[index].idTagHexaInv
        }

        if (network.tokens[index].status !== process.env.NetworkStatusInactive) {

            let body = {
                "country_code": "PT",
                "party_id": "EVI",
                "type": process.env.TokensTypeRFID,
                "uid": oldCard.idTagHexa,
                "valid": false
            };

            updateGireveToken(body, contractFound.userId)
                .then(async result => {

                    if (result.data.auth === false) {
                        console.log("[updateGireveToken] Result ", result.data);
                        reject(false);
                    } else {

                        activeTokenInternationalNetwork(contractFound, idTagHexa, network.network, process.env.TokensTypeRFID, true)
                            .then((responseData) => {

                                let response = {
                                    idTagDec: idTagDec,
                                    idTagHexa: idTagHexa,
                                    idTagHexaInv: idTagHexaInv
                                };

                                resolve(response);

                            })
                            .catch((error) => {
                                console.log(`[${context}][activeTokenInternationalNetwork] Error `, error.message);
                                reject(false);
                            });

                    };

                })
                .catch(error => {

                    if (error.response) {
                        console.log(`[${context}][updateMobieToken][400] Error `, error.response.data);
                        reject(false);
                    } else {
                        console.log(`[${context}][updateMobieToken] Error `, error.message);
                        reject(false);
                    };

                });

        } else {

            let response = {
                idTagDec: idTagDec,
                idTagHexa: idTagHexa,
                idTagHexaInv: idTagHexaInv
            };

            resolve(response);

        };
    });
};

function createPayment(data) {
    const context = "Function createPayment";
    return new Promise(async (resolve, reject) => {
        try {

            let host = process.env.HostPayments + process.env.PathPaymentPhysicalCard
            let payment = await axios.post(host, data);

            //if (payment.data) {
            resolve(payment.data);
            /*} else {
                resolve(null)
            }*/

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

//ContractHandler.standardizeCemeTariff()

async function addPhysicalCardState() {
    const context = "Function addPhysicalCardState";
    try {

        let query = {
            cardPhysicalState: true
        }

        let updateValues = {
            $set: { cardPhysicalStateInfo: process.env.CARDPHYSICALSTATEINFOACTIVE }
        }

        let results = await Contract.updateMany(query, updateValues)

        console.log("ACTIVE Cards update");
        console.log(results)

        query = {
            cardType: 'Virtual'
        }

        updateValues = {
            $set: { cardPhysicalStateInfo: process.env.CARDPHYSICALSTATEINFOVIRTUALONLY }
        }

        results = await Contract.updateMany(query, updateValues)

        console.log("VIRTUALONLY Cards update");
        console.log(results)

        query = {
            cardPhysicalState: false,
            cardType: 'Virtual_Physical',
            networks: {
                $elemMatch: {
                    name: "EVIO",
                    tokens: {
                        $elemMatch: {
                            tokenType: 'RFID',
                            idTagDec: {
                                $exists: true,
                                $ne: ""
                            }
                        }
                    }
                }
            }
        }

        updateValues = {
            $set: { cardPhysicalStateInfo: process.env.CARDPHYSICALSTATEINFOASSOCIATED }
        }

        results = await Contract.updateMany(query, updateValues)

        console.log("ASSOCIATED Cards update");
        console.log(results)

        query = {
            cardPhysicalState: false,
            cardType: 'Virtual_Physical',
            networks: {
                $elemMatch: {
                    name: "EVIO",
                    tokens: {
                        $elemMatch: {
                            tokenType: 'RFID',
                            $or: [
                                { idTagDec: { $exists: false } },
                                { idTagDec: "" }
                            ]
                        }
                    }
                }
            }
        }

        updateValues = {
            $set: { cardPhysicalStateInfo: process.env.CARDPHYSICALSTATEINFOREQUESTEDTOTHIRDPARTY }
        }

        results = await Contract.updateMany(query, updateValues)

        console.log("REQUESTEDBYCUSTOMER Cards update");
        console.log(results)

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    };
};

async function changeCardDateFormat() {
    const context = "Function changeCardDateFormat";
    try {

        let query = {
            $or:
                [
                    { requestDate: { $exists: true } },
                    { requestThirdPartyDate: { $exists: true } },
                    { processedThirdPartyDate: { $exists: true } },
                    { activationDate: { $exists: true } }
                ]
        }

        let project = {
            _id: 1,
            requestDate: 1,
            requestThirdPartyDate: 1,
            processedThirdPartyDate: 1,
            activationDate: 1
        }

        let contracts = await Contract.find(query, project)

        for (let i = 0; i != contracts.length; i++) {
            let requestUpdatedDate = null
            let requestThirdPartyUpdatedDate = null
            let processedThirdPartyUpdatedDate = null
            let activationUpdatedDate = null

            if (contracts[i].requestDate)
                requestUpdatedDate = moment(contracts[i].requestDate, ["YYYY-M-DD", "YYYY-MM-DD", "DD-MM-YYYY"]).format('YYYY-MM-DD')

            if (contracts[i].requestThirdPartyDate)
                requestThirdPartyUpdatedDate = moment(contracts[i].requestThirdPartyDate, ["YYYY-M-DD", "YYYY-MM-DD", "DD-MM-YYYY"]).format('YYYY-MM-DD')


            if (contracts[i].processedThirdPartyDate)
                processedThirdPartyUpdatedDate = moment(contracts[i].processedThirdPartyDate, ["YYYY-M-DD", "YYYY-MM-DD", "DD-MM-YYYY"]).format('YYYY-MM-DD')

            if (contracts[i].activationDate)
                activationUpdatedDate = moment(contracts[i].activationDate, ["YYYY-M-DD", "YYYY-MM-DD", "DD-MM-YYYY"]).format('YYYY-MM-DD')

            let queryUpdate = {
                _id: contracts[i]._id
            }

            let values = {}

            if (requestUpdatedDate != null)
                values = Object.assign(values, { requestDate: requestUpdatedDate })

            if (requestThirdPartyUpdatedDate != null)
                values = Object.assign(values, { requestThirdPartyDate: requestThirdPartyUpdatedDate })

            if (processedThirdPartyUpdatedDate != null)
                values = Object.assign(values, { processedThirdPartyDate: processedThirdPartyUpdatedDate })


            if (activationUpdatedDate != null)
                values = Object.assign(values, { activationDate: activationUpdatedDate })

            let updateValues = {
                $set: values
            }

            results = await Contract.updateMany(queryUpdate, updateValues)
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    };

};

async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await Contract.updateMany({ 'address.address': { '$exists': true } }, [{ $set: { 'address.street': "$address.address" } }], (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.address to address.street: ", result);
            };
        })

        await Contract.updateMany({ 'address.postCode': { '$exists': true } }, [{ $set: { 'address.zipCode': "$address.postCode" } }], (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.postCode to address.zipCode: ", result);
            };
        })

        let Contracts = await Contract.find({ 'address.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != Contracts.length; i++) {
            if (Contracts[i].address)
                if (Contracts[i].address.country)
                    if (unicCountries.indexOf(Contracts[i].address.country) == -1) {
                        unicCountries.push(Contracts[i].address.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        console.log("coutryCodes", coutryCodes, "unicCountries", unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await Contract.updateMany({ 'address.country': unicCountries[i] }, [{ $set: { 'address.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("result " + unicCountries[i] + " to " + coutryCodes[i] + ": ", result);
                    };
                })
            }
            else {
                console.log("WRONG Country found: " + unicCountries[i])
            }
        }


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return error
    }
}

async function updateshippingAddressModel() {
    const context = "Function updateshippingAddressModel"
    try {

        await Contract.updateMany({ 'shippingAddress.address': { '$exists': true } }, [{ $set: { 'shippingAddress.street': "$shippingAddress.address" } }], (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
            }
            else {
                console.log("result shippingAddress.address to shippingAddress.street: ", result);
            };
        })

        await Contract.updateMany({ 'shippingAddress.postCode': { '$exists': true } }, [{ $set: { 'shippingAddress.zipCode': "$shippingAddress.postCode" } }], (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
            }
            else {
                console.log("result shippingAddress.postCode to shippingAddress.zipCode: ", result);
            };
        })

        let Contracts = await Contract.find({ 'shippingAddress.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != Contracts.length; i++) {
            if (Contracts[i].shippingAddress)
                if (Contracts[i].shippingAddress.country)
                    if (unicCountries.indexOf(Contracts[i].shippingAddress.country) == -1) {
                        unicCountries.push(Contracts[i].shippingAddress.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        console.log("coutryCodes")
        console.log(coutryCodes)

        console.log("unicCountries")
        console.log(unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await Contract.updateMany({ 'shippingAddress.country': unicCountries[i] }, [{ $set: { 'shippingAddress.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("result " + unicCountries[i] + " to " + coutryCodes[i] + ": ", result);
                    };
                })
            }
            else {
                console.log("WRONG Country found: " + unicCountries[i])
            }
        }


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return error
    }
}

async function updateZipCodeAddress() {

    const query = {
        $and: [
            {
                'address.zipCode':
                {
                    $not:
                        { $regex: '^[0-9]{4}-[0-9]{3}$' }
                }
            },
            { 'address.zipCode': { $exists: true } },
            { 'address.countryCode': 'PT' }
        ]
    }

    const contracts = await Contract.find(query)

    let contractsWithProblem = []

    contracts.forEach(async contract => {

        let zipCode = contract.address.zipCode.trim()

        if (/^[0-9]{4}.[0-9]{3}$/.test(zipCode)) {
            zipCode = zipCode.slice(0, 4) + "-" + zipCode.slice(5);
        }
        else if (/^[0-9]{7}$$/.test(zipCode)){
            zipCode = zipCode.slice(0, 4) + "-" + zipCode.slice(4);
        } else {
            contractsWithProblem.push({
                "_id": contract._id,
                "userId": contract.userId,
                "zipCode": zipCode
            })
        }

        await Contract.updateOne({ _id: contract._id }, { $set: { 'address.zipCode': zipCode } })

    });

    return contractsWithProblem;
}

async function updateZipCodeShippingAddress() {

    const query = {
        $and: [
            {
                'shippingAddress.zipCode':
                {
                    $not:
                        { $regex: '^[0-9]{4}-[0-9]{3}$' }
                }
            },
            { 'shippingAddress.zipCode': { $exists: true } },
            { 'shippingAddress.countryCode': 'PT' }
        ]
    }

    const contracts = await Contract.find(query)

    let contractsWithProblem = []

    contracts.forEach(async contract => {

        let zipCode = contract.shippingAddress.zipCode.trim()

        if (/^[0-9]{4}.[0-9]{3}$/.test(zipCode)) {
            zipCode = zipCode.slice(0, 4) + "-" + zipCode.slice(5);
        }
        else if (/^[0-9]{7}$$/.test(zipCode)){
            zipCode = zipCode.slice(0, 4) + "-" + zipCode.slice(4);
        } else {
            contractsWithProblem.push({
                "_id": contract._id,
                "userId": contract.userId,
                "zipCode": zipCode
            })
        }

        await Contract.updateOne({ _id: contract._id }, { $set: { 'shippingAddress.zipCode': zipCode } })

    });

    return contractsWithProblem;
}

async function removePostCodeAddress() {

    const query = { 'address.postCode': { $exists: true } }

    const contracts = await Contract.find(query);

    contracts.forEach(async contract => {

        let contractV2 = JSON.parse(JSON.stringify(contract.address))

        delete contractV2.postCode

        await Contract.updateOne({ _id: contract._id }, { $set: { 'address': contractV2  } });

    });

    return
}

async function removePostCodeShippingAddress() {

    const query = { 'shippingAddress.postCode': { $exists: true } }

    const contracts = await Contract.find(query);

    contracts.forEach(async contract => {

        let contractV2 = JSON.parse(JSON.stringify(contract.shippingAddress))

        delete contractV2.postCode

        await Contract.updateOne({ _id: contract._id }, { $set: { 'shippingAddress': contractV2  } });

    });

    return
}


async function updateRFIDContracts(contractFound) {
    const context = "Function updateRFIDContracts"
    return new Promise(async (resolve, reject) => {
        try {
            let query = {
                _id: contractFound._id
            };
            contractFound.networks.forEach(async network => {
                let newValues = {
                    $set: {
                        "networks.$[i].tokens.$[j].status": process.env.NetworkStatusActive,
                        "networks.$[i].hasJoined": true
                    }
                };
                let arrayFilters = [
                    { "i.network": network.network },
                    { "j.tokenType": process.env.TokensTypeRFID }
                ];
                let contract = await Contract.findOneAndUpdate(query, newValues, { arrayFilters: arrayFilters })
            })
            let contractsUpdated = await Contract.findOne(query)
            resolve(contractsUpdated)
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error)
        };
    });
};

async function updateCardDateFormats() {
    const context = "Function updateCardDateFormats";
    try {
        const query = {
            $or: [
                { requestDate: { $exists: true } },
                { requestThirdPartyDate: { $exists: true } },
                { processedThirdPartyDate: { $exists: true } },
                { activationDate: { $exists: true } }
            ]
        }

        const project = {
            _id: 1,
            requestDate: 1,
            requestThirdPartyDate: 1,
            processedThirdPartyDate: 1,
            activationDate: 1
        }

        const contracts = await Contract.find(query, project);

        for (const contract of contracts) {

            let values = {}

            const updateDateField = (fieldName, dateValue) => {
                if (dateValue) {
                    const updatedDate = new Date(dateValue);
                    updatedDate.setHours(0, 0, 0, 0);
                    values[fieldName] = updatedDate;
                }
            };

            updateDateField('requestDate', contract.requestDate);
            updateDateField('requestThirdPartyDate', contract.requestThirdPartyDate);
            updateDateField('processedThirdPartyDate', contract.processedThirdPartyDate);
            updateDateField('activationDate', contract.activationDate);

            let queryUpdate = {
                _id: contract._id
            }

            let updateValues = {
                $set: values
            }

            try {
                const results = await Contract.updateMany(queryUpdate, updateValues)
                if (results.nModified > 0) {
                    console.log(`Updated ${results.nModified} documents for _id: ${contract._id}`);
                }
            } catch (updateError) {
                console.log(`[${context}] Update error: `, updateError.message);
            }
        }

        console.log(`[${context}] Update completed successfully`);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    };
};

async function updateFieldNames() {
    const context = "Function updateFieldNames";

    try {
        const query = {
            cardPhysicalLisencePlate: { $exists: true }
        };

        const updateNameField = {
            $rename: { 'cardPhysicalLisencePlate': 'cardPhysicalLicensePlate' }
        };

        const result = await Contract.updateMany(query, updateNameField);
        console.log(`[${context}] Update result:`, result);

        if (result.n === 0) {
            console.log(`[${context}] No documents found with field 'cardPhysicalLisencePlate'`);
        } else {
            console.log(`[${context}] Matched ${result.n} and modified ${result.nModified} documents`);
        }
        console.log(`[${context}] Update completed successfully`);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

async function validatePaymentMethod(userId) {
    const headers = { userid: userId };
    const host = process.env.HostPayments + process.env.PathGetPaymentMethodDefault;
    const userWalletURL = `${process.env.HostPayments}/api/private/wallet/byUser`;

    const paymentMethod = await AxiosHandler.axiosGetHeaders(host, headers);

    const userFound = await User.findOne({ _id: userId }, { _id: 1, clientType: 1 })
    const wallet = await AxiosHandler.axiosGetHeaders(userWalletURL, headers);

    const hasValidPaymentMethod = (paymentMethods) => {
        return paymentMethods.filter(pm => pm.defaultPaymentMethod === true && pm.status !== Enums.PaymentMethodStatus.Expired).length > 0;
    }

    if (!hasValidPaymentMethod(paymentMethod) && userFound.clientType === process.env.ClientTypeb2c && wallet.amount.value < paymentValidationEnum.minAmountWallet) {
        return false;
    }

    return true;
}

module.exports = router;
