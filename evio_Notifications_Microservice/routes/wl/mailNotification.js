const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const nodemailer = require("nodemailer");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const handlebars = require('handlebars');
const inlineBase64 = require('nodemailer-plugin-inline-base64');

const SenderEmail = require('../../models/senderEmail');
const WLKeysMapping = require('../../models/WLKeysMapping.json');
const scParticularContract = require('../../utils/wl/sc_ParticularContractUtils');
const hyundaiParticularContract = require('../../utils/wl/hyundai_ParticularContractUtils');
const DeleteAccountEmailTypes = require('../../utils/deleteAccountEmailTypes');

const Utils = require('../../utils/Utils');
const { getEmailHeaderKeyMap } = require('../../utils/wl/emailHeaderKeys');
const { setFooterTranslation } = require('../../utils/wl/emailFooterUtils');

const Constants = require('../../utils/constants');

const { replaceAll } = require('../../middlewares/mailNotifications');

const { getTranslationsAccordingToUser } = require('../../services/languageService');
const { getUserByEmail } = require('../../services/identityService');
const Sentry = require('@sentry/node');

/*const transporter = nodemailer.createTransport({
    maxConnections: 2,
    maxMessages: 1,
    pool: true,
    host: 'smtp.office365.com',
    port: 587,
    auth: {
        user: process.env.EVIOMAILSC,
        pass: process.env.EVIOPASSWORDSC
    }
});
transporter.use('compile', inlineBase64({ cidPrefix: 'somePrefix_' }));

transporterACP.use('compile', inlineBase64({ cidPrefix: 'somePrefix_' }));*/
//Por apagar
//Substituido na WL por sendEmail
///api/private/mailNotification/recoverPassword

//Por apagar
//Nao é incluido na WL a mudança de email
///api/private/mailNotification/changeEmail

