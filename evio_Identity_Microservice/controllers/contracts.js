const contractServices = require('../services/contracts');
const TokenStatusService = require('../services/tokenStatus.service');
const { cancelRfidTagsAndRemoveTokens } = require('../services/cancel-rfid')
const Contract = require('../models/contracts');
const User = require('../models/user');
const GroupCSUsers = require('../models/groupCSUsers');
const ExternalRequestsHandler = require('./externalRequests');
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const rawdata = fs.readFileSync(path.resolve(__dirname, "../digitCalculation/lists.json"));
const checkDigitLists = JSON.parse(rawdata);
const checkDigitMobility = require('../digitCalculation/digitCalculation');
const CemeData = require('./ceme');
const whiteLabelMap = require('../utils/whiteLabelMap.json');
const AxiosHandler = require('../services/axios');
const BillingProfileHandler = require('./billingProfile');
const CemeTarifftsHandler = require('./cemeTariff');
const moment = require('moment');
const Converter = require('hexadecimal-to-decimal')
const toggle = require('evio-toggle').default;
const { updateNetworkStatus } = require('evio-library-assets').default;
const { default: { clientTypes, contractTypes } } = require('../utils/constants');
const { default: { getGroupDriversByUserId } } = require('../services/groupDriver');
const { default: { getSharedEvs } } = require('../services/evs');
const { addRFIDToNetworks } = require('../services/add-rfid-to-networks')
const { Enums } = require('evio-library-commons').default;

const { notifyRFID } = require('evio-library-notifications').default;

const { billingProfileStatus, paymentValidationEnum } = require('../constants/env').default;

const getContractsB2C = async (userId, req) => {
    const context = 'Function getContractsB2C';

    try {
        const paymentMethods = await ExternalRequestsHandler.getPaymentMethods(userId);

        const groupDrivers = await getGroupDriversByUserId(userId);

        let groupDriversIds = []
        if (groupDrivers?.length != 0) {
            groupDriversIds =  groupDrivers.map(groupDriverId => groupDriverId._id.toString());
        }

        const evs = await getSharedEvs(userId, groupDriversIds);

        let query;
        if (evs.length > 0) {
            let evIds = evs.map(ev => ev._id);
            query = {
                $or: [
                    {
                        active: true,
                        evId: evIds
                    },
                    {
                        userId,
                        contractType: contractTypes.user,
                        active: true
                    }
                ]
            };
        } else {
            query = {
                userId,
                contractType: contractTypes.user,
                active: true
            };
        }
        console.log(`[${context}] Query `,{query});
        let contractsFound = await Contract.find(query);
        console.log(`[${context}] contractsFound.length `,{length: contractsFound.length});

        let contractToSend = await ExternalRequestsHandler.getTariffInfo(contractsFound, paymentMethods);
        console.log(`[${context}] contractToSend.length `,{length: contractToSend.length});
        
        console.log(`${context} contracts: ${JSON.stringify(contractToSend)}`);
        let contractToSendMerged = contractToSend.map(contract => {
            const userIdWillPay = getUserIdWillPay(contract, evs, userId);
            console.log(`Contract ID: ${contract._id}, userIdWillPay: ${userIdWillPay}`);
            return {
                ...contract,
                userIdWillPay
            };
        });
        
        return contractToSendMerged;
    } catch (error) {
        console.log(`[${context}] Error `, {error});
        throw error;
    }
};

const getContractsB2B = async (userId, req) => {
    const context = 'Function getContractsB2B';
    try {

        let query;
        if (req.query.contractType) {
            if (req.query.contractType === process.env.ContractTypeUser) {
                query = {
                    userId,
                    contractType: process.env.ContractTypeUser,
                    active: true
                };
            }
            else {
                if (req.query.contractType === process.env.ContractTypeFleet) {
                    query = {
                        userId,
                        contractType: process.env.ContractTypeFleet,
                        active: true
                    };
                }
            }
        } else {
            query = {
                userId,
                $or: [
                    { contractType: process.env.ContractTypeUser },
                    { contractType: process.env.ContractTypeFleet }
                ],
                active: true
            };
        }

        let contractsFound = await Contract.find(query);

        if (contractsFound.length === 0) {
            return contractsFound;
        }

        let paymentMethods = await ExternalRequestsHandler.getPaymentMethods(userId);
        contractsFound = JSON.parse(JSON.stringify(contractsFound));

        console.log(`[${context}] Contracts found: ${contractsFound.length}`);

        let contractToSend = await ExternalRequestsHandler.getTariffInfo(contractsFound, paymentMethods)
        return contractToSend;
    } catch (error) {
        console.log(`[${context}] Error `, error);
        throw error;
    }
}

