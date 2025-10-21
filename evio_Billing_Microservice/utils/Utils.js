const express = require('express');
var fs = require('fs');
const { jsPDF } = require('jspdf');
const nodemailer = require('nodemailer');
var moment = require('moment');
const handlebars = require('handlebars');
const axios = require('axios');
const Excel = require('exceljs');
const Sentry = require('@sentry/node');

const TopUp = require('../models/TopUp');
const Invoice = require('../models/Invoice');
const UtilsGireve = require('../utils/UtilsGireve');
const UtilsEVIO = require('../utils/UtilsEVIO');
const UtilsMobiE = require('../utils/UtilsMobiE');
const UtilsBudget = require('../utils/UtilsBudget');
const UtilsMonthly = require('../utils/UtilsMonthly');
const pdf2base64 = require('pdf-to-base64');

const soap = require('soap');
const { invoiceErrorMessages, defaultLanguage } = require('./constants');
const { FileTransaction } = require('evio-library-language').default;
const url = process.env.MagnifinanceWSDL;
let MagnifinanceClient;

soap.createClient(url, (err, client) => {
  if (err) {
    console.error(`[Error] Error `, err.message);
  } else {
    MagnifinanceClient = client;
  }
});

const transporter = nodemailer.createTransport({
  maxConnections: 2,
  maxMessages: 1,
  pool: true,
  host: 'smtp.office365.com',
  port: 587,
  auth: {
    user: process.env.EVIOMAIL,
    pass: process.env.EVIOPASSWORD,
  },
});