router.post('/api/private/wl/sendEmail', async (req, res, next) => {
    var context = "POST /api/private/wl/sendEmail";
    try {

        if (req.body != null) {

            if (!req.body.mailOptions) {
                return res.status(400).send({ auth: false, code: 'server_mailOptions_require', message: "Mail options data require" });
                //return res.status(400).send({ code: 'send_email_error', message: "Send email error" });
            }

            if (!req.body.mailOptions.to && !req.body.mailOptions.cc) {
                return res.status(400).send({ auth: false, code: 'server_to_require', message: "Mail to require" });
                //return res.status(400).send({ code: 'send_email_error', message: "Send email error" });
            }

            if (!req.body.mailOptions.message) {
                return res.status(400).send({ auth: false, code: 'server_message_require', message: "Message data require" });
                //return res.status(400).send({ code: 'send_email_error', message: "Send email error" });
            }

            if (!req.body.mailOptions.type) {
                return res.status(400).send({ auth: false, code: 'server_type_require', message: "Type data require" });
                //return res.status(400).send({ code: 'send_email_error', message: "Send email error" });
            }

            let clientName = req.headers.clientname;
            let notificationBody = JSON.stringify(req.body);
            let mail = req.body.mailOptions;
            let emailSubject;

            let emailLanguage = mail.to;
            if (DeleteAccountEmailTypes.includes(mail.type)) {
                emailLanguage = mail.message.userEmail;
            } else if (mail?.userEmail) {
                emailLanguage = mail.userEmail
            }

            let { translations, isSupportEVIO } = await getTranslationsAccordingToUser(emailLanguage, clientName);

            //console.log("clientName", clientName);
            //console.log("notificationBody", notificationBody);
            //console.log("mail", mail);

            const clientNameTemplatePath = "../../emailTemplatesWL/" + clientName;
            const templatesPath = path.resolve(__dirname, clientNameTemplatePath);
            const template = mail.emailTemplate ?? mail.type;

            const imgDirectory = templatesPath + `/${template}` + '/img';
            console.log("mail.type ", mail.type);
            if (mail.type === "globalNotification") {
                // Add environment to email subject
                emailSubject = addEnvironmentToSubject(mail.message.emailSubject)
            } else {

                // This function gets all translation keys according to the user language ans checks if the mail is for suport EVIO or a current user
                //let { translations, isSupportEVIO } = await getTranslationsAccordingToUser(mail.to ,clientName , mail.mailLanguage)
                let clientNameKeyMappingWL = WLKeysMapping[clientName];

                // Query the keys according to mail.type for the emails
                emailSubject = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_email_${mail.type}_subject` || translation.key === `shared_email_${mail.type}_subject`)[0].value
                let emailTitle = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_email_${mail.type}_title` || translation.key === `shared_email_${mail.type}_title`)[0].value
                const emailHeaderKeyMap = getEmailHeaderKeyMap(clientNameKeyMappingWL);
                const emailHeaderKey = emailHeaderKeyMap[mail.type] || `${clientNameKeyMappingWL}_email_header`;
                let emailHeader = translations.find(t => t.key === emailHeaderKey)?.value;
                let emailBody = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_email_${mail.type}_body` || translation.key === `shared_email_${mail.type}_body`)[0].value
                let emailAfterFooter = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_email_after_footer`)[0].value
                let emailCancelSubscription = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_email_cancel_subscription`)[0].value
                let linkText = mail.message?.linkUrl ? translations.filter(translation => translation.key === `email_${mail.type}_link_text`) : null;
                //let emailFooter = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_email_footer`)[0].value
                let emailFooter = ''

                //console.log("emailTitle ", emailTitle);
                //console.log("emailHeader ", emailHeader);
                //console.log("emailBody ", emailBody);
                //console.log("emailSubject ", emailSubject);

                //Replacing the strings with the values from mail.message
                emailSubject = replaceAll(emailSubject, mail.message)
                emailTitle = replaceAll(emailTitle, mail.message)
                emailHeader = replaceAll(emailHeader, mail.message)
                emailBody = replaceAll(emailBody, mail.message)

                if (mail.type === 'account_deletion_refund_finance') {
                    const confirmClearenceBalance = await createBalanceClearanceLink(mail);
                    mail.message["confirmClearenceBalance"] = confirmClearenceBalance
                    mail.message["transactionRows"] = generateTableRefundDeleteAccount(mail.message.paymentMethod); 
                }

                if (mail.type === 'account_deletion_wallet_clearance_finance') {
                    emailBody = await generateConfirmDeleteAccountFinance(emailBody, mail.message.walletsData, language);
                    emailHeader = '';
                    emailFooter = '';
                }

                emailCancelSubscription = replaceAll(emailCancelSubscription, {contactEmail: Constants.company[clientNameKeyMappingWL]?.contactEmail})
                // if the email is for us (support evio) the subject is set on the body of the request
                /*if (isSupportEVIO) {
                    emailSubject = mail.subject
                }*/

                // Add environment to email subject
                emailSubject = addEnvironmentToSubject(emailSubject)
                // Add translation keys values to template
                mail.message["emailTitle"] = emailTitle
                mail.message["emailHeader"] = emailHeader
                mail.message["emailBody"] = emailBody
                mail.message["emailFooter"] = emailFooter
                mail.message["contactEmail"] = Constants.company[clientNameKeyMappingWL]?.contactEmail
                mail.message["emailAfterFooter"] = emailAfterFooter
                mail.message["emailCancelSubscription"] = emailCancelSubscription
                mail.message["linkText"] = linkText && linkText.length > 0 ? linkText[0].value : null

                const supportEmail = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_email_support`)
                mail.message[`email_support`] = supportEmail.length > 0 ? supportEmail[0]?.value : Constants.company[clientNameKeyMappingWL]?.contactEmail
                const supportNumber = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_number_support`)
                mail.message[`number_support`] = supportNumber.length > 0 ? supportNumber[0].value : Constants.company[clientNameKeyMappingWL]?.numberSupport
                const footerDownloadApps = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_footer_download_apps`)
                mail.message[`footer_download_apps`] = footerDownloadApps.length > 0 ? footerDownloadApps[0]?.value : null
                mail.message["appleStoreLink"] = Constants.company[clientNameKeyMappingWL]?.appleStoreLink || Constants.company.evio.appleStoreLink
                mail.message["playStoreLink"] = Constants.company[clientNameKeyMappingWL]?.playStoreLink || Constants.company.evio.playStoreLink
                mail.message[`facebook_link`] = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_facebook_link`)[0]?.value || null;
                mail.message[`linkedin_link`] = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_linkedin_link`)[0]?.value || null;
                mail.message[`instagram_link`] = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_instagram_link`)[0]?.value || null;
                mail.message[`twitter_link`] = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_twitter_link`)[0]?.value || null;

                mail.message["contactWebsite"] = Constants.company[clientNameKeyMappingWL]?.contactWebsite || Constants.company.evio.contactWebsite

                setFooterTranslation(mail, clientNameKeyMappingWL, translations);
            }

            // Add hyperlinks to template
            mail.message["appleStoreLink"] = process.env.appleStoreLink
            mail.message["playStoreLink"] = process.env.playStoreLink
            mail.message["evioWebsite"] = process.env.evioWebsite

            // This function reads our HTML template file according to its email type ( contract , session, etc.)
            //console.log("templatesPath + `/${mail.type}` + '/index.html'", templatesPath + `/${mail.type}` + '/index.html');
            readHTMLFile(templatesPath + `/${template}` + '/index.html')
                .then(async html => {

                    // The images in the email HTML are being sent as base64 strings.
                    // I found this approach better than sending them as attachments since it wasn't even working with Gmail
                    let filenames = fs.readdirSync(imgDirectory);
                    filenames.forEach((file) => {
                        const contents = fs.readFileSync(imgDirectory + `/${file}`, { encoding: 'base64' });
                        let base64name = file.split('.')[0]
                        mail.message[base64name] = contents
                    });

                    // In order to replace our HTML with values we use the handlebars library and pass it as argument the mail.message
                    const template = handlebars.compile(html);
                    var htmlToSend = template(mail.message);

                    let senderInfo = await getWLSenderEmailInfo(clientName);

                    var mailOptions = {
                        source: senderInfo.sourceInfo + '<' + senderInfo.email + '>',
                        from: senderInfo.fromInfo + '<' + senderInfo.email + '>', // sender address
                        to: mail.to,
                        subject: emailSubject,
                        html: htmlToSend,
                    };

                    if (mail.type === "contract" || mail.type === "scheduledContract" || mail.type === "contractb2b" || mail.type === "scheduledContractb2b") {
                        let contractInfo = req.body.contract;
                        if (contractInfo) {
                            let generalConditionsFilename = translations.filter(translation => translation.key === `email_general_conditions_filename`)[0].value;
                            let particularConditionsFilename = translations.filter(translation => translation.key === `email_particular_conditions_filename`)[0].value
                            mailOptions = await addWLAttachmentsToContractEmail(mailOptions, contractInfo, clientName, generalConditionsFilename,
                                particularConditionsFilename);
                        }
                    }

                    if (mail.type === "invoice") {

                        console.log("clientName", clientName);
                        let clientNameKeyMappingWL = WLKeysMapping[clientName];

                        console.log("clientNameKeyMappingWL", clientNameKeyMappingWL);

                        let emailAttachmentInvoice = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_email_attachmentInvoice`)[0].value
                        let emailAttachmentSummary = translations.filter(translation => translation.key === clientNameKeyMappingWL + `_email_attachmentSummary`)[0].value

                        let filename_invoice = emailAttachmentInvoice + mail.attachments[0].filename;
                        let filename_summary = emailAttachmentSummary + mail.attachments[1].filename;
                        if (mail.attachments.length > 2) {
                            let invoiceInfo = req.body.mailOptions.invoiceInfo
                            let documentNumberReplacing = invoiceInfo.documentNumber.replace("/", " ").split(" ")

                            mail.attachments[0].filename = documentNumberReplacing[0] + documentNumberReplacing[1] + '_' + documentNumberReplacing[2] + mail.attachments[0].filename

                            let buffer = Buffer.from(mail.attachments[1].content);
                            mail.attachments[1].filename = filename_summary;
                            mail.attachments[1].content = buffer;


                            //Create Excel Buffer to attach
                            let billingDates = {
                                startDate: invoiceInfo.startDate,
                                endDate: invoiceInfo.endDate,
                                dueDate: invoiceInfo.dueDate,
                                emissionDate: invoiceInfo.emissionDate,
                            }

                            mail.attachments[2].filename = emailAttachmentSummary + mail.attachments[2].filename;

                            let columns = Utils.createBillingPeriodExcelColumns(translations)
                            let lines = Utils.createBillingPeriodExcelLines(invoiceInfo, invoiceInfo.attach, billingDates)
                            let excelBuffer = await Utils.createExcelBuffer(mail.attachments[2].filename, columns, lines)

                            mail.attachments[2].content = excelBuffer;

                        } else {
                            mail.attachments[0].filename = filename_invoice;
                            mail.attachments[1].filename = filename_summary;

                            let buffer = Buffer.from(mail.attachments[1].content);
                            mail.attachments[1].content = buffer;
                        }

                        mailOptions.attachments = mail.attachments;
                    }

                    const transporter = nodemailer.createTransport({
                        maxConnections: 2,
                        maxMessages: 1,
                        pool: true,
                        host: senderInfo.host,
                        port: senderInfo.port,
                        secure: senderInfo.port == 465 ? true : false,
                        auth: {
                            user: senderInfo.email,
                            pass: senderInfo.password
                        }
                    });
                    //console.log("transporter", transporter);
                    transporter.use('compile', inlineBase64({ cidPrefix: 'somePrefix_' }));

                    transporter.verify(function (error, success) {
                        if (error) {
                            console.log(`[${context}] Error `, error.message);

                            let history = {
                                isToSend: true,
                                sent: false,
                                requestBody: JSON.parse(notificationBody),
                                status: '500',
                                clientName: clientName
                            }
                            Utils.sendFailedEmailToSentry(history, error);

                            return res.status(500).send(error.message);
                        } else {
                            console.log("Server is ready to take our messages");

                            transporter.sendMail(mailOptions, async (error, info) => {
                                if (error) {
                                    console.log('Email failed: ' + error.message);

                                    let history = {
                                        isToSend: true,
                                        sent: false,
                                        requestBody: JSON.parse(notificationBody),
                                        status: '400',
                                        clientName: clientName
                                    }
                                    Utils.sendFailedEmailToSentry(history, error);

                                    return res.status(400).send({ code: 'send_email_failed', message: "Send email error" });
                                }
                                else {
                                    console.log('Email sent: ' + info.response);

                                    let history = {
                                        isToSend: false,
                                        sent: true,
                                        requestBody: JSON.parse(notificationBody),
                                        status: '200',
                                        clientName: clientName
                                    }
                                    let responseInfo = {
                                        invoiceDocumentName: mailOptions.attachments ? mailOptions.attachments[0].filename : "",
                                        summaryDocumentName: mailOptions.attachments ? mailOptions.attachments[1].filename : ""
                                    }

                                    return res.status(200).send(responseInfo);
                                }
                            });
                        }
                    });

                })
                .catch(error => {
                    console.log(`[${context}][readHTMLFile] Error `, error);
                    return res.status(400).send({ code: 'mail_notification_error', message: "Mail notification error" });
                });

        } else {
            return res.status(400).send({ code: 'mail_notification_error', message: "Mail notification error" });
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return res.status(500).send(error.message);
    };
});

