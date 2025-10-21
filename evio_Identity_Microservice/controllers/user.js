import Constants from '../utils/constants';
require("dotenv-safe").load();
var acpClient;
var soap = require('soap');
const join = require('path').join;
var wsdlPath = join(__dirname, "../wsdl/CustomUI_ACP_Member_Validation_WS_Ext.WSDL");
var wsdPrelPath = join(__dirname, "../wsdl/ACP_Member_Validation_WS_Ext_PRE.WSDL");
var wsdProdlPath = join(__dirname, "../wsdl/ACP_Member_Validation_WS_Ext_PROD.WSDL");
const User = require('../models/user');
const ConttractsHandler = require('./contracts');
const CemeTarifftsHandler = require('./cemeTariff');
const ExternalRequests = require('./externalRequests');
const DriversDependenciesHandler = require('./driversDependencies');
const GroupDriversDependenciesHandler = require('./groupDriversDependencies');
const GroupCSUsersDependenciesHandlet = require('./groupCSUsersDependencies');
const GroupDriversHandler = require('./groupDrivers');
const GroupCSUsersHandler = require('./groupCSUsers');
const DriversHandler = require('./drivers');
const AxiosHandler = require('../services/axios');
const ActivationHandler = require('./activation');
const CemeData = require('../controllers/ceme');
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
const fs = require('fs');
const { listenerCount } = require('process');
const nodemailerS = require('../services/nodemailerService');
const { moveMessagePortToContext } = require("worker_threads");
const moment = require('moment');
const Constants = require('../utils/constants');
const contractsServices = require('../services/contracts');

const { logger } = Constants;
const CemeTariffSevice = require('../services/cemeTariff')

import UserPasswords from "../models/userPasswords";
import Sentry from "@sentry/node";


const { notifyAccountValidPartner } = require('evio-library-notifications').default;
const { FileTransaction } = require('evio-library-language').default;

