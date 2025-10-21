require("dotenv-safe").load();
const { Client, Config, CheckoutAPI, Modification, Recurring , ClassicIntegrationAPI} = require('@adyen/api-library');
const axios = require("axios");
const UserPaymentConfiguration = require('../models/userPaymentConfigurations')
const PaymentMethod = require('../models/paymentMethod');
const moment = require('moment');
const PreAuthorizeHandler = require('./preAuthorize');
const ExternalRequest = require("./externalRequest");
const TransactionsHandler = require('./transactions');

//EVIO
var config = new Config();
var client;
var hostAdyen;
var adyenMerchantAccount;

//Salvador Caetano
var configSC = new Config();
var clientSC;
var adyenMerchantAccountSC;

switch (process.env.NODE_ENV) {
    case 'production':

        //EVIO
        adyenMerchantAccount = process.env.AdyenMerchantAccount;
        config.apiKey = process.env.AdyenAPIKEY;
        config.merchantAccount = adyenMerchantAccount;
        client = new Client({ config, environment: 'LIVE', liveEndpointUrlPrefix: '1e2f35e905cd5681-evioelectricalmobility' });
        //config.apiKey = process.env.AdyenAPIKEYTest;
        //config.AdyenMerchantAccount = adyenMerchantAccount;
        //client = new Client({ config });
        //client.setEnvironment("TEST");

        //Salvador Caetano
        adyenMerchantAccountSC = process.env.AdyenMerchantAccountSC;
        configSC.apiKey = process.env.AdyenAPIKEYSC;
        configSC.merchantAccount = adyenMerchantAccountSC;
        clientSC = new Client({ config: configSC, environment: 'LIVE', liveEndpointUrlPrefix: '328e099768bec969-SalvadorCaetanoGroup' });

        break;
    case 'development':

        //EVIO
        adyenMerchantAccount = process.env.AdyenMerchantAccountTest;
        config.apiKey = process.env.AdyenAPIKEYTest;
        config.merchantAccount = adyenMerchantAccount;
        client = new Client({ config });
        //hostAdyen = "https://pal-test.adyen.com/pal/servlet/Payment/v64";
        client.setEnvironment("TEST");

        //Salvador Caetano
        adyenMerchantAccountSC = process.env.AdyenMerchantAccountTestSC;
        configSC.apiKey = process.env.AdyenAPIKEYTestSC;
        configSC.merchantAccount = adyenMerchantAccountSC;
        clientSC = new Client({ config: configSC });
        clientSC.setEnvironment("TEST");

        console.log("Initing DEV environment")

        break;
    case 'pre-production':

        //EVIO
        adyenMerchantAccount = process.env.AdyenMerchantAccountTest;
        config.apiKey = process.env.AdyenAPIKEYTest;
        config.merchantAccount = adyenMerchantAccount;
        client = new Client({ config });
        //hostAdyen = "https://pal-test.adyen.com/pal/servlet/Payment/v64";
        client.setEnvironment("TEST");

        //Salvador Caetano
        adyenMerchantAccountSC = process.env.AdyenMerchantAccountTestSC;
        configSC.apiKey = process.env.AdyenAPIKEYTestSC;
        configSC.merchantAccount = adyenMerchantAccountSC;
        clientSC = new Client({ config: configSC });
        clientSC.setEnvironment("TEST");

        console.log("Initing pre environment")

        break;
    default:

        //EVIO
        adyenMerchantAccount = process.env.AdyenMerchantAccountTest;
        config.apiKey = process.env.AdyenAPIKEYTest;
        config.merchantAccount = adyenMerchantAccount;
        client = new Client({ config });
        //hostAdyen = "https://pal-test.adyen.com/pal/servlet/Payment/v64";
        client.setEnvironment("TEST");


        //Salvador Caetano
        adyenMerchantAccountSC = process.env.AdyenMerchantAccountTestSC;
        configSC.apiKey = process.env.AdyenAPIKEYTestSC;
        configSC.merchantAccount = adyenMerchantAccountSC;
        clientSC = new Client({ config: configSC });
        clientSC.setEnvironment("TEST");

        break;
};

//EVIO
const checkout = new CheckoutAPI(client);
// const modification = new Modification(client);
const modification = new ClassicIntegrationAPI(client);

//Salvador Caetano
const checkoutSC = new CheckoutAPI(clientSC);
// const modificationSC = new Modification(clientSC);
const modificationSC = new ClassicIntegrationAPI(clientSC);

module.exports = {
    createPaymentAdyen: function (payment, transaction) {
        const context = "Function createPaymentAdyen";
        return new Promise(async (resolve, reject) => {

            //console.log("payment", payment);

            //let clientName = payment.clientName;
            let body = {
                merchantAccount: adyenMerchantAccount,
                reference: payment.transactionId,
                amount: payment.amount,
                paymentMethod: {
                    type: "scheme",
                    storedPaymentMethodId: payment.paymentMethodId,
                    encryptedCardNumber: "",
                    encryptedExpiryYear: "",
                    encryptedSecurityCode: "",
                    holderName: "",
                    encryptedExpiryMonth: ""
                },
                shopperReference: payment.userId,
                shopperInteraction: process.env.ShopperInteractionContAuth,
                recurringProcessingModel: await getRecurringProcessingModel(payment.userId , payment.paymentMethodId),
            };

            await forceResponseCode(payment.userId , body)

            body.amount.value *= 100;
            body.amount.value = Math.abs(body.amount.value);

            //console.log("body", body);
            if (payment.clientName === process.env.clientNameSC || payment.clientName === process.env.clientNameHyundai) {

                body.merchantAccount = adyenMerchantAccountSC;
                console.log("1 body SC - ", body);
                checkoutSC.payments(body)
                    //checkout.payments(body)
                    .then(async (result) => {
                        needsThreeDSAuthentication(payment.paymentMethodId, result.refusalReasonCode)

                        //console.log("result", result);

                        var status;

                        switch (result.resultCode) {
                            case 'Error':
                                status = process.env.TransactionStatusFaild;
                                break;
                            case 'Refused':
                                status = process.env.TransactionStatusFaild;
                                break;
                            default:

                                result.amount.value = Math.abs(result.amount.value);

                                var data = {
                                    merchantAccount: adyenMerchantAccountSC,
                                    originalReference: result.pspReference,
                                    modificationAmount: result.amount,
                                    reference: result.merchantReference
                                };

                                //TODO
                                modificationSC.capture(data);
                                //modification.capture(data);
                                status = process.env.TransactionStatusInPayment;
                                result.amount.value /= 100;

                                break;
                        };

                        resolve(status);

                    })
                    .catch((error) => {

                        console.error(`[${context}][checkoutSC.payments] Error `, error.message);
                        reject(error);

                    });

            } else {

                checkout.payments(body)
                    .then(async (result) => {
                        needsThreeDSAuthentication(payment.paymentMethodId, result.refusalReasonCode)

                        //console.log("result", result);

                        var status;

                        switch (result.resultCode) {
                            case 'Error':
                                status = process.env.TransactionStatusFaild;
                                break;
                            case 'Refused':
                                status = process.env.TransactionStatusFaild;
                                break;
                            default:

                                result.amount.value = Math.abs(result.amount.value);

                                var data = {
                                    merchantAccount: adyenMerchantAccount,
                                    originalReference: result.pspReference,
                                    modificationAmount: result.amount,
                                    reference: result.merchantReference
                                };

                                modification.capture(data);
                                status = process.env.TransactionStatusInPayment;
                                result.amount.value /= 100;

                                break;
                        };


                        resolve(status);

                    })
                    .catch((error) => {

                        console.error(`[${context}][checkout.payments] Error `, error.message);
                        reject(error);

                    });

            }
        });
    },
    cancelPaymentAdyen: async function (clientName , originalReference , reference) {
        const context = "Function createPaymentAdyen";
        try {
            const adyenModificationObj = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? modificationSC : modification
            const adyenMerchantAccountName = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? adyenMerchantAccountSC : adyenMerchantAccount
            let data = {
                merchantAccount : adyenMerchantAccountName,
                originalReference,
                reference,
            };
            return await adyenModificationObj.cancel(data);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            throw error
        }
    },
    checkoutPayment,
    modificationCapture,
    makeReservationPaymentAdyen,
    adyenConfigObjects,
    
}


async function getRecurringProcessingModel(userId , paymentMethodId) {
    const context = "Function getRecurringProcessingModel"
    try {
        const found = await UserPaymentConfiguration.findOne({userId,paymentMethodId}).lean()
        if (found) {
            return found.recurringProcessingModel
        } else {
            const foundUser = await UserPaymentConfiguration.findOne({userId}).lean()
            return foundUser ? foundUser.recurringProcessingModel : process.env.RecurringProcessingModelUnscheduledCardOnFile
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return process.env.RecurringProcessingModelUnscheduledCardOnFile
    }
}

async function forceResponseCode(userId , body) {
    const context = "Function forceResponseCode"
    try {
        const found = await UserPaymentConfiguration.findOne({userId , paymentMethodId:body.paymentMethod.storedPaymentMethodId})
        if (found && found.tester && (found.testResponseCode !== null && found.testResponseCode !== undefined)) {
            body.additionalData = {
                RequestedTestAcquirerResponseCode : found.testResponseCode
            }
        } else {
            const foundUser = await UserPaymentConfiguration.findOne({userId}).lean()
            if (foundUser && foundUser.tester && (foundUser.testResponseCode !== null && foundUser.testResponseCode !== undefined)) {
                body.additionalData = {
                    RequestedTestAcquirerResponseCode : foundUser.testResponseCode
                }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function needsThreeDSAuthentication(paymentMethodId, refusalReasonCode) {
    const context = "Function needsThreeDSAuthentication"
    try {

        if (['11','38','42'].includes(refusalReasonCode)) {
            const found = await PaymentMethod.findOneAndUpdate({paymentMethodId , needsThreeDSAuthentication : false} , {$set : {needsThreeDSAuthentication : true}} , {new : true}).lean()
            if (found) {
                //TODO Send email or notification to user to warn about the need to authenticate the card through 3DS
                let foundUserPaymentConfig = await UserPaymentConfiguration.findOne({userId : found.userId,paymentMethodId}).lean()
                if (foundUserPaymentConfig) {
                    if (foundUserPaymentConfig.sendEmail) {
                        const userInfo = await getUser(found.userId)
                        sendEmailToUser(userInfo, 'threeDSAuthentication', { username: userInfo.name} , found.clientName)
                    }
                } else {
                    foundUserPaymentConfig = await UserPaymentConfiguration.findOne({userId : found.userId}).lean()
                    if (foundUserPaymentConfig) {
                        if (foundUserPaymentConfig.sendEmail) {
                            const userInfo = await getUser(found.userId)
                            sendEmailToUser(userInfo, 'threeDSAuthentication', { username: userInfo.name} , found.clientName)
                        }
                    }
                }
                return true
            }
        }
        return false
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    }
}

async function sendEmailToUser(user, action, message , clientName) {
    const context = "Function sendEmailToUser";
    try {
        const host = process.env.NotificationsHost + process.env.PathSendEmail;
        const mailOptions = {
            to: user.email,
            message,
            type: action,
            mailLanguage: user.language,
        };

        const headers = {
            clientname: clientName
        }
        await axios.post(host, { mailOptions }, { headers })
        console.log("sending email")
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
};

function makeReservationPaymentAdyen(paymentInfo) {
    const context = "Function makeReservationPaymentAdyen";
    return new Promise(async (resolve, reject) => {
        try {
            /* 
                Check if exists any pre authorization done in the last 10 min.  
                If for some reason the charger failed to accept or send the session, we'll try to re-use the pre authorization done in the past.

                The pre auth only becomes active if it fails further on in the process. This prevents the case of reusing a transaction that can't be reused and
                has already been assigned to another session.
            
            */
            const dateLimit = moment.utc().subtract(10, 'minutes').format();
            const foundPreAuth = await PreAuthorizeHandler.findOnePreAuthorize({ userId : paymentInfo.userIdWillPay , paymentMethodId : paymentInfo.paymentMethodId , authorizeDate : {$gte : dateLimit} , success : true , active  :true  })  
            
            //TODO : Wrap this logic in a function so we can contemplate more clientNames. Look for it in the whole code. 
            const { adyenCheckoutObj , adyenModificationObj , adyenMerchantAccountName } = adyenConfigObjects(paymentInfo.clientName)        
            if (foundPreAuth) {
                
                /*
                    We need to check if the new authorization value it's bigger than the one that already existed. 
                    If the user changed to a fast charging charger, it's expected that the reservedAmount is higher. 
                    Obviously, if we can't adjuts the existing authorization with the new value, we must return an error.
                */

                let preAuthValue = foundPreAuth.amount.value
                console.log("foundPreAuth" , JSON.stringify(foundPreAuth))
                console.log("paymentInfo.reservedAmount" , JSON.stringify(paymentInfo.reservedAmount))
                if (paymentInfo.reservedAmount > preAuthValue) {
                    console.log("Higher reservedAmount than the previous pre authorize")
                    preAuthValue = paymentInfo.reservedAmount
                    const result = await adjustExistingPreAuthorize(foundPreAuth.adyenReference , foundPreAuth.amount.currency , Math.abs(preAuthValue*100) , foundPreAuth.reference , adyenMerchantAccountName , adyenModificationObj , paymentInfo.userIdWillPay)
                    if (!result) {
                        //TODO Block RFID tokens, send email/sms/notification about inactivation
                        ExternalRequest.verifyUnblockedRFID(paymentInfo.userIdWillPay);
                        console.log("Failed adjusting existing pre auth")
                        PreAuthorizeHandler.editPreAuthorize({_id : foundPreAuth._id , "amount.value" : preAuthValue , success : false , active : false})
                        TransactionsHandler.updateTransaction({ _id: foundPreAuth.reference }, { $set: { "amount.value": preAuthValue } });
                        var message = { auth: true, code: 'server_payment_PreAuth', message: `We tried to reserve ${paymentInfo.reservedAmount} for the charging, however it was denied by your credit car issuer. Please add a new valid method of payment and please don't forget to select it as principal.`, redirect: "payments", amount: paymentInfo.reservedAmount };
                        console.error(`[${context}][!Authorised] Error `, message.message);
                        return resolve(message);
                    } 
                }
                /*
                    If the reservedAmount is still the same or lower, we just need to update the auhtorizeDate to count again the 10 min and set it to false,
                    so that it can't be re-used again unless there's another failure.
                */
                PreAuthorizeHandler.editPreAuthorize({_id : foundPreAuth._id , "amount.value" : preAuthValue , authorizeDate : new Date().toISOString() , active : false})
                TransactionsHandler.updateTransaction({ _id: foundPreAuth.reference }, { $set: { "amount.value": preAuthValue } });
                paymentInfo.adyenReference = foundPreAuth.adyenReference;
                paymentInfo.transactionId = foundPreAuth.reference;
                resolve(paymentInfo);
                
            } else {

                /* 
                    Since no pre authorization was found, we're going to create a new one after sending the request to Adyen
                */
               
                const transactionCreated = await TransactionsHandler.createTransactionEntry( paymentInfo.userIdWillPay , process.env.TransactionTypePreAuthorize , process.env.TransactionStatusSentToGenerate , process.env.TransactionProviderCreditCard , "EUR" , paymentInfo.reservedAmount , paymentInfo.clientName)
                const transactionId = transactionCreated._id.toString();
                let body = await createAdyenPreAuthBody(adyenMerchantAccountName , transactionId , paymentInfo.userIdWillPay , "EUR" , paymentInfo.reservedAmount , paymentInfo.paymentMethodId)

                console.log("createAdyenPreAuthBody", JSON.stringify(body));

                adyenCheckoutObj.payments(body)
                .then(async (result) => {
                    console.log("result", JSON.stringify(result));
                    if (result.resultCode === 'Authorised') {
                        //TODO Unblock RFID tokens
                        ExternalRequest.verifyBlockedRFID(paymentInfo.userIdWillPay);
                        await TransactionsHandler.updateTransaction({ _id: transactionId }, { $set: { adyenReference: result.pspReference } });
                        PreAuthorizeHandler.createPreAuthorizeEntry(transactionId , "EUR"  , paymentInfo.reservedAmount , paymentInfo.paymentMethodId , result.pspReference , paymentInfo.userIdWillPay , true , false , paymentInfo.clientName, new Date().toISOString() )
                        paymentInfo.adyenReference = result.pspReference;
                        paymentInfo.transactionId = transactionId;
                        resolve(paymentInfo);
                    }
                    else {
                        //TODO Block RFID tokens, send email/sms/notification about inactivation
                        ExternalRequest.verifyUnblockedRFID(paymentInfo.userIdWillPay);
                        PreAuthorizeHandler.createPreAuthorizeEntry(transactionId , "EUR"  , paymentInfo.reservedAmount , paymentInfo.paymentMethodId , result.pspReference , paymentInfo.userIdWillPay , false , false , paymentInfo.clientName , new Date().toISOString() )
                        var message = { auth: true, code: 'server_payment_PreAuth', message: `We tried to reserve ${paymentInfo.reservedAmount} for the charging, however it was denied by your credit car issuer. Please add a new valid method of payment and please don't forget to select it as principal.`, redirect: "payments", amount: paymentInfo.reservedAmount };
                        console.error(`[${context}][!Authorised] Error `, message.message);
                        resolve(message);
                    };
                })
                .catch((error) => {
                    if (error?.response?.status === 400) {
                        console.log(contex + " " + "Error response 400")
                        //TODO Block RFID tokens, send email/sms/notification about inactivation
                        ExternalRequest.verifyUnblockedRFID(paymentInfo.userIdWillPay);

                    }
                    PreAuthorizeHandler.createPreAuthorizeEntry(transactionId , "EUR"  , paymentInfo.reservedAmount , paymentInfo.paymentMethodId , undefined , paymentInfo.userIdWillPay , false , false , paymentInfo.clientName , new Date().toISOString() )
                    console.error(`[${context}][checkout.payments] Error `, error.message);
                    reject(error);
                });
            }
        } catch (error) {
            console.error(`[${context}][] Error `, error.message);
            reject(error);
        }
    });
};

async function adjustExistingPreAuthorize(originalReference , currency , value , reference , merchantAccount , adyenModificationObj , userId) {
    const context = "Function adjustExistingPreAuthorize";
    try {
        const body = {
            originalReference,
            modificationAmount: {
                currency,
                value,
            },
            additionalData: {
                industryUsage: "DelayedCharge",
                encryptedCardNumber: "",
                encryptedExpiryYear: "",
                encryptedSecurityCode: "",
                holderName: "",
                encryptedExpiryMonth: ""
            },
            reference,
            merchantAccount,

        }
        await forceResponseCode(userId , body)

        return await adjustPreAuthorize(body, adyenModificationObj)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    };
}

async function adjustPreAuthorize(body, adyenModificationObj) {
    const context = "Funciton walletFindOne";
        try {
        body.modificationAmount.value = Math.abs(body.modificationAmount.value);
        const result = await adyenModificationObj.adjustAuthorisation(body)
        return result.response === '[adjustAuthorisation-received]'
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    };
};

async function createAdyenPreAuthBody( adyenMerchantAccountName , transactionId , userId , currency , value , paymentMethodId) {
    const context = "Function createAdyenPreAuthBody";
    try {
        let body = {
            merchantAccount: adyenMerchantAccountName,
            reference: transactionId,
            amount: {
                currency: currency,
                value: value
            },
            paymentMethod: {
                type: "scheme",
                storedPaymentMethodId: paymentMethodId,
                encryptedCardNumber: "",
                encryptedExpiryYear: "",
                encryptedSecurityCode: "",
                holderName: "",
                encryptedExpiryMonth: ""
            },
            shopperReference: userId,
            shopperInteraction: process.env.ShopperInteractionContAuth,
            recurringProcessingModel: await getRecurringProcessingModel(userId),
            additionalData: {
                authorisationType: process.env.AdyenAuthorisationTypePreAuth
            }
        }
        body.amount.value *= 100;
        body.amount.value = Math.abs(body.amount.value);

        await forceResponseCode(userId , body)

        return body
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    };
}

async function getRecurringProcessingModel(userId, paymentMethodId) {
    const context = "Function getRecurringProcessingModel"
    try {
        const found = await UserPaymentConfiguration.findOne({ userId, paymentMethodId }).lean()
        if (found) {
            return found.recurringProcessingModel
        } else {
            const foundUser = await UserPaymentConfiguration.findOne({ userId }).lean()
            return foundUser ? foundUser.recurringProcessingModel : process.env.RecurringProcessingModelCardOnFile
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return process.env.RecurringProcessingModelCardOnFile
    }
}

function adyenConfigObjects(clientName) {
    const context = "Function adyenConfigObjects"
    try {
        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
            return {
                adyenCheckoutObj:checkoutSC,
                adyenModificationObj:modificationSC,
                adyenMerchantAccountName:adyenMerchantAccountSC,
            }
        } else {
            return {
                adyenCheckoutObj:checkout,
                adyenModificationObj:modification,
                adyenMerchantAccountName:adyenMerchantAccount,
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {
            adyenCheckoutObj:checkout,
            adyenModificationObj:modification,
            adyenMerchantAccountName:adyenMerchantAccount,
        }
    }
}

async function checkoutPayment(adyenMerchantAccountName , adyenCheckoutObj , adyenModificationObj ,  transactionId , currency , value , paymentMethodId , userId) {
    const context = "Function checkoutPayment"
    try {

        let body = {
            merchantAccount: adyenMerchantAccountName,
            reference: transactionId,
            amount: {
                currency: currency,
                value: value
            },
            paymentMethod: {
                type: "scheme",
                storedPaymentMethodId: paymentMethodId,
                encryptedCardNumber: "",
                encryptedExpiryYear: "",
                encryptedSecurityCode: "",
                holderName: "",
                encryptedExpiryMonth: ""
            },
            shopperReference: userId,
            shopperInteraction: process.env.ShopperInteractionContAuth,
            recurringProcessingModel: await getRecurringProcessingModel(userId , paymentMethodId),
            captureDelayHours:  0
        };

        await forceResponseCode(userId , body)

        console.log("checkoutPayment body - ", body);
        return await adyenCheckoutObj.payments(body)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    }
}


async function modificationCapture(adyenMerchantAccountName , adyenModificationObj , pspReference , amount ,  merchantReference ) {
    const context = "Function modificationCapture"
    try {
        const body = {
            merchantAccount: adyenMerchantAccountName,
            originalReference: pspReference,
            modificationAmount: amount,
            reference: merchantReference
        };

        return await adyenModificationObj.capture(body);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    }
}