const readHTMLFile = function (path) {
    const context = "Function readHTMLFile"
    return new Promise((resolve, reject) => {
        fs.readFile(path, { encoding: 'utf-8' }, function (err, html) {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                reject(err);
            } else {
                resolve(html);
            }
        });

    });
};

function addEnvironmentToSubject(subject) {
    let environment = "";
    let position = 4;

    if (process.env.NODE_ENV === 'pre-production') {
        environment = ' [PRE]'
    } else if (process.env.NODE_ENV === 'development') {
        environment = ' [QA]'
    }
    //return [subject.slice(0, position), environment, subject.slice(position)].join('');
    return `${environment} ${subject}`
}

function addWLAttachmentsToContractEmail(mailOptions, contractInfo, clientName, generalConditionsFilename, particularConditionsFilename) {
    return new Promise(async (resolve, reject) => {

        const pdfGeralPath = path.resolve(__dirname, "../../assets");
        let clientNameKeyMappingWL = WLKeysMapping[clientName];
        let language = 'en';
        let user = await getUserByEmail(mailOptions.to, clientName)
        let pathFile;

        if (user)
            language = user.language;

        switch (language) {
            case 'pt':
                pathFile = pdfGeralPath + '/wl/' + clientNameKeyMappingWL + '/' + clientNameKeyMappingWL + '_geral.pdf';
                break;
            case 'en':
                pathFile = pdfGeralPath + '/wl/' + clientNameKeyMappingWL + '/' + clientNameKeyMappingWL + '_geral_EN.pdf';
                break;
            case 'es':
                pathFile = pdfGeralPath + '/wl/' + clientNameKeyMappingWL + '/' + clientNameKeyMappingWL + '_geral_ES.pdf';
                break;
            case 'fr':
                pathFile = pdfGeralPath + '/wl/' + clientNameKeyMappingWL + '/' + clientNameKeyMappingWL + '_geral_FR.pdf';
                break;
            default:
                pathFile = pdfGeralPath + '/wl/' + clientNameKeyMappingWL + '/' + clientNameKeyMappingWL + '_geral.pdf';
                break;
        };

        fs.readFile(pathFile, (err, pdfBuffer) => {
            if (err) {
                console.log(err);
                reject();
            }

            if (pdfBuffer) {

                let attachments = [
                    {
                        filename: generalConditionsFilename + '.pdf',
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                        encoding: 'base64'
                    }
                ];

                if (process.env.clientNameSC === clientName) {

                    console.log("language", language);

                    scParticularContract.createParticularContract(contractInfo, language)
                        .then((particularContractBuffer) => {

                            attachments.push(
                                {
                                    filename: particularConditionsFilename + '.pdf',
                                    content: particularContractBuffer,
                                    contentType: 'application/pdf',
                                    encoding: 'base64'
                                }
                            );

                            mailOptions.attachments = attachments;
                            resolve(mailOptions);

                        })
                        .catch((error) => {
                            console.log("Failed to create particular contract");
                            mailOptions.attachments = attachments;
                            resolve(mailOptions);
                        });

                } else if (process.env.clientNameHyundai === clientName) {

                    hyundaiParticularContract.createParticularContract(contractInfo)
                        .then((particularContractBuffer) => {

                            attachments.push(
                                {
                                    filename: particularConditionsFilename + '.pdf',
                                    content: particularContractBuffer,
                                    contentType: 'application/pdf',
                                    encoding: 'base64'
                                }
                            );

                            mailOptions.attachments = attachments;
                            resolve(mailOptions);

                        })
                        .catch((error) => {
                            console.log("Failed to create particular contract");
                            mailOptions.attachments = attachments;
                            resolve(mailOptions);
                        });

                }

            }
            else {
                resolve(mailOptions);
            };

        });

    });
}