module.exports = {
    cancelRFID: (contractId, reason, userId, isNewCard=false) => {
        return cancelRFID(contractId, reason, userId, isNewCard)
    },
    updatePaymentRequestPhysicalCard: (payment) => {
        const context = "Funciton updatePaymentRequestPhysicalCard";
        return new Promise(async (resolve, reject) => {
            try {

                let query = { _id: payment.contractId }

                let contractFound = await Contract.findOne(query);

                if (payment.status === "40") {

                    let found = contractFound.networks.find(network => {
                        return network.network === process.env.NetworkMobiE && network.tokens.find(token => {
                            return token.tokenType === process.env.TokensTypeRFID && (token.status === process.env.NetworkStatusToRequest || token.status === process.env.NetworkStatusActive)
                        })
                    });

                    //console.log("found", found)
                    if (found) {

                        contractFound.cardType = process.env.CardTypeVirtualPhysical;
                        contractFound.cardPhysicalPaymentStateInfo = process.env.CARDPHYSICALPAYMENTSTATEINFOPAID;

                        let newValues = { $set: contractFound };

                        let contractUpdated = await Contract.findOneAndUpdate(query, newValues, { new: true })
                        resolve(contractUpdated);

                    } else {

                        let newToken = {
                            tokenType: process.env.TokensTypeRFID,
                            status: 'toRequest',
                            refId: ""
                        }

                        contractFound.cardType = process.env.CardTypeVirtualPhysical;
                        contractFound.cardPhysicalPaymentStateInfo = process.env.CARDPHYSICALPAYMENTSTATEINFOPAID;
                        contractFound.cardPhysicalStateInfo = process.env.CARDPHYSICALSTATEINFOREQUESTEDBYCUSTOMER;
                        contractFound.requestDate = new Date();

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
                        ).then(async () => {

                            //console.log("contractFound", contractFound);
                            let newValues = { $set: contractFound };
                            let contractUpdated = await Contract.findOneAndUpdate(query, newValues, { new: true })

                            sendEmailEVIO(contractUpdated, contract.address);

                            resolve(contractUpdated);

                        }).catch(error => {
                            console.log(`[${context}] Error `, error.message);
                            reject(error);
                        })

                    };

                } else {

                    let contractUpdated = await Contract.findOneAndUpdate(query, { $set: { cardPhysicalPaymentStateInfo: process.env.CARDPHYSICALPAYMENTSTATEINFOPAYMENTFAILURE } }, { new: true })

                    let mailOptions = {
                        to: contractFound.email,
                        subject: `EVIO - Erro na Solicitação do Cartão`,
                        message: {
                            "username": contractUpdated.name,
                        },
                        type: "errorRequestCard"
                    };

                    sendEmailClient(mailOptions, contractUpdated.clientName);

                    reject({ auth: false, code: 'server_failed_request_physicalCard', message: 'Failed to request a physical card ' });
                }

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    updateCardPhysicalStateInfo: (body) => {
        const context = "Funciton cancelRFID";
        return new Promise(async (resolve, reject) => {
            try {
                if (!body.contractId) {
                    reject({ auth: false, code: 'server_contractId_required', message: 'Contract id required' });
                };
                if (!body.cardPhysicalStateInfo) {
                    reject({ auth: false, code: 'server_stateInfo_required', message: 'State info required' });
                };

                if (!process.env.CARDPHYSICALSTATEINFOENUM.includes(body.cardPhysicalStateInfo)) {
                    reject({ auth: false, code: 'server_stateInfo_not_valid', message: 'State info not valid' });
                };

                let query = {
                    _id: body.contractId
                }

                let contractUpdated = await Contract.findOneAndUpdate(query, { $set: { cardPhysicalStateInfo: body.cardPhysicalStateInfo } }, { new: true })

                resolve(contractUpdated);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    getMyContracts: (userId, req) => {
        return getMyContracts(userId, req);
    },
    activeNetworks: (req) => {
        const context = "Function activeNetworks";
        return new Promise(async (resolve, reject) => {
            try {
                const path = `${req.method} ${req.baseUrl}`;
                const userId = req.headers['userid'];
                const userType = req.headers['usertype'];
                const clientName = req.headers['clientname'];
                let received = req.body;

                if (!received.contractId)
                    reject({ auth: false, code: 'contract_id_required', message: 'Contract id is required' });

                if (!received.network)
                    reject({ auth: false, code: 'contract_network_required', message: 'Network is required' });

                if (process.env.NETWORKS.includes(received.network)) {

                    const contractFound = await Contract.findOne({ _id: received.contractId });
                    if (!contractFound) return reject({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });

                    const anotherContractsFound = await Contract.find({ _id: { $ne: received.contractId }, status: process.env.ContractStatusActive, userId: contractFound.userId });

                    //Main contract to activate
                    const contractActivated = await activateOrDeactivateTokensInANetwork(contractFound, received.network, true, path);

                    if (contractActivated?.auth) {
                        //Activate other contracts in the same network
                        anotherContractsFound.forEach(async (anotherContract) => {
                            activateOrDeactivateTokensInANetwork(anotherContract, received.network, true, path);
                        });

                        // Retrieve contract updated
                        const contractUpdated = await Contract.findOne({ _id: received.contractId });
                        resolve({...contractActivated, contract: contractUpdated});
                    } else {
                        // If the activation failed, reject with the error
                        reject(contractActivated);
                    }


                } else {
                    reject({ auth: false, code: 'server_contract_network_not_recognized', message: 'Network is not recognized' });
                };

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    updateTariffContractACP: async (userId, valid, clientName) => {
        const context = "Funciton updateTariffContractACP";
        return new Promise(async (resolve, reject) => {
            try {

                let cemeTariff = await CemeData.getCEMEEVIOADHOC(clientName, valid);

                let tariff = {
                    power: "all",
                    planId: cemeTariff.plan._id
                };
                //console.log("tariff", tariff);

                let contractsUpdated = await Contract.updateMany({ userId: userId }, { $set: { tariff: tariff } }, { new: true });

                resolve(contractsUpdated)
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    requestPhysicalCardEVIO: (contract, userId, clientName) => {
        const context = "Funciton requestPhysicalCardEVIO";
        return new Promise(async (resolve, reject) => {
            try {

                const headers = { userid: userId };
                const host = process.env.HostPayments + process.env.PathGetPaymentMethodDefault;
                const userWalletURL = `${process.env.HostPayments}/api/private/wallet/byUser`;

                const paymentMethod = await AxiosHandler.axiosGetHeaders(host, headers);
                const billingProfile = await BillingProfileHandler.validateBillingProfile(userId);

                const isFlagBillingProfileStatus = await toggle.isEnable('bp-369-no-address-validation-on-physical-card-request')
                console.log('isFlagBillingProfileStatus', isFlagBillingProfileStatus)
                if(isFlagBillingProfileStatus && billingProfile?.status !== billingProfileStatus.ACTIVE) {
                    console.log('validations billing profile status active')
                    return reject({ auth: false, statusCode: 400, message: { code: 'server_billingProfile_required', message: "Billing Profile is required", redirect: "billing" }});
                }


                const userFound = await User.findOne({ _id: userId }, { _id: 1, clientType: 1 })
                const wallet = await AxiosHandler.axiosGetHeaders(userWalletURL, headers);

                let valid = await validateFieldsRequestPhysicalCardWL(contract);
                console.log(`[${context}] valid`, valid);
                if (valid) {

                    if (!hasValidPaymentMethod(paymentMethod) && userFound.clientType === process.env.ClientTypeb2c && wallet.amount.value < paymentValidationEnum.minAmountWallet) {
                        return reject({ auth: false, statusCode: 400, message: { code: 'server_paymentMethod_or_wallet_required', message: "Payment method or Wallet with more than 30€ required", redirect: "payments" }});
                    }

                    if (!billingProfile && userFound.clientType === process.env.ClientTypeb2c) {
                        return reject({ auth: false, statusCode: 400, message: { code: 'server_billingProfile_required', message: "Billing Profile is required", redirect: "billing" }});
                    }

                    if (userFound.clientType === process.env.ClientTypeb2c) {
                        let newPaymentMethod = await paymentMethod.find(method => {
                            return method.defaultPaymentMethod === true;
                        });

                        if (!newPaymentMethod) {
                            contract.paymentMethod = paymentMethod[0]?.paymentMethodId ?? contract.paymentMethod;
                        }
                        else {
                            contract.paymentMethod = newPaymentMethod.paymentMethodId;
                        }
                    }

                    let response = await requestPhysicalCard(contract, userId, clientName)

                    return resolve(response)

                }

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                return reject(error);
            }
        })
    },
    requestPhysicalCardWL: (contract, userId, clientName) => {
        const context = "Funciton requestPhysicalCardWL";
        return new Promise(async (resolve, reject) => {
            try {

                const headers = { userid: userId };
                const host = process.env.HostPayments + process.env.PathGetPaymentMethodDefault;
                const userWalletURL = `${process.env.HostPayments}/api/private/wallet/byUser`;

                const paymentMethod = await AxiosHandler.axiosGetHeaders(host, headers);
                const billingProfile = await BillingProfileHandler.validateBillingProfile(userId);
                const userFound = await User.findOne({ _id: userId }, { _id: 1, clientType: 1 });
                const wallet = await AxiosHandler.axiosGetHeaders(userWalletURL, headers);

                 const isFlagBillingProfileStatus = await toggle.isEnable('bp-369-no-address-validation-on-physical-card-request')
                console.log('isFlagBillingProfileStatus', isFlagBillingProfileStatus)
                if(isFlagBillingProfileStatus && billingProfile?.status !== billingProfileStatus.ACTIVE) {
                    console.log('validations billing profile status active')
                    return reject({ auth: false, statusCode: 400, message: { code: 'server_billingProfile_required', message: "Billing Profile is required", redirect: "billing" }});
                }

                let valid = await validateFieldsRequestPhysicalCardWL(contract)
                if (valid) {

                    if (!hasValidPaymentMethod(paymentMethod) && userFound.clientType === process.env.ClientTypeb2c && wallet.amount.value < paymentValidationEnum.minAmountWallet) {
                        return reject({ auth: false, statusCode: 400, message: { code: 'server_paymentMethod_or_wallet_required', message: "Payment method or Wallet with more than 30€ required", redirect: "payments" }});

                    }

                    if (!billingProfile && userFound.clientType === process.env.ClientTypeb2c) {
                        return reject({ auth: false, statusCode: 400, message: { code: 'server_billingProfile_required', message: "Billing Profile is required", redirect: "billing" }});
                    }

                    if (userFound.clientType === process.env.ClientTypeb2c) {
                        let newPaymentMethod = await paymentMethod.find(method => {
                            method.defaultPaymentMethod === true;
                        });

                        if (!newPaymentMethod) {
                            contract.paymentMethod = paymentMethod[0]?.paymentMethodId ?? contract.paymentMethod;
                        }
                        else {
                            contract.paymentMethod = newPaymentMethod.paymentMethodId;
                        }
                    }

                    let response = await requestPhysicalCardWLFinal(contract, userId, clientName)

                    return resolve(response);

                }

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                return reject(error);
            }
        });
    },
    blockRFID: (req) => {
        const context = "Funciton blockRFID";
        return new Promise(async (resolve, reject) => {
            try {
                const useAssetsLibFlag = await toggle.isEnable('charge-524-rework-block-rfid')

                let received = req.body;

                let query = {
                    userId: received.userId,
                    cardType: process.env.CardTypeVirtualPhysical,
                    status: process.env.ContractStatusActive,
                    active: true,
                    cancelReason: { $ne: process.env.CancelReasonCard }
                };

                let userFound = await User.findOne({ _id: received.userId });
                let contractsFound = await Contract.find(query);

                //console.log("contractsFound", contractsFound.length);
                if (contractsFound.length === 0) {
                    console.log("No cards RFID to block")
                    resolve("No cards RFID to block");
                } else {
                    console.log("Cards RFID to block")

                    Promise.all(
                        contractsFound.map(contract => {
                            return new Promise((resolve, reject) => {
                                const networksUpdatePromise = useAssetsLibFlag
                                    ? updateNetworkStatus({ // if any network fails, revert the sucessful ones and throws an exception
                                            userId: received.userId,
                                            contractId: String(contract._id),
                                            action: 'DEACTIVATE', // TODO commons constant/enum
                                            tokenTypes: ['RFID'],
                                            path: 'PATCH /api/private/contracts/blockRFIDCard',
                                            reason: process.env.CancelReasonCard
                                        })
                                    : Promise.all(
                                    contract.networks.map(network => {
                                        return new Promise(async (resolve, reject) => {

                                            let tokenFound;
                                            switch (network.network) {
                                                case process.env.NetworkMobiE:

                                                    tokenFound = network.tokens.findIndex(token => {
                                                        return token.tokenType === process.env.TokensTypeRFID;
                                                    })

                                                    if (tokenFound >= 0) {

                                                        network.tokens[tokenFound].status = process.env.NetworkStatusInactive;

                                                        if (network.hasJoined) {
                                                            tokenRFID = network.tokens.find(token => { return token.tokenType === process.env.TokensTypeRFID })

                                                            //Cancel RFID in OCPI

                                                            body = {
                                                                "country_code": "PT",
                                                                "party_id": "EVI",
                                                                "type": process.env.TokensTypeRFID,
                                                                "uid": tokenRFID.idTagDec,
                                                                "valid": false
                                                            };

                                                            try {

                                                                let responseMobiE = await updateMobieToken(body, contract.userId);

                                                            } catch (error) {

                                                                console.log(`[${context}][updateMobieToken] Error `, error.message);
                                                                //reject(error);

                                                            }

                                                        };
                                                        resolve(true)

                                                    } else {

                                                        resolve(false)

                                                    };

                                                    break;

                                                case process.env.NetworkGireve:

                                                    tokenFound = network.tokens.findIndex(token => {
                                                        return token.tokenType === process.env.TokensTypeRFID;
                                                    })

                                                    if (tokenFound >= 0) {

                                                        network.tokens[tokenFound].status = process.env.NetworkStatusInactive;

                                                        if (network.hasJoined) {
                                                            tokenRFID = network.tokens.find(token => { return token.tokenType === process.env.TokensTypeRFID })

                                                            //Cancel RFID in OCPI
                                                            body = {
                                                                "type": process.env.TokensTypeRFID,
                                                                "uid": tokenRFID.idTagHexa,
                                                                "valid": false
                                                            };

                                                            try {

                                                                let responseGirebe = await updateGireveToken(body, contract.userId);

                                                            } catch (error) {

                                                                console.log(`[${context}][updateGireveToken] Error `, error.message);

                                                            }

                                                        }

                                                        resolve(true)

                                                    } else {
                                                        resolve(false)
                                                    };

                                                    break;
                                                default:

                                                    tokenFound = network.tokens.findIndex(token => {
                                                        return token.tokenType === process.env.TokensTypeRFID;
                                                    })

                                                    if (tokenFound >= 0) {

                                                        network.tokens[tokenFound].status = process.env.NetworkStatusInactive;
                                                        resolve(true)

                                                    } else {
                                                        resolve(false)
                                                    };
                                                    break;
                                            }

                                        });
                                    })
                                )

                                networksUpdatePromise.then(async () => {

                                    const update = { cancelReason: process.env.CancelReasonCard }
                                    await Contract.findOneAndUpdate({ _id: contract._id }, { $set: update });
                                    resolve(true);

                                }).catch((err) => reject(err))
                            })
                        })
                    ).then(result => {
                        notifyRFID(userFound._id, process.env.RFIDBLOCKED, userFound.name)
                        resolve("Cards RFID blocked")

                    }).catch((err) => reject(err))

                };
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    unlockRFID: (req) => {
        const context = "Funciton unlockRFID";
        return new Promise(async (resolve, reject) => {
            try {

                const useAssetsLibFlag = await toggle.isEnable('charge-523-rework-unlockrfid')

                let received = req.body;

                let query = {
                    userId: received.userId,
                    cardType: process.env.CardTypeVirtualPhysical,
                    cancelReason: process.env.CancelReasonCard,
                    status: process.env.ContractStatusActive,
                    active: true
                };

                let userFound = await User.findOne({ _id: received.userId });
                let contractsFound = await Contract.find(query);

                if (contractsFound.length === 0) {
                    console.log("No cards RFID to unlock")
                    resolve("No cards RFID to unlock");
                } else {
                    console.log("Cards RFID to unlock")
                    Promise.all(
                        contractsFound.map(contract => {
                            return new Promise((resolve, reject) => {
                                const networksUpdatePromise = useAssetsLibFlag
                                    ? updateNetworkStatus({ // if any network fails, revert the sucessful ones and throws an exception
                                            userId: received.userId,
                                            contractId: String(contract._id),
                                            action: 'ACTIVATE', // TODO commons constant/enum
                                            tokenTypes: ['RFID'],
                                            path: 'PATCH /api/private/contracts/unlockRFIDCard'
                                        })
                                    : Promise.all(
                                    contract.networks.map(network => {
                                        return new Promise(async (resolve, reject) => {

                                            let tokenFound
                                            switch (network.network) {
                                                case process.env.NetworkMobiE:

                                                    tokenFound = network.tokens.findIndex(token => {
                                                        return token.tokenType === process.env.TokensTypeRFID;
                                                    })

                                                    if (tokenFound >= 0) {

                                                        network.tokens[tokenFound].status = process.env.NetworkStatusActive;

                                                        if (network.hasJoined) {
                                                            tokenRFID = network.tokens.find(token => { return token.tokenType === process.env.TokensTypeRFID })

                                                            //Cancel RFID in OCPI

                                                            body = {
                                                                "country_code": "PT",
                                                                "party_id": "EVI",
                                                                "type": process.env.TokensTypeRFID,
                                                                "uid": tokenRFID.idTagDec,
                                                                "valid": true
                                                            };

                                                            try {

                                                                let responseMobiE = await updateMobieToken(body, contract.userId);

                                                            } catch (error) {

                                                                console.log(`[${context}][updateMobieToken] Error `, error.message);
                                                                //reject(error);

                                                            }

                                                        };
                                                        resolve(true)

                                                    } else {

                                                        resolve(false)

                                                    };

                                                    break;

                                                case process.env.NetworkGireve:

                                                    tokenFound = network.tokens.findIndex(token => {
                                                        return token.tokenType === process.env.TokensTypeRFID;
                                                    })

                                                    if (tokenFound >= 0) {

                                                        network.tokens[tokenFound].status = process.env.NetworkStatusActive;

                                                        if (network.hasJoined) {
                                                            tokenRFID = network.tokens.find(token => { return token.tokenType === process.env.TokensTypeRFID })

                                                            //Cancel RFID in OCPI
                                                            body = {
                                                                "type": process.env.TokensTypeRFID,
                                                                "uid": tokenRFID.idTagHexa,
                                                                "valid": true
                                                            };

                                                            try {

                                                                let responseGirebe = await updateGireveToken(body, contract.userId);

                                                            } catch (error) {

                                                                console.log(`[${context}][updateGireveToken] Error `, error.message);

                                                            }

                                                        }

                                                        resolve(true)

                                                    } else {
                                                        resolve(false)
                                                    };

                                                    break;
                                                default:

                                                    tokenFound = network.tokens.findIndex(token => {
                                                        return token.tokenType === process.env.TokensTypeRFID;
                                                    })

                                                    if (tokenFound >= 0) {

                                                        network.tokens[tokenFound].status = process.env.NetworkStatusActive;
                                                        resolve(true)

                                                    } else {
                                                        resolve(false)
                                                    };
                                                    break;

                                            };

                                        });
                                    })
                                )

                                networksUpdatePromise.then(async () => {

                                    const update = { cancelReason: '' }
                                    await Contract.findOneAndUpdate({ _id: contract._id }, { $set: update });
                                    resolve(true);

                                }).catch((err) => {
                                    return reject(err)
                                })
                            })
                        })
                    ).then(result => {
                        notifyRFID(userFound._id, process.env.RFIDUNLOCKED, userFound.name)
                        resolve("Cards RFID unlocked")
                    }).catch((err) => {
                        return reject(err)
                    })
                };

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    updateMobileContract: (user) => {
        let context = "Function updateMobileContract";

        let query = {
            userId: user._id
        };

        let newValues = {
            $set: { mobile: user.mobile }
        };

        Contract.updateMany(query, newValues, (err, result) => {
            if (err) {
                console.log(`[${context}][.catch] Error `, err.message);
            }
            else
                console.log("Updated", result);
        });
    },
    updatePaymentMethod: (req) => {
        const context = "Funciton updatePaymentMethod";
        return new Promise(async (resolve, reject) => {
            try {
                let paymentMethodId = req.body.paymentMethodId;
                let userId = req.body.userId;

                let query = {
                    userId: userId
                };

                let contractsFound = await Contract.find(query);

                if (contractsFound.length > 0) {

                    let promises = [];

                    for (let i = 0; i < contractsFound.length; i++) {

                        let contract = contractsFound[i];
                        promises.push(new Promise(async (resolve, reject) => {

                            contract.networks.map(network => {
                                network.paymentMethod = paymentMethodId
                                return
                            })

                            let contractUpdated = await Contract.findOneAndUpdate({ _id: contract._id }, { $set: contract }, { new: true });

                            resolve()

                        }));
                    }
                    Promise.all(promises)
                        .then(() => {
                            resolve({ auth: true, code: "", message: "Contracts updated" });
                        })
                        .catch((error) => {
                            console.log(`[${context}][] Error `, error.message);
                            reject(error);
                        });

                } else {
                    resolve({ auth: false, code: "", message: "No Contracts" });
                }

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    standardizeCemeTariff: async () => {
        let context = "Function standardizeCemeTariff";
        try {

            CemeTarifftsHandler.standardizeCemeTariff();
            let cemeTariff = await CemeData.getCEMEEVIOADHOC("EVIO", false);

            console.log("cemeTariff", cemeTariff.plan._id);

            let query = {
                status: "active",
                clientName: "EVIO"
            }

            let tariff = {
                power: "all",
                planId: cemeTariff.plan._id
            }

            let contractsUpdated = await Contract.updateMany(query, { $set: { tariff: tariff } }, { new: true });
            console.log("contractsUpdated", contractsUpdated)


        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        };
    },
    activateNewCard: async (contractId, card, clientName, cardNumber, userId) => {
        const context = "Funciton activateNewCard";
        try {
            let tags = await convertTags(card.dec)

            let query = {
                _id: contractId,
                clientName: clientName
            };
            let contractFound = await contractsFindOne(query);
            if (!contractFound)
                return null
            if (contractFound.cardType == process.env.CardTypeVirtualPhysical) {
                //DEACTIVATE OLD CARD
                contractFound = await cancelRFID(contractId, "New_Card_Added", userId, true);
            }

            //ACTIVATE NEW CARD
            let data = {
                cardNumber: card.cardNumber,
                idTagDec: tags.tagDecimalInvert,
                idTagHexa: tags.tagHexa,
                idTagHexaInv: tags.tagHexaInvert,
                contractId: contractFound._id
            };

            let dataToResponse = await addCardRFIDToNetworks(contractFound, data, true, query)


            return dataToResponse
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return null
        };
    },
    getEvsContracts: (userId, evIdList) => {
        const context = "Funciton getEvsContracts";
        return new Promise(async (resolve, reject) => {
            try {

                let query = {
                    evId: {$in : evIdList},
                    contractType: process.env.ContractTypeFleet,
                    active: true
                };
                let contractsFound = await Contract.find(query).lean()
                resolve(contractsFound)

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    getFleetEvsContracts: (userId, evIdList) => {
        const context = "Funciton getFleetEvsContracts";
        return new Promise(async (resolve, reject) => {
            try {

                let query = {
                    evId: {$in : evIdList},
                    contractType: process.env.ContractTypeFleet,
                    active: true
                };
                let contractsFound = await Contract.find(query).lean()
                resolve(contractsFound)

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    getMyContractsWithRfidUiState: async (userId, req) => {
        let contracts = await contractServices.getCachedContractsByUser(userId);

        if (!contracts) {
            contracts = await getMyContracts(userId, req);
            contractServices.createCacheContractsByUser(userId, contracts);
        }

        if (!contracts.length) {
            return []; // Return empty array if no contracts found
        }

        const usersId = contracts.map(contract => contract.userId).filter((value, index, self) => self.indexOf(value) === index);
        const users = await User.find({ _id: { $in: usersId } }, { _id: 1, clientType: 1 });

        const tokenStatusService = new TokenStatusService();

        contracts = contracts.map(contract => ({
            ...contract,
            rfidUIState: tokenStatusService.getRfidUIState({
                contract,
                clientType: users.find(u => u._id.toString() === contract.userId)?.clientType || process.env.ClientTypeb2c,
                requestUserId: userId
            }),
        }));

        return contracts;
    }
}

//========== FUNCTION ==========
function cancelRFID(contractId, reason, userId, isNewCardRequest=false) {
    const context = "Funciton cancelRFID";
    return new Promise(async (resolve, reject) => {
        try {
            if (!contractId) {
                reject({ auth: false, code: 'server_contractId_required', message: 'Contract id required' });
            };

            let query = {
                _id: contractId
            }

            let contarctFound = await Contract.findOne(query);

            if (contarctFound) {

                if (contarctFound.cardType === process.env.CardTypeVirtualPhysical) {

                    contarctFound = JSON.parse(JSON.stringify(contarctFound))

                    contarctFound.firstPhysicalCard = false;
                    contarctFound.cardPhysicalPaymentStateInfo = process.env.CARDPHYSICALPAYMENTSTATEINFOCHARGEPAYMENT;

                    delete contarctFound._id
                    if (contarctFound.activationDate) delete contarctFound.activationDate
                    if (contarctFound.requestDate) delete contarctFound.requestDate
                    if (contarctFound.requestThirdPartyDate) delete contarctFound.requestThirdPartyDate
                    if (contarctFound.processedThirdPartyDate) delete contarctFound.processedThirdPartyDate

                    let newContract = new Contract(contarctFound)
                    newContract.cardPhysicalStateInfo = process.env.CARDPHYSICALSTATEINFOCANCELEDBYCUSTOMER
                    newContract.active = false
                    newContract.status = process.env.ContractStatusInactive

                    if (typeof reason == 'string')
                        newContract.cancelReason = reason
                    else
                        newContract.cancellationReason = reason

                    let contractCancel = await createContractCancelRFID(newContract)

                    return resolve(await cancelRfidTagsAndRemoveTokens({
                        contractId,
                        isNewCardRequest,
                        requestUserId: userId,
                        contractCancelId: String(contractCancel._id),
                        contract: contarctFound
                    }))

                } else {
                    reject({ auth: false, code: 'server_no_physical_card', message: 'Contract without physical card' });
                };

            } else {
                reject({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
            };

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}


function createContractCancelRFID(newContract) {
    var context = "Function createContractCancelRFID";
    return new Promise((resolve, reject) => {
        Contract.createContractCancelRFID(newContract, (err, contractCreated) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(contractCreated);
            };
        });
    });
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

function sendEmailClient(mailOptions, clientName) {
    var context = "Function sendEmailClient";

    let headers = {
        clientname: clientName
    }

    let host = process.env.HostNotifications + process.env.PathNotificationsSendEmail

    axios.post(host, { mailOptions }, { headers })
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

function sendEmailEVIO(contractFound, address) {
    var context = "Function sendEmailEVIO";

    //envia email
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
        clientname: contractFound.clientName
    }

    let host = process.env.HostNotifications + process.env.PathNotificationsSendEmail

    axios.post(host, { mailOptions }, { headers })
        .then((response) => {
            //TODO verify
            //Send email to client
            mailOptions.to = contractFound.email
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

function activeNetwork(contractFound, clientName, userId, network, type) {
    const context = "Function activeNetwork";
    return new Promise(async (resolve, reject) => {
        try {

            let body;
            let token;
            let newValues;
            let arrayFilters;
            let countryCode = "PT"
            let partyId = "EVI"
            let random8Int = getRandomInt(10000000, 99999999)
            let checkDigit = checkDigitMobility(countryCode + partyId + "C" + random8Int, checkDigitLists)
            let appUserUid = await getTokenIdTag(contractFound, network, type)

            if (!appUserUid)
                appUserUid = await getTokenIdTag(contractFound, process.env.NetworkEVIO, process.env.TokensTypeApp_User);

            switch (network) {
                case process.env.NetworkMobiE:

                    body = {
                        "country_code": countryCode,
                        "party_id": partyId,
                        "uid": appUserUid,
                        "type": type,
                        "contract_id": `${countryCode}-${partyId}-C${random8Int}-${checkDigit}`,
                        "issuer": "EVIO - Electrical Mobility",
                        "valid": true,
                        "last_updated": "",
                        "source": "",
                        "whitelist": "ALWAYS",
                        "evId": contractFound.contractType === 'fleet' ? contractFound.evId : '-1',
                        "energy_contract": {
                            "supplier_name": process.env.EnergyContractSupplierName,
                            "contract_id": (process.env.NODE_ENV === 'production') ? process.env.ProdEnergyContractDiaBi : process.env.PreProdEnergyContractDiaBi
                        },
                    }

                    token = await ExternalRequestsHandler.createMobiETokenType(userId, body);

                    newValues = {
                        $set: {
                            contract_id: body.contract_id,
                            'networks.$[i].tokens.$[j].status': 'active',
                            'networks.$[i].tokens.$[j].refId': token.refId,
                            'networks.$[i].tokens.$[j].idTagDec': body.uid,
                            "networks.$[i].hasJoined": true
                        }
                    }

                    arrayFilters = [
                        { "i.network": network },
                        { "j.tokenType": type }
                    ];

                    break;
                case process.env.NetworkGireve:


                    let contract_id = `${countryCode}-${partyId}-C${random8Int}-${checkDigit}`;

                    body = {
                        "uid": appUserUid,
                        "type": type,
                        "contract_id": contract_id,
                        "issuer": "EVIO - Electrical Mobility",
                        "valid": true,
                        "last_updated": "",
                        "source": "",
                        "whitelist": "NEVER",
                        "evId": contractFound.contractType === 'fleet' ? contractFound.evId : '-1',
                    };

                    token = await ExternalRequestsHandler.createInternationalTokenType(userId, body, network);
                    newValues = {
                        $set: {
                            "networks.$[i].tokens.$[j].refId": token.refId,
                            "networks.$[i].tokens.$[j].idTagDec": appUserUid,
                            "networks.$[i].tokens.$[j].status": process.env.NetworkStatusActive,
                            "networks.$[i].hasJoined": true,
                            "contractIdInternationalNetwork.$[i].tokens.$[j].contract_id": contract_id
                        }
                    };

                    arrayFilters = [
                        { "i.network": network },
                        { "j.tokenType": type }
                    ];

                    break;
                default:
                    reject({ auth: false, code: 'server_network_not_allowed', message: 'Network not allowed' })
                    break;
            }

            Contract.updateContractWithFilters({ _id: contractFound._id }, newValues, { arrayFilters: arrayFilters, new: true }, async (err, contractUpdated) => {
                if (err) {
                    console.log(`[${context}][.then][updateContract] Error`, err.message);
                    resolve(err)
                };
                if (contractUpdated) {

                    if (contractUpdated.cardType === process.env.CardTypeVirtualPhysical) {
                        let response = await activeNetworkRFID(contractUpdated, clientName, userId, network, "RFID")

                        if (response) {
                            resolve({ contractUpdated: response, valid: true });
                        } else {
                            resolve({ contractUpdated: response, valid: false });
                        };

                    } else {
                        resolve({ contractUpdated: contractUpdated, valid: true });
                    };

                } else {
                    resolve({ contractUpdated: contractUpdated, valid: false });
                };
            });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error)
        };
    })
};

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
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

function activeNetworkRFID(contractFound, clientName, userId, network, type) {
    const context = "Function activeNetworkRFID";
    return new Promise(async (resolve, reject) => {
        try {

            let countryCode = "PT"
            let partyId = "EVI"
            let idTagDec = await getTokenIdTag(contractFound, network, type)
            if (!idTagDec) {
                idTagDec = await getTokenIdTag(contractFound, process.env.NetworkEVIO, process.env.TokensTypeRFID);
            };

            if (!idTagDec) {

                resolve(contractFound);

            } else {

                let body;
                let token;
                let newValues;
                let arrayFilters;
                switch (network) {
                    case process.env.NetworkMobiE:

                        body = {
                            "country_code": countryCode,
                            "party_id": partyId,
                            "uid": idTagDec,
                            "type": type,
                            "contract_id": contractFound.contract_id,
                            "issuer": "EVIO - Electrical Mobility",
                            "valid": true,
                            "last_updated": "",
                            "source": "",
                            "evId": (contractFound.contractType === 'fleet') ? contractFound.evId : '-1',
                            "whitelist": "ALWAYS",
                            "energy_contract": {
                                "supplier_name": process.env.EnergyContractSupplierName,
                                "contract_id": (process.env.NODE_ENV === 'production') ? process.env.ProdEnergyContractDiaBi : process.env.PreProdEnergyContractDiaBi
                            },
                        };

                        token = await ExternalRequestsHandler.createMobiETokenType(userId, body);

                        newValues = {
                            $set: {
                                'networks.$[i].tokens.$[j].status': 'active',
                                'networks.$[i].tokens.$[j].refId': token.refId,
                                'networks.$[i].tokens.$[j].idTagDec': body.uid,
                                "networks.$[i].hasJoined": true
                            }
                        }

                        arrayFilters = [
                            { "i.network": network },
                            { "j.tokenType": type }
                        ];
                        break;
                    case process.env.NetworkGireve:

                        let random8Int = getRandomInt(10000000, 99999999)
                        let checkDigit = checkDigitMobility(countryCode + partyId + "C" + random8Int, checkDigitLists)
                        let contract_id = `${countryCode}-${partyId}-C${random8Int}-${checkDigit}`;

                        let tokenRFIDEVIO = contractFound.networks.find(network => {
                            return network.network === process.env.NetworkGireve;
                        }).tokens.find(token => {
                            return token.tokenType === process.env.TokensTypeRFID;
                        });

                        body = {
                            "uid": tokenRFIDEVIO.idTagHexa,
                            "type": type,
                            "contract_id": contract_id,
                            "issuer": "EVIO - Electrical Mobility",
                            "valid": true,
                            "last_updated": "",
                            "source": "",
                            "whitelist": "NEVER",
                            "evId": contractFound.contractType === 'fleet' ? contractFound.evId : '-1',
                        };

                        token = await ExternalRequestsHandler.createInternationalTokenType(userId, body, network);

                        newValues = {
                            $set: {
                                'networks.$[i].tokens.$[j].refId': token.refId,
                                'networks.$[i].tokens.$[j].status': 'active',
                                'networks.$[i].tokens.$[j].wasAssociated': false,
                                'contractIdInternationalNetwork.$[i].tokens.$[j].contract_id': token.contract_id,
                                "networks.$[i].hasJoined": true
                            }
                        };

                        arrayFilters = [
                            { "i.network": network },
                            { "j.tokenType": process.env.TokensTypeRFID }
                        ];


                        break;
                    default:
                        reject({ auth: false, code: 'server_network_not_allowed', message: 'Network not allowed' })
                        break;
                }

                Contract.updateContractWithFilters({ _id: contractFound._id }, newValues, { arrayFilters: arrayFilters, new: true }, async (err, contractUpdated) => {
                    if (err) {
                        console.log(`[${context}][.then][updateContract] Error`, err.message);
                        resolve(err)
                    };

                    resolve(contractUpdated);

                });

            }

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error)
        };
    })
};

async function activateOrDeactivateTokensInANetwork(contract, network, activate = true, path = '') {
    const context = "Function activateOrDeactivateTokensInANetwork";
    const tokenTypes = contract.networks.find(contractNetwork => {
        return contractNetwork.network === network;
    }).tokens.map(token => {
        return token.tokenType
    });

    try {
        await updateNetworkStatus({
            userId: contract.userId,
            contractId: String(contract._id),
            networks: [network],
            action: activate ? 'ACTIVATE' : 'DEACTIVATE', // TODO commons constant/enum
            tokenTypes,
            path
        });
        const code =
            network === process.env.NetworkMobiE ?
                `server_contracts_messageInfoActivationOkMobiE_${whiteLabelMap[contract.clientName]}` :
                `server_contracts_messageInfoActivationOkGv_${whiteLabelMap[contract.clientName]}`

        const message = { auth: true, code, message: 'You can now charge on several charging stations across Portugal.\nCharge anywhere with App.' }
        return ({ auth: true, message: message });

    } catch (error) {
        console.log(`[${context}] Error updating network status`, error.message || error);
        return ({ auth: false, code: 'server_contract_active_network_failed', message: "Network activation failed" })
    };
}

function getTariffInfo(contractsFound, paymentMethods) {
    let context = "Function getTariffInfo";
    return new Promise(async (resolve, reject) => {
        try {

            Promise.all(
                contractsFound.map(contract => {
                    return new Promise(async (resolve, reject) => {

                        let netWorkIndex = contract.networks.indexOf(contract.networks.find(netWork => {
                            return netWork.network === process.env.NetworkMobiE;
                        }));

                        if (netWorkIndex >= 0) {

                            //console.log("contract.networks[netWorkIndex]", contract.networks[netWorkIndex]);
                            if (contract.networks[netWorkIndex].paymentMethod != "" && contract.networks[netWorkIndex].paymentMethod != undefined) {

                                let paymentMethodInfo = paymentMethods.find(payment => {
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
                            let params = {
                                _id: contract.tariff.planId
                            };

                            let tariffInfo = await ExternalRequestsHandler.getTariffCEME(params);
                            let tariffRoamingInfo = await ExternalRequestsHandler.getTariffCEMERoaming(contract.tariffRoaming);
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

                /*if (isB2C)
                    resolve(contractsFound);
                else*/
                resolve(contractsFound);

            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error)
        };
    })
}

function validateFieldsRequestPhysicalCardWL(contract) {
    let context = "Function validateFieldsRequestPhysicalCardWL";
    return new Promise(async (resolve, reject) => {
        try {

            if (!contract._id)
                reject({ auth: false, code: 'contract_id_required', message: 'Contract id is required' });


            if (!contract.name)
                reject({ auth: false, code: 'contract_name_required', message: 'Contract name is required' });


            if (!contract.mobile)
                reject({ auth: false, code: 'contract_mobile_required', message: 'Contract mobile is required' });


            if (!contract.email)
                reject({ auth: false, code: 'contract_email_required', message: 'Contract email is required' });


            if (!contract.internationalPrefix)
                reject({ auth: false, code: 'contract_international_prefix_required', message: 'Contract international prefix is required' });


            else
                resolve(true);


        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error)
        };
    })
}

function requestPhysicalCardWLFinal(contract, userId, clientName) {
    const context = "Function requestPhysicalCardWLFinal";
    return new Promise(async (resolve, reject) => {
        try {

            let query = {
                _id: contract._id
            };

            let contractFound = await Contract.findOne(query);

            if (contractFound) {

                contractFound.shippingAddress = contract.address;
                contractFound.cardPhysicalName = contract.cardPhysicalName ? contract.cardPhysicalName : contractFound.name
                contractFound.cardPhysicalSendTo = contract.cardPhysicalSendTo ? contract.cardPhysicalSendTo : ""
                contractFound.cardPhysicalInTheCareOf = contract.cardPhysicalInTheCareOf ? contract.cardPhysicalInTheCareOf : "",
                contractFound.cardPhysicalLicensePlate = contract.cardPhysicalLicensePlate ? contract.cardPhysicalLicensePlate : ""
                contractFound.cardPhysicalText = contract.cardPhysicalText ? contract.cardPhysicalText : ""

                if (contractFound.firstPhysicalCard || contractFound.cardPhysicalPaymentStateInfo === process.env.CARDPHYSICALPAYMENTSTATEINFOFREE) {

                    let found = contractFound.networks.find(network => {
                        return network.network === process.env.NetworkMobiE && network.tokens.find(token => {
                            return token.tokenType === process.env.TokensTypeRFID && (token.status === process.env.NetworkStatusToRequest || token.status === process.env.NetworkStatusActive)
                        })
                    });

                    //console.log("found", found)
                    if (found) {

                        resolve(contractFound);

                    } else {

                        let newToken = {
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

                                    //if (network.network === process.env.NetworkEVIO) {

                                    if (process.env.NetworksEVIO.includes(network.network)) {

                                        network.paymentMethod = contract.paymentMethod;
                                        newToken.status = 'toRequest'
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
                        ).then(async () => {

                            //console.log("contractFound", contractFound);
                            let newValues = { $set: contractFound };

                            let contractUpdated = await Contract.findOneAndUpdate(query, newValues, { new: true });

                            sendEmail(contractUpdated, clientName);

                            resolve(contractUpdated);

                        }).catch(error => {
                            console.log(`[${context}] Error `, error.message);
                            reject(error);
                        })

                    };

                } else {

                    //TODO
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
                                contractFound.requestDate = new Date();

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
                                ).then(async () => {

                                    //console.log("contractFound", contractFound);
                                    let newValues = { $set: contractFound };
                                    let contractUpdated = await Contract.findOneAndUpdate(query, newValues, { new: true });

                                    sendEmail(contractUpdated, clientName);

                                    resolve(contractUpdated);

                                }).catch(error => {
                                    console.log(`[${context}] Error `, error.message);
                                    reject(error);
                                })

                            };

                            break;

                        case process.env.PAYMENTRESPONSEWAITPAYMENT:

                            contractFound.cardPhysicalPaymentStateInfo = process.env.CARDPHYSICALPAYMENTSTATEINFOPROCESSING;
                            let newValues = { $set: contractFound };
                            let contractUpdated = await Contract.findOneAndUpdate(query, newValues, { new: true });

                            sendEmail(contractUpdated, clientName);

                            resolve(contractUpdated);


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



                            //sendEmailClient(mailOptions, contractFound.clientName);

                            reject({ auth: false, code: 'server_failed_request_physicalCard', message: 'We inform you that it was not possible to charge for the issue of the 2nd copy of the card, due to insufficient balance or/and absence of a valid credit card. It is therefore requested that a valid payment method be entered and that the request be repeated again.' });

                            break;

                    };

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

function requestPhysicalCard(contract, userId, clientName) {
    const context = "Function requestPhysicalCard";
    return new Promise(async (resolve, reject) => {
        try {

            let query = {
                _id: contract._id
            };

            let contractFound = await Contract.findOne(query);

            if (contractFound) {

                contractFound.shippingAddress = contract.address;
                contractFound.cardPhysicalName = contract.cardPhysicalName ? contract.cardPhysicalName : contractFound.name
                contractFound.cardPhysicalSendTo = contract.cardPhysicalSendTo ? contract.cardPhysicalSendTo : "",
                    contractFound.cardPhysicalInTheCareOf = contract.cardPhysicalInTheCareOf ? contract.cardPhysicalInTheCareOf : "",
                    contractFound.cardPhysicalLicensePlate = contract.cardPhysicalLicensePlate ? contract.cardPhysicalLicensePlate : ""
                contractFound.cardPhysicalText = contract.cardPhysicalText ? contract.cardPhysicalText : ""

                let found = contractFound.networks.find(network => {
                    return network.network === process.env.NetworkMobiE && network.tokens.find(token => {
                        return token.tokenType === process.env.TokensTypeRFID && (token.status === process.env.NetworkStatusToRequest || token.status === process.env.NetworkStatusActive)
                    })
                });

                if (found) {

                    resolve(contractFound);

                } else {

                    let newToken = {
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

                                //if (network.network === process.env.NetworkEVIO) {

                                if (process.env.NetworksEVIO.includes(network.network)) {

                                    network.paymentMethod = contract.paymentMethod;
                                    newToken.status = 'toRequest'
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
                    ).then(async () => {

                        console.log("-->contractFound", contractFound);
                        let newValues = { $set: contractFound };

                        let contractUpdated = await Contract.findOneAndUpdate(query, newValues, { new: true });

                        sendEmailEVIO(contractFound, contract.address);

                        resolve(contractUpdated);

                    }).catch(error => {
                        console.log(`[${context}] Error `, error.message);
                        reject(error);
                    })

                }



            } else {

                reject({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });

            };

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};


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

async function sendEmail(contract, clientName) {
    const context = "Function sendEmail";
    try {

        let host = process.env.HostNotificationsDefinition + process.env.PathGetMailNotification;

        let headers = {
            clientname: clientName
        };

        let dataEmail = await AxiosHandler.axiosGetHeaders(host, headers);

        host = process.env.HostNotifications + process.env.PathNotificationsSendEmail;

        let mailOptions
        if (clientName === process.env.WhiteLabelACP) {
            mailOptions = {
                to: dataEmail.mailList,//.toString(),
                message: {
                    username: contract.cardPhysicalName,
                    userMobile: contract.internationalPrefix + ' ' + contract.mobile,
                    userEmail: contract.email,
                    userStreet: contract.shippingAddress.street,
                    userNumber: contract.shippingAddress.number,
                    floor: contract.shippingAddress.floor,
                    zipCode: contract.shippingAddress.zipCode,
                    userCity: contract.shippingAddress.city,
                    userState: contract.shippingAddress.state,
                    userCountry: contract.shippingAddress.country
                },
                type: "requestCardWL"
            };
        } else {
            mailOptions = {
                to: dataEmail.mailList,//.toString(),
                message: {
                    username: contract.cardPhysicalName,
                    userMobile: contract.internationalPrefix + ' ' + contract.mobile,
                    userEmail: contract.email
                },
                type: "requestCardWL"
            };
        }

        let response = await AxiosHandler.axiosPostBodyHeadersEmail(host, mailOptions, headers);

        if (response) {

            mailOptions = {
                to: contract.email,
                //subject: `EVIO - Solicitação do Cartão`,
                message: {
                    "username": contract.name,
                },
                type: "requestCard"
            };

            let response = await AxiosHandler.axiosPostBodyHeadersEmail(host, mailOptions, headers);

            if (response)
                console.log(`[${context}] Email sent`);
            else
                console.log(`[${context}] Email not sent`);
        }


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    };
};

function createPayment(data) {
    const context = "Function createPayment";
    return new Promise(async (resolve, reject) => {
        try {

            let host = process.env.HostPayments + process.env.PathPaymentPhysicalCard
            let payment = await AxiosHandler.axiosPostBody(host, data);

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

function convertTags(tagDec) {
    const context = "Function convertTags"
    return new Promise((resolve, reject) => {
        try {

            let hexa = (BigInt(tagDec).toString(16)).toUpperCase();

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
                tagDecimal: tagDec,
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

function contractsFindOne(query) {
    var context = "Function contractsFindOne";
    return new Promise((resolve, reject) => {
        Contract.findOne(query, (err, contractFound) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err.message);
                reject(err);
            }
            else {
                resolve(contractFound);
            };
        });
    });
};

function addCardRFIDToNetworks(contractFound, received, valid, query) {
    var context = "Function addCardRFIDToNetworks";
    return new Promise(async (resolve, reject) => {

        let countryCode = "PT"
        let partyId = "EVI"
        let idTagDec = received.idTagDec
        let idTagHexa = received.idTagHexa.toUpperCase();
        let idTagHexaInv = received.idTagHexaInv.toUpperCase();
        let cardNumber = received.cardNumber

        addRFIDToNetworks({contract: contractFound, cardData: received}).then(() => {

            if (cardNumber !== undefined && cardNumber !== "") {
                contractFound.cardNumber = cardNumber
            }

            contractFound.cardType = process.env.CardTypeVirtualPhysical;
            contractFound.cardPhysicalState = valid;

            if (valid) {
                contractFound.cardPhysicalStateInfo = process.env.CARDPHYSICALSTATEINFOACTIVE
                contractFound.activationDate = new Date()
            } else {
                contractFound.cardPhysicalStateInfo = process.env.CARDPHYSICALSTATEINFOASSOCIATED
                contractFound.processedThirdPartyDate = new Date()
            }


            let newValues = { $set: contractFound };
            contractUpdate(query, newValues)
                .then(result => {
                    resolve(contractFound);
                })
                .catch(error => {
                    console.log(`[${context}] Error `, error.message);
                    reject(error);
                });


        }).catch((error) => {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        })

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


            console.log("host", host)
            //console.log("body", body);
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
                        //resolve(body)
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

function contractUpdate(query, newValue) {
    var context = "Function contractUpdate";
    return new Promise((resolve, reject) => {
        Contract.updateOne(query, newValue, (err, result) => {
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

function getSpecificToken(contract, networkEnum, tokenType) {
    return contract.networks.find(network => network.network === networkEnum).tokens.find(token => token.tokenType === tokenType)
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

function groupCSUsersFind(query) {
    var context = "Function groupCSUsersFind";
    return new Promise((resolve, reject) => {
        GroupCSUsers.find(query, (err, groupCSUsersFound) => {
            if (err) {
                console.log(`[${context}][findOnde] Error `, err);
                reject(err);
            }
            else {
                resolve(groupCSUsersFound);
            };
        });
    });
};

function getUserIdWillPay(contract, evs, userId) {
    const ev = evs.find(e => e._id.toString() === contract.evId);

    if (!ev) {
        console.warn(`No EV found for contract with evId: ${contract.evId}`);
        return contract.userId;
    }

    const companyWillPay = Array.isArray(ev.listOfDrivers)
        ? ev.listOfDrivers.find(driver => driver.userId === userId && driver.paymenteBy === 'myself')
        : null;

    if (!companyWillPay) {
        console.warn(`No driver found for evId: ${contract.evId} with userId: ${userId} and paymenteBy: 'myself'`);
        return userId;
    }

    return contract.userId;
}

function hasValidPaymentMethod(paymentMethods) {
    return paymentMethods.filter(pm => pm.defaultPaymentMethod === true && pm.status !== Enums.PaymentMethodStatus.Expired).length > 0;
}

function getMyContracts(userId, req) {
    const context = 'Function getMyContracts';

    console.debug(`[${context}] Starting for userId ${userId}`);

    return new Promise(async (resolve, reject) => {
        try {
            const isB2C = Boolean(
                await User.findOne({ _id: userId, clientType: clientTypes.ClientB2C })
            );
            if (isB2C) {
                const contractsB2C = await getContractsB2C(userId, req);
                resolve(contractsB2C);
            }
            const contractsB2B = await getContractsB2B(userId, req);
            resolve(contractsB2B);
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}