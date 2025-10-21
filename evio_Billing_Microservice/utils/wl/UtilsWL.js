var moment = require('moment');
const axios = require("axios");

const addressS = require("../../services/address")

const UtilsGireve = require('../wl/UtilsWLGireve');
const UtilsEVIO = require('../wl/UtilsWLEVIO');
const UtilsMobiE = require('../wl/UtilsWLMobiE');
const UtilsMonthly = require('../wl/UtilsWLMonthly');

var UtilsWL = {

    createPartnerBillingDocument(billingData, payments, paymentId, auth, optionalCountryCodeToVAT) {
        return new Promise((resolve, reject) => {

            try {

                let documentDescription;
                let name;

                switch (auth.clientName) {
                    case process.env.WhiteLabelGoCharge:
                        name = process.env.descriptionGoCharge;
                        break;
                    case process.env.WhiteLabelHyundai:
                        name = process.env.descriptionHyundai;
                        break;
                    case process.env.WhiteLabelACP:
                        name = process.env.descriptionACP;
                        break;
                    case process.env.WhiteLabelKLC:
                        name = process.env.descriptionKLC;
                        break;
                    case process.env.WhiteLabelKinto:
                        name = process.env.descriptionKinto;
                        break;
                    default:
                        name = process.env.descriptionEVIO;
                        break;
                }

                if (billingData.purchaseOrder == undefined || billingData.purchaseOrder == "") {
                    documentDescription = `${name}`;

                } else {
                    documentDescription = `${name} - ${billingData.purchaseOrder}`;
                };

                let invoices = [];
                payments.forEach(payment => {
                    let invoiceLine = {
                        APIInvoicingProduct: {
                            Code: payment.code,
                            Description: payment.description,
                            UnitPrice: payment.unitPrice,
                            Quantity: payment.quantity,
                            Unit: payment.uom,
                            Type: 'S',
                            TaxValue: taxValue(payment.vat),
                            ProductDiscount: payment.discount
                        }
                    }

                    if (optionalCountryCodeToVAT) {
                        invoiceLine.APIInvoicingProduct.TaxValueCountry = optionalCountryCodeToVAT;
                    }

                    invoices.push(invoiceLine);
                });

                let address = addressS.parseAddressStreetToString(billingData.billingAddress)

                var arg = {
                    Authentication: {
                        Email: auth.email,
                        Token: auth.token
                    },
                    Client: {
                        NIF: billingData.nif,
                        Name: billingData.billingName,
                        Address: address,
                        City: billingData?.billingAddress?.city,
                        PostCode: billingData?.billingAddress?.zipCode ?? billingData?.billingAddress?.postCode,
                        CountryCode: billingData?.billingAddress?.countryCode,
                        CountryName: billingData?.billingAddress?.country,
                        PhoneNumber: billingData.mobile,
                        Email: billingData.email
                    },
                    Document: {
                        Date: moment().format('YYYY-MM-DD'),
                        DueDate: moment().format('YYYY-MM-DD'),
                        Description: documentDescription,
                        Type: 'T', //Fatura/Recibo
                        Lines: invoices,
                        ExternalId: paymentId
                    },
                    IsToClose: true
                    //SendTo: billingData.email
                };

                addSeriesToDocument(auth, arg)
                addTaxExemptionCode(arg , payments)

                resolve(arg);

            }
            catch (error) {
                reject(error);
            }

        });
    },

    createEVIOBillingDocumentWL(billingData, payments, paymentId, auth, optionalCountryCodeToVAT) {
        return new Promise((resolve, reject) => {

            try {

                let documentDescription;
                let name;

                switch (auth.clientName) {
                    case process.env.WhiteLabelGoCharge:
                        name = process.env.descriptionGoCharge;
                        break;
                    case process.env.WhiteLabelHyundai:
                        name = process.env.descriptionHyundai;
                        break;
                    case process.env.WhiteLabelACP:
                        name = process.env.descriptionACP;
                        break;
                    case process.env.WhiteLabelKLC:
                        name = process.env.descriptionKLC;
                        break;
                    case process.env.WhiteLabelKinto:
                        name = process.env.descriptionKinto;
                        break;
                    default:
                        name = process.env.descriptionEVIO;
                        break;
                }

                if (billingData.purchaseOrder == undefined || billingData.purchaseOrder == "") {
                    documentDescription = `${name}`;

                } else {
                    documentDescription = `${name} - ${billingData.purchaseOrder}`;
                };

                let invoices = [];
                payments.forEach(payment => {
                    let invoiceLine = {
                        APIInvoicingProduct: {
                            Code: payment.code,
                            Description: payment.description,
                            UnitPrice: payment.unitPrice,
                            Quantity: payment.quantity,
                            Unit: payment.uom,
                            Type: 'S',
                            TaxValue: taxValue(payment.vat),
                            ProductDiscount: payment.discount
                        }
                    }

                    if (optionalCountryCodeToVAT) {
                        invoiceLine.APIInvoicingProduct.TaxValueCountry = optionalCountryCodeToVAT;
                    }

                    invoices.push(invoiceLine);
                });

                let address = addressS.parseAddressStreetToString(billingData.billingAddress)

                var arg = {
                    Authentication: {
                        Email: auth.email,
                        Token: auth.token
                    },
                    Client: {
                        NIF: billingData.nif,
                        Name: billingData.billingName,
                        Address: address,
                        City: billingData?.billingAddress?.city,
                        PostCode: billingData?.billingAddress?.zipCode ?? billingData?.billingAddress?.postCode,
                        CountryCode: billingData?.billingAddress?.countryCode,
                        CountryName: billingData?.billingAddress?.country,
                        PhoneNumber: billingData.mobile,
                        Email: billingData.email
                    },
                    Document: {
                        Date: moment().format('YYYY-MM-DD'),
                        DueDate: moment().format('YYYY-MM-DD'),
                        Description: documentDescription,
                        Type: 'T', //Fatura/Recibo
                        // Type: 'B', //Fatura/Recibo
                        Lines: invoices,
                        ExternalId: paymentId
                    },
                    IsToClose: true
                    //SendTo: billingData.email
                };

                addSeriesToDocument(auth, arg)
                addTaxExemptionCode(arg , payments)

                resolve(arg);

            }
            catch (error) {
                reject(error);
            }

        });
    },

    createInternationalBillingDocumentWL(billingData, payments, paymentId, auth, optionalCountryCodeToVAT) {
        return new Promise((resolve, reject) => {

            try {

                let documentDescription;
                let name;

                switch (auth.clientName) {
                    case process.env.WhiteLabelGoCharge:
                        name = process.env.descriptionGoCharge;
                        break;
                    case process.env.WhiteLabelHyundai:
                        name = process.env.descriptionHyundai;
                        break;
                    case process.env.WhiteLabelACP:
                        name = process.env.descriptionACP;
                        break;
                    case process.env.WhiteLabelKLC:
                        name = process.env.descriptionKLC;
                        break;
                    case process.env.WhiteLabelKinto:
                        name = process.env.descriptionKinto;
                        break;
                    default:
                        name = process.env.descriptionEVIO;
                        break;
                }

                if (billingData.purchaseOrder == undefined || billingData.purchaseOrder == "") {
                    documentDescription = `${name}`;

                } else {
                    documentDescription = `${name} - ${billingData.purchaseOrder}`;
                };

                let invoices = [];
                payments.forEach(payment => {
                    let invoiceLine = {
                        APIInvoicingProduct: {
                            Code: payment.code,
                            Description: payment.description,
                            UnitPrice: payment.unitPrice,
                            Quantity: payment.quantity,
                            Unit: payment.uom,
                            Type: 'S',
                            TaxValue: taxValue(payment.vat),
                            ProductDiscount: payment.discount
                        }
                    }

                    if (optionalCountryCodeToVAT) {
                            invoiceLine.APIInvoicingProduct.TaxValueCountry = optionalCountryCodeToVAT;
                    }

                    invoices.push(invoiceLine);
                });

                let address = addressS.parseAddressStreetToString(billingData.billingAddress)

                var arg = {
                    Authentication: {
                        Email: auth.email,
                        Token: auth.token
                    },
                    Client: {
                        NIF: billingData.nif,
                        Name: billingData.billingName,
                        Address: address,
                        City: billingData?.billingAddress?.city,
                        PostCode: billingData?.billingAddress?.zipCode ?? billingData?.billingAddress?.postCode,
                        CountryCode: billingData?.billingAddress?.countryCode,
                        CountryName: billingData?.billingAddress?.country,
                        PhoneNumber: billingData.mobile,
                        Email: billingData.email
                    },
                    Document: {
                        Date: moment().format('YYYY-MM-DD'),
                        DueDate: moment().format('YYYY-MM-DD'),
                        Description: documentDescription,
                        Type: 'T', //Fatura/Recibo
                        // Type: 'B', //Fatura/Recibo
                        Lines: invoices,
                        ExternalId: paymentId
                    },
                    IsToClose: true
                    //SendTo: billingData.email
                };

                addSeriesToDocument(auth, arg)
                addTaxExemptionCode(arg , payments)

                resolve(arg);

            }
            catch (error) {
                reject(error);
            }

        });
    },

    sendEVIOInvoiceEmailWL: (billingData, invoice, attach, pdfBuffer, invoiceInfo, emailUserId) => {
        var context = "sendEVIOInvoiceEmailWL";
        return new Promise((resolve, reject) => {

            UtilsEVIO.createInvoicePDF(billingData, invoice, attach, invoiceInfo.clientName)
                .then(async (result) => {

                    var headers = {
                        clientname: invoiceInfo.clientName
                    }

                    var host = process.env.HostNotifications + process.env.PathWLNotificationsSendEmail;

                    //TODO change email to emails?
                    console.log("EmailUserId")
                    console.log(emailUserId)

                    let emailsList = []

                    if (emailUserId) {
                        for (let i = 0; i != emailUserId.length; i++) {
                            let billingProfile = await getBillingProfile(emailUserId[i])
                            emailsList.push(billingProfile.email)
                        }
                    }

                    console.log("emailsList")
                    console.log(emailsList)

                    if (emailsList.length == 0) {
                        emailsList.push(billingData.email)
                    }

                    console.log("emailsList 2")
                    console.log(emailsList)

                    var mailOptions = {
                        to: emailsList,
                        message: {
                            username: billingData.billingName
                        },
                        type: "invoice",
                        attachments: [
                            {
                                filename: billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                                content: pdfBuffer,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            },
                            {
                                filename: billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                                content: result,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            }
                        ]
                    };

                    axios.post(host, { mailOptions }, { headers })
                        .then((result) => {
                            if (result)
                                resolve(result.data);
                            else
                                reject("email sent unsuccessfully!");
                        })
                        .catch((error) => {
                            if (error.response) {
                                console.error(`[${context}][.catch] Error `, error.response.data);
                                reject(error);
                            }
                            else {
                                console.error(`[${context}][.catch] Error `, error.message);
                                reject(error);
                            };
                        });

                })
                .catch((error) => {
                    console.log(error);
                    reject();
                });

        });

    },

    sendMobieInvoiceEmailWL: (billingData, invoice, attach, pdfBuffer, invoiceInfo, emailUserId) => {
        var context = "sendMobieInvoiceEmailWL";
        return new Promise((resolve, reject) => {

            UtilsMobiE.createInvoicePDF(billingData, invoice, attach, invoiceInfo.clientName)
                .then(async (result) => {

                    var headers = {
                        clientname: invoiceInfo.clientName
                    }

                    var host = process.env.HostNotifications + process.env.PathWLNotificationsSendEmail;

                    //TODO change email to emails?
                    console.log("EmailUserId")
                    console.log(emailUserId)

                    let emailsList = []
                    if (emailUserId) {
                        for (let i = 0; i != emailUserId.length; i++) {
                            let billingProfile = await getBillingProfile(emailUserId[i])
                            emailsList.push(billingProfile.email)
                        }
                    }

                    console.log("emailsList")
                    console.log(emailsList)

                    if (emailsList.length == 0) {
                        emailsList.push(billingData.email)
                    }

                    console.log("emailsList 2")
                    console.log(emailsList)

                    var mailOptions = {
                        to: emailsList,
                        message: {
                            username: billingData.billingName
                        },
                        type: "invoice",
                        attachments: [
                            {
                                filename: billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                                content: pdfBuffer,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            },
                            {
                                filename: billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                                content: result,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            }
                        ]
                    };

                    axios.post(host, { mailOptions }, { headers })
                        .then((result) => {
                            if (result)
                                resolve(result.data);
                            else
                                reject("email sent unsuccessfully!");
                        })
                        .catch((error) => {
                            if (error.response) {
                                console.error(`[${context}][.catch] Error `, error.response.data);
                                reject(error);
                            }
                            else {
                                console.error(`[${context}][.catch] Error `, error.message);
                                reject(error);
                            };
                        });

                })
                .catch((error) => {
                    console.log(error);
                    reject();
                });

        });

    },

    sendGireveInvoiceEmailWL: (billingData, invoice, attach, pdfBuffer, invoiceInfo, emailUserId) => {
        var context = "sendGireveInvoiceEmailWL";
        return new Promise((resolve, reject) => {

            UtilsGireve.createInvoicePDF(billingData, invoice, attach, invoiceInfo.clientName)
                .then(async (result) => {

                    var headers = {
                        clientname: invoiceInfo.clientName
                    }

                    var host = process.env.HostNotifications + process.env.PathWLNotificationsSendEmail;

                    //TODO change email to emails?
                    console.log("EmailUserId")
                    console.log(emailUserId)

                    let emailsList = []

                    if (emailUserId) {
                        for (let i = 0; i != emailUserId.length; i++) {
                            let billingProfile = await getBillingProfile(emailUserId[i])
                            emailsList.push(billingProfile.email)
                        }
                    }

                    console.log("emailsList")
                    console.log(emailsList)

                    if (emailsList.length == 0) {
                        emailsList.push(billingData.email)
                    }

                    console.log("emailsList 2")
                    console.log(emailsList)

                    var mailOptions = {
                        to: emailsList,
                        message: {
                            username: billingData.billingName
                        },
                        type: "invoice",
                        attachments: [
                            {
                                filename: billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                                content: pdfBuffer,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            },
                            {
                                filename: billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                                content: result,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            }
                        ]
                    };

                    axios.post(host, { mailOptions }, { headers })
                        .then((result) => {
                            if (result)
                                resolve(result.data);
                            else
                                reject("email sent unsuccessfully!");
                        })
                        .catch((error) => {
                            if (error.response) {
                                console.error(`[${context}][.catch] Error `, error.response.data);
                                reject(error);
                            }
                            else {
                                console.error(`[${context}][.catch] Error `, error.message);
                                reject(error);
                            };
                        });

                })
                .catch((error) => {
                    console.log(error);
                    reject();
                });

        });

    },

    sendPeriodicInvoiceEmailWL: (billingData, invoice, attach, pdfBuffer, invoiceInfo, emailUserId) => {
        var context = "sendPeriodicInvoiceEmailWL";
        return new Promise((resolve, reject) => {

            UtilsMonthly.createInvoicePDF(billingData, invoice, attach, invoiceInfo.clientName)
                .then(async (result) => {

                    var headers = {
                        clientname: invoiceInfo.clientName
                    }

                    var host = process.env.HostNotifications + process.env.PathWLNotificationsSendEmail;

                    //TODO change email to emails?
                    console.log("EmailUserId")
                    console.log(emailUserId)

                    let emailsList = []
                    if (emailUserId) {
                        for (let i = 0; i != emailUserId.length; i++) {
                            let billingProfile = await getBillingProfile(emailUserId[i])
                            emailsList.push(billingProfile.email)
                        }
                    }

                    console.log("emailsList")
                    console.log(emailsList)

                    if (emailsList.length == 0) {
                        emailsList.push(billingData.email)
                    }

                    console.log("emailsList 2")
                    console.log(emailsList)

                    var mailOptions = {
                        to: emailsList,
                        message: {
                            username: billingData.billingName
                        },
                        type: "invoice",
                        invoiceInfo: { ...invoiceInfo, ...invoice },
                        attachments: [
                            {
                                filename: billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                                content: pdfBuffer,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            },
                            {
                                filename: billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                                content: result,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            },
                            {
                                filename: billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.xlsx',
                                content: '',
                                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            }
                        ]
                    };

                    axios.post(host, { mailOptions }, { headers })
                        .then((result) => {
                            if (result)
                                resolve(result.data);
                            else
                                reject("email sent unsuccessfully!");
                        })
                        .catch((error) => {
                            if (error.response) {
                                console.error(`[${context}][.catch] Error `, error.response.data);
                                reject(error);
                            }
                            else {
                                console.error(`[${context}][.catch] Error `, error.message);
                                reject(error);
                            };
                        });

                })
                .catch((error) => {
                    console.log(error);
                    reject();
                });

        });

    }

}