export default module.exports = {
    ValidateSocioByID: async Socio => {
        const context = "Funciton ValidateUserByNCard";
        return new Promise(async (resolve, reject) => {
            try {
                if (acpClient == null) {
                    if (process.env.NODE_ENV === 'production')
                        acpClient = await soap.createClientAsync(wsdProdlPath);
                    else
                        acpClient = await soap.createClientAsync(wsdPrelPath);

                    let wsSecurity = await new soap.WSSecurity(process.env.ACPUsername, process.env.ACPPassword, {})

                    await acpClient.setSecurity(wsSecurity);
                }

                const arg = {
                    N_Socio: Socio,
                    N_Socio_Suf: 0
                };
                console.log("arg", arg);
                acpClient.QueryByNumSocioExt(arg, (err, result) => {
                    if (err) {
                        if (err.code == process.env.TimeOutCode) {
                            let emailSubject = "ACP TIMEOUT!"
                            let emailText = `Bom dia,\n\nA comunicação com a ACP falhou devido a um TIMEOUT.\nEsta falha ocurreu na função ` + context + `\nData da falha: ` + moment().utc().format()

                            if (process.env.NODE_ENV === 'production')
                                nodemailerS.sendEmailFromSupportText(Constants.emails.SupportEvio, emailSubject, emailText)
                            else
                                nodemailerS.sendEmailFromSupportText(process.env.EMAIL4, "[PRE] " + emailSubject, emailText)

                        }

                        throw err
                    }
                    else {
                        console.log(`[${context}] result `, result.ListOfAcpMemberValidationIo);

                        if (result.ListOfAcpMemberValidationIo.Cartao_Ativo == "Y") resolve(true);
                        else resolve(false);
                    };
                })
            } catch (error) {
                console.log("Error : ", error);
                reject(false);
            }
        }).then((resolve) => {
            return true
        }).catch((err) => {
            console.log(`Error on  ${context} : ${err.message}`)
            return false;
        });
    },
    ValidateSocioByNIF: async (nif, data) => {
        const context = "Funciton ValidateSocioByNIF";
        return new Promise(async (resolve, reject) => {
            try {
                if (acpClient == null) {
                    if (process.env.NODE_ENV === 'production')
                        acpClient = await soap.createClientAsync(wsdProdlPath);
                    else
                        acpClient = await soap.createClientAsync(wsdPrelPath);

                    let wsSecurity = await new soap.WSSecurity(process.env.ACPUsername, process.env.ACPPassword, {})

                    await acpClient.setSecurity(wsSecurity);
                }

                const arg = {
                    vBirthDT: data,
                    vNifNum: nif
                };
                acpClient.ValidateMemberNIF(arg, (err, result) => {
                    if (err) {
                        if (err.code == process.env.TimeOutCode) {
                            let emailSubject = "ACP TIMEOUT!"
                            let emailText = `Bom dia,\n\nA comunicação com a ACP falhou devido a um TIMEOUT.\nEsta falha ocurreu na função ` + context + `\nData da falha: ` + moment().utc().format()

                            if (process.env.NODE_ENV === 'production')
                                nodemailerS.sendEmailFromSupportText(Constants.emails.SupportEvio, emailSubject, emailText)
                            else
                                nodemailerS.sendEmailFromSupportText(process.env.EMAIL4, "[PRE] " + emailSubject, emailText)

                        }

                        throw err;
                    }
                    else {
                        // console.log(`[${context}] result `, result.ListOfAcpMemberValidationIo.AcpMember[0]);
                        if (result.ListOfAcpMemberValidationIo.AcpMember[0].Socio_Ativo == "Y") resolve(true);
                        else resolve(false);
                    };
                })
            } catch (error) {
                console.log("Teste : ", error);
                reject(false);
            }
        }).then((resolve) => {
            return true
        }).catch((err) => {
            console.log(`Error on ${context} : ${err}`)
            return false;
        });
    },
    ValidateSocioByCardNumber: async (cardNumber, memberNumber, user) => {
        const context = "Funciton ValidateSocioByCardNumber";
        return new Promise(async (resolve, reject) => {
            validateSocioByCardNumberACP(cardNumber, memberNumber, user)
                .then(result => {
                    resolve(result);
                })
                .catch(error => {
                    console.error(`[${context}] Error `, error.message);
                    resolve({ activePartner: false, cardAndMemberNotValid: false });
                })
        })
    },
    validateData: (user) => {
        const context = "Funciton validateData";
        return new Promise(async (resolve, reject) => {
            let response;
            switch (user.clientName) {
                case process.env.clientNameACP:
                    response = await validateDataACP(user)
                    break;
                default:
                    response = false;
                    break;
            }
            console.log("response", response);
            resolve(response)
        })
    },
    updateUsersWl: (query, user) => {
        const context = "Funciton updateUsersWl";
        return new Promise(async (resolve, reject) => {
            try {
                const translation = await FileTransaction.retrieveFileTranslationByLanguage({language: user.language});
                let userFound;
                if (user.cardNumber) {
                    userFound = await User.findOne({ _id: { $ne: user._id }, cardNumber: user.cardNumber, clientName: user.clientName, active: true })
                }

                if (userFound) {
                    reject({ auth: false, code: 'server_cardNumber_taken', message: 'Card Number ' + user.cardNumber + ' already in use by another user' })
                } else {

                    let oldUser = await User.findOne(query, { _id: 1, cardNumber: 1 })

                    User.findOneAndUpdate(query, user, { new: true }, async (err, result) => {
                        if (err) {
                            console.error(`[${context}][updateUser] Error `, err.message);
                            reject(err);
                        };
                        if (result) {

                            let message = { auth: true, code: 'server_user_updated', message: 'User updated', type: 'topmessage' };

                            if (query.clientName === process.env.clientNameACP) {

                                let userResponse = await validateDataACP(result);

                                //console.log("userResponse", userResponse);
                                let userUpdated;

                                if (userResponse.faildConnectionACP) {
                                    message = { auth: true, code: 'server_user_partner_updated_faild', message: (translation['server_user_partner_updated_faild'] ? translation['server_user_partner_updated_faild'].replace('${result.name}', result.name) : `Hello ${result.name}, at the moment it has not been possible to validate your ACP membership card details, we will try later if they are filled in.`), type: 'dialog' };
                                   
                                    userUpdated = await User.findOne({ _id: result._id });
                                    resolve({ user: userUpdated, message: message });

                                } else if (oldUser.cardNumber !== user.cardNumber) {
                                    if (userResponse.activePartner) {
                                        message = { auth: true, code: 'server_user_partner_updated_active', message: (translation['server_user_partner_updated_active'] ? translation['server_user_partner_updated_active'].replace('${result.name}', result.name) : `Dear ${result.name}, your ACP discount is active`), type: 'dialog' };
                                    } else {
                                        if (userResponse.cardAndMemberNotValid)
                                            message = { auth: true, code: 'server_user_card_membership_not_match', message: (translation['server_user_card_membership_not_match'] ? translation['server_user_card_membership_not_match'].replace('${result.name}', result.name) : `Dear ${result.name}, the membership card number entered does not correspond to the membership number registered during your registration process, as such, you will not be able to take advantage of membership discounts as it was not possible to validate your ACP account. You can validate/update these fields later in your app.`), type: 'dialog' };
                                        else
                                            message = { auth: true, code: 'server_user_partner_updated', message: (translation['server_user_partner_updated'] ? translation['server_user_partner_updated'].replace('${result.name}', result.name) : `Dear ${result.name}, it was not possible to validate your ACP membership card number. As such your ACP discount will not be active. For any question and/or doubt please contact the ACP helpline, thank you.`), type: 'dialog' };
                                    }
                                    userUpdated = await User.findOne({ _id: result._id });
                                    resolve({ user: userUpdated, message: message });
                                } else {
                                    if (userResponse.activePartner != result.activePartner) {
                                        if (userResponse.activePartner) {
                                            message = { auth: true, code: 'server_user_partner_updated_active', message: (translation['server_user_partner_updated_active'] ? translation['server_user_partner_updated_active'].replace('${result.name}', result.name) : `Dear ${result.name}, your ACP discount is active`), type: 'dialog' };
                                        } else {
                                            if (userResponse.cardAndMemberNotValid)
                                                message = { auth: true, code: 'server_user_card_membership_not_match', message: (translation['server_user_card_membership_not_match'] ? translation['server_user_card_membership_not_match'].replace('${result.name}', result.name) : `Dear ${result.name}, the membership card number entered does not correspond to the membership number registered during your registration process, as such, you will not be able to take advantage of membership discounts as it was not possible to validate your ACP account. You can validate/update these fields later in your app.`), type: 'dialog' };
                                            else
                                                message = { auth: true, code: 'server_user_partner_updated', message: (translation['server_user_partner_updated'] ? translation['server_user_partner_updated'].replace('${result.name}', result.name) : `Dear ${result.name}, it was not possible to validate your ACP membership card number. As such your ACP discount will not be active. For any question and/or doubt please contact the ACP helpline, thank you.`), type: 'dialog' };
                                        }
                                        userUpdated = await User.findOne({ _id: result._id });
                                        resolve({ user: userUpdated, message: message });
                                    } else {
                                        userUpdated = await User.findOne({ _id: result._id });
                                        resolve({ user: userUpdated, message: message });
                                    };
                                };

                            } else {

                                resolve({ user: result, message: message });

                            };

                        } else {

                            resolve(false);

                        };
                    });
                }
            } catch (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            };
        });
    },
    removeUserById: (userId) => {
        const context = "Funciton removeUserById";
        return new Promise(async (resolve, reject) => {
            try {

                let userFound = await User.findOne({ _id: userId });

                if (userFound) {

                    //removeContract(userId);
                    CemeTarifftsHandler.removeCEMETariff(userId);
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
                    contractsServices.updateContractStatusExternalNetworks(userId, false);
                    await contractsServices.deleteCachedContractsByUser(userId);

                } else {
                    reject({ auth: false, code: 'server_users_not_found', message: "Users not found for given parameters" });
                }

            } catch (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            };
        });
    },
    updateUsers: (query, user) => {
        let context = "Function updateUsers";
        return new Promise(async (resolve, reject) => {
            try {

                let userFound
                if (user.cardNumber) {
                    userFound = await User.findOne({ _id: { $ne: user._id }, cardNumber: user.cardNumber })
                };

                if (userFound) {
                    reject({ auth: false, code: 'server_cardNumber_taken', message: 'Card Number ' + user.cardNumber + ' already in use by another user' })

                } else {

                    User.findOneAndUpdate(query, user, { new: true }, async (err, result) => {
                        if (err) {
                            console.error(`[${context}][updateUser] Error `, err.message);
                            reject(err);
                        };

                        if (result) {

                            if (query.clientName === process.env.clientNameACP) {
                                let userResponse = await this.validateData(result, user.cardNumber);
                                console.log("userResponse", userResponse);
                                resolve({ user: result, message: { auth: true, code: 'server_user_updated', message: 'User updated' } });
                                //resolve(result);

                            } else {
                                user.mobile = result.mobile;
                                resolve({ user: result, message: { auth: true, code: 'server_user_updated', message: 'User updated' } });
                                //resolve(result);
                            };

                        }
                        else
                            resolve(false);
                    });

                };

            } catch (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            };
        });
    },
    changeMobileWlLoginMobile: (req) => {
        const context = "Function changeMobileWlLoginMobile";
        return new Promise(async (resolve, reject) => {
            try {

                let userId = req.headers['userid'];
                let clientName = req.headers['clientname'];
                let user = req.body;
                let headers = req.headers;
                if (user.devUser != undefined) {
                    delete user.devUser;
                };

                user.clientName = clientName;
                if (user.mobile) {

                    let query = {
                        mobile: user.mobile,
                        internationalPrefix: user.internationalPrefix,
                        clientName: clientName,
                        active: true
                    };

                    let userFoundMobile = await User.findOne(query);

                    if (userFoundMobile)
                        reject({ auth: false, code: 'server_mobile_use', message: "Mobile is already in use!" });
                    else {

                        let query = {
                            _id: userId
                        };

                        let userFound = await User.findOne(query);

                        if (userFound) {

                            let oldMobile = userFound.mobile;
                            let olderInternationalPrefix = userFound.internationalPrefix;

                            //Put new
                            userFound.mobile = user.mobile;
                            userFound.username = user.mobile;
                            userFound.internationalPrefix = user.internationalPrefix;

                            updateMobileMongo(userFound)
                                .then((value) => {
                                    if (value) {

                                        try {
                                            user._id = userFound._id;
                                            console.log("user", user)

                                            DriversDependenciesHandler.userDriversDependencies(user);
                                            GroupDriversDependenciesHandler.userGroupDriversDependencies(user);
                                            GroupCSUsersDependenciesHandlet.userGroupCSUsersDependencies(user);
                                            ConttractsHandler.updateMobileContract(user);
                                            DriversHandler.updateMobileDrivers(user);
                                            GroupDriversHandler.updateMobileGroupDrivers(user);
                                            GroupCSUsersHandler.updateMobileGroupCSUsers(user);

                                            if (userFound.clientType === process.env.ClientTypeb2c) {
                                                cancelAllTokens(userId);
                                                cancelFirebaseTokens(userId);
                                                cancelFirebaseWLTokens(userId);
                                                ActivationHandler.userCodeChangeMobile(user, headers);
                                            }

                                            resolve({ auth: true, code: 'server_user_updated', message: 'User updated' });
                                        } catch (error) {
                                            Sentry.captureException(error);

                                            userFound.mobile = oldMobile;
                                            userFound.username = oldMobile;
                                            userFound.internationalPrefix = olderInternationalPrefix;

                                            updateMobileMongo(userFound)
                                                .then((value) => {
                                                    reject({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
                                                })
                                                .catch((err) => {
                                                    console.error(`[${context}][updateMobileMongo][.catch] Error `, err.message);
                                                    reject(err.message);
                                                });
                                        }

                                    } else
                                        reject({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
                                })
                                .catch((err) => {
                                    console.error(`[${context}][updateMobileMongo][.catch] Error `, err.message);
                                    reject(err);
                                });

                        } else
                            reject({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
                    };

                }
                else
                    reject({ auth: false, code: 'server_mobile_number_required', message: "Mobile number required" });

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            };
        });
    },
    changePasswordWlLoginMobile: (req, res) => {
        const context = "Function changePasswordWlLoginMobile";
        return new Promise(async (resolve, reject) => {
            try {
                let userId = req.headers['userid'];

                let passwords = req.body;
                let query = {
                    _id: userId
                };
                let userFound = await User.findOne(query)

                if (userFound) {

                    cancelFirebaseTokens(userId);
                    cancelAllTokens(userId);
                    cancelFirebaseWLTokens(userId);
                    User.updateUser({ _id: userId }, { $set: { needChangePassword: false } }, async(err, newResult) => {
                        if (err) {
                            Sentry.captureException(err);
                            console.error(`[${context}][updateUser][] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {

                            console.log(`[${context}] Changing password for userId ${userId} ...`);
                            await UserPasswords.updatePassword(userId, passwords?.newPassword);

                            return res.status(200).send({ auth: true, code: 'server_password_change', message: "Password successfully changed" });
                        }
                    });


                }
                else
                    return res.status(400).send({ auth: false, code: 'server_users_not_found', message: "Users not found for given parameters" });

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            };
        });
    },
    forceJobFaildConnectionACP: () => {
        const context = "Function forceJobFaildConnectionACP";
        return new Promise(async (resolve, reject) => {
            jobFaildConnectionACP()
            resolve("Job Faild Connection ACP FORCED")

        });
    },
     addMileageEntryEnabledNewField: async function() {
        const context = "Function addMileageEntryEnabled";
        try {
            const result = await User.updateMany({},
                { "userPackage.mileageEntryEnabled": false },
                { new: true, upsert: true });
            console.log(result);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return error;
        }
    },
    // Returns true if the user's paymentPeriod is either AD_HOC or PROMPT_PAYMENT
    isValidUserToBlock: (user) => {
        console.log(`UserId: ${user?.id} | PaymentPeriod: ${user?.paymentPeriod}`);
        const adHoc = process.env.PaymentPeriodAD_HOC;
        const promptPayment = process.env.PaymentPeriodPROMPT_PAYMENT;
        if (user?.paymentPeriod !== adHoc && user?.paymentPeriod !== promptPayment) return false;
        return true;
    },
    forceJobValidateDataACP: () => {
        const context = "Function forceJobValidateDataACP";
        return new Promise(async (resolve, reject) => {
            jobValidateDataACP();
            resolve("Job validate data ACP FORCED")

        });
    }
};

function validateSocioByCardNumberACP(cardNumber, memberNumber, user) {
    const context = "Funciton validateSocioByCardNumberACP";
    return new Promise(async (resolve, reject) => {
        try {

            if (acpClient == null) {
                if (process.env.NODE_ENV === 'production')
                    acpClient = await soap.createClientAsync(wsdProdlPath);
                else
                    acpClient = await soap.createClientAsync(wsdPrelPath);

                let wsSecurity = await new soap.WSSecurity(process.env.ACPUsername, process.env.ACPPassword, {})

                await acpClient.setSecurity(wsSecurity);
            }

            const arg = {
                N_Cartao: cardNumber
            };

            console.log("acpClient.setSecurity - ", acpClient.setSecurity)
            console.log("acpClient.QueryByNumCartaoExt - ", acpClient.QueryByNumCartaoExt)

            acpClient.QueryByNumCartaoExt(arg, (err, result) => {
                if (err) {
                    if (err.code == process.env.TimeOutCode) {
                        let emailSubject = "ACP TIMEOUT!"
                        let emailText = `Bom dia,\n\nA comunicação com a ACP falhou devido a um TIMEOUT.\nEsta falha ocurreu na função ` + context + `\nData da falha: ` + moment().utc().format()

                        if (process.env.NODE_ENV === 'production')
                            nodemailerS.sendEmailFromSupportText(Constants.emails.SupportEvio, emailSubject, emailText)
                        else
                            nodemailerS.sendEmailFromSupportText(process.env.EMAIL4, "[PRE] " + emailSubject, emailText)

                    }

                    console.error(`[${context}][QueryByNumCartaoExt] Error `, err.response?.data);
                    //console.error(`[${context}][QueryByNumCartaoExt] Error `, err.message);
                    resolve({ activePartner: false, cardAndMemberNotValid: false, faildConnectionACP: true });
                };
                if (result) {

                    console.log("result QueryByNumCartaoExt - ", result)

                    if (result.ListOfAcpCartaoBeneficiarioGeralIo.AcpEbcCartaoBeneficioGeral[0].Cartao_Ativo == "Y") {

                        let nSocio = `${result.ListOfAcpCartaoBeneficiarioGeralIo.AcpEbcCartaoBeneficioGeral[0].ListOfAcpMember.AcpMember[0].N_Socio}-${result.ListOfAcpCartaoBeneficiarioGeralIo.AcpEbcCartaoBeneficioGeral[0].ListOfAcpMember.AcpMember[0].N_Socio_Suf}`

                        if (memberNumber === nSocio)
                            resolve({ activePartner: true, cardAndMemberNotValid: false, faildConnectionACP: false, resultACP: result });
                        else
                            resolve({ activePartner: false, cardAndMemberNotValid: true, faildConnectionACP: false, resultACP: result });

                    } else
                        resolve({ activePartner: false, cardAndMemberNotValid: false, faildConnectionACP: false, resultACP: result });

                } else
                    resolve({ activePartner: false, cardAndMemberNotValid: false, faildConnectionACP: false, resultACP: { error: "No Resul" } });

            })

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve({ activePartner: false, cardAndMemberNotValid: false, faildConnectionACP: true, resultACP: { error: "Crash JOB" } });
        }
    });
}

async function validateDataACP(user) {
    const context = "Funciton validateDataACP";
    return new Promise(async (resolve, reject) => {
        try {

            let headers = {
                clientname: user.clientName
            };

            if (user.cardNumber) {
                let responseFromACP = await validateSocioByCardNumberACP(user.cardNumber, user.memberNumber, user);

                console.log(`${context}: responseFromACP ${responseFromACP}`);

                const [cemeTariff, cemeTariffUser ] = await Promise.all([CemeData.getCEMEEVIOADHOC(user.clientName, responseFromACP.activePartner), CemeTariffSevice.cemeTariffFindOne({userId: user._id})]);

                console.log(`${context}: cemeTariff ${cemeTariff}`);
                console.log(`${context}: cemeTariffUser ${cemeTariffUser}`);

                if (responseFromACP.faildConnectionACP) {
                    await User.findOneAndUpdate({ _id: user._id }, { $set: { faildConnectionACP: responseFromACP.faildConnectionACP } })
                    resolve(responseFromACP);

                } else if (responseFromACP.activePartner !== user.activePartner || cemeTariff.plan._id != cemeTariffUser?.tariff?.planId) {
                    //Change atribute activePartner
                    //Change CEME Tariff and Contract to corresponding tariff;
                    await Promise.all([ 
                        ConttractsHandler.updateTariffContractACP(user._id, responseFromACP.activePartner, user.clientName),
                        CemeTarifftsHandler.updateTariffCEMEACP(user._id, responseFromACP.activePartner, user.clientName),
                        User.findOneAndUpdate({ _id: user._id }, { $set: { activePartner: responseFromACP.activePartner, cardAndMemberNotValid: responseFromACP.cardAndMemberNotValid, faildConnectionACP: responseFromACP.faildConnectionACP } })
                    ]);

                    //Send email
                    let mailOptions = {
                        to: user.email,
                        message: {
                            username: user.name
                        },
                        type: responseFromACP.activePartner ? "activePartner" : "inactivePartner"
                    };


                    if (process.env.ACPSendEmailsFlag == "true") {
                        ExternalRequests.sendEmails(headers, mailOptions);
                        notifyAccountValidPartner(user._id, responseFromACP.activePartner);
                    }
                    resolve(responseFromACP);

                } else {
                    resolve(responseFromACP);
                }

            } else if (!user.cardNumber && user.activePartner) {
                await Promise.all([ 
                    ConttractsHandler.updateTariffContractACP(user._id, false, user.clientName),
                    CemeTarifftsHandler.updateTariffCEMEACP(user._id, false, user.clientName),
                    User.findOneAndUpdate({ _id: user._id }, { $set: { activePartner: false } })
                ]);

                //Send email
                let mailOptions = {
                    to: user.email,
                    message: {
                        username: user.name
                    },
                    type: "inactivePartner"
                };


                if (process.env.ACPSendEmailsFlag == "true") {
                    ExternalRequests.sendEmails(headers, mailOptions);
                }
                resolve({ activePartner: false });
            } else {
                resolve({ activePartner: false });
            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve({ activePartner: false });
        };
    });
};

var taskValidateDataACPSchedule = null;
var taskFaildConnectionACPSchedule = null;

if (process.env.NODE_ENV === 'production') {
    initValidateDataACPSchedule('0 2 * * *')
        .then(() => {
            taskValidateDataACPSchedule.start();
            console.log("Validate Data ACP Schedule Job Started")
        })
        .catch(error => {
            console.error("Error starting Validate Data ACP schedule Job: ", error.message)
        });

    initFaildConnectionACPSchedule('0 */4 * * *')
        .then(() => {
            taskFaildConnectionACPSchedule.start();
            console.log("Faild Connection ACP Schedule Job Started")
        })
        .catch(error => {
            console.error("Error starting Faild Connection ACP schedule Job: ", error.message)
        });
}

function initValidateDataACPSchedule(timer) {
    return new Promise((resolve, reject) => {

        taskValidateDataACPSchedule = cron.schedule(timer, () => {
            console.log('Running Job Validate Data ACP Schedule: ' + new Date().toISOString());

            jobValidateDataACP();

        }, {

            scheduled: false

        });

        resolve();

    });
};

function initFaildConnectionACPSchedule(timer) {
    return new Promise((resolve, reject) => {

        taskFaildConnectionACPSchedule = cron.schedule(timer, () => {
            console.log('Running Job Faild Connection ACP Schedule: ' + new Date().toISOString());

            jobFaildConnectionACP();

        }, {

            scheduled: false

        });

        resolve();

    });
};

//jobValidateDataACP()
async function jobValidateDataACP() {
    const context = "Funciton jobValidateDataACP";

    let query = {
        $and: [
            { cardNumber: { $exists: true } },
            { cardNumber: { $ne: "" } }
        ],
        status: process.env.USERRREGISTERED,
        clientName: process.env.clientNameACP,
    }

    let usersFound = await User.find(query);

    let filesToProcess = [];
    let promiseResponse = [];
    if (usersFound.length > 0) {

        for (let i = 0; i != usersFound.length; i++) {

            let user = usersFound[i]

            let response = await validateDataACP(user);

            console.log("response ACP - ", response)

            filesToProcess.push({ userId: user._id, name: user.name, activePartner: response.activePartner, date: new Date(), cardNumber: user.cardNumber, memberNumber: user.memberNumber, resultACP: response.resultACP })

        }

        /*
        Promise.all(promiseResponse)
            .then(async () => {
                */

                let date = new Date();
                let year = date.getFullYear();
                let day = date.getDate();
                let month = date.getMonth() + 1;

                let dateLastMonth = new Date(date.setDate(date.getDate() - 31));
                let yearLastMonth = dateLastMonth.getFullYear();
                let dayLastMonth = dateLastMonth.getDate();
                let monthLastMonth = dateLastMonth.getMonth() + 1;

                let path = `/usr/src/app/files/acp/${day}-${month}-${year}.txt`;

                filesToProcess = JSON.stringify(filesToProcess);

                fs.writeFile(path, filesToProcess, (err, result) => {
                    if (err) {
                        console.error(`[${context}][fs.writeFile] Error `, err.message);
                    };

                    console.log(`File saved successfully: ${day}-${month}-${year}.txt`)

                    path = `/usr/src/app/files/acp/${dayLastMonth}-${monthLastMonth}-${yearLastMonth}.txt`;

                    fs.readFile(path, 'utf8', (err, data) => {
                        if (err) {
                            console.error(`[${context}][fs.unlink] Error `, err.message);
                        }

                        if (data) {
                            fs.unlink(path, (err) => {
                                if (err) {
                                    console.error(`[${context}][fs.unlink] Error `, err.message);
                                }

                                console.log(`Deleted file: ${dayLastMonth}-${monthLastMonth}-${yearLastMonth}.txt`);

                            });
                        }

                    });

                });


        //})
    }
}

function updateMobileMongo(user) {
    let context = "Function updateMobileMongo";
    return new Promise((resolve, reject) => {
        try {

            let query = {
                _id: user._id
            };

            if (user.clientType === process.env.ClientTypeb2c)
                user.active = false

            User.updateUser(query, user, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateUser] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result)
                        resolve(true);
                    else
                        resolve(false);
                };
            });

        } catch (ex) {
            console.error(`[${context}] Error `, ex);
            reject(ex);
        };
    });
};

function cancelAllTokens(userId) {
    let context = "Function cancelAllTokens";

    let data = {
        userId: userId
    };

    let host = "http://authorization:3001/api/validTokens";

    AxiosHandler.axiosPatchBody(host, data)
        .then(() => {
            console.log("Tokens updated");
        })
        .catch(error => {
            console.error(`[${context}][.catch] Error `, error.message);
        });

};

function cancelFirebaseTokens(userId) {
    let context = "Function cancelFirebaseTokens";

    let data = {
        userId: userId
    };

    //let host = "http://notifications:3008/api/private/firebase/firebaseUserTokens";
    let host = process.env.NotificationsHost + process.env.PathNotificationFirebaseUserTokens;

    AxiosHandler.axiosPatchBody(host, data)
        .then(() => {
            console.log("Tokens firebase updated");
        })
        .catch(error => {
            console.error(`[${context}][.catch] Error `, error.message);
        });

};

function cancelFirebaseWLTokens(userId) {
    let context = "Function cancelFirebaseWLTokens";

    let data = {
        userId: userId
    };

    //let host = "http://notifications-firebase-wl:3032/api/private/firebase/firebaseUserTokens";
    let host = process.env.NotificationsFirebaseWLHost + process.env.PathNotificationFirebaseUserTokens;

    AxiosHandler.axiosPatchBody(host, data)
        .then(() => {
            console.log("Tokens firebase WL updated");
        })
        .catch(error => {
            console.error(`[${context}][.catch] Error `, error.message);
        });

};

//jobFaildConnectionACP()
async function jobFaildConnectionACP() {
    const context = "Funciton jobFaildConnectionACP";

    const limit = Constants.configs.jobFaildConnectionACP.limit;
    const awaitTime = Constants.configs.jobFaildConnectionACP.awaitTime;

    let query = {
        faildConnectionACP: true,
        status: process.env.USERRREGISTERED,
        clientName: process.env.clientNameACP,
    };

    let usersFound = await User.find(query);
    let filesToProcess = [];
    let promiseResponse = [];

    if (usersFound.length > 0) {

        for (let i = 0; i != usersFound.length; i++) {

            let user = usersFound[i]

            let response = await validateDataACP(user);

            filesToProcess.push({ userId: user._id, name: user.name, activePartner: response.activePartner, date: new Date(), cardNumber: user.cardNumber, memberNumber: user.memberNumber, resultACP: response.resultACP })

            if(i % limit === 0){
                await new Promise(r => setTimeout(r, awaitTime));
            }
        }

        //Promise.all(promiseResponse)
        //    .then(async () => {

                let date = new Date();
                let year = date.getFullYear();
                let day = date.getDate();
                let month = date.getMonth() + 1;
                let hour = date.getHours();

                let dateLastMonth = new Date(date.setDate(date.getDate() - 31));
                let yearLastMonth = dateLastMonth.getFullYear();
                let dayLastMonth = dateLastMonth.getDate();
                let monthLastMonth = dateLastMonth.getMonth() + 1;

                let path = `/usr/src/app/files/acp/${day}-${month}-${year}-${hour}-faildConnection.txt`;

                filesToProcess = JSON.stringify(filesToProcess);

                fs.writeFile(path, filesToProcess, (err, result) => {
                    if (err) {
                        console.error(`[${context}][fs.writeFile] Error `, err.message);
                    };

                    console.log(`File saved successfully: ${day}-${month}-${year}-${hour}-faildConnection.txt`)

                    path = `/usr/src/app/files/acp/${dayLastMonth}-${monthLastMonth}-${yearLastMonth}-${hour}-faildConnectionACPfaildConnection.txt`;

                    fs.readFile(path, 'utf8', (err, data) => {
                        if (err) {
                            console.error(`[${context}][fs.unlink] Error `, err.message);
                        }

                        if (data) {
                            fs.unlink(path, (err) => {
                                if (err) {
                                    console.error(`[${context}][fs.unlink] Error `, err.message);
                                }

                                console.log(`Deleted file: ${dayLastMonth}-${monthLastMonth}-${yearLastMonth}-${hour}-faildConnection.txt`);

                            });
                        }

                    });

                });



       //     })
    }
}
