const Invoice = require('../models/Invoice');
var moment = require('moment');
const Sentry = require("@sentry/node");

// Utils
const Utils = require('../utils/Utils')
const UtilsGireve = require('../utils/UtilsGireve');
const UtilsEVIO = require('../utils/UtilsEVIO');
const UtilsMobiE = require('../utils/UtilsMobiE');
const UtilsMonthly = require('../utils/UtilsMonthly');

// Utils WL
const UtilsGireveWL = require('../utils/wl/UtilsWLGireve');
const UtilsEVIOWL = require('../utils/wl/UtilsWLEVIO');
const UtilsMobiEWL = require('../utils/wl/UtilsWLMobiE');
const UtilsMonthlyWL = require('../utils/wl/UtilsWLMonthly');
const { providers, defaultLanguage } = require('../utils/constants');

const { Enums } = require('evio-library-commons').default;

const validatePortugalTaxId = async (taxNumber) => {
    const context = 'validatePortugalTaxId'
    try {
        const response = await fetch(`${providers.PortugalTaxIdValidatorUrl}?q=${taxNumber}/`);
        return response.status == 200;
    } catch (error) {
        console.error(`[${context}] Error`, error)
        Sentry.captureException(error);
        return false;
    }
}

const validateInternationalTaxId = async (taxNumber, countryCode) => {
    const context = 'validateInternationalTaxId'
    try {
        const response = await fetch(`${providers.InternationalTaxIdValidatorUrl}`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({msCode: countryCode?.toUpperCase(), tinNumber: taxNumber.toString()})
        });

        const jsonResponse = await response.json();
        return jsonResponse?.result?.structureValid && jsonResponse?.result?.syntaxValid;
    } catch (error) {
        console.error(`[${context}] Error`, error)
        Sentry.captureException(error);
        return false;
    }
}

const isTaxIdValid = async (taxNumber, countryCode)=>{
    console.log(`Validating tax number ${taxNumber} for country ${countryCode}`);
    if (countryCode?.toUpperCase()==='PT') {
        return await validatePortugalTaxId(taxNumber)
    }

    return await validateInternationalTaxId(taxNumber, countryCode)
}

module.exports = {
    reprocessAttachments: async (invoiceIds , test , testEmail, reprocessInvoicePdf ,reprocessSummaryPdf , reprocessExcel) => {
        const context = "Function reprocessAttachments";
        try {
            // Get Invoices to reprocess
            const invoices = await getInvoicesById(invoiceIds)

            // Reprocess all invoices
            await reprocessInvoices(invoices , test , testEmail, reprocessInvoicePdf ,reprocessSummaryPdf , reprocessExcel)

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
        }
    },
    isTaxIdValid
}