function taxValue(iva) {
    return iva * 100;
}


function addSeriesToDocument(auth, arg) {
    var context = "addSeriesToDocument";
    try {

        let serieGoCharge;
        let serieACP;
        let serieHyundai;
        let serieFR;
        let serieGoChargeCemeGC;
        let serieHyundaiCemeGC;
        let serieFT;
        let serieGoChargeCemeGCFT;
        let serieHyundaiCemeGCFT;

        switch (process.env.NODE_ENV) {
            case 'production':
                serieGoCharge = process.env.serieGoCharge
                serieACP = process.env.serieACP
                serieHyundai = process.env.serieHyundai
                serieFR = process.env.serieFR
                serieGoChargeCemeGC = process.env.serieGoChargeCemeGC
                serieHyundaiCemeGC = process.env.serieHyundaiCemeGC
                serieFT = process.env.serieFT
                serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFT
                serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFT
                break;
            case 'pre-production':
                serieGoCharge = process.env.serieGoChargePre
                serieACP = process.env.serieACPPre
                serieHyundai = process.env.serieHyundaiPre
                serieFR = process.env.serieFRPre
                serieGoChargeCemeGC = process.env.serieGoChargeCemeGCPre
                serieHyundaiCemeGC = process.env.serieHyundaiCemeGCPre
                serieFT = process.env.serieFTPre
                serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFTPre
                serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFTPre
                break;
            case 'development':
                serieGoCharge = process.env.serieGoChargePre
                serieACP = process.env.serieACPPre
                serieHyundai = process.env.serieHyundaiPre
                serieFR = process.env.serieFRPre
                serieGoChargeCemeGC = process.env.serieGoChargeCemeGCPre
                serieHyundaiCemeGC = process.env.serieHyundaiCemeGCPre
                serieFT = process.env.serieFTPre
                serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFTPre
                serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFTPre
                break;
            default:
                serieGoCharge = process.env.serieGoChargePre
                serieACP = process.env.serieACPPre
                serieHyundai = process.env.serieHyundaiPre
                serieFR = process.env.serieFRPre
                serieGoChargeCemeGC = process.env.serieGoChargeCemeGCPre
                serieHyundaiCemeGC = process.env.serieHyundaiCemeGCPre
                serieFT = process.env.serieFTPre
                serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFTPre
                serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFTPre
                break;
        }

        switch (auth.clientName) {
            case process.env.WhiteLabelGoCharge:
                if (auth.ceme === 'EVIO') {
                    arg.Document.Serie = serieGoCharge
                } else {
                    arg.Document.Serie = serieGoChargeCemeGC
                }
                break;
            case process.env.WhiteLabelHyundai:
                if (auth.ceme === 'EVIO') {
                    arg.Document.Serie = serieHyundai
                } else {
                    arg.Document.Serie = serieHyundaiCemeGC
                }
                break;
            case process.env.WhiteLabelACP:
                arg.Document.Serie = serieACP
                break;
            case process.env.WhiteLabelKLC:
                arg.Document.Serie = serieFR
                break;
            case process.env.WhiteLabelKinto:
                if (arg.Document.Type === process.env.documentTypeInvoiceReceipt) {
                    arg.Document.Serie = serieFR
                } else {
                    arg.Document.Serie = serieFT
                }
                break;
            default:
                arg.Document.Serie = serieFR
                break;
        }

        console.log("arg.Document.Serie - ", arg.Document.Serie)

        /*if (auth.clientName === process.env.WhiteLabelGoCharge && auth.ceme === 'EVIO') {
            arg.Document.Serie = serieGoCharge
        } else if (auth.clientName === process.env.WhiteLabelACP && auth.ceme === 'EVIO') {
            arg.Document.Serie = serieACP
        } else if (auth.clientName === process.env.WhiteLabelHyundai && auth.ceme === 'EVIO') {
            arg.Document.Serie = serieHyundai
        } else {
            arg.Document.Serie = serieFR
        }*/

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function getBillingProfile(userId) {
    var context = "Function getBillingProfile";
    return new Promise((resolve, reject) => {

        var params = { userId: userId };
        var host = process.env.IdentityHost + process.env.PathGetBillingProfile;
        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    resolve(result.data);
                }
                else {
                    resolve(null);
                };
            })
            .catch((error) => {
                console.error(`[${context}]Error`, error.message);
                resolve(null);
            });
    });
}

function addTaxExemptionCode(arg , payments) {
    var context = "addTaxExemptionCode";
    try {
        const foundExemption = payments.find(elem => elem.taxExemptionReasonCode || elem.TaxExemptionReasonCode)
        if (foundExemption) {
            arg.Document.TaxExemptionReasonCode = foundExemption.taxExemptionReasonCode ?? elem.TaxExemptionReasonCode
            console.log(`[Function addTaxExemptionCode] TaxExemptionReasonCode found ${arg?.Document?.TaxExemptionReasonCode}`)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}


module.exports = UtilsWL;