var Utils = {
  updateTopUp: function (query, newInvoice) {
    var context = 'FUNCTION updateTopUp';

    TopUp.updateTopUp(query, { $set: newInvoice }, (error, doc) => {
      if (error) {
        console.log(`[${context}][updateTopUp] Error`);
      } else {
        if (doc != null) {
          console.log(`[${context}][updateTopUp] Success`);
        }
      }
    });
  },

  base64_encode: function (file) {
    // convert binary data to base64 encoded string
    return fs.readFileSync(file, { encoding: 'base64' });
  },

  createTopUpPDFDocument: function (billingProfile, payment) {
    const doc = new jsPDF();

    var imgData =
      'data:image/jpeg;base64,' + Utils.base64_encode('assets/images/evio.png');
    doc.addImage(imgData, 'JPEG', 10, 10, 35, 10);

    doc.setFontSize(10);
    doc.text(180, 10, '' + moment().format('YYYY-MM-DD'));

    //Header company
    doc.setFontSize(10);
    doc.text(10, 30, 'Evio - Elec tric al Mobility Lda');
    doc.text(10, 35, '4450-017 - Matosinhos');
    doc.text(10, 40, 'PT 515681890');
    doc.text(10, 45, '918021117');
    doc.text(10, 50, 'support@go-evio.com');

    //Body
    doc.setFontSize(12);
    doc.text(10, 65, 'Caro ' + billingProfile.name + ',');
    doc.text(10, 75, 'Adicionou ' + payment + ' euros à sua carteira da EVIO.');
    doc.text(
      10,
      85,
      'Obrigado por utilizar a aplicação EVIO para efetuar carregamentos.',
    );

    return doc.output('datauristring');
  },

  sendTopUpEmail: (billingData, topup, i) => {
    var context = 'sendTopUpEmail';

    setTimeout(() => {
      /*var mailOptions = {
                source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
                from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
                to: billingData.email,
                subject: 'Envio de confirmação de Top Up - EVIO - Electrical Mobility',
                text: 'Envio de confirmação de Top Up - EVIO - Electrical Mobility',
                html: '<b> Caro ' + billingData.billingName + ', </b><br>' +
                    '<br>' +
                    '<b>' + "Segue em anexo o documento do top up que foi realizado." + ' </b><br>' +
                    '<br>' +
                    '<b>' + "Obrigado por utilizar a EVIO," + ' </b><br>' +
                    '<br>' +
                    '<b>' + "EVIO - Electrical Mobility" + ' </b><br>',
                attachments: [
                    {
                        filename: 'topup_' + billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                        path: Utils.createTopUpPDFDocument(billingData, topup.payment),
                        contentType: 'application/pdf',
                        encoding: 'base64'
                    }
                ]
            };

            transporter.verify((error, success) => {
                if (error) {
                    console.log(error);
                } else {
                    console.log("Server is ready to take our messages");
                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.log('Email not sent: ' + error);
                        }
                        else {
                            if (info) {
                                let updateBilling = {
                                    status: '40'
                                }
                                let query = { _id: topup._id };
                                Utils.updateTopUp(query, updateBilling);
                            }
                        }
                    });
                }
            });*/

      sendTopUpEmail(billingData, topup, billingData.clientName)
        .then(() => {
          let updateBilling = {
            status: '40',
          };
          let query = { _id: topup._id };
          Utils.updateTopUp(query, updateBilling);
        })
        .catch((error) => {
          console.log('[Error] Failed to send email');
        });
    }, i * 3 * 1000);
  },

  sendInvoiceEmail: (billingData, invoice, pdfBuffer, emailUserId) => {
    var context = 'sendInvoiceEmail';
    return new Promise(async (resolve, reject) => {
      try {
        var html = fs.readFileSync('utils/indexOthers.html', 'utf8');

        let message = {
          apple: Utils.base64_encode('utils/img/apple.png'),
          call: Utils.base64_encode('utils/img/call.png'),
          charge: Utils.base64_encode('utils/img/charge.png'),
          email: Utils.base64_encode('utils/img/email.png'),
          EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
          line: Utils.base64_encode('utils/img/line.png'),
          play: Utils.base64_encode('utils/img/play.png'),
          username: billingData.billingName,
          linkApple: process.env.appleStoreLink,
          linkGoogle: process.env.googleStoreLink,
        };

        // Fetch user to get its languageCode
        let user = await getUserById(billingData.userId);
        let language = user?.language ?? defaultLanguage;
        // Fetch language microservice to get translations to a specific languageCode
        let translations = await getTranslations(language);

        // Query the translation keys for the emails
        let emailSubject = translations.filter(
          (translation) => translation.key === `email_invoice_subject`,
        )[0].value;
        let emailTitle = translations.filter(
          (translation) => translation.key === `email_invoice_title`,
        )[0].value;
        let emailHeader = translations.filter(
          (translation) => translation.key === `email_header`,
        )[0].value;
        let emailBody = translations.filter(
          (translation) => translation.key === `email_invoice_body`,
        )[0].value;
        let emailAttachmentInvoice = translations.filter(
          (translation) => translation.key === `email_attachmentInvoice`,
        )[0].value;

        // Replacing the strings with the values from message
        emailHeader = replaceAll(emailHeader, message);

        // Add environment to email subject
        emailSubject = addEnvironmentToSubject(emailSubject);

        // Add translation keys values to template
        message['emailTitle'] = emailTitle;
        message['emailHeader'] = emailHeader;
        message['emailBody'] = emailBody;

        const template = handlebars.compile(html);
        var htmlToSend = template(message);

        //TODO change email to emails?
        console.log('EmailUserId');
        console.log(emailUserId);

        let emailsList = [];

        if (emailUserId) {
          for (let i = 0; i != emailUserId.length; i++) {
            let billingProfile = await getBillingProfile(emailUserId[i]);
            emailsList.push(billingProfile.email);
          }
        }
        console.log('emailsList');
        console.log(emailsList);

        if (emailsList.length == 0) {
          emailsList.push(billingData.email);
        }

        console.log('emailsList 2');
        console.log(emailsList);

        var mailOptions = {
          source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
          from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
          to: emailsList,
          subject: emailSubject,
          text: 'EVIO - Envio de confirmação de Fatura/Recibo',
          html: htmlToSend,
          attachments: [
            {
              filename:
                emailAttachmentInvoice +
                billingData.billingName.replace(/ /g, '') +
                '_' +
                moment().format('YYYY-MM-DD') +
                '.pdf',
              content: pdfBuffer,
              contentType: 'application/pdf',
              encoding: 'base64',
            },
          ],
        };

        transporter.verify((error, success) => {
          if (error) {
            console.log(error);
          } else {
            console.log('Server is ready to take our messages');
            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.log('Email not sent: ' + error);
                reject();
              } else {
                if (info) {
                  let info = {
                    invoiceDocumentName:
                      'fatura_' +
                      billingData.billingName.replace(/ /g, '') +
                      '_' +
                      moment().format('YYYY-MM-DD') +
                      '.pdf',
                  };
                  resolve(info);
                }
              }
            });
          }
        });
      } catch (error) {
        console.error(`[${context}] Error `, error?.message);
        reject();
      }
    });
  },

  sendMobieInvoiceEmail: (
    billingData,
    invoice,
    attach,
    pdfBuffer,
    emailUserId,
  ) => {
    var context = 'sendMobieInvoiceEmail';
    return new Promise((resolve, reject) => {
      try {
        UtilsMobiE.createInvoicePDF(billingData, invoice, attach)
          .then(async (result) => {
            var html = fs.readFileSync('utils/indexMobie.html', 'utf8');

            let message = {
              apple: Utils.base64_encode('utils/img/apple.png'),
              call: Utils.base64_encode('utils/img/call.png'),
              charge: Utils.base64_encode('utils/img/charge.png'),
              email: Utils.base64_encode('utils/img/email.png'),
              EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
              line: Utils.base64_encode('utils/img/line.png'),
              play: Utils.base64_encode('utils/img/play.png'),
              username: billingData.billingName,
              linkApple: process.env.appleStoreLink,
              linkGoogle: process.env.googleStoreLink,
            };

            // Fetch user to get its languageCode
            let user = await getUserById(billingData.userId);
            let language = user?.language ?? defaultLanguage;
            // Fetch language microservice to get translations to a specific languageCode
            let translations = await getTranslations(language);

            // Query the translation keys for the emails
            let emailSubject = translations.filter(
              (translation) => translation.key === `email_invoice_subject`,
            )[0].value;
            let emailTitle = translations.filter(
              (translation) => translation.key === `email_invoice_title`,
            )[0].value;
            let emailHeader = translations.filter(
              (translation) => translation.key === `email_header`,
            )[0].value;
            let emailBody = translations.filter(
              (translation) => translation.key === `email_invoiceMobie_body`,
            )[0].value;
            let emailAttachmentInvoice = translations.filter(
              (translation) => translation.key === `email_attachmentInvoice`,
            )[0].value;
            let emailAttachmentSummary = translations.filter(
              (translation) => translation.key === `email_attachmentSummary`,
            )[0].value;

            //Replacing the strings with the values from message
            emailHeader = replaceAll(emailHeader, message);

            // Add environment to email subject
            emailSubject = addEnvironmentToSubject(emailSubject);

            // Add translation keys values to template
            message['emailTitle'] = emailTitle;
            message['emailHeader'] = emailHeader;
            message['emailBody'] = emailBody;

            const template = handlebars.compile(html);
            var htmlToSend = template(message);

            //TODO change email to emails?
            console.log('EmailUserId');
            console.log(emailUserId);

            let emailsList = [];
            if (emailUserId) {
              for (let i = 0; i != emailUserId.length; i++) {
                let billingProfile = await getBillingProfile(emailUserId[i]);
                emailsList.push(billingProfile.email);
              }
            }

            console.log('emailsList');
            console.log(emailsList);

            if (emailsList.length == 0) {
              emailsList.push(billingData.email);
            }

            console.log('emailsList 2');
            console.log(emailsList);

            var mailOptions = {
              source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
              from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
              to: emailsList,
              subject: emailSubject,
              text: 'EVIO - Envio de confirmação de Fatura/Recibo',
              html: htmlToSend,
              attachments: [
                {
                  filename:
                    emailAttachmentInvoice +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
                {
                  filename:
                    emailAttachmentSummary +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  content: result,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
              ],
            };

            transporter.verify((error, success) => {
              if (error) {
                console.log(error);
              } else {
                console.log('Server is ready to take our messages');
                transporter.sendMail(mailOptions, (error, info) => {
                  if (error) {
                    console.log('Email not sent: ' + error);
                    reject();
                  } else {
                    if (info) {
                      let info = {
                        invoiceDocumentName:
                          'fatura_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                        summaryDocumentName:
                          'resumo_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                      };
                      resolve(info);
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log(error);
            reject();
          });
      } catch (error) {
        console.error(`[${context}] Error `, error?.message);
        reject();
      }
    });
  },

  sendMobiECreditNoteEmail: (
    billingData,
    invoice,
    invoiceNumber,
    attach,
    pdfBuffer,
    emailUserId,
  ) => {
    var context = 'sendMobiECreditNoteEmail';
    return new Promise((resolve, reject) => {
      try {
        Utils.createInvoicePDF(billingData, invoice, attach)
          .then(async (result) => {
            var html = fs.readFileSync('utils/indexMobie.html', 'utf8');

            let message = {
              apple: Utils.base64_encode('utils/img/apple.png'),
              call: Utils.base64_encode('utils/img/call.png'),
              charge: Utils.base64_encode('utils/img/charge.png'),
              email: Utils.base64_encode('utils/img/email.png'),
              EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
              line: Utils.base64_encode('utils/img/line.png'),
              play: Utils.base64_encode('utils/img/play.png'),
              username: billingData.billingName,
              linkApple: process.env.appleStoreLink,
              linkGoogle: process.env.googleStoreLink,
            };

            // Fetch user to get its languageCode
            let user = await getUserById(billingData.userId);
            let language = user?.language ?? defaultLanguage;

            // Fetch language microservice to get translations to a specific languageCode
            let translations = await getTranslations(language);

            let emailSubject;
            let emailTitle;
            let emailHeader;
            let emailBody;
            let emailAttachmentInvoice;
            let emailAttachmentSummary;

            // Query the translation keys for the emails
            if (language === 'pt_PT') {
              emailSubject = 'EVIO - Envio de confirmação de nota de crédito';
              emailTitle = 'Nota de Crédito';
              emailHeader = 'Caro ' + billingData.name;
              emailBody =
                'Obrigada por usar EVIO e contribuir para um futuro mais sustentável.' +
                '<br>' +
                'Em anexo encontra a nota de crédito referente à fatura ' +
                invoiceNumber +
                '.' +
                '<br>' +
                'O montante cobrado será creditado na sua carteira.' +
                '<br>' +
                'Pedimos desculpa pelo inconveniente.';
              emailAttachmentInvoice = 'credit_note_';
              emailAttachmentSummary = translations.filter(
                (translation) => translation.key === `email_attachmentSummary`,
              )[0].value;
            } else {
              emailSubject = 'EVIO - Credit Note confirmation';
              emailTitle = 'Credit Note';
              emailHeader = 'Dear ' + billingData.name;
              emailBody =
                'Thank you for using EVIO and contribute to a more sustainable future.' +
                '<br>' +
                'Attached to this email you can find the credit note regarding the invoice ' +
                invoiceNumber +
                '.' +
                '<br>' +
                'The amount charged will be credited to your wallet.' +
                '<br>' +
                'We apologize for the inconvenience.';
              emailAttachmentInvoice = 'credit_note_';
              emailAttachmentSummary = translations.filter(
                (translation) => translation.key === `email_attachmentSummary`,
              )[0].value;
            }

            //Replacing the strings with the values from message
            emailHeader = replaceAll(emailHeader, message);

            // Add environment to email subject
            emailSubject = addEnvironmentToSubject(emailSubject);

            // Add translation keys values to template
            message['emailTitle'] = emailTitle;
            message['emailHeader'] = emailHeader;
            message['emailBody'] = emailBody;

            const template = handlebars.compile(html);
            var htmlToSend = template(message);

            //TODO change email to emails?
            console.log('EmailUserId');
            console.log(emailUserId);

            let emailsList = [];
            if (emailUserId) {
              for (let i = 0; i != emailUserId.length; i++) {
                let billingProfile = await getBillingProfile(emailUserId[i]);
                emailsList.push(billingProfile.email);
              }
            }

            console.log('emailsList');
            console.log(emailsList);

            if (emailsList.length == 0) {
              emailsList.push(billingData.email);
            }

            console.log('emailsList 2');
            console.log(emailsList);
            var mailOptions = {
              source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
              from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
              to: emailsList,
              subject: emailSubject,
              text: 'EVIO - Envio de confirmação de Fatura/Recibo',
              html: htmlToSend,
              attachments: [
                {
                  filename:
                    emailAttachmentInvoice +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                } /*,
                            {
                                filename: emailAttachmentSummary + billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                                content: result,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            }*/,
              ],
            };

            transporter.verify((error, success) => {
              if (error) {
                console.log(error);
              } else {
                console.log('Server is ready to take our messages');
                transporter.sendMail(mailOptions, (error, info) => {
                  if (error) {
                    console.log('Email not sent: ' + error);
                    reject();
                  } else {
                    if (info) {
                      let info = {
                        invoiceDocumentName:
                          'credit_note_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                        summaryDocumentName:
                          'resumo_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                      };
                      resolve(info);
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log(error);
            reject();
          });
      } catch (error) {
        console.error(`[${context}] Error `, error?.message);
        reject();
      }
    });
  },

  sendInvoiceFailureEmail: async (invoiceId, error, billingData) => {
    const context = 'sendInvoiceFailureEmail';
    const handleEmailMessageContent = (messageLabel, translations, error) => {
      try {
        const fetchedTranslated = messageLabel
          ? translations.find((translation) => translation.key === messageLabel)
              .value
          : null;
        if (fetchedTranslated) {
          return fetchedTranslated;
        }

        return error?.ValidationErrors?.ValidationError?.length
          ? error.ValidationErrors.ValidationError[0]?.Detail
          : JSON.stringify(error);
      } catch (error) {
        Sentry.captureException(error);
        console.error(
          `[${context}][handleEmailMessageContent] Error `,
          error.message,
        );
        return String(error);
      }
    };

    const user = await getUserById(billingData.userId);
    const language = user?.language ?? defaultLanguage;
    const translations = await getTranslations(language);
    const errorType = error?.ValidationErrors?.ValidationError?.length
      ? error.ValidationErrors.ValidationError[0]?.Type
      : '';
    const messageLabel = invoiceErrorMessages[errorType];
    const message = handleEmailMessageContent(
      messageLabel,
      translations,
      error,
    );

    return new Promise((resolve, reject) => {
      let emailSubject = 'EVIO - Erro na emissão de fatura';
      // Add environment to email subject
      emailSubject = addEnvironmentToSubject(emailSubject);
      var mailOptions = {
        source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
        from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
        to: process.env.EVIOMAIL,
        subject: emailSubject,
        text: 'EVIO - Erro na emissão de fatura',
        html:
          '' +
          'InvoiceId: ' +
          invoiceId +
          '<br>' +
          '' +
          'Erro: ' +
          message +
          '<br>',
      };
      transporter.verify((error, success) => {
        if (error) {
          Sentry.captureException(error);
          console.log(error);
        } else {
          console.log('Server is ready to take our messages');
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              Sentry.captureException(error);
              console.log('Email not sent: ' + error);
              reject();
            } else {
              resolve();
            }
          });
        }
      });
    });
  },

  sendInvoiceInvalidNifEmail: async (billingData) => {
    const context = 'sendInvoiceInvalidNifEmail';
    const user = await getUserById(billingData.userId);
    const language = user?.language ?? defaultLanguage;
    const translations = await getTranslations(language);
    const translatedMessage = translations.find(
      (translation) =>
        translation.key === invoiceErrorMessages.invalidNifEmailBody,
    );
    const translatedTitle = translations.find(
      (translation) =>
        translation.key === invoiceErrorMessages.invalidNifEmailTitle,
    );

    const message = translatedMessage ? translatedMessage.value : '';
    const title = translatedTitle ? translatedTitle.value : '';
    if (!message || !title || !billingData.email) {
      console.log(`[${context}] Insufficient data to send email`, {
        bodyMessage: message,
        title,
        email: billingData.email,
      });
      Sentry.captureMessage(
        `[${context}] Insufficient data to send email. language=${language} message=${message}, title=${title}, email=${billingData.email}`,
      );
      return;
    }
    return new Promise((resolve, reject) => {
      var mailOptions = {
        source: `"EVIO support" <${process.env.EVIOMAIL}>`,
        from: `"EVIO support" <${process.env.EVIOMAIL}>`,
        to: billingData.email,
        subject: title,
        text: title,
        html: message,
      };
      transporter.verify((error, success) => {
        if (error) {
          Sentry.captureException(error);
          console.log(`[${context}] transporter.verify Error`, { error });
        } else {
          console.log('Server is ready to take our messages');
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              Sentry.captureException(error);
              console.log(`[${context}] transporter.verify Error`, { error });
              reject();
            } else {
              resolve();
            }
          });
        }
      });
    });
  },

  sendBudgetDocumentoToSupport: (
    billingData,
    invoice,
    attach,
    billingDates,
    pdfBuffer,
    emailUserId,
  ) => {
    var context = 'sendBudgetDocumentoToSupport';
    return new Promise((resolve, reject) => {
      try {
        UtilsMonthly.createInvoicePDF(billingData, invoice, attach)
          .then(async (result) => {
            var html = fs.readFileSync('utils/indexMobie.html', 'utf8');

            let message = {
              apple: Utils.base64_encode('utils/img/apple.png'),
              call: Utils.base64_encode('utils/img/call.png'),
              charge: Utils.base64_encode('utils/img/charge.png'),
              email: Utils.base64_encode('utils/img/email.png'),
              EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
              line: Utils.base64_encode('utils/img/line.png'),
              play: Utils.base64_encode('utils/img/play.png'),
              username: billingData.billingName,
              linkApple: process.env.appleStoreLink,
              linkGoogle: process.env.googleStoreLink,
            };

            // Fetch user to get its languageCode
            let user = await getUserById(billingData.userId);
            let language = user?.language ?? defaultLanguage;

            // Fetch language microservice to get translations to a specific languageCode
            let translations = await getTranslations(language);

            // Query the translation keys for the emails
            let emailSubject =
              'EVIO - Fatura ' +
              billingData.name +
              ' - ' +
              invoice.documentNumber;
            let emailTitle = 'Fatura ' + billingData.name;
            let emailHeader = '';
            let emailBody =
              'Fatura gerada para a empresa ' +
              billingData.name +
              (billingDates.startDate
                ? ' de ' +
                  moment(billingDates.startDate).format('YYYY-MM-DD') +
                  ' a ' +
                  moment(billingDates.endDate).format('YYYY-MM-DD')
                : '');
            let emailAttachmentInvoice = 'fatura_';
            let emailAttachmentSummary = translations.filter(
              (translation) => translation.key === `email_attachmentSummary`,
            )[0].value;
            let documentNumberReplacing = invoice.documentNumber
              .replace('/', ' ')
              .split(' ');

            //Replacing the strings with the values from message
            emailHeader = replaceAll(emailHeader, message);

            // Add environment to email subject
            emailSubject = addEnvironmentToSubject(emailSubject);

            // Add translation keys values to template
            message['emailTitle'] = emailTitle;
            message['emailHeader'] = emailHeader;
            message['emailBody'] = emailBody;

            const template = handlebars.compile(html);
            var htmlToSend = template(message);

            let emailToSend;
            if (process.env.NODE_ENV === 'production') {
              emailToSend = process.env.EVIOMAIL;
            } else if (process.env.NODE_ENV === 'pre-production') {
              emailToSend = process.env.EVIOMAILQA;
            } else {
              emailToSend = process.env.EVIOMAILQA;
            }

            console.log(
              `${context} -------  invoice: ${JSON.stringify(
                invoice,
              )}, attach: ${JSON.stringify(attach)}`,
            );
            //Create Excel Buffer to attach
            let columns = Utils.createBillingPeriodExcelColumns(translations);
            let lines = Utils.createBillingPeriodExcelLines(
              invoice,
              attach,
              billingDates,
            );
            let excelBuffer = await Utils.createExcelBuffer(
              emailAttachmentSummary +
                billingData.billingName.replace(/ /g, ''),
              columns,
              lines,
            );

            var mailOptions = {
              source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
              from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
              to: billingData.email,
              subject: emailSubject,
              text: 'EVIO - Envio de confirmação de Fatura',
              html: htmlToSend,
              attachments: [
                // {
                //     filename: emailAttachmentInvoice + billingData.billingName.replace(/ /g, "") + "_" + moment().format('YYYY-MM-DD') + '.pdf',
                //     content: pdfBuffer,
                //     contentType: 'application/pdf',
                //     encoding: 'base64'
                // },
                {
                  filename:
                    documentNumberReplacing[0] +
                    documentNumberReplacing[1] +
                    '_' +
                    documentNumberReplacing[2] +
                    '_' +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
                {
                  filename:
                    emailAttachmentSummary +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  content: result,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
                {
                  filename:
                    emailAttachmentSummary +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.xlsx',
                  content: excelBuffer,
                  contentType:
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
              ],
            };

            transporter.verify((error, success) => {
              if (error) {
                console.log(error);
              } else {
                console.log('Server is ready to take our messages');
                transporter.sendMail(mailOptions, (error, info) => {
                  if (error) {
                    console.log('Email not sent: ' + error);
                    reject();
                  } else {
                    if (info) {
                      let info = {
                        invoiceDocumentName:
                          'orçamento_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                        summaryDocumentName:
                          'resumo_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                      };
                      resolve(info);
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log(error);
            reject();
          });
      } catch (error) {
        console.error(`[${context}] Error `, error?.message);
        reject();
      }
    });
  },

  sendCSVDocumentToSupport: (csv, data) => {
    var context = 'sendExcelDocumentoToSupport';
    return new Promise((resolve, reject) => {
      var html = fs.readFileSync('utils/indexMobie.html', 'utf8');

      let message = {
        apple: Utils.base64_encode('utils/img/apple.png'),
        call: Utils.base64_encode('utils/img/call.png'),
        charge: Utils.base64_encode('utils/img/charge.png'),
        email: Utils.base64_encode('utils/img/email.png'),
        EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
        line: Utils.base64_encode('utils/img/line.png'),
        play: Utils.base64_encode('utils/img/play.png'),
        username: 'Support',
        linkApple: process.env.appleStoreLink,
        linkGoogle: process.env.googleStoreLink,
      };

      // Query the translation keys for the emails
      let emailSubject =
        'EVIO - Completed cdrs between ' +
        data.cdr_start_date +
        ' and ' +
        data.cdr_end_date;
      let emailTitle = 'Completed cdrs';
      let emailHeader = '';
      let emailBody =
        'Completed cdrs and charging sessions between ' +
        data.cdr_start_date +
        ' and ' +
        data.cdr_end_date;

      //Replacing the strings with the values from message
      emailHeader = replaceAll(emailHeader, message);

      // Add environment to email subject
      emailSubject = addEnvironmentToSubject(emailSubject);

      // Add translation keys values to template
      message['emailTitle'] = emailTitle;
      message['emailHeader'] = emailHeader;
      message['emailBody'] = emailBody;

      const template = handlebars.compile(html);
      var htmlToSend = template(message);

      let emailToSend;
      if (process.env.NODE_ENV === 'production') {
        emailToSend = process.env.EVIOMAIL;
      } else if (process.env.NODE_ENV === 'pre-production') {
        //emailToSend = process.env.EVIOMAIL;
        emailToSend = process.env.EVIOMAILQA;
      } else {
        emailToSend = process.env.EVIOMAILQA;
      }

      var mailOptions = {
        source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
        from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
        to: emailToSend,
        subject: emailSubject,
        text: '',
        html: htmlToSend,
        attachments: [
          {
            filename:
              'completed_cdrs_' +
              data.cdr_start_date +
              '/' +
              data.cdr_end_date +
              '.csv',
            content: csv,
          },
        ],
      };

      transporter.verify((error, success) => {
        if (error) {
          console.log(error);
        } else {
          console.log('Server is ready to take our messages');
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.log('Email not sent: ' + error);
              reject();
            } else {
              if (info) {
                resolve();
              }
            }
          });
        }
      });
    });
  },

  sendGireveInvoiceEmail: (
    billingData,
    invoice,
    attach,
    pdfBuffer,
    emailUserId,
  ) => {
    var context = 'sendGireveInvoiceEmail';
    return new Promise((resolve, reject) => {
      try {
        UtilsGireve.createInvoicePDF(billingData, invoice, attach)
          .then(async (result) => {
            var html = fs.readFileSync('utils/indexMobie.html', 'utf8');

            let message = {
              apple: Utils.base64_encode('utils/img/apple.png'),
              call: Utils.base64_encode('utils/img/call.png'),
              charge: Utils.base64_encode('utils/img/charge.png'),
              email: Utils.base64_encode('utils/img/email.png'),
              EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
              line: Utils.base64_encode('utils/img/line.png'),
              play: Utils.base64_encode('utils/img/play.png'),
              username: billingData.billingName,
              linkApple: process.env.appleStoreLink,
              linkGoogle: process.env.googleStoreLink,
            };

            // Fetch user to get its languageCode
            let user = await getUserById(billingData.userId);
            let language = user?.language ?? defaultLanguage;
            // Fetch language microservice to get translations to a specific languageCode
            let translations = await getTranslations(language);

            // Query the translation keys for the emails
            let emailSubject = translations.filter(
              (translation) => translation.key === `email_invoice_subject`,
            )[0].value;
            let emailTitle = translations.filter(
              (translation) => translation.key === `email_invoice_title`,
            )[0].value;
            let emailHeader = translations.filter(
              (translation) => translation.key === `email_header`,
            )[0].value;
            let emailBody = translations.filter(
              (translation) => translation.key === `email_invoiceMobie_body`,
            )[0].value;
            let emailAttachmentInvoice = translations.filter(
              (translation) => translation.key === `email_attachmentInvoice`,
            )[0].value;
            let emailAttachmentSummary = translations.filter(
              (translation) => translation.key === `email_attachmentSummary`,
            )[0].value;

            //Replacing the strings with the values from message
            emailHeader = replaceAll(emailHeader, message);

            // Add environment to email subject
            emailSubject = addEnvironmentToSubject(emailSubject);

            // Add translation keys values to template
            message['emailTitle'] = emailTitle;
            message['emailHeader'] = emailHeader;
            message['emailBody'] = emailBody;

            const template = handlebars.compile(html);
            var htmlToSend = template(message);

            //TODO change email to emails?
            console.log('EmailUserId');
            console.log(emailUserId);

            let emailsList = [];
            if (emailUserId) {
              for (let i = 0; i != emailUserId.length; i++) {
                let billingProfile = await getBillingProfile(emailUserId[i]);
                emailsList.push(billingProfile.email);
              }
            }
            console.log('emailsList');
            console.log(emailsList);

            if (emailsList.length == 0) {
              emailsList.push(billingData.email);
            }

            console.log('emailsList 2');
            console.log(emailsList);

            var mailOptions = {
              source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
              from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
              to: emailsList,
              subject: emailSubject,
              text: 'EVIO - Envio de confirmação de Fatura/Recibo',
              html: htmlToSend,
              attachments: [
                {
                  filename:
                    emailAttachmentInvoice +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
                {
                  filename:
                    emailAttachmentSummary +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  //path: Utils.createTopUpPDFDocument(billingData, topup.payment),
                  //content: new Buffer.from(result, 'base64'),
                  content: result,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
              ],
            };

            transporter.verify((error, success) => {
              if (error) {
                console.log(error);
              } else {
                console.log('Server is ready to take our messages');
                transporter.sendMail(mailOptions, (error, info) => {
                  if (error) {
                    console.log('Email not sent: ' + error);
                    reject();
                  } else {
                    if (info) {
                      let info = {
                        invoiceDocumentName:
                          'fatura_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                        summaryDocumentName:
                          'resumo_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                      };
                      resolve(info);
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log(error);
            reject();
          });
      } catch (error) {
        console.error(`[${context}] Error `, error?.message);
        reject();
      }
    });
  },

  sendEVIOInvoiceEmail: (
    billingData,
    invoice,
    attach,
    pdfBuffer,
    emailUserId,
  ) => {
    var context = 'sendEVIOInvoiceEmail';
    return new Promise((resolve, reject) => {
      try {
        UtilsEVIO.createInvoicePDF(billingData, invoice, attach)
          .then(async (result) => {
            var html = fs.readFileSync('utils/indexMobie.html', 'utf8');

            let message = {
              apple: Utils.base64_encode('utils/img/apple.png'),
              call: Utils.base64_encode('utils/img/call.png'),
              charge: Utils.base64_encode('utils/img/charge.png'),
              email: Utils.base64_encode('utils/img/email.png'),
              EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
              line: Utils.base64_encode('utils/img/line.png'),
              play: Utils.base64_encode('utils/img/play.png'),
              username: billingData.billingName,
              linkApple: process.env.appleStoreLink,
              linkGoogle: process.env.googleStoreLink,
            };

            // Fetch user to get its languageCode
            let user = await getUserById(billingData.userId);
            let language = user?.language ?? defaultLanguage;
            // Fetch language microservice to get translations to a specific languageCode
            let translations = await getTranslations(language);

            // Query the translation keys for the emails
            let emailSubject = translations.filter(
              (translation) => translation.key === `email_invoice_subject`,
            )[0].value;
            let emailTitle = translations.filter(
              (translation) => translation.key === `email_invoice_title`,
            )[0].value;
            let emailHeader = translations.filter(
              (translation) => translation.key === `email_header`,
            )[0].value;
            let emailBody = translations.filter(
              (translation) => translation.key === `email_invoiceMobie_body`,
            )[0].value;
            let emailAttachmentInvoice = translations.filter(
              (translation) => translation.key === `email_attachmentInvoice`,
            )[0].value;
            let emailAttachmentSummary = translations.filter(
              (translation) => translation.key === `email_attachmentSummary`,
            )[0].value;

            //Replacing the strings with the values from message
            emailHeader = replaceAll(emailHeader, message);

            // Add environment to email subject
            emailSubject = addEnvironmentToSubject(emailSubject);

            // Add translation keys values to template
            message['emailTitle'] = emailTitle;
            message['emailHeader'] = emailHeader;
            message['emailBody'] = emailBody;

            const template = handlebars.compile(html);
            var htmlToSend = template(message);

            //TODO change email to emails?
            console.log('EmailUserId');
            console.log(emailUserId);

            let emailsList = [];
            if (emailUserId) {
              for (let i = 0; i != emailUserId.length; i++) {
                let billingProfile = await getBillingProfile(emailUserId[i]);
                emailsList.push(billingProfile.email);
              }
            }
            console.log('emailsList');
            console.log(emailsList);

            if (emailsList.length == 0) {
              emailsList.push(billingData.email);
            }

            console.log('emailsList 2');
            console.log(emailsList);

            var mailOptions = {
              source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
              from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
              to: emailsList,
              subject: emailSubject,
              text: 'EVIO - Envio de confirmação de Fatura/Recibo',
              html: htmlToSend,
              attachments: [
                {
                  filename:
                    emailAttachmentInvoice +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
                {
                  filename:
                    emailAttachmentSummary +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  //path: Utils.createTopUpPDFDocument(billingData, topup.payment),
                  //content: new Buffer.from(result, 'base64'),
                  content: result,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
              ],
            };

            transporter.verify((error, success) => {
              if (error) {
                console.log(error);
              } else {
                console.log('Server is ready to take our messages');
                transporter.sendMail(mailOptions, (error, info) => {
                  if (error) {
                    console.log('Email not sent: ' + error);
                    reject();
                  } else {
                    if (info) {
                      let info = {
                        invoiceDocumentName:
                          'fatura_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                        summaryDocumentName:
                          'resumo_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                      };
                      resolve(info);
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log(error);
            reject();
          });
      } catch (error) {
        console.error(`[${context}] Error `, error?.message);
        reject();
      }
    });
  },

  sendEVIOCSVDocumentToSupport: (csv, data) => {
    var context = 'sendExcelDocumentoToSupport';
    return new Promise((resolve, reject) => {
      var html = fs.readFileSync('utils/indexMobie.html', 'utf8');

      let message = {
        apple: Utils.base64_encode('utils/img/apple.png'),
        call: Utils.base64_encode('utils/img/call.png'),
        charge: Utils.base64_encode('utils/img/charge.png'),
        email: Utils.base64_encode('utils/img/email.png'),
        EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
        line: Utils.base64_encode('utils/img/line.png'),
        play: Utils.base64_encode('utils/img/play.png'),
        username: 'Support',
        linkApple: process.env.appleStoreLink,
        linkGoogle: process.env.googleStoreLink,
      };

      // Query the translation keys for the emails
      let emailSubject =
        'EVIO - Completed EVIO sessions between ' +
        data.start_date +
        ' and ' +
        data.end_date;
      let emailTitle = 'Completed Sessions';
      let emailHeader = '';
      let emailBody =
        'Completed EVIO charging sessions between ' +
        data.start_date +
        ' and ' +
        data.end_date;

      //Replacing the strings with the values from message
      emailHeader = replaceAll(emailHeader, message);

      // Add environment to email subject
      emailSubject = addEnvironmentToSubject(emailSubject);

      // Add translation keys values to template
      message['emailTitle'] = emailTitle;
      message['emailHeader'] = emailHeader;
      message['emailBody'] = emailBody;

      const template = handlebars.compile(html);
      var htmlToSend = template(message);

      let emailToSend;
      if (process.env.NODE_ENV === 'production') {
        emailToSend = process.env.EVIOMAIL;
      } else if (process.env.NODE_ENV === 'pre-production') {
        //emailToSend = process.env.EVIOMAIL;
        emailToSend = process.env.EVIOMAILQA;
      } else {
        emailToSend = process.env.EVIOMAILQA;
      }

      var mailOptions = {
        source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
        from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
        to: emailToSend,
        subject: emailSubject,
        text: '',
        html: htmlToSend,
        attachments: [
          {
            filename:
              'completed_evio_sessions' +
              data.start_date +
              '/' +
              data.end_date +
              '.csv',
            content: csv,
          },
        ],
      };

      transporter.verify((error, success) => {
        if (error) {
          console.log(error);
        } else {
          console.log('Server is ready to take our messages');
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.log('Email not sent: ' + error);
              reject();
            } else {
              if (info) {
                resolve();
              }
            }
          });
        }
      });
    });
  },

  sendMonthlyInvoiceEmail: (
    billingData,
    invoice,
    attach,
    billingDates,
    pdfBuffer,
    emailUserId,
  ) => {
    var context = 'sendMonthlyInvoiceEmail';
    return new Promise((resolve, reject) => {
      try {
        UtilsMonthly.createInvoicePDF(billingData, invoice, attach)
          .then(async (result) => {
            var html = fs.readFileSync('utils/indexMobie.html', 'utf8');

            let message = {
              apple: Utils.base64_encode('utils/img/apple.png'),
              call: Utils.base64_encode('utils/img/call.png'),
              charge: Utils.base64_encode('utils/img/charge.png'),
              email: Utils.base64_encode('utils/img/email.png'),
              EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
              line: Utils.base64_encode('utils/img/line.png'),
              play: Utils.base64_encode('utils/img/play.png'),
              username: billingData.billingName,
              linkApple: process.env.appleStoreLink,
              linkGoogle: process.env.googleStoreLink,
            };

            // Fetch user to get its languageCode
            let user = await getUserById(billingData.userId);
            let language = user?.language ?? defaultLanguage;
            // Fetch language microservice to get translations to a specific languageCode
            let translations = await getTranslations(language);

            // Query the translation keys for the emails
            let emailSubject = translations.filter(
              (translation) => translation.key === `email_invoice_subject`,
            )[0].value;
            let emailTitle = translations.filter(
              (translation) => translation.key === `email_invoice_title`,
            )[0].value;
            let emailHeader = translations.filter(
              (translation) => translation.key === `email_header`,
            )[0].value;
            let emailBody = translations.filter(
              (translation) => translation.key === `email_invoiceMobie_body`,
            )[0].value;
            let emailAttachmentInvoice = translations.filter(
              (translation) => translation.key === `email_attachmentInvoice`,
            )[0].value;
            let emailAttachmentSummary = translations.filter(
              (translation) => translation.key === `email_attachmentSummary`,
            )[0].value;
            let documentNumberReplacing = invoice.documentNumber
              .replace('/', ' ')
              .split(' ');

            //Replacing the strings with the values from message
            emailHeader = replaceAll(emailHeader, message);

            // Add environment to email subject
            emailSubject = addEnvironmentToSubject(emailSubject);

            // Add translation keys values to template
            message['emailTitle'] = emailTitle;
            message['emailHeader'] = emailHeader;
            message['emailBody'] = emailBody;

            const template = handlebars.compile(html);
            var htmlToSend = template(message);

            //Create Excel Buffer to attach
            let columns = Utils.createBillingPeriodExcelColumns(translations);
            let lines = Utils.createBillingPeriodExcelLines(
              invoice,
              attach,
              billingDates,
            );
            let excelBuffer = await Utils.createExcelBuffer(
              emailAttachmentSummary +
                billingData.billingName.replace(/ /g, ''),
              columns,
              lines,
            );

            //TODO change email to emails?
            console.log('EmailUserId');
            console.log(emailUserId);

            let emailsList = [];
            if (emailUserId) {
              for (let i = 0; i != emailUserId.length; i++) {
                let billingProfile = await getBillingProfile(emailUserId[i]);
                emailsList.push(billingProfile.email);
              }
            }
            console.log('emailsList');
            console.log(emailsList);

            if (emailsList.length == 0) {
              emailsList.push(billingData.email);
            }

            console.log('emailsList 2');
            console.log(emailsList);

            var mailOptions = {
              source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
              from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
              to: emailsList,
              subject: emailSubject + ' - ' + invoice.documentNumber,
              text: 'EVIO - Envio de confirmação de Fatura/Recibo',
              html: htmlToSend,
              attachments: [
                {
                  filename:
                    documentNumberReplacing[0] +
                    documentNumberReplacing[1] +
                    '_' +
                    documentNumberReplacing[2] +
                    '_' +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
                {
                  filename:
                    emailAttachmentSummary +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.pdf',
                  //path: Utils.createTopUpPDFDocument(billingData, topup.payment),
                  //content: new Buffer.from(result, 'base64'),
                  content: result,
                  contentType: 'application/pdf',
                  encoding: 'base64',
                },
                {
                  filename:
                    emailAttachmentSummary +
                    billingData.billingName.replace(/ /g, '') +
                    '_' +
                    moment().format('YYYY-MM-DD') +
                    '.xlsx',
                  content: excelBuffer,
                  contentType:
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
              ],
            };

            transporter.verify((error, success) => {
              if (error) {
                console.log(error);
              } else {
                console.log('Server is ready to take our messages');
                transporter.sendMail(mailOptions, (error, info) => {
                  if (error) {
                    console.log('Email not sent: ' + error);
                    reject();
                  } else {
                    if (info) {
                      let info = {
                        invoiceDocumentName:
                          'fatura_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                        summaryDocumentName:
                          'resumo_' +
                          billingData.billingName.replace(/ /g, '') +
                          '_' +
                          moment().format('YYYY-MM-DD') +
                          '.pdf',
                      };
                      resolve(info);
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log(error);
            reject();
          });
      } catch (error) {
        console.error(`[${context}] Error `, error?.message);
        reject();
      }
    });
  },
  createExcelBuffer: async (excelName, columns, lines) => {
    const context = 'Function createExcelBuffer';
    try {
      let workbook = new Excel.Workbook();
      let worksheet = workbook.addWorksheet(`${excelName}`);
      worksheet.columns = columns;
      let data = lines;
      data.forEach((e) => {
        worksheet.addRow(e);
      });
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return null;
    }
  },
  createBillingPeriodExcelColumns: (translations) => {
    const context = 'Function createBillingPeriodExcelColumns';
    try {
      return [
        {
          header: getKeyValue(translations, 'report_startDate'),
          key: 'startDate',
        },
        {
          header: getKeyValue(translations, 'report_stopDate'),
          key: 'stopDate',
        },
        { header: getKeyValue(translations, 'report_network'), key: 'network' },
        { header: getKeyValue(translations, 'report_charger'), key: 'hwId' },
        { header: getKeyValue(translations, 'report_city'), key: 'city' },
        {
          header: getKeyValue(translations, 'report_durationInMin'),
          key: 'durationMin',
        },
        {
          header: getKeyValue(translations, 'report_energyInKWh'),
          key: 'totalPower',
        },
        {
          header: getKeyValue(translations, 'report_timeChargedInMin'),
          key: 'realTimeCharging',
        },
        {
          header: getKeyValue(translations, 'report_averagePower'),
          key: 'averagePower',
        },
        { header: getKeyValue(translations, 'report_co2'), key: 'CO2emitted' },
        {
          header: getKeyValue(translations, 'report_totalExclVat'),
          key: 'totalExclVat',
        },
        { header: getKeyValue(translations, 'report_vatRate'), key: 'vat' },
        {
          header: getKeyValue(translations, 'report_totalInclVat'),
          key: 'totalInclVat',
        },
        { header: getKeyValue(translations, 'report_fleet'), key: 'fleetName' },
        { header: getKeyValue(translations, 'report_ev'), key: 'licensePlate' },
        { header: getKeyValue(translations, 'report_group'), key: 'groupName' },
        { header: getKeyValue(translations, 'report_user'), key: 'userIdName' },
        {
          header: getKeyValue(translations, 'report_userIdWillPayName'),
          key: 'userIdWillPayName',
        },
        {
          header: getKeyValue(translations, 'report_documentNumber'),
          key: 'documentNumber',
        },
        {
          header: getKeyValue(translations, 'report_emissionDate'),
          key: 'emissionDate',
        },
        { header: getKeyValue(translations, 'report_dueDate'), key: 'dueDate' },
        {
          header: getKeyValue(translations, 'report_billingPeriodStart'),
          key: 'billingPeriodStart',
        },
        {
          header: getKeyValue(translations, 'report_billingPeriodEnd'),
          key: 'billingPeriodEnd',
        },
        {
          header: getKeyValue(translations, 'report_durationAfterCharge'),
          key: 'parkingMin',
        },
        {
          header: getKeyValue(translations, 'report_activationFee'),
          key: 'activationFee',
        },
        {
          header: getKeyValue(translations, 'report_tariffEnergy'),
          key: 'energyTariff',
        },
        {
          header: getKeyValue(translations, 'report_tariffTime'),
          key: 'timeTariff',
        },
        {
          header: getKeyValue(translations, 'report_parkingDuringCharge'),
          key: 'chargingUseTariff',
        },
        {
          header: getKeyValue(translations, 'report_parkingTariff'),
          key: 'parkingTariff',
        },
        {
          header: getKeyValue(translations, 'report_roamingTimeCost'),
          key: 'roamingTimeCost',
        },
        {
          header: getKeyValue(translations, 'report_roamingEnergyCost'),
          key: 'roamingEnergyCost',
        },
        {
          header: getKeyValue(translations, 'report_voltageLevel'),
          key: 'voltageLevel',
        },
        {
          header: getKeyValue(translations, 'report_energyConsumedEmpty'),
          key: 'energyConsumedEmpty',
        },
        {
          header: getKeyValue(translations, 'report_energyConsumedOutEmpty'),
          key: 'energyConsumedOutEmpty',
        },
        {
          header: getKeyValue(translations, 'report_mobieCemeTotal'),
          key: 'cemeTotalPrice',
        },
        {
          header: getKeyValue(translations, 'report_cemeFlatTariff'),
          key: 'cemeFlatTariff',
        },
        {
          header: getKeyValue(translations, 'report_unitPriceCEMEEmpty'),
          key: 'unitPriceCEMEEmpty',
        },
        {
          header: getKeyValue(translations, 'report_unitPriceCEMEOutEmpty'),
          key: 'unitPriceCEMEOutEmpty',
        },
        {
          header: getKeyValue(translations, 'report_mobieTarTotal'),
          key: 'tarTotalPrice',
        },
        {
          header: getKeyValue(translations, 'report_unitPriceTAREmptyMT'),
          key: 'unitPriceTAREmptyMT',
        },
        {
          header: getKeyValue(translations, 'report_unitPriceTAROutEmptyMT'),
          key: 'unitPriceTAROutEmptyMT',
        },
        {
          header: getKeyValue(translations, 'report_unitPriceTAREmptyBT'),
          key: 'unitPriceTAREmptyBT',
        },
        {
          header: getKeyValue(translations, 'report_unitPriceTAROutEmptyBT'),
          key: 'unitPriceTAROutEmptyBT',
        },
        {
          header: getKeyValue(translations, 'report_mobieOpcTotal'),
          key: 'opcTotalPrice',
        },
        {
          header: getKeyValue(translations, 'report_unitPriceOPCTime'),
          key: 'unitPriceOPCTime',
        },
        {
          header: getKeyValue(translations, 'report_unitPriceOPCEnergy'),
          key: 'unitPriceOPCEnergy',
        },
        {
          header: getKeyValue(translations, 'report_opcTimeCost'),
          key: 'opcTimeCost',
        },
        {
          header: getKeyValue(translations, 'report_opcEnergyCost'),
          key: 'opcEnergyCost',
        },
        {
          header: getKeyValue(translations, 'report_opcFlatCost'),
          key: 'opcFlatCost',
        },
        {
          header: getKeyValue(translations, 'report_mobieSupportEM'),
          key: 'mobiEGrant',
        },
        {
          header: getKeyValue(translations, 'report_mobieIecTotal'),
          key: 'iecTotalPrice',
        },
        {
          header: getKeyValue(translations, 'report_partyIdOfOPC'),
          key: 'partyIdOfOPC',
        },
      ];
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  },
  createBillingPeriodExcelLines: (invoice, attach, billingDates) => {
    const context = 'Function createBillingPeriodExcelLines';
    try {
      let attachLines = attach.chargingSessions.lines;
      let sessions = attachLines
        .map((obj) => Object.values(obj)[0])
        .flat(1)
        .sort((a, b) => moment(a.startDateTime) - moment(b.startDateTime));

      let excelLines = mappingExcelLinesValues(sessions, invoice, billingDates);
      return excelLines;
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  },
  convertPdfToBase64: async function (url) {
    const context = 'Function convertPdfToBase64';
    try {
      return await pdf2base64(url);
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return null;
    }
  },
  sleep: function (ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },
  mappingExcelLinesValues,
  addMissingUserInfo: async function (session) {
    if (
      session.network === process.env.NetworkInternational ||
      session.network === process.env.NetworkMobiE
    ) {
      if (
        session.fleetName === '-' ||
        session.licensePlate === '-' ||
        session.userIdName === '-' ||
        session.userIdWillPayName === '-'
      ) {
        const foundSession = await getOCPISessions({
          start_date_time: session.startDateTime,
          location_id: session.hwId,
          status: 'COMPLETED',
        });
        if (foundSession) {
          const evDetails =
            foundSession.evDetails ??
            (foundSession.evId !== null &&
            foundSession.evId !== undefined &&
            foundSession.evId !== '-1'
              ? await getEvDetails(foundSession.evId)
              : null);
          const licensePlate = evDetails ? evDetails.licensePlate : null;
          const groupDrivers = evDetails
            ? evDetails.listOfGroupDrivers.find((group) =>
                group.listOfDrivers.find(
                  (driver) => driver._id === foundSession.userId,
                ),
              )
            : null;
          await this.sleep(500);
          const fleet =
            foundSession.fleetDetails ??
            (evDetails &&
            evDetails.fleet !== null &&
            evDetails.fleet !== undefined &&
            evDetails.fleet !== '-1'
              ? await getFleetDetails(evDetails.fleet)
              : null);
          await this.sleep(500);
          const userInfo =
            foundSession.userIdInfo ?? (await getUserById(foundSession.userId));
          const userWillPayInfo =
            foundSession.userIdWillPayInfo ??
            (foundSession.userIdWillPay !== foundSession.userId
              ? await getUserById(foundSession.userIdWillPay)
              : userInfo);

          session.fleetName = fleet?.name ?? '-';
          session.licensePlate = licensePlate ?? '-';
          session.groupName = groupDrivers?.name ?? '-';
          session.userIdName = userInfo?.name ?? '-';
          session.userIdWillPayName = userWillPayInfo?.name ?? '-';
          return session;
        } else {
          return session;
        }
      } else {
        return session;
      }
    } else {
      return session;
    }
  },
  getUserAndBillingInfo: async function (userId) {
    const billingData = await getBillingProfile(userId);
    const userInfo = await getUserById(userId);
    if (!billingData || !userInfo) {
      throw new Error({ message: "Couldn't get user info" });
    }
    return { billingData, userInfo };
  },
  getTranslations,
  getEmailInputInfo: function (invoice, billingData, translations) {
    const context = 'Function getEmailInputInfo';
    try {
      const html = fs.readFileSync('utils/indexMobie.html', 'utf8');

      let message = {
        apple: Utils.base64_encode('utils/img/apple.png'),
        call: Utils.base64_encode('utils/img/call.png'),
        charge: Utils.base64_encode('utils/img/charge.png'),
        email: Utils.base64_encode('utils/img/email.png'),
        EVIO_logo: Utils.base64_encode('utils/img/EVIO_logo.png'),
        line: Utils.base64_encode('utils/img/line.png'),
        play: Utils.base64_encode('utils/img/play.png'),
        username: billingData.billingName,
        linkApple: process.env.appleStoreLink,
        linkGoogle: process.env.googleStoreLink,
      };

      let emailSubject,
        emailTitle,
        emailHeader,
        emailBody,
        emailAttachmentInvoice,
        emailAttachmentSummary;

      if (invoice.type !== process.env.budgetType) {
        // Query the translation keys for the emails
        emailSubject = translations.filter(
          (translation) => translation.key === `email_invoice_subject`,
        )[0].value;
        emailTitle = translations.filter(
          (translation) => translation.key === `email_invoice_title`,
        )[0].value;
        emailHeader = translations.filter(
          (translation) => translation.key === `email_header`,
        )[0].value;
        emailBody = translations.filter(
          (translation) => translation.key === `email_invoiceMobie_body`,
        )[0].value;
        emailAttachmentInvoice = translations.filter(
          (translation) => translation.key === `email_attachmentInvoice`,
        )[0].value;
        emailAttachmentSummary = translations.filter(
          (translation) => translation.key === `email_attachmentSummary`,
        )[0].value;
      } else {
        // Query the translation keys for the emails
        emailSubject =
          'EVIO - Fatura ' + billingData.name + ' - ' + invoice.documentNumber;
        emailTitle = 'Fatura ' + billingData.name;
        emailHeader = '';
        emailBody =
          'Fatura gerada para a empresa ' +
          billingData.name +
          (invoice.startDate
            ? ' de ' +
              moment(invoice.startDate).format('YYYY-MM-DD') +
              ' a ' +
              moment(invoice.endDate).format('YYYY-MM-DD')
            : '');
        emailAttachmentInvoice = 'fatura_';
        emailAttachmentSummary = translations.filter(
          (translation) => translation.key === `email_attachmentSummary`,
        )[0].value;
      }

      //Replacing the strings with the values from message
      emailHeader = replaceAll(emailHeader, message);

      // Add environment to email subject
      emailSubject = addEnvironmentToSubject(emailSubject);

      // Add translation keys values to template
      message['emailTitle'] = emailTitle;
      message['emailHeader'] = emailHeader;
      message['emailBody'] = emailBody;

      const template = handlebars.compile(html);
      const htmlToSend = template(message);

      return {
        emailSubject,
        emailTitle,
        emailHeader,
        emailBody,
        emailAttachmentInvoice,
        emailAttachmentSummary,
        htmlToSend,
      };
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      throw new Error({ message: "Couldn't get email input info" });
    }
  },
  sendEmail: function (from, to, subject, html, attachments) {
    const context = 'Function sendEmail';
    return new Promise((resolve, reject) => {
      try {
        const mailOptions = {
          source: '"EVIO support" <' + from + '>',
          from: '"EVIO support" <' + from + '>', // sender address
          to,
          subject,
          text: 'EVIO - Envio de confirmação de Fatura',
          html,
          attachments,
        };

        transporter.verify((error, success) => {
          if (error) {
            console.log(error);
            reject({ message: 'Error verifying email' });
          } else {
            console.log('Server is ready to take our messages');
            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.log('Email not sent: ' + error);
                reject({ message: 'Error sending email' });
              } else {
                if (!info) {
                  console.log('Error sending email');
                  reject({ message: 'Error sending email' });
                } else {
                  console.log('Email sent!');
                  resolve();
                }
              }
            });
          }
        });
      } catch (error) {
        console.error(`[${context}] Error `, error?.message);
        reject({ message: error?.message });
      }
    });
  },
  updateInvoiceDocumentNames: function (invoice, billingData) {
    const context = 'Function updateInvoiceDocumentNames';
    try {
      let info = {
        invoiceDocumentName:
          'orçamento_' +
          billingData?.billingName?.replace(/ /g, '') +
          '_' +
          moment(invoice.createdAt).format('YYYY-MM-DD') +
          '.pdf',
        summaryDocumentName:
          'resumo_' +
          billingData?.billingName?.replace(/ /g, '') +
          '_' +
          moment(invoice.createdAt).format('YYYY-MM-DD') +
          '.pdf',
      };

      if (invoice.type !== process.env.budgetType) {
        info = {
          invoiceDocumentName:
            'fatura_' +
            billingData?.billingName?.replace(/ /g, '') +
            '_' +
            moment(invoice.createdAt).format('YYYY-MM-DD') +
            '.pdf',
          summaryDocumentName:
            'resumo_' +
            billingData?.billingName?.replace(/ /g, '') +
            '_' +
            moment(invoice.createdAt).format('YYYY-MM-DD') +
            '.pdf',
        };
      }

      let updateInvoice = {
        documentNumber: invoice.documentNumber,
        documentUrl: invoice.documentUrl,
        pdfDocumentName: invoice._id + '.pdf',
        invoiceDocumentName: info.invoiceDocumentName,
        summaryDocumentName: info.summaryDocumentName,
        emailStatus: true,
      };

      let query = { _id: invoice._id };

      updateInvoiceDatabase(query, updateInvoice);
    } catch (error) {
      console.error(`[${context}] Error `, error?.message);
    }
  },
  getMagnifinanceDocument: function (email, token, documentId) {
    const context = 'Function getMagnifinanceDocument';
    return new Promise((resolve, reject) => {
      try {
        const arg = {
          Authentication: {
            Email: email,
            Token: token,
          },
          DocumentId: documentId,
        };

        MagnifinanceClient.DocumentGet(arg, (err, result) => {
          if (err) {
            console.error(`[GetProcessingBillings] Error `, err);
            reject({ message: "Couldn't get magnifinance document" });
          } else {
            let type = result.Response.Type;
            if (type) {
              if (type === 'Success') {
                resolve(result.Response.Object);
              } else {
                console.log('Document ' + documentId + ' still processing');
                reject({ message: "Couldn't get magnifinance document" });
              }
            } else {
              reject({ message: "Couldn't get magnifinance document" });
            }
          }
        });
      } catch (error) {
        console.error(`[${context}] Error `, error?.message);
        reject({ message: error?.message });
      }
    });
  },
};

function updateInvoiceDatabase(query, newInvoice) {
  var context = 'FUNCTION updateInvoiceDatabase';

  Invoice.updateInvoice(query, { $set: newInvoice }, (error, doc) => {
    if (error) {
      console.log(`[${context}][updateInvoice] Error`);
    } else {
      if (doc != null) {
        console.log(`[${context}][updateInvoice] Success`);
      }
    }
  });
}

function mappingExcelLinesValues(sessions, invoice, billingDates) {
  const context = 'Function mappingExcelLinesValues';
  try {
    let excelLines = [];
    let otherNetworksNumber = {
      international: {
        exists: false,
        number: 1,
      },
      whiteLabel: {
        exists: false,
        number: 1,
      },
    };
    console.log(`${context} ---- invoice: ${JSON.stringify(invoice)}`);
    console.log(
      `${context} ---- billingDates: ${JSON.stringify(billingDates)}`,
    );
    for (let session of sessions) {
      if (session.network === process.env.NetworkEVIO /* "EVIO" */) {
        excelLines.push({
          startDate: insertSessionValue(
            moment(session.startDateTime).format('DD/MM/YYYY HH:mm'),
          ),
          stopDate: insertSessionValue(
            moment(session.endDateTime).format('DD/MM/YYYY HH:mm'),
          ),
          network: insertSessionValue(session.network),
          hwId: insertSessionValue(session.hwId),
          city: insertSessionValue(session.city),
          durationMin: insertSessionValue(session.durationMin),
          totalPower: insertSessionValue(session.totalPower),
          realTimeCharging: insertSessionValue(session.realTimeCharging),
          averagePower: insertSessionValue(session.averagePower),
          CO2emitted: insertSessionValue(session.CO2emitted),
          totalExclVat: insertSessionValue(session.total_exc_vat),
          vat: insertSessionValue(session.vat),
          totalInclVat: insertSessionValue(session.total_inc_vat),
          fleetName: insertSessionValue(session.fleetName),
          licensePlate: insertSessionValue(session.licensePlate),
          groupName: insertSessionValue(session.groupName),
          userIdName: insertSessionValue(session.userIdName),
          userIdWillPayName: insertSessionValue(session.userIdWillPayName),
          documentNumber: invoice.documentNumber,
          emissionDate: insertSessionValue(billingDates.emissionDate),
          dueDate: insertSessionValue(billingDates.dueDate),
          billingPeriodStart: insertSessionValue(
            billingDates.startDate
              ? moment(billingDates.startDate).format('YYYY-MM-DD')
              : billingDates.startDate,
          ),
          billingPeriodEnd: insertSessionValue(
            billingDates.startDate
              ? moment(billingDates.endDate).format('YYYY-MM-DD')
              : billingDates.startDate,
          ),
          parkingMin: insertSessionValue(session.parkingMin),
          activationFee: insertSessionValue(session.opcFlatCost),
          energyTariff: insertSessionValue(session.tariffEnergy),
          timeTariff: insertSessionValue(session.tariffTime),
          chargingUseTariff: insertSessionValue(
            session.parkingDuringChargingTariff,
          ),
          parkingTariff: insertSessionValue(session.charging_after_parking),
          roamingTimeCost: insertSessionValue(null),
          roamingEnergyCost: insertSessionValue(null),
          voltageLevel: insertSessionValue(null),
          energyConsumedEmpty: insertSessionValue(null),
          energyConsumedOutEmpty: insertSessionValue(null),
          cemeTotalPrice: insertSessionValue(null),
          cemeFlatTariff: insertSessionValue(null),
          unitPriceCEMEEmpty: insertSessionValue(null),
          unitPriceCEMEOutEmpty: insertSessionValue(null),
          tarTotalPrice: insertSessionValue(null),
          unitPriceTAREmptyMT: insertSessionValue(null),
          unitPriceTAROutEmptyMT: insertSessionValue(null),
          unitPriceTAREmptyBT: insertSessionValue(null),
          unitPriceTAROutEmptyBT: insertSessionValue(null),
          opcTotalPrice: insertSessionValue(null),
          unitPriceOPCTime: insertSessionValue(null),
          unitPriceOPCEnergy: insertSessionValue(null),
          opcTimeCost: insertSessionValue(null),
          opcEnergyCost: insertSessionValue(null),
          opcFlatCost: insertSessionValue(null),
          mobiEGrant: insertSessionValue(null),
          iecTotalPrice: insertSessionValue(null),
          partyIdOfOPC: insertSessionValue(session?.partyId),
        });
      } else if (session.network === process.env.NetworkMobiE /* "MobiE" */) {
        excelLines.push({
          startDate: insertSessionValue(
            moment(session.startDateTime).format('DD/MM/YYYY HH:mm'),
          ),
          stopDate: insertSessionValue(
            moment(session.endDateTime).format('DD/MM/YYYY HH:mm'),
          ),
          network: insertSessionValue(session.network),
          hwId: insertSessionValue(session.hwId),
          city: insertSessionValue(session.city),
          durationMin: insertSessionValue(session.durationMin),
          totalPower: insertSessionValue(session.totalPower),
          realTimeCharging: insertSessionValue(session.realTimeCharging),
          averagePower: insertSessionValue(session.averagePower),
          CO2emitted: insertSessionValue(session.CO2emitted),
          totalExclVat: insertSessionValue(session.total_exc_vat),
          vat: insertSessionValue(session.vat),
          totalInclVat: insertSessionValue(session.total_inc_vat),
          fleetName: insertSessionValue(session.fleetName),
          licensePlate: insertSessionValue(session.licensePlate),
          groupName: insertSessionValue(session.groupName),
          userIdName: insertSessionValue(session.userIdName),
          userIdWillPayName: insertSessionValue(session.userIdWillPayName),
          documentNumber: invoice.documentNumber,
          emissionDate: insertSessionValue(billingDates.emissionDate),
          dueDate: insertSessionValue(billingDates.dueDate),
          billingPeriodStart: insertSessionValue(
            billingDates.startDate
              ? moment(billingDates.startDate).format('YYYY-MM-DD')
              : billingDates.startDate,
          ),
          billingPeriodEnd: insertSessionValue(
            billingDates.startDate
              ? moment(billingDates.endDate).format('YYYY-MM-DD')
              : billingDates.startDate,
          ),
          parkingMin: insertSessionValue(null),
          activationFee: insertSessionValue(null),
          energyTariff: insertSessionValue(null),
          timeTariff: insertSessionValue(null),
          chargingUseTariff: insertSessionValue(null),
          parkingTariff: insertSessionValue(null),
          roamingTimeCost: insertSessionValue(null),
          roamingEnergyCost: insertSessionValue(null),
          voltageLevel: insertSessionValue(session.voltageLevel),
          energyConsumedEmpty: insertSessionValue(session.energyConsumedEmpty),
          energyConsumedOutEmpty: insertSessionValue(
            session.energyConsumedOutEmpty,
          ),
          cemeTotalPrice: insertSessionValue(session.cemeTotalPrice),
          cemeFlatTariff: insertSessionValue(session.activationFee),
          unitPriceCEMEEmpty: insertSessionValue(session.unitPriceCEMEEmptyBT),
          unitPriceCEMEOutEmpty: insertSessionValue(
            session.unitPriceCEMEOutEmptyBT,
          ),
          tarTotalPrice: insertSessionValue(session.tar),
          unitPriceTAREmptyMT: insertSessionValue(session.unitPriceTAREmptyMT),
          unitPriceTAROutEmptyMT: insertSessionValue(
            session.unitPriceTAROutEmptyMT,
          ),
          unitPriceTAREmptyBT: insertSessionValue(session.unitPriceTAREmptyBT),
          unitPriceTAROutEmptyBT: insertSessionValue(
            session.unitPriceTAROutEmptyBT,
          ),
          opcTotalPrice: insertSessionValue(session.opcTotalPrice),
          unitPriceOPCTime: insertSessionValue(session.unitPriceOPCTime),
          unitPriceOPCEnergy: insertSessionValue(session.unitPriceOPCEnergy),
          opcTimeCost: insertSessionValue(session.opcTimeCost),
          opcEnergyCost: insertSessionValue(session.opcEnergyCost),
          opcFlatCost: insertSessionValue(session.opcFlatCost),
          mobiEGrant: insertSessionValue(session.mobiEGrant),
          iecTotalPrice: insertSessionValue(session.iec),
          partyIdOfOPC: insertSessionValue(session?.partyId),
        });
      } else if (
        session.network === process.env.NetworkInternational /* "Gireve" */
      ) {
        excelLines.push({
          startDate: insertSessionValue(
            moment(session.startDateTime).format('DD/MM/YYYY HH:mm'),
          ),
          stopDate: insertSessionValue(
            moment(session.endDateTime).format('DD/MM/YYYY HH:mm'),
          ),
          network: insertSessionValue(
            `Outras redes ${otherNetworksNumber.international.number}`,
          ),
          hwId: insertSessionValue(session.hwId),
          city: insertSessionValue(session.country),
          durationMin: insertSessionValue(session.durationMin),
          totalPower: insertSessionValue(session.totalPower),
          realTimeCharging: insertSessionValue(session.realTimeCharging),
          averagePower: insertSessionValue(session.averagePower),
          CO2emitted: insertSessionValue(session.CO2emitted),
          totalExclVat: insertSessionValue(session.total_exc_vat),
          vat: insertSessionValue(session.vat),
          totalInclVat: insertSessionValue(session.total_inc_vat),
          fleetName: insertSessionValue(session.fleetName),
          licensePlate: insertSessionValue(session.licensePlate),
          groupName: insertSessionValue(session.groupName),
          userIdName: insertSessionValue(session.userIdName),
          userIdWillPayName: insertSessionValue(session.userIdWillPayName),
          documentNumber: invoice.documentNumber,
          emissionDate: insertSessionValue(billingDates.emissionDate),
          dueDate: insertSessionValue(billingDates.dueDate),
          billingPeriodStart: insertSessionValue(
            billingDates.startDate
              ? moment(billingDates.startDate).format('YYYY-MM-DD')
              : billingDates.startDate,
          ),
          billingPeriodEnd: insertSessionValue(
            billingDates.startDate
              ? moment(billingDates.endDate).format('YYYY-MM-DD')
              : billingDates.startDate,
          ),
          parkingMin: insertSessionValue(null),
          activationFee: insertSessionValue(session.flatCost),
          energyTariff: insertSessionValue(session.unitPriceRoamingEnergy),
          timeTariff: insertSessionValue(session.unitPriceRoamingTime),
          chargingUseTariff: insertSessionValue(null),
          parkingTariff: insertSessionValue(null),
          roamingTimeCost: insertSessionValue(session.timeCost),
          roamingEnergyCost: insertSessionValue(session.energyCost),
          voltageLevel: insertSessionValue(session.voltageLevel),
          energyConsumedEmpty: insertSessionValue(null),
          energyConsumedOutEmpty: insertSessionValue(null),
          cemeTotalPrice: insertSessionValue(null),
          cemeFlatTariff: insertSessionValue(null),
          unitPriceCEMEEmpty: insertSessionValue(null),
          unitPriceCEMEOutEmpty: insertSessionValue(null),
          tarTotalPrice: insertSessionValue(null),
          unitPriceTAREmptyMT: insertSessionValue(null),
          unitPriceTAROutEmptyMT: insertSessionValue(null),
          unitPriceTAREmptyBT: insertSessionValue(null),
          unitPriceTAROutEmptyBT: insertSessionValue(null),
          opcTotalPrice: insertSessionValue(null),
          unitPriceOPCTime: insertSessionValue(null),
          unitPriceOPCEnergy: insertSessionValue(null),
          opcTimeCost: insertSessionValue(null),
          opcEnergyCost: insertSessionValue(null),
          opcFlatCost: insertSessionValue(null),
          mobiEGrant: insertSessionValue(null),
          iecTotalPrice: insertSessionValue(null),
          partyIdOfOPC: insertSessionValue(session?.partyId),
        });
        incrementOtherNetworksNumber(otherNetworksNumber, 'international');
      } else if (
        session.network === process.env.NetworkGoCharge ||
        session.network === process.env.NetworkHyundai ||
        session.network === process.env.NetworkKLC ||
        session.network === process.env.NetworkKinto /* "EVIO" */
      ) {
        excelLines.push({
          startDate: insertSessionValue(
            moment(session.startDateTime).format('DD/MM/YYYY HH:mm'),
          ),
          stopDate: insertSessionValue(
            moment(session.endDateTime).format('DD/MM/YYYY HH:mm'),
          ),
          network: insertSessionValue(
            `Outras redes ${otherNetworksNumber.whiteLabel.number}`,
          ),
          hwId: insertSessionValue(session.hwId),
          city: insertSessionValue(session.city),
          durationMin: insertSessionValue(session.durationMin),
          totalPower: insertSessionValue(session.totalPower),
          realTimeCharging: insertSessionValue(session.realTimeCharging),
          averagePower: insertSessionValue(session.averagePower),
          CO2emitted: insertSessionValue(session.CO2emitted),
          totalExclVat: insertSessionValue(session.total_exc_vat),
          vat: insertSessionValue(session.vat),
          totalInclVat: insertSessionValue(session.total_inc_vat),
          fleetName: insertSessionValue(session.fleetName),
          licensePlate: insertSessionValue(session.licensePlate),
          groupName: insertSessionValue(session.groupName),
          userIdName: insertSessionValue(session.userIdName),
          userIdWillPayName: insertSessionValue(session.userIdWillPayName),
          documentNumber: invoice.documentNumber,
          emissionDate: insertSessionValue(billingDates.emissionDate),
          dueDate: insertSessionValue(billingDates.dueDate),
          billingPeriodStart: insertSessionValue(
            billingDates.startDate
              ? moment(billingDates.startDate).format('YYYY-MM-DD')
              : billingDates.startDate,
          ),
          billingPeriodEnd: insertSessionValue(
            billingDates.startDate
              ? moment(billingDates.endDate).format('YYYY-MM-DD')
              : billingDates.startDate,
          ),
          parkingMin: insertSessionValue(session.parkingMin),
          activationFee: insertSessionValue(session.opcFlatCost),
          energyTariff: insertSessionValue(session.tariffEnergy),
          timeTariff: insertSessionValue(session.tariffTime),
          chargingUseTariff: insertSessionValue(
            session.parkingDuringChargingTariff,
          ),
          parkingTariff: insertSessionValue(session.charging_after_parking),
          roamingTimeCost: insertSessionValue(null),
          roamingEnergyCost: insertSessionValue(null),
          voltageLevel: insertSessionValue(null),
          energyConsumedEmpty: insertSessionValue(null),
          energyConsumedOutEmpty: insertSessionValue(null),
          cemeTotalPrice: insertSessionValue(null),
          cemeFlatTariff: insertSessionValue(null),
          unitPriceCEMEEmpty: insertSessionValue(null),
          unitPriceCEMEOutEmpty: insertSessionValue(null),
          tarTotalPrice: insertSessionValue(null),
          unitPriceTAREmptyMT: insertSessionValue(null),
          unitPriceTAROutEmptyMT: insertSessionValue(null),
          unitPriceTAREmptyBT: insertSessionValue(null),
          unitPriceTAROutEmptyBT: insertSessionValue(null),
          opcTotalPrice: insertSessionValue(null),
          unitPriceOPCTime: insertSessionValue(null),
          unitPriceOPCEnergy: insertSessionValue(null),
          opcTimeCost: insertSessionValue(null),
          opcEnergyCost: insertSessionValue(null),
          opcFlatCost: insertSessionValue(null),
          mobiEGrant: insertSessionValue(null),
          iecTotalPrice: insertSessionValue(null),
          partyIdOfOPC: insertSessionValue(session?.partyId),
        });

        incrementOtherNetworksNumber(otherNetworksNumber, 'whiteLabel');
      }
    }

    return excelLines;
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return [];
  }
}
function getKeyValue(translations, key) {
  const context = 'Function getKeyValue';
  try {
    return translations.find((translation) => translation.key === key).value;
  } catch (error) {
    console.log(`[Error][${context}]`, error.message + `: ${key}`);
    return key;
  }
}

function insertSessionValue(value) {
  const context = 'Function insertSessionValue';
  try {
    return value !== null && value !== undefined && value !== '' ? value : '-';
  } catch (error) {
    console.log(`[Error][${context}]`, error.message);
    return '-';
  }
}

function sendTopUpEmail(billingData, topUp, clientName) {
  return new Promise((resolve, reject) => {
    var context = 'sendTopUpEmail';

    console.log(`[${context}] billingData`, billingData);

    let host = process.env.NotificationsHost + process.env.PathSendEmail;

    let mailOptions = {
      to: billingData.email,
      message: {
        username: billingData.billingName,
        topUpValue: topUp.payment,
      },
      type: 'topUp',
    };

    let headers = {
      clientname: billingData.clientName,
    };

    axios
      .post(host, { mailOptions }, { headers })
      .then(() => {
        resolve();
      })
      .catch((error) => {
        if (error.response) {
          console.error(
            `[Error][${context}][400][.catch][axios]`,
            error.response.data,
          );
          reject();
        } else {
          console.error(
            `[Error][${context}][500][.catch][axios]`,
            error.message,
          );
          reject();
        }
      });
  });
}

function replaceAll(str, mapObj) {
  const isEmpty = isEmptyObject(mapObj);
  if (!isEmpty) {
    var re = new RegExp(Object.keys(mapObj).join('|'), 'gi');
    return str.replace(re, function (matched) {
      return mapObj[matched];
    });
  } else {
    return str;
  }
}

async function getTranslations(languageCode) {
  const context = 'Function getTranslations';
  try {
    const translations =
      await FileTransaction.retrieveFileTranslationByLanguage({
        component: 'email',
        project: 'evio',
        language: languageCode,
      });

    return Object.entries(translations).map(([key, value]) => ({
      key,
      value,
    }));
  } catch (error) {
    console.error(
      `[${context}] Error retrieving translations: ${JSON.stringify(error)}`,
    );
    return null;
  }
}

function getUserById(userId) {
  var context = 'Function getUserById';
  return new Promise((resolve, reject) => {
    var params = { _id: userId };
    var host = process.env.IdentityHost + process.env.PathGetUserById;
    axios
      .get(host, { params })
      .then((result) => {
        if (result.data) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      })
      .catch((error) => {
        console.error(`[${context}]Error`, error.message);
        resolve(null);
        //reject(error);
      });
  });
}

function getBillingProfile(userId) {
  var context = 'Function getBillingProfile';
  return new Promise((resolve, reject) => {
    var params = { userId: userId };
    var host = process.env.IdentityHost + process.env.PathGetBillingProfile;
    axios
      .get(host, { params })
      .then((result) => {
        if (result.data) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      })
      .catch((error) => {
        console.error(`[${context}]Error`, error.message);
        resolve(null);
      });
  });
}

function addEnvironmentToSubject(subject) {
  let environment = '';
  let position = 4;

  if (process.env.NODE_ENV === 'pre-production') {
    environment = ' [PRE]';
  } else if (process.env.NODE_ENV === 'development') {
    environment = ' [QA]';
  }
  return [
    subject.slice(0, position),
    environment,
    subject.slice(position),
  ].join('');
}

function incrementOtherNetworksNumber(otherNetworksNumber, network) {
  otherNetworksNumber[network].exists = true;
  for (let otherNetwork in otherNetworksNumber) {
    if (!otherNetworksNumber[otherNetwork].exists) {
      otherNetworksNumber[otherNetwork].number += 1;
    }
  }
}

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

function getOCPISessions(body) {
  var context = 'Function getOCPISessions';
  return new Promise((resolve, reject) => {
    var host = process.env.HostOcpi + process.env.PathGetOCPIChargingSessions;
    console.log(host);
    axios
      .get(host, { data: body })
      .then((result) => {
        if (result.data) {
          if (result.data.length > 0) {
            resolve(result.data[0]);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      })
      .catch((error) => {
        console.error(`[${context}]Error`, error.message);
        resolve(null);
        //reject(error);
      });
  });
}

async function getEvDetails(evId) {
  let context = 'Function getEvDetails';
  try {
    let proxyEV = process.env.HostEvs + process.env.PathGetEVDetails;
    let params = {
      _id: evId,
    };

    let foundEv = await axios.get(proxyEV, { params });
    return foundEv.data ? foundEv.data : null;
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return null;
  }
}

async function getFleetDetails(fleetId) {
  let context = 'Function getFleetDetails';
  try {
    let proxyEV = process.env.HostEvs + process.env.PathGetFleetById;
    let params = {
      _id: fleetId,
    };

    let foundFleet = await axios.get(proxyEV, { params });
    return foundFleet.data ? foundFleet.data : null;
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return null;
  }
}
module.exports = Utils;