async function getInvoicesById(invoiceIds) {
    const context = "Function getInvoicesById";
    try {
        const query = { _id: invoiceIds }
        return await getInvoices(query)

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function getInvoices(query) {
    const context = "Function getInvoices";
    try {
        return await Invoice.find(query).lean()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function reprocessInvoices(invoices , test , testEmail, reprocessInvoicePdf ,reprocessSummaryPdf , reprocessExcel) {
    const context = "Function reprocessInvoices";
    try {
        for (let invoice of invoices) {
            await reprocess(invoice , test , testEmail, reprocessInvoicePdf ,reprocessSummaryPdf , reprocessExcel)
            await Utils.sleep(1000)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);

    }
}

async function reprocess(invoice , test , testEmail, reprocessInvoicePdf ,reprocessSummaryPdf , reprocessExcel) {
    const context = "Function reprocess";
    try {
            const {billingData , translations, language} = await getAllUserInfo(invoice.userId)

            const { emailSubject,htmlToSend} = Utils.getEmailInputInfo(invoice , billingData , translations)

            let attachments = []
            if (reprocessInvoicePdf) {
                const magnifinanceDocument = await Utils.getMagnifinanceDocument(invoice?.argData?.Authentication?.Email , invoice?.argData?.Authentication?.Token , invoice.documentId)    
                
                addInfoToInvoiceObject(magnifinanceDocument , invoice)
                
                await generateInvoicePdf(invoice , billingData ,  attachments)
            }

            if (reprocessSummaryPdf) {
                await generateSummaryPdf(invoice , billingData ,  attachments , translations, language)
            }

            if (reprocessExcel) {
                await generateExcel(invoice , billingData ,  attachments , translations)
            }

            await Utils.sendEmail(process.env.EVIOMAIL  , test ? testEmail : billingData.email , emailSubject , htmlToSend , attachments)

            Utils.updateInvoiceDocumentNames(invoice , billingData)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);

    }
}

async function generateInvoicePdf(invoice , billingData ,  attachments) {
    const context = "Function generateInvoicePdf";
    try {
        const pdfBuffer = await Utils.convertPdfToBase64(invoice.documentUrl)
        const documentNumberReplacing = invoice.documentNumber.replace("/", " ").split(" ")
        attachments.push(
            {
                filename: documentNumberReplacing[0] + documentNumberReplacing[1] + '_' + documentNumberReplacing[2] + '_' + billingData.billingName.replace(/ /g, "") + '.pdf',
                content: pdfBuffer,
                contentType: 'application/pdf',
                encoding: 'base64'
            }
        )
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function generateSummaryPdf(invoice , billingData ,  attachments , translations, language) {
    const context = "Function generateSummaryPdf";
    try {
        const pdfBuffer = await createSummaryBuffer(invoice , billingData, language)
        const emailAttachmentSummary = translations.filter(translation => translation.key === `email_attachmentSummary`)[0].value
        attachments.push(
            {
                filename: emailAttachmentSummary + billingData.billingName.replace(/ /g, "") + '.pdf',
                content: pdfBuffer,
                contentType: 'application/pdf',
                encoding: 'base64'
            },
        )
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function createSummaryBuffer(invoice , billingData, language) {
    const context = "Function createSummaryBuffer";
    try {
       if (invoice.clientName && invoice.clientName !== process.env.evioClientName ) {
        if (invoice.billingType == undefined || invoice.billingType == process.env.instantType) {
            if (invoice.chargerType === process.env.ChargerTypeMobiE) {
                    return await UtilsMobiEWL.createInvoicePDF(billingData, invoice, invoice.attach, invoice.clientName, language)
            } else {
                if (
                    invoice.chargerType === process.env.ChargerTypeGireve || 
                    invoice.chargerType === Enums.ChargerTypes.Hubject
                ) {
                    return await UtilsGireveWL.createInvoicePDF(billingData, invoice, invoice.attach, invoice.clientName, language)
                } else {
                    return await UtilsEVIOWL.createInvoicePDF(billingData, invoice, invoice.attach, invoice.clientName, language)
                }
            }
        } else {
            return await UtilsMonthlyWL.createInvoicePDF(billingData, invoice, invoice.attach, invoice.clientName, language)
        }
       } else {
            if (invoice.type === process.env.budgetType) {
                return await UtilsMonthly.createInvoicePDF(billingData, invoice, invoice.attach, language)
            } else {
                if (invoice.billingType == undefined || invoice.billingType == process.env.instantType) {
                    if (invoice.chargerType === process.env.ChargerTypeMobiE) {
                        return await UtilsMobiE.createInvoicePDF(billingData, invoice, invoice.attach, language)

                    } else {
                        if (
                            invoice.chargerType === process.env.ChargerTypeGireve ||
                            invoice.chargerType === Enums.ChargerTypes.Hubject
                        ) {
                            return await UtilsGireve.createInvoicePDF(billingData, invoice, invoice.attach, language)
                        } else {
                            return await UtilsEVIO.createInvoicePDF(billingData, invoice, invoice.attach, language)
                        }
                    }
                } else {
                    return await UtilsMonthly.createInvoicePDF(billingData, invoice, invoice.attach, language)
                }
            }
       }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}



async function generateExcel(invoice , billingData ,  attachments , translations) {
    const context = "Function generateExcel";
    try {
        const emailAttachmentSummary = translations.filter(translation => translation.key === `email_attachmentSummary`)[0].value
        const excelBuffer = await createExcelBuffer(invoice , billingData , translations , emailAttachmentSummary)
        attachments.push(
            {
                filename: emailAttachmentSummary + billingData.billingName.replace(/ /g, "") + '.xlsx',
                content: excelBuffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
        )
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}


async function createExcelBuffer(invoice , billingData , translations , emailAttachmentSummary) {
    const context = "Function createExcelBuffer";
    try {
        // Build sessions array to excel lines
        let attachLines = invoice.attach.chargingSessions.lines
        let sessions = []
        if (invoice.billingType === process.env.monthlyType) {
            sessions = attachLines.map(obj => Object.values(obj)[0]).flat(1).sort((a, b) => moment(a.startDateTime) - moment(b.startDateTime))
        } else {
            sessions = attachLines.sort((a, b) => moment(a.startDateTime) - moment(b.startDateTime))
        }
        sessions = await Promise.all(sessions.map(async session => await Utils.addMissingUserInfo(session)))
        const billingDates = {
            startDate: invoice.startDate,
            endDate: invoice.endDate,
            dueDate: invoice.dueDate,
            emissionDate: invoice.emissionDate,
        }
        const lines = Utils.mappingExcelLinesValues(sessions, invoice, billingDates)
        const columns = Utils.createBillingPeriodExcelColumns(translations)
        return await Utils.createExcelBuffer(emailAttachmentSummary + billingData.billingName.replace(/ /g, ""), columns, lines)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}


async function getAllUserInfo(userId) {
    const context = "Function getAllUserInfo";
    try {

        // Fetch user info
        const {billingData , userInfo} = await Utils.getUserAndBillingInfo(userId)

        // Get its languageCode
        let language = userInfo?.language ?? defaultLanguage;

        // Fetch language microservice to get translations to a specific languageCode
        let translations = await Utils.getTranslations(language);
        return {billingData , translations, language}
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw new Error({message : "Couldn't get user info"})
    }
}


function addInfoToInvoiceObject(magnifinanceDocument , invoice) {
    const context = "Function addInfoToInvoiceObject";
    try {
        invoice.documentNumber = magnifinanceDocument.DocumentNumber,
        invoice.documentUrl = magnifinanceDocument.DownloadUrl
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}