function getWLSenderEmailInfo(clientName) {
    return new Promise((resolve, reject) => {

        let query = {
            clientName: clientName
        };

        SenderEmail.findOne(query, (err, info) => {
            if (err) {
                console.error(`[getWLSenderEmailInfo][find] Error `, err);
                reject(err);
            }
            else {
                if (info) {
                    resolve(info)
                } else {
                    reject();
                }
            }
        });

    });
}

function isEmptyObject(obj) {
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}

function generateConfirmDeleteAccountFinance(htmlContent, walletsData, language) {
    walletsData.forEach(wallet => {
      htmlContent += `
        <tr style="border: 1px solid #dddddd;">
          <td style="padding: 8px;">${wallet.walletId}</td>
          <td style="padding: 8px;">${wallet.userId}</td>
          <td style="padding: 8px;">${wallet.previousBalance}</td>
          <td style="padding: 8px;">${new Date(wallet.clearenceDate).toLocaleString()}</td>
        </tr>
      `;
    });

    if (language === 'en') {
      htmlContent += `
          </tbody>
        </table><br>
        Please review these updates for accuracy. For any issues or additional information, contact the support team or refer to the system logs.<br><br>
        Thank you for your attention.
      `;
    } else {
      htmlContent += `
          </tbody>
        </table><br>
        Por favor, revejam estas atualizações para garantir a sua precisão. Em caso de dúvidas ou necessidade de mais informações, entrem em contacto com a equipa de suporte ou consultem os registos do sistema.<br><br>
        Obrigado pela vossa atenção.
      `;
    }
  
    return htmlContent;
  }

const createBalanceClearanceLink = async (mail) => {
    let confirmClearenceBalance;
    const apiUrl = Constants.apiUrls[Constants.environment] || Constants.apiUrls.local;
    confirmClearenceBalance = `${apiUrl}/api/public/wallet/enableBalanceClearance?user=${mail.message.userId}`;
    return confirmClearenceBalance;
};

function generateTableRefundDeleteAccount(transactions) {
    return transactions.map(({ amount, transactionId, provider }) => `
      <tr style="border: 1px solid #dddddd;">
        <td style="padding: 8px;">${amount}</td>
        <td style="padding: 8px;">${transactionId}</td>
        <td style="padding: 8px;">${provider}</td>
      </tr>
    `).join('');
}

module.exports = router;

