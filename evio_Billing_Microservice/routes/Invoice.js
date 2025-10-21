const express = require('express');
const router = express.Router();
require('dotenv-safe').load();
const axios = require('axios');
var moment = require('moment');
const toggle = require('evio-toggle').default;
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
const pdf2base64 = require('pdf-to-base64');
var fs = require('fs');
const UUID = require('uuid-js');
const nodemailer = require('nodemailer');
const ExternalRequest = require('../handlers/externalRequest');
const InvoiceHandler = require('../handlers/invoice');
const Invoice = require('../models/Invoice');
const Utils = require('../utils/Utils');
const UtilsWL = require('../utils/wl/UtilsWL');
const Template = require('../models/Template');
const addressS = require('../services/address');
const Constants = require('../utils/constants');
const MagnifinanceService = require('../services/magnifinance');
const Sentry = require('@sentry/node');
const InvoiceController = require('../controllers/invoice');
const { StatusCodes } = require('http-status-codes');
const { Enums } = require('evio-library-commons').default;

const billingProfileProxy = `${Constants.services.identity}/api/private/billingProfile`;

var soap = require('soap');
var url = Constants.providers.magnifinance;
var MagnifinanceClient;

soap.createClient(url, (err, client) => {
  if (err) {
    Sentry.captureException(err);
    console.log(
      `[Error] Error while creating a synchronous soap client`,
      err.message,
    );
  } else {
    console.log('Connect to Magnifinance client');
    MagnifinanceClient = client;
    //processFailedInvoices()
  }
});

//=====GET=====
router.get(
  '/api/private/getBillingDocument',
  InvoiceController.getBillingDocument,
);

router.get(
  '/api/private/billing/invoiceDocument',
  InvoiceController.getInvoiceDocument,
);

router.get(
  '/api/private/billing/invoiceDocumentByPaymentId',
  async (req, res, next) => {
    const context = 'GET /api/private/billing/invoiceDocumentByPaymentId';
    try {
      let paymentId = req.query.paymentId;
      let invoiceId = req.query.invoiceId;

      console.log('invoiceId', invoiceId);

      let query;
      if (invoiceId) {
        query = {
          _id: invoiceId,
        };
      } else {
        query = {
          $or: [
            {
              paymentId: paymentId,
            },
            {
              paymentIdList: paymentId,
            },
          ],
        };
      }

      let invoice = await Invoice.findOne(query).lean();
      console.log(`[${context}] fetched invoice`, invoice, {
        paymentId,
        invoiceId,
      });

      return res.status(200).send(invoice);
    } catch (error) {
      Sentry.captureException(error);
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error?.message);
    }
  },
);

router.post('/api/private/billing/runFirstTime', (req, res, next) => {
  const context = 'POST /api/private/billing/runFirstTime';
  try {
    addBillingType();
    return res.status(200).send('OK');
  } catch (error) {
    console.log(`[${context}] Error `, error?.message);
    return res.status(500).send(error?.message);
  }
});

router.post('/api/private/createBillingDocument', async (req, res, next) => {
  var context = 'POST /api/private/createBillingDocument';
  try {
    if (!req.body.invoice) {
      return res
        .status(400)
        .send({ code: 'invoice_missing', message: 'Invoice missing' });
    }

    if (!req.body.attach) {
      return res
        .status(400)
        .send({ code: 'attach_missing', message: 'Attach missing' });
    }

    const optionalCountryCodeToVAT = req.body.optionalCountryCodeToVAT;
    let invoice = req.body.invoice;
    let attach = req.body.attach;
    let paymentId = req.body.invoice.paymentId;

    if (await checkIfEVIOInvouce(invoice.header.userId)) {
      let response = await createEVIOInvoice(invoice, attach);
      if (response)
        if (response.invoiceId) return res.status(200).send(response);

      return res.status(500).send(response);
    }

    checkIfInvoiceAlreadyExists(paymentId)
      .then(() => {
        let params = {
          userId: invoice.header.userId,
        };

        axios
          .get(billingProfileProxy, { params: params })
          .then(async (profileFound) => {
            let billingData = profileFound.data;
            let dueDate = moment().format('YYYY-MM-DD');
            let emissionDate = moment().format('YYYY-MM-DD');


            createBillingDocument(
              billingData,
              invoice.lines,
              paymentId,
              dueDate,
              emissionDate,
              optionalCountryCodeToVAT,
            )
              .then(async (arg) => {
                console.log('Request body Magnifinance');
                console.log('ARG', JSON.stringify(arg));
                try {
                  let invoiceUpdated = await Invoice.findOneAndUpdate(
                    { _id: invoice._id },
                    { $set: { argData: arg } },
                    { new: true },
                  );
                } catch (error) {
                  console.log(`[${context}][Invoice] Error`, error);
                }

                //console.log(arg.Document.Lines);
                await saveInvoiceBeforeThirdParty(invoice, attach, arg);

                MagnifinanceClient.DocumentCreate(arg, (err, result) => {
                  if (err) {
                    //console.log(MagnifinanceClient.lastRequest);

                    console.log(`[${context}] Error `, err.response);
                    Sentry.captureException(err);

                    let billing = {
                      payments: invoice.lines,
                      paymentId: invoice.paymentId,
                      userId: invoice.header.userId,
                      chargerType: invoice.header.chargerType,
                      type: process.env.invoiceType,
                      status: process.env.failedStatus,
                      attach: attach,
                      validationError: setValidationError(err, context),
                      billingType: process.env.instantType,
                      dueDate: dueDate,
                      emissionDate: emissionDate,
                      clientName: process.env.evioClientName,
                      argData: arg,
                    };

                    updateOrCreateInvoice(billing)
                      .then((result) => {
                        if (process.env.NODE_ENV === 'production') {
                          Utils.sendInvoiceFailureEmail(
                            result._id,
                            err,
                            billingData,
                          );
                        } else if (process.env.NODE_ENV === 'pre-production') {
                          Utils.sendInvoiceFailureEmail(
                            result._id,
                            err,
                            billingData,
                          );
                        }

                        return res.status(200).send({
                          invoiceId: result._id,
                          invoiceStatus: process.env.failedStatus,
                        });
                      })
                      .catch((error) => {
                        Sentry.captureException(error);
                        return res.status(500).send(error);
                      });
                  } else {
                    console.log(result.Response);

                    if (result.Response.Type === 'Error') {
                      let billing;

                      billing = {
                        payments: invoice.lines,
                        paymentId: invoice.paymentId,
                        userId: invoice.header.userId,
                        chargerType: invoice.header.chargerType,
                        type: process.env.invoiceType,
                        status: process.env.failedStatus,
                        attach: attach,
                        validationError: result.Response,
                        billingType: process.env.instantType,
                        dueDate: dueDate,
                        emissionDate: emissionDate,
                        clientName: process.env.evioClientName,
                        argData: arg,
                      };

                      updateOrCreateInvoice(billing)
                        .then((result) => {
                          if (process.env.NODE_ENV === 'production') {
                            Utils.sendInvoiceFailureEmail(
                              result._id,
                              billing.validationError,
                              billingData,
                            );
                          } else if (
                            process.env.NODE_ENV === 'pre-production'
                          ) {
                            Utils.sendInvoiceFailureEmail(
                              result._id,
                              billing.validationError,
                              billingData,
                            );
                          }

                          return res.status(200).send({
                            invoiceId: result._id,
                            invoiceStatus: process.env.failedStatus,
                          });
                        })
                        .catch((error) => {
                          Sentry.captureException(error);
                          return res.status(500).send(error);
                        });
                    }

                    if (result.Response.Type === 'Success') {
                      let billing = {
                        payments: invoice.lines,
                        paymentId: invoice.paymentId,
                        userId: invoice.header.userId,
                        chargerType: invoice.header.chargerType,
                        documentId: result.Response.Object.DocumentId,
                        type: process.env.invoiceType,
                        billingType: process.env.instantType,
                        status: process.env.processingStatus,
                        attach: attach,
                        dueDate: dueDate,
                        emissionDate: emissionDate,
                        clientName: process.env.evioClientName,
                        argData: arg,
                      };

                      updateOrCreateInvoice(billing)
                        .then((result) => {
                          return res.status(200).send({
                            invoiceId: result._id,
                            invoiceStatus: process.env.processingStatus,
                          });
                        })
                        .catch((error) => {
                          Sentry.captureException(error);
                          return res.status(500).send(error);
                        });
                    }

                    if (
                      result.Response.Type !== 'Success' &&
                      result.Response.Type !== 'Error'
                    ) {
                      saveThirdPartyUnknownResult(invoice, result);
                      return res.status(200).send({
                        invoiceId: result._id,
                        invoiceStatus: process.env.unknownStatus,
                      });
                    }
                  }
                });
              })
              .catch((error) => {
                Sentry.captureException(error);
                return res.status(500).send(error);
              });
          })
          .catch((error) => {
            console.log(`[${context}][.then][find] Error`, error);
            return res.status(400).send({
              auth: false,
              code: 'billing_profile_failed',
              message: 'Failed to retrieve billing profile',
            });
          });
      })
      .catch(() => {
        console.log(
          `[${context}][checkIfInvoiceAlreadyExists] PaymentId already has an invoice` +
            paymentId,
        );
        return res.status(400).send({
          code: 'payment_already_has_invoice',
          message: 'PaymentId already has an invoice' + paymentId,
        });
      });
  } catch (error) {
    Sentry.captureException(error);
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

router.post(
  '/api/private/createMobiEBillingDocument',
  async (req, res, next) => {
    var context = 'POST /api/private/createMobiEBillingDocument';
    try {
      if (!req.body.invoice) {
        return res
          .status(400)
          .send({ code: 'invoice_missing', message: 'Invoice missing' });
      }

      if (!req.body.attach) {
        return res
          .status(400)
          .send({ code: 'attach_missing', message: 'Attach missing' });
      }

      const optionalCountryCodeToVAT = req.body.optionalCountryCodeToVAT;
      let invoice = req.body.invoice;
      let attach = req.body.attach;
      let paymentId = req.body.invoice.paymentId;
      const userId = invoice.header.userId || req.headers.userid;
      if (!userId) {
        return res
          .status(400)
          .send({ code: 'userId_missing', message: 'UserId missing' });
      }

      if (await checkIfEVIOInvouce(userId)) {
        let response = await createEVIOInvoice(invoice, attach);
        if (response)
          if (response.invoiceId) return res.status(200).send(response);

        return res.status(500).send(response);
      }

      checkIfInvoiceAlreadyExists(paymentId)
        .then(() => {
          let params = {
            userId,
          };

          axios
            .get(billingProfileProxy, { params: params })
            .then(async (profileFound) => {
              let billingData = profileFound.data;
              const isTaxIdValid = await InvoiceHandler.isTaxIdValid(
                billingData.nif,
                billingData?.billingAddress?.countryCode,
              );

              if (!isTaxIdValid) {
                billingData.nif = Constants.nifDefault;
                await Utils.sendInvoiceInvalidNifEmail(billingData);
              }

              createPublicNetworkBillingDocument(
                billingData,
                invoice.lines,
                paymentId,
                optionalCountryCodeToVAT,
              )
                .then(async (arg) => {
                  console.log('Request body Magnifinance');
                  console.log('ARG', JSON.stringify(arg));
                  try {
                    let invoiceUpdated = await Invoice.findOneAndUpdate(
                      { _id: invoice._id },
                      { $set: { argData: arg } },
                      { new: true },
                    );
                  } catch (error) {
                    Sentry.captureException(error);
                    console.log(`[${context}][Invoice] Error`, error);
                  }

                  await saveInvoiceBeforeThirdParty(invoice, attach, arg);

                  MagnifinanceClient.DocumentCreate(arg, (err, result) => {
                    if (err) {
                      Sentry.captureException(err);
                      console.log(`[${context}] Error `, err.response);

                      let billing = {
                        payments: invoice.lines,
                        paymentId: invoice.paymentId,
                        userId,
                        chargerType: process.env.ChargerTypeMobiE,
                        type: process.env.invoiceType,
                        billingType: process.env.instantType,
                        status: process.env.failedStatus,
                        clientName: process.env.evioClientName,
                        attach: attach,
                        validationError: setValidationError(err, context),
                        argData: arg,
                      };

                      updateOrCreateInvoice(billing)
                        .then((result) => {
                          if (process.env.NODE_ENV === 'production') {
                            Utils.sendInvoiceFailureEmail(
                              result._id,
                              err,
                              billingData,
                            );
                          } else if (
                            process.env.NODE_ENV === 'pre-production'
                          ) {
                            Utils.sendInvoiceFailureEmail(
                              result._id,
                              err,
                              billingData,
                            );
                          }

                          return res.status(200).send({
                            invoiceId: result._id,
                            invoiceStatus: process.env.failedStatus,
                          });
                        })
                        .catch((error) => {
                          return res.status(500).send(error);
                        });
                    } else {
                      console.log(result.Response);

                      if (result.Response.Type === 'Error') {
                        let billing;

                        if (
                          result.Response.ValidationErrors !== undefined &&
                          result.Response.ValidationErrors !== null
                        ) {
                          if (
                            result.Response.ValidationErrors.ValidationError
                          ) {
                            billing = {
                              payments: invoice.lines,
                              paymentId: invoice.paymentId,
                              userId,
                              chargerType: process.env.ChargerTypeMobiE,
                              type: process.env.invoiceType,
                              billingType: process.env.instantType,
                              clientName: process.env.evioClientName,
                              status: process.env.failedStatus,
                              attach: attach,
                              validationError: result.Response,
                            };
                          } else {
                            billing = {
                              payments: invoice.lines,
                              paymentId: invoice.paymentId,
                              userId,
                              chargerType: process.env.ChargerTypeMobiE,
                              type: process.env.invoiceType,
                              billingType: process.env.instantType,
                              clientName: process.env.evioClientName,
                              status: process.env.failedStatus,
                              attach: attach,
                              validationError: result.Response,
                            };
                          }
                        } else {
                          billing = {
                            payments: invoice.lines,
                            paymentId: invoice.paymentId,
                            userId,
                            chargerType: process.env.ChargerTypeMobiE,
                            type: process.env.invoiceType,
                            billingType: process.env.instantType,
                            clientName: process.env.evioClientName,
                            status: process.env.failedStatus,
                            attach: attach,
                            validationError: result.Response,
                          };
                        }

                        billing.arg = arg;

                        updateOrCreateInvoice(billing)
                          .then((result) => {
                            if (process.env.NODE_ENV === 'production') {
                              Utils.sendInvoiceFailureEmail(
                                result._id,
                                billing.validationError,
                                billingData,
                              );
                            } else if (
                              process.env.NODE_ENV === 'pre-production'
                            ) {
                              Utils.sendInvoiceFailureEmail(
                                result._id,
                                billing.validationError,
                                billingData,
                              );
                            }

                            return res.status(200).send({
                              invoiceId: result._id,
                              invoiceStatus: process.env.failedStatus,
                            });
                          })
                          .catch((error) => {
                            Sentry.captureException(error);
                            return res.status(500).send(error);
                          });
                      }

                      if (result.Response.Type === 'Success') {
                        let billing = {
                          payments: invoice.lines,
                          paymentId: invoice.paymentId,
                          userId,
                          chargerType: process.env.ChargerTypeMobiE,
                          documentId: result.Response.Object.DocumentId,
                          type: process.env.invoiceType,
                          billingType: process.env.instantType,
                          clientName: process.env.evioClientName,
                          status: process.env.processingStatus,
                          attach: attach,
                          argData: arg,
                        };
                        updateOrCreateInvoice(billing)
                          .then((result) => {
                            return res.status(200).send({
                              invoiceId: result._id,
                              invoiceStatus: process.env.processingStatus,
                            });
                          })
                          .catch((error) => {
                            Sentry.captureException(error);
                            return res.status(500).send(error);
                          });
                      }

                      if (
                        result.Response.Type !== 'Success' &&
                        result.Response.Type !== 'Error'
                      ) {
                        saveThirdPartyUnknownResult(invoice, result);
                        return res.status(200).send({
                          invoiceId: result._id,
                          invoiceStatus: process.env.unknownStatus,
                        });
                      }
                    }
                  });
                })
                .catch((error) => {
                  Sentry.captureException(error);
                  console.log(
                    `[${context}][createPublicNetworkBillingDocument] Error`,
                    error?.message,
                  );
                  return res.status(500).send(error);
                });
            })
            .catch((error) => {
              console.log(`[${context}][.then][find] Error`, error?.message);
              return res.status(400).send({
                auth: false,
                code: 'billing_profile_failed',
                message: 'Failed to retrieve billing profile',
              });
            });
        })
        .catch(() => {
          console.log(
            `[${context}][checkIfInvoiceAlreadyExists] PaymentId already has an invoice` +
              paymentId,
          );
          return res.status(400).send({
            code: 'payment_already_has_invoice',
            message: 'PaymentId already has an invoice ' + paymentId,
          });
        });
    } catch (error) {
      Sentry.captureException(error);
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error?.message);
    }
  },
);

router.post(
  '/api/private/createGireveBillingDocument',
  async (req, res, next) => {
    const context = 'POST /api/private/createGireveBillingDocument';
    try {
      const featureFlagEnabled = await toggle.isEnable(
        'foreign_invoice_deactivated_bp-54',
      );
      if (featureFlagEnabled) {
        console.log(
          `[${context}][FEATUREFLAG][foreign_invoice_deactivated_BP-54]`,
        );
        return res.status(StatusCodes.FORBIDDEN).send({
          code: 'foreign_invoice_deactivated',
          message: 'Foreign invoice deactivated',
        });
      }

      if (!req.body.invoice) {
        return res
          .status(400)
          .send({ code: 'invoice_missing', message: 'Invoice missing' });
      }

      if (!req.body.attach) {
        return res
          .status(400)
          .send({ code: 'attach_missing', message: 'Attach missing' });
      }

      const optionalCountryCodeToVAT = req.body.optionalCountryCodeToVAT;
      let invoice = req.body.invoice;
      let attach = req.body.attach;
      let paymentId = req.body.invoice.paymentId;

      if (await checkIfEVIOInvouce(invoice.header.userId)) {
        let response = await createEVIOInvoice(invoice, attach);
        if (response)
          if (response.invoiceId) return res.status(200).send(response);

        return res.status(500).send(response);
      }

      // console.log(`${context} request: `, JSON.stringify(req.body))
      checkIfInvoiceAlreadyExists(paymentId)
        .then(() => {
          let params = {
            userId: invoice.header.userId,
          };
          //console.log("userID: ", params.userId)
          axios
            .get(billingProfileProxy, { params: params })
            .then(async (profileFound) => {
              let billingData = profileFound.data;
              const isTaxIdValid = await InvoiceHandler.isTaxIdValid(
                billingData.nif,
                billingData?.billingAddress?.countryCode,
              );

              if (!isTaxIdValid) {
                billingData.nif = Constants.nifDefault;
                await Utils.sendInvoiceInvalidNifEmail(billingData);
              }

              createPublicNetworkBillingDocument(
                billingData,
                invoice.lines,
                paymentId,
                optionalCountryCodeToVAT,
              )
                .then(async (arg) => {
                  console.log('Request body Magnifinance');
                  console.log('ARG', JSON.stringify(arg));
                  try {
                    let invoiceUpdated = await Invoice.findOneAndUpdate(
                      { _id: invoice._id },
                      { $set: { argData: arg } },
                      { new: true },
                    );
                  } catch (error) {
                    console.log(`[${context}][Invoice] Error`, error);
                  }

                  await saveInvoiceBeforeThirdParty(invoice, attach, arg);

                  MagnifinanceClient.DocumentCreate(arg, (err, result) => {
                    if (err) {
                      console.log(`[${context}] Error `, err.response);

                      let billing = {
                        payments: invoice.lines,
                        paymentId: invoice.paymentId,
                        userId: invoice.header.userId,
                        chargerType: process.env.ChargerTypeGireve,
                        type: process.env.invoiceType,
                        billingType: process.env.instantType,
                        clientName: process.env.evioClientName,
                        status: process.env.failedStatus,
                        attach: attach,
                        validationError: setValidationError(err, context),
                        argData: arg,
                      };

                      updateOrCreateInvoice(billing)
                        .then((result) => {
                          if (process.env.NODE_ENV === 'production') {
                            Utils.sendInvoiceFailureEmail(
                              result._id,
                              err,
                              billingData,
                            );
                          } else if (
                            process.env.NODE_ENV === 'pre-production'
                          ) {
                            Utils.sendInvoiceFailureEmail(
                              result._id,
                              err,
                              billingData,
                            );
                          }

                          return res.status(200).send({
                            invoiceId: result._id,
                            invoiceStatus: process.env.failedStatus,
                          });
                        })
                        .catch((error) => {
                          return res.status(500).send(error);
                        });
                    } else {
                      console.log(
                        'MagnifinanceClient response',
                        result.Response,
                      );

                      if (result.Response.Type === 'Error') {
                        let billing;

                        if (
                          result.Response.ValidationErrors !== undefined &&
                          result.Response.ValidationErrors !== null
                        ) {
                          if (
                            result.Response.ValidationErrors.ValidationError
                          ) {
                            billing = {
                              payments: invoice.lines,
                              paymentId: invoice.paymentId,
                              userId: invoice.header.userId,
                              chargerType: process.env.ChargerTypeGireve,
                              type: process.env.invoiceType,
                              billingType: process.env.instantType,
                              clientName: process.env.evioClientName,
                              status: process.env.failedStatus,
                              attach: attach,
                              validationError: result.Response,
                            };
                          } else {
                            billing = {
                              payments: invoice.lines,
                              paymentId: invoice.paymentId,
                              userId: invoice.header.userId,
                              chargerType: process.env.ChargerTypeGireve,
                              type: process.env.invoiceType,
                              billingType: process.env.instantType,
                              clientName: process.env.evioClientName,
                              status: process.env.failedStatus,
                              attach: attach,
                              validationError: result.Response,
                            };
                          }
                        } else {
                          billing = {
                            payments: invoice.lines,
                            paymentId: invoice.paymentId,
                            userId: invoice.header.userId,
                            chargerType: process.env.ChargerTypeGireve,
                            type: process.env.invoiceType,
                            billingType: process.env.instantType,
                            clientName: process.env.evioClientName,
                            status: process.env.failedStatus,
                            attach: attach,
                            validationError: result.Response,
                          };
                        }
                        billing.arg = arg;
                        updateOrCreateInvoice(billing)
                          .then((result) => {
                            if (process.env.NODE_ENV === 'production') {
                              Utils.sendInvoiceFailureEmail(
                                result._id,
                                billing.validationError,
                                billingData,
                              );
                            } else if (
                              process.env.NODE_ENV === 'pre-production'
                            ) {
                              Utils.sendInvoiceFailureEmail(
                                result._id,
                                billing.validationError,
                                billingData,
                              );
                            }

                            return res.status(200).send({
                              invoiceId: result._id,
                              invoiceStatus: process.env.failedStatus,
                            });
                          })
                          .catch((error) => {
                            return res.status(500).send(error);
                          });
                      }

                      if (result.Response.Type === 'Success') {
                        let billing = {
                          payments: invoice.lines,
                          paymentId: invoice.paymentId,
                          userId: invoice.header.userId,
                          chargerType: process.env.ChargerTypeGireve,
                          documentId: result.Response.Object.DocumentId,
                          type: process.env.invoiceType,
                          billingType: process.env.instantType,
                          clientName: process.env.evioClientName,
                          status: process.env.processingStatus,
                          attach: attach,
                          argData: arg,
                        };
                        updateOrCreateInvoice(billing)
                          .then((result) => {
                            return res.status(200).send({
                              invoiceId: result._id,
                              invoiceStatus: process.env.processingStatus,
                            });
                          })
                          .catch((error) => {
                            return res.status(500).send(error);
                          });
                      }

                      if (
                        result.Response.Type !== 'Success' &&
                        result.Response.Type !== 'Error'
                      ) {
                        saveThirdPartyUnknownResult(invoice, result);
                        return res.status(200).send({
                          invoiceId: result._id,
                          invoiceStatus: process.env.unknownStatus,
                        });
                      }
                    }
                  });
                })
                .catch((error) => {
                  return res.status(500).send(error);
                });
            })
            .catch((error) => {
              console.log(`[${context}][.then][find] Error`, error);
              return res.status(400).send({
                auth: false,
                code: 'billing_profile_failed',
                message: 'Failed to retrieve billing profile',
              });
            });
        })
        .catch(() => {
          console.log(
            `[${context}][checkIfInvoiceAlreadyExists] PaymentId already has an invoice` +
              paymentId,
          );
          return res.status(400).send({
            code: 'payment_already_has_invoice',
            message: 'PaymentId already has an invoice' + paymentId,
          });
        });
    } catch (error) {
      Sentry.captureException(error);
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error?.message);
    }
  },
);

router.post('/api/private/checkFailedEmails', (req, res, next) => {
  var context = 'POST /api/private/checkFailedEmails';
  try {
    let query = {
      type: 'invoice',
      status: process.env.createdStatus,
      emailStatus: false,
    };

    Invoice.find(query, (err, invoices) => {
      if (err) {
        console.log(`[${context}][find] Error `, err);
        return res.status(500).send(err);
      } else {
        if (invoices.length === 0) {
          console.log('Invoices with pending emails to process not found');
          return res.status(400).send('No invoices with pending emails');
        } else {
          let promises = [];

          for (let i = 0; i < invoices.length; i++) {
            const invoice = invoices[i];

            setTimeout(function () {
              promises.push(
                new Promise(function (resolve, reject) {
                  let userId = invoice.userId;
                  let pdfDocumentName = invoice.pdfDocumentName;

                  getLocalPdfDocument(pdfDocumentName)
                    .then((pdfBuffer) => {
                      if (
                        invoice.chargerType === process.env.ChargerTypeMobiE
                      ) {
                        setTimeout(function () {
                          sendMobiEEmail(
                            userId,
                            invoice,
                            invoice.attach,
                            pdfBuffer,
                            invoice.emailUserId,
                          )
                            .then(() => {
                              let updateInvoice = {
                                emailStatus: true,
                              };
                              let query = { _id: invoice._id };
                              updateInvoiceDatabase(query, updateInvoice);
                              resolve(true);
                            })
                            .catch((error) => {
                              console.log(
                                '[Error][Failed to send email] ' + error,
                              );
                              resolve(false);
                            });
                        }, i * 4 * 1000);
                      } else {
                        setTimeout(function () {
                          sendEmail(
                            userId,
                            invoice,
                            pdfBuffer,
                            invoice.emailUserId,
                          )
                            .then(() => {
                              let updateInvoice = {
                                emailStatus: true,
                              };
                              let query = { _id: invoice._id };
                              updateInvoiceDatabase(query, updateInvoice);
                              resolve(true);
                            })
                            .catch((error) => {
                              console.log(
                                '[Error][Failed to send email] ' + error,
                              );
                              resolve(false);
                            });
                        }, i * 4 * 1000);
                      }
                    })
                    .catch((error) => {
                      console.log('[Error][Failed to send email] ' + error);
                      resolve(false);
                    });
                }),
              );
            }, i * 4 * 1000);
          }

          Promise.all(promises)
            .then(() => {
              return res.status(200).send('Update finished with success.');
            })
            .catch(() => {
              return res.status(400).send('Process failed to update emails.');
            });
        }
      }
    });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

router.post('/api/private/billing/processInvoiceById', (req, res, next) => {
  var context = 'POST /api/private/billing/processInvoice';
  try {
    if (!req.body.invoiceId) {
      return res
        .status(400)
        .send({ code: 'invoice_missing', message: 'Invoice missing' });
    }

    let invoiceId = req.body.invoiceId;

    //Apenas reprocessa faturas que estejam no estado '30''
    let query = {
      _id: invoiceId,
      status: process.env.failedStatus,
    };

    Invoice.findOne(query, (err, invoice) => {
      if (err) {
        console.log(`[${context}][find] Error `, err);
        return res.status(500).send(err.message);
      } else {
        if (invoice) {
          if (invoice.status === process.env.failedStatus) {
            if (invoice.billingType !== process.env.monthlyType) {
              if (invoice.chargerType === process.env.ChargerTypeMobiE) {
                processFailedMobieDocument(invoice)
                  .then(() => {
                    return res.status(200).send('Invoice is being reprocessed');
                  })
                  .catch(() => {
                    return res
                      .status(400)
                      .send('Invoice failed to be reprocessed');
                  });
              } else {
                if (
                  invoice.chargerType === process.env.ChargerTypeGireve ||
                  invoice.chargerType === Enums.ChargerTypes.Hubject
                ) {
                  processFailedGireveDocument(invoice)
                    .then(() => {
                      return res
                        .status(200)
                        .send('Invoice is being reprocessed');
                    })
                    .catch(() => {
                      return res
                        .status(400)
                        .send('Invoice failed to be reprocessed');
                    });
                } else {
                  processFailedEVIODocument(invoice)
                    .then(() => {
                      return res
                        .status(200)
                        .send('Invoice is being reprocessed');
                    })
                    .catch(() => {
                      return res
                        .status(400)
                        .send('Invoice failed to be reprocessed');
                    });
                }
              }
            } else {
              if (invoice.type === process.env.budgetType) {
                if (
                  invoice.payments &&
                  invoice.paymentId &&
                  invoice.dueDate &&
                  invoice.emissionDate
                ) {
                  processFailedBudgetDocument(invoice)
                    .then(() => {
                      return res
                        .status(200)
                        .send('Invoice is being reprocessed');
                    })
                    .catch(() => {
                      return res
                        .status(400)
                        .send('Invoice failed to be reprocessed');
                    });
                } else {
                  return res
                    .status(400)
                    .send(
                      'Missing parameters to reprocess budget type document',
                    );
                }
              } else {
                if (
                  invoice.payments &&
                  invoice.transactionId &&
                  invoice.dueDate &&
                  invoice.emissionDate
                ) {
                  processFailedPeriodDocument(invoice)
                    .then(() => {
                      return res
                        .status(200)
                        .send('Invoice is being reprocessed');
                    })
                    .catch(() => {
                      return res
                        .status(400)
                        .send('Invoice failed to be reprocessed');
                    });
                } else {
                  return res
                    .status(400)
                    .send(
                      'Missing parameters to reprocess budget type document',
                    );
                }
              }
            }
          } else {
            return res
              .status(400)
              .send('Invoice is not in a state that can be reprocessed');
          }
        } else {
          return res
            .status(400)
            .send('Invoice is not in a state that can be reprocessed');
        }
      }
    });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

//DEPRECATED
/**
 * @deprecated Since version 1.34.0. Will be deleted in version 1.40.0. Use xxx instead.
 */
router.post('/api/private/billing/monthlyBilling', async (req, res, next) => {
  var context = 'POST /api/private/monthlyBilling';
  try {
    if (!req.body.invoice) {
      return res
        .status(400)
        .send({ code: 'invoice_missing', message: 'Invoice missing' });
    }

    if (!req.body.attach) {
      return res
        .status(400)
        .send({ code: 'attach_missing', message: 'Attach missing' });
    }

    let startDate = req.headers['startdate'];
    let endDate = req.headers['enddate'];

    let invoice = req.body.invoice;
    let attach = req.body.attach;

    if (await checkIfEVIOInvouce(invoice.header.userId)) {
      let response = await createEVIOInvoice(invoice, attach);
      if (response)
        if (response.invoiceId) return res.status(200).send(response);

      return res.status(500).send(response);
    }

    let params = {
      userId: invoice.header.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        createBudgetDocument(billingData, invoice.lines)
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));
            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { _id: invoice._id },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            await saveInvoiceBeforeThirdParty(invoice, attach, arg);

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error `, err.response);

                let billing = {
                  payments: invoice.lines,
                  paymentId: invoice.paymentId,
                  userId: invoice.header.userId,
                  chargerType: process.env.ChargerTypeMobiE,
                  type: process.env.budgetType,
                  status: process.env.failedStatus,
                  attach: attach,
                  validationError: setValidationError(err, context),
                  startDate: startDate,
                  endDate: endDate,
                  argData: arg,
                };

                updateOrCreateInvoice(billing)
                  .then((result) => {
                    if (process.env.NODE_ENV === 'production') {
                      Utils.sendInvoiceFailureEmail(
                        result._id,
                        err,
                        billingData,
                      );
                    } else if (process.env.NODE_ENV === 'pre-production') {
                      Utils.sendInvoiceFailureEmail(
                        result._id,
                        err,
                        billingData,
                      );
                    }

                    return res.status(200).send({
                      invoiceId: result._id,
                      invoiceStatus: process.env.failedStatus,
                    });
                  })
                  .catch((error) => {
                    return res.status(500).send(error);
                  });
              } else {
                console.log(result.Response);

                if (result.Response.Type === 'Error') {
                  let billing;

                  if (
                    result.Response.ValidationErrors !== undefined &&
                    result.Response.ValidationErrors !== null
                  ) {
                    if (result.Response.ValidationErrors.ValidationError) {
                      billing = {
                        payments: invoice.lines,
                        paymentId: invoice.paymentId,
                        userId: invoice.header.userId,
                        chargerType: process.env.ChargerTypeMobiE,
                        type: process.env.budgetType,
                        status: process.env.failedStatus,
                        attach: attach,
                        validationError: result.Response,
                        startDate: startDate,
                        endDate: endDate,
                      };
                    } else {
                      billing = {
                        payments: invoice.lines,
                        paymentId: invoice.paymentId,
                        userId: invoice.header.userId,
                        chargerType: process.env.ChargerTypeMobiE,
                        type: process.env.budgetType,
                        status: process.env.failedStatus,
                        attach: attach,
                        validationError: result.Response,
                        startDate: startDate,
                        endDate: endDate,
                      };
                    }
                  } else {
                    billing = {
                      payments: invoice.lines,
                      paymentId: invoice.paymentId,
                      userId: invoice.header.userId,
                      chargerType: process.env.ChargerTypeMobiE,
                      type: process.env.budgetType,
                      status: process.env.failedStatus,
                      attach: attach,
                      validationError: result.Response,
                      startDate: startDate,
                      endDate: endDate,
                    };
                  }
                  billing.argData = arg;
                  updateOrCreateInvoice(billing)
                    .then((result) => {
                      if (process.env.NODE_ENV === 'production') {
                        Utils.sendInvoiceFailureEmail(
                          result._id,
                          billing.validationError,
                          billingData,
                        );
                      } else if (process.env.NODE_ENV === 'pre-production') {
                        Utils.sendInvoiceFailureEmail(
                          result._id,
                          billing.validationError,
                          billingData,
                        );
                      }

                      return res.status(200).send({
                        invoiceId: result._id,
                        invoiceStatus: process.env.failedStatus,
                      });
                    })
                    .catch((error) => {
                      return res.status(500).send(error);
                    });
                }

                if (result.Response.Type === 'Success') {
                  let billing = {
                    payments: invoice.lines,
                    paymentId: invoice.paymentId,
                    userId: invoice.header.userId,
                    chargerType: process.env.ChargerTypeMobiE,
                    documentId: result.Response.Object.DocumentId,
                    type: process.env.budgetType,
                    status: process.env.processingStatus,
                    attach: attach,
                    startDate: startDate,
                    endDate: endDate,
                    argData: arg,
                  };
                  updateOrCreateInvoice(billing)
                    .then((result) => {
                      return res.status(200).send({
                        invoiceId: result._id,
                        invoiceStatus: process.env.processingStatus,
                      });
                    })
                    .catch((error) => {
                      return res.status(500).send(error);
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(invoice, result);
                  return res.status(200).send({
                    invoiceId: result._id,
                    invoiceStatus: process.env.unknownStatus,
                  });
                }
              }
            });
          })
          .catch((error) => {
            return res.status(500).send(error);
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        return res.status(400).send({
          auth: false,
          code: 'billing_profile_failed',
          message: 'Failed to retrieve billing profile',
        });
      });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

router.get('/api/private/billing/getInvoiceDocument', (req, res) => {
  var context = 'GET /api/private/billing/getInvoiceDocument';

  try {
    var userId = req.headers['userid'];

    if (!req.query.invoiceId) {
      return res
        .status(400)
        .send({ code: 'invoice_missing', message: 'Invoice missing' });
    }

    let invoiceId = req.query.invoiceId;

    let query = {
      _id: invoiceId,
      userId: userId,
    };

    Invoice.findOne(query, (err, invoice) => {
      if (err) {
        console.log(`[${context}][find] Error `, err);
        return res.status(500).send(err.message);
      } else {
        if (invoice) {
          if (invoice.status === process.env.processingStatus) {
            return res.status(400).send({
              auth: true,
              code: 'invoice_status_processing',
              message: 'Invoice is being processed',
            });
          }

          if (invoice.status === process.env.failedStatus) {
            return res.status(400).send({
              auth: true,
              code: 'invoice_status_failed',
              message: 'Invoice is being processed',
            });
          }

          if (invoice.status === process.env.createdStatus) {
            getLocalPdfDocument(invoice.pdfDocumentName)
              .then((buffer) => {
                let pdfInvoice = {
                  name: invoice.invoiceDocumentName,
                  buffer: buffer,
                };

                return res.status(200).send(pdfInvoice);
              })
              .catch((error) => {
                return res.status(500).send({
                  auth: true,
                  code: 'invoice_local_failed',
                  message: 'Invoice not found',
                });
              });
          }
        } else {
          return res.status(400).send({
            auth: false,
            code: 'invoice_not_access',
            message: 'You dont have access to this document',
          });
        }
      }
    });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

router.post('/api/private/billing/creditNoteByPaymentId', (req, res, next) => {
  var context = 'POST /api/private/billing/creditNoteByPaymentId';
  try {
    if (!req.body.paymentId) {
      return res
        .status(400)
        .send({ code: 'invoice_missing', message: 'Invoice missing' });
    }

    let paymentId = req.body.paymentId;
    //console.log(paymentId)
    Invoice.findOne({ paymentId: paymentId }, (err, invoice) => {
      if (err) {
        console.log(`[${context}][find] Error `, err);
        return res.status(500).send(err.message);
      } else {
        if (invoice) {
          if (invoice.status === process.env.createdStatus) {
            if (invoice.chargerType === process.env.ChargerTypeMobiE) {
              createMobiECreditNote(invoice)
                .then(() => {
                  return res.status(200).send('Credit note is being processed');
                })
                .catch(() => {
                  return res
                    .status(400)
                    .send('Credit note failed to be processed');
                });
            } else {
              //TO DO
              try {
                createEVIOCreditNote(invoice)
                  .then(() => {
                    return res
                      .status(200)
                      .send('Credit note is being processed');
                  })
                  .catch(() => {
                    return res
                      .status(400)
                      .send('Credit note failed to be processed');
                  });
              } catch (error) {
                console.log('[ERROR] Failed to create EVIO credit note');
                return res
                  .status(400)
                  .send('Credit note failed to be processed');
              }
            }
          } else {
            return res
              .status(400)
              .send(
                'Invoice is not a created state. No credit note can be created.',
              );
          }
        } else {
          return res.status(400).send('Invoice does not exist');
        }
      }
    });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

router.post('/api/private/billing/creditNoteByInvoiceId', (req, res, next) => {
  var context = 'POST /api/private/billing/creditNoteByInvoiceId';
  try {
    if (!req.body.invoiceId) {
      return res
        .status(400)
        .send({ code: 'invoice_missing', message: 'Invoice missing' });
    }

    let invoiceId = req.body.invoiceId;
    //console.log(invoiceId)
    Invoice.findOne({ _id: invoiceId }, (err, invoice) => {
      if (err) {
        console.log(`[${context}][find] Error `, err);
        return res.status(500).send(err.message);
      } else {
        if (invoice) {
          if (invoice.status === process.env.createdStatus) {
            createMobiECreditNote(invoice)
              .then(() => {
                return res.status(200).send('Credit note is being processed');
              })
              .catch(() => {
                return res
                  .status(400)
                  .send('Credit note failed to be processed');
              });

            // if (invoice.chargerType === process.env.ChargerTypeMobiE) {
            //     createMobiECreditNote(invoice)
            //         .then(() => {
            //             return res.status(200).send("Credit note is being processed");
            //         })
            //         .catch(() => {
            //             return res.status(400).send("Credit note failed to be processed");
            //         });
            // }
            // else {
            //     //TO DO
            //     try {
            //         createEVIOCreditNote(invoice)
            //             .then(() => {
            //                 return res.status(200).send("Credit note is being processed");
            //             })
            //             .catch(() => {
            //                 return res.status(400).send("Credit note failed to be processed");
            //             });
            //     }
            //     catch (error) {
            //         console.log("[ERROR] Failed to create EVIO credit note");
            //         return res.status(400).send("Credit note failed to be processed");
            //     }

            // }
          } else {
            return res
              .status(400)
              .send(
                'Invoice is not a created state. No credit note can be created.',
              );
          }
        } else {
          return res.status(400).send('Invoice does not exist');
        }
      }
    });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error.message);
  }
});

router.post('/api/private/billing/sendInvoiceEmail', (req, res, next) => {
  var context = 'POST /api/private/billing/sendInvoiceEmail';
  try {
    if (!req.body.invoiceId) {
      return res.status(400).send({
        auth: false,
        code: 'invoice_id_missing',
        message: 'Invoice id is missing',
      });
    }

    let invoiceId = req.body.invoiceId;

    //Apenas reprocessa faturas que estejam no estado '40' e que ainda não foi enviado email
    let query = {
      _id: invoiceId,
      status: process.env.createdStatus,
      emailStatus: process.env.emailFailedStatus,
    };

    Invoice.findOne(query, async (err, invoice) => {
      if (err) {
        console.log(`[${context}][find] Error `, err);
        return res.status(500).send(err.message);
      } else {
        if (invoice) {
          let arg;
          if (invoice.clientName === 'EVIO') {
            let { email, token } = getAuthenticationEmailCredentials();
            arg = {
              Authentication: {
                Email: email,
                Token: token,
              },
              DocumentId: invoice.documentId,
            };
          } else {
            auth = await getAuthCredentialsFromTemplate(
              invoice.clientName,
              invoice.ceme,
            );
            arg = {
              Authentication: {
                Email: auth.email,
                Token: auth.token,
              },
              DocumentId: invoice.documentId,
            };
          }
          /* var arg = {
                         Authentication: {
                             Email: auth.email,
                             Token: auth.token
                         },
                         DocumentId: invoice.documentId
                     };*/

          try {
            let invoiceUpdated = await Invoice.findOneAndUpdate(
              { _id: invoice._id },
              { $set: { argData: arg } },
              { new: true },
            );
          } catch (error) {
            console.log(`[${context}][Invoice] Error`, error);
          }

          let i = 1;
          MagnifinanceClient.DocumentGet(arg, (err, result) => {
            if (err) {
              console.log(`[sendInvoiceEmail] Error `, err);
            } else {
              let type = result.Response.Type;
              if (type) {
                if (type === 'Success') {
                  let object = result.Response.Object;

                  let invoiceData = {
                    documentNumber: object.DocumentNumber,
                    documentUrl: object.DownloadUrl,
                    chargerType: invoice.chargerType,
                    clientName: invoice.clientName,
                  };

                  downloadAndStorePDF(object.DownloadUrl, invoice._id)
                    .then((pdfBuffer) => {
                      //Send Email Mobie
                      if (
                        invoice.chargerType === process.env.ChargerTypeMobiE
                      ) {
                        setTimeout(function () {
                          if (invoice.type === process.env.creditNoteType) {
                            sendMobiECreditNote(
                              invoice.userId,
                              invoiceData,
                              invoice.invoiceNumber,
                              invoice.attach,
                              pdfBuffer,
                              invoice.emailUserId,
                            )
                              .then((info) => {
                                let updateInvoice = {
                                  emailStatus: true,
                                };

                                let query = { _id: invoice._id };

                                updateInvoiceDatabase(query, updateInvoice);

                                return res
                                  .status(200)
                                  .send('Credit note email sent');
                              })
                              .catch(() => {
                                return res
                                  .status(400)
                                  .send('Credit note email failed to be sent');
                              });
                          } else {
                            if (invoice.clientName === 'EVIO') {
                              sendMobiEEmail(
                                invoice.userId,
                                invoiceData,
                                invoice.attach,
                                pdfBuffer,
                                invoice.emailUserId,
                              )
                                .then((info) => {
                                  let updateInvoice = {
                                    emailStatus: true,
                                  };

                                  let query = { _id: invoice._id };

                                  updateInvoiceDatabase(query, updateInvoice);

                                  return res
                                    .status(200)
                                    .send('Invoice email sent');
                                })
                                .catch(() => {
                                  return res
                                    .status(400)
                                    .send('Invoice email failed to be sent');
                                });
                            } else {
                              sendMobiEEmailWL(
                                invoiceData,
                                invoice.attach,
                                pdfBuffer,
                                invoice,
                                invoice.emailUserId,
                              )
                                .then((info) => {
                                  let updateInvoice = {
                                    emailStatus: true,
                                  };

                                  let query = { _id: invoice._id };

                                  updateInvoiceDatabase(query, updateInvoice);

                                  return res
                                    .status(200)
                                    .send('Invoice email sent');
                                })
                                .catch(() => {
                                  return res
                                    .status(400)
                                    .send('Invoice email failed to be sent');
                                });
                            }
                          }
                        }, i * 4 * 1000);
                      } else {
                        //Send Email Gireve
                        if (
                          invoice.chargerType ===
                            process.env.ChargerTypeGireve ||
                          invoice.chargerType === Enums.ChargerTypes.Hubject
                        ) {
                          setTimeout(function () {
                            if (invoice.clientName === 'EVIO') {
                              sendGireveEmail(
                                invoice.userId,
                                invoiceData,
                                invoice.attach,
                                pdfBuffer,
                                invoice.emailUserId,
                              )
                                .then((info) => {
                                  let updateInvoice = {
                                    emailStatus: true,
                                  };

                                  let query = { _id: invoice._id };

                                  updateInvoiceDatabase(query, updateInvoice);

                                  return res
                                    .status(200)
                                    .send('Invoice email sent');
                                })
                                .catch(() => {
                                  return res
                                    .status(400)
                                    .send('Invoice email failed to be sent');
                                });
                            } else {
                              sendGireveEmailWL(
                                invoiceData,
                                invoice.attach,
                                pdfBuffer,
                                invoice,
                                invoice.emailUserId,
                              )
                                .then((info) => {
                                  let updateInvoice = {
                                    emailStatus: true,
                                  };

                                  let query = { _id: invoice._id };

                                  updateInvoiceDatabase(query, updateInvoice);

                                  return res
                                    .status(200)
                                    .send('Invoice email sent');
                                })
                                .catch(() => {
                                  return res
                                    .status(400)
                                    .send('Invoice email failed to be sent');
                                });
                            }
                          }, i * 4 * 1000);
                        } else {
                          //Send Email EVIO
                          setTimeout(function () {
                            if (invoice.clientName === 'EVIO') {
                              sendEVIOEmail(
                                invoice.userId,
                                invoiceData,
                                invoice.attach,
                                pdfBuffer,
                                invoice.emailUserId,
                              )
                                .then((info) => {
                                  let updateInvoice = {
                                    emailStatus: true,
                                  };

                                  let query = { _id: invoice._id };

                                  updateInvoiceDatabase(query, updateInvoice);

                                  return res
                                    .status(200)
                                    .send('Invoice email sent');
                                })
                                .catch(() => {
                                  return res
                                    .status(400)
                                    .send('Invoice email failed to be sent');
                                });
                            } else {
                              sendEVIOEmailWL(
                                invoiceData,
                                invoice.attach,
                                pdfBuffer,
                                invoice,
                                invoice.emailUserId,
                              )
                                .then((info) => {
                                  let updateInvoice = {
                                    emailStatus: true,
                                  };

                                  let query = { _id: invoice._id };

                                  updateInvoiceDatabase(query, updateInvoice);

                                  return res
                                    .status(200)
                                    .send('Invoice email sent');
                                })
                                .catch(() => {
                                  return res
                                    .status(400)
                                    .send('Invoice email failed to be sent');
                                });
                            }
                          }, i * 4 * 1000);
                        }
                      }
                    })
                    .catch((error) => {
                      console.log('[Error] ' + error);
                      return res
                        .status(400)
                        .send(
                          'Failed to retrieve the invoice pdf from Magnifinance',
                        );
                    });
                } else {
                  console.log(
                    'Document ' + invoice.documentId + ' still processing',
                  );
                  return res
                    .status(400)
                    .send(
                      'Document ' + invoice.documentId + ' is still processing',
                    );
                }
              }
            }
          });
        } else {
          return res.status(400).send({
            auth: false,
            code: 'invoice_not_found',
            message: 'Invoice is not found',
          });
        }
      }
    });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

router.post('/api/private/billing/periodBilling', async (req, res, next) => {
  const context = 'POST /api/private/billing/periodBilling';

  try {
    const featureFlagEnabled = await toggle.isEnable(
      'foreign_invoice_deactivated_bp-54',
    );
    if (featureFlagEnabled && req.body.optionalCountryCodeToVAT !== 'PT') {
      console.log(
        `[${context}][FEATUREFLAG][foreign_invoice_deactivated_BP-54]`,
      );
      return res.status(StatusCodes.FORBIDDEN).send({
        code: 'foreign_invoice_deactivated',
        message: 'Foreign invoice deactivated',
      });
    }

    if (!req.body.invoice) {
      return res
        .status(400)
        .send({ code: 'invoice_missing', message: 'Invoice missing' });
    }

    if (!req.body.attach) {
      return res
        .status(400)
        .send({ code: 'attach_missing', message: 'Attach missing' });
    }

    if (!req.body.billingProfile) {
      return res.status(400).send({
        code: 'billing_profile_missing',
        message: 'billingProfile missing',
      });
    }

    let invoice = req.body.invoice;
    let attach = req.body.attach;
    let billingData = req.body.billingProfile;
    let paymentIdList = req.body.invoice.paymentIdList;
    let paymentId = req.body.invoice.paymentId;
    const optionalCountryCodeToVAT = req.body.optionalCountryCodeToVAT;

    if (await checkIfEVIOInvouce(invoice.header.userId)) {
      let response = await createEVIOInvoice(invoice, attach);
      if (response)
        if (response.invoiceId) return res.status(200).send(response);

      return res.status(500).send(response);
    }

    let emailUserId = [];
    if (req.body.emailUserId) {
      emailUserId = req.body.emailUserId;
      console.log('emailUserId');
      console.log(req.body.emailUserId);
    }

    let clientName = req.headers['clientname'];
    let ceme = req.headers['ceme'];

    console.log(invoice);

    checkIfPaymentIdWasAlreadyProcessed(paymentIdList)
      .then(async () => {
        if (billingData) {
          if (paymentId) {
            let emissionDate = moment.utc().format('YYYY-MM-DD');
            let dueDate = moment.utc().endOf('month').format('YYYY-MM-DD');
            let arg = await getPeriodBillingBudgetDocument(
              clientName,
              ceme,
              billingData,
              invoice,
              paymentId,
              dueDate,
              emissionDate,
              optionalCountryCodeToVAT,
            );

            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { _id: invoice._id },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            await saveInvoiceBeforeThirdParty(invoice, attach, arg);

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error `, err.response);

                let billing = {
                  emailUserId: emailUserId,
                  payments: invoice.lines,
                  paymentId: invoice.paymentId,
                  userId: invoice.header.userId,
                  type: process.env.budgetType,
                  status: process.env.failedStatus,
                  attach: attach,
                  billingType: process.env.monthlyType,
                  validationError: setValidationError(err, context),
                  startDate: invoice.billingPeriodDates.startDate,
                  endDate: invoice.billingPeriodDates.endDate,
                  dueDate: dueDate,
                  emissionDate: emissionDate,
                  clientName: clientName,
                  ceme: ceme,
                  authEmail: arg.Authentication.Email,
                  authToken: arg.Authentication.Token,
                  argData: arg,
                  billingProfile: billingData,
                };

                updateOrCreateInvoice(billing)
                  .then((result) => {
                    if (process.env.NODE_ENV === 'production') {
                      Utils.sendInvoiceFailureEmail(
                        result._id,
                        err,
                        billingData,
                      );
                    } else if (process.env.NODE_ENV === 'pre-production') {
                      Utils.sendInvoiceFailureEmail(
                        result._id,
                        err,
                        billingData,
                      );
                    }

                    return res.status(200).send({
                      invoiceId: result._id,
                      invoiceStatus: process.env.failedStatus,
                    });
                  })
                  .catch((error) => {
                    return res.status(500).send(error);
                  });
              } else {
                console.log(result.Response);

                if (result.Response.Type === 'Error') {
                  let billing = {
                    emailUserId: emailUserId,
                    payments: invoice.lines,
                    paymentId: invoice.paymentId,
                    userId: invoice.header.userId,
                    type: process.env.budgetType,
                    status: process.env.failedStatus,
                    attach: attach,
                    billingType: process.env.monthlyType,
                    validationError: result.Response,
                    startDate: invoice.billingPeriodDates.startDate,
                    endDate: invoice.billingPeriodDates.endDate,
                    dueDate: dueDate,
                    emissionDate: emissionDate,
                    clientName: clientName,
                    ceme: ceme,
                    authEmail: arg.Authentication.Email,
                    authToken: arg.Authentication.Token,
                    argData: arg,
                    billingProfile: billingData,
                  };

                  updateOrCreateInvoice(billing)
                    .then((result) => {
                      if (process.env.NODE_ENV === 'production') {
                        Utils.sendInvoiceFailureEmail(
                          result._id,
                          billing.validationError,
                          billingData,
                        );
                      } else if (process.env.NODE_ENV === 'pre-production') {
                        Utils.sendInvoiceFailureEmail(
                          result._id,
                          billing.validationError,
                          billingData,
                        );
                      }

                      return res.status(200).send({
                        invoiceId: result._id,
                        invoiceStatus: process.env.failedStatus,
                      });
                    })
                    .catch((error) => {
                      return res.status(500).send(error);
                    });
                }

                if (result.Response.Type === 'Success') {
                  let billing = {
                    emailUserId: emailUserId,
                    payments: invoice.lines,
                    paymentId: invoice.paymentId,
                    userId: invoice.header.userId,
                    documentId: result.Response.Object.DocumentId,
                    type: process.env.budgetType,
                    status: process.env.processingStatus,
                    attach: attach,
                    billingType: process.env.monthlyType,
                    startDate: invoice.billingPeriodDates.startDate,
                    endDate: invoice.billingPeriodDates.endDate,
                    dueDate: dueDate,
                    emissionDate: emissionDate,
                    clientName: clientName,
                    ceme: ceme,
                    authEmail: arg.Authentication.Email,
                    authToken: arg.Authentication.Token,
                    argData: arg,
                    billingProfile: billingData,
                  };

                  updateOrCreateInvoice(billing)
                    .then((result) => {
                      return res.status(200).send({
                        invoiceId: result._id,
                        invoiceStatus: process.env.processingStatus,
                      });
                    })
                    .catch((error) => {
                      return res.status(500).send(error);
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(invoice, result);
                  return res.status(200).send({
                    invoiceId: result._id,
                    invoiceStatus: process.env.unknownStatus,
                  });
                }
              }
            });

            // })
            // .catch((error) => {
            //     return res.status(500).send(error);
            // });
          } else {
            let dueDate = moment().format('YYYY-MM-DD');
            let emissionDate = moment().format('YYYY-MM-DD');
            const uuid4 = UUID.create();
            let arg = await getPeriodBillingDocument(
              clientName,
              ceme,
              billingData,
              invoice,
              uuid4.hex,
              dueDate,
              emissionDate,
              optionalCountryCodeToVAT,
            );

            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { _id: invoice._id },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }
            // createBillingDocument(billingData, invoice.lines, uuid4.hex, dueDate, emissionDate)
            //     .then((arg) => {

            await saveInvoiceBeforeThirdPartyPaymentIdList(
              invoice,
              attach,
              arg,
            );

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error `, err.response);

                let billing = {
                  emailUserId: emailUserId,
                  payments: invoice.lines,
                  userId: invoice.header.userId,
                  type: process.env.invoiceType,
                  status: process.env.failedStatus,
                  attach: attach,
                  validationError: setValidationError(err, context),
                  billingType: process.env.monthlyType,
                  paymentIdList: invoice.paymentIdList,
                  transactionId: uuid4.hex,
                  startDate: invoice.billingPeriodDates.startDate,
                  endDate: invoice.billingPeriodDates.endDate,
                  dueDate: dueDate,
                  emissionDate: emissionDate,
                  clientName: clientName,
                  ceme: ceme,
                  authEmail: arg.Authentication.Email,
                  authToken: arg.Authentication.Token,
                  argData: arg,
                  billingProfile: billingData,
                };

                updateOrCreateInvoice(billing)
                  .then((result) => {
                    if (process.env.NODE_ENV === 'production') {
                      Utils.sendInvoiceFailureEmail(
                        result._id,
                        err,
                        billingData,
                      );
                    } else if (process.env.NODE_ENV === 'pre-production') {
                      Utils.sendInvoiceFailureEmail(
                        result._id,
                        err,
                        billingData,
                      );
                    }

                    return res.status(200).send({
                      invoiceId: result._id,
                      invoiceStatus: process.env.failedStatus,
                    });
                  })
                  .catch((error) => {
                    return res.status(500).send(error);
                  });
              } else {
                if (result.Response.Type === 'Error') {
                  let billing = {
                    emailUserId: emailUserId,
                    payments: invoice.lines,
                    userId: invoice.header.userId,
                    type: process.env.invoiceType,
                    status: process.env.failedStatus,
                    attach: attach,
                    validationError: result.Response,
                    billingType: process.env.monthlyType,
                    paymentIdList: invoice.paymentIdList,
                    transactionId: uuid4.hex,
                    startDate: invoice.billingPeriodDates.startDate,
                    endDate: invoice.billingPeriodDates.endDate,
                    dueDate: dueDate,
                    emissionDate: emissionDate,
                    clientName: clientName,
                    ceme: ceme,
                    authEmail: arg.Authentication.Email,
                    authToken: arg.Authentication.Token,
                    argData: arg,
                    billingProfile: billingData,
                  };

                  updateOrCreateInvoice(billing)
                    .then((result) => {
                      if (process.env.NODE_ENV === 'production') {
                        Utils.sendInvoiceFailureEmail(
                          result._id,
                          billing.validationError,
                          billingData,
                        );
                      } else if (process.env.NODE_ENV === 'pre-production') {
                        Utils.sendInvoiceFailureEmail(
                          result._id,
                          billing.validationError,
                          billingData,
                        );
                      }

                      return res.status(200).send({
                        invoiceId: result._id,
                        invoiceStatus: process.env.failedStatus,
                      });
                    })
                    .catch((error) => {
                      return res.status(500).send(error);
                    });
                }

                if (result.Response.Type === 'Success') {
                  let billing = {
                    emailUserId: emailUserId,
                    payments: invoice.lines,
                    userId: invoice.header.userId,
                    documentId: result.Response.Object.DocumentId,
                    type: process.env.invoiceType,
                    status: process.env.processingStatus,
                    attach: attach,
                    billingType: process.env.monthlyType,
                    paymentIdList: invoice.paymentIdList,
                    transactionId: uuid4.hex,
                    startDate: invoice.billingPeriodDates.startDate,
                    endDate: invoice.billingPeriodDates.endDate,
                    dueDate: dueDate,
                    emissionDate: emissionDate,
                    clientName: clientName,
                    ceme: ceme,
                    authEmail: arg.Authentication.Email,
                    authToken: arg.Authentication.Token,
                    argData: arg,
                    billingProfile: billingData,
                  };

                  updateOrCreateInvoice(billing)
                    .then((result) => {
                      return res.status(200).send({
                        invoiceId: result._id,
                        invoiceStatus: process.env.processingStatus,
                      });
                    })
                    .catch((error) => {
                      return res.status(500).send(error);
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResultPaymentIdList(invoice, result);
                  return res.status(200).send({
                    invoiceId: result._id,
                    invoiceStatus: process.env.unknownStatus,
                  });
                }
              }
            });

            // })
            // .catch((error) => {
            //     return res.status(500).send(error);
            // });
          }
        } else {
          console.log(`[${context}][.then][find] Error`, error);
          return res.status(400).send({
            auth: false,
            code: 'billing_profile_failed',
            message: 'Failed to retrieve billing profile',
          });
        }

        // })
        // .catch((error) => {
        //     console.log(`[${context}][.then][find] Error`, error);
        //     return res.status(400).send({ auth: false, code: 'billing_profile_failed', message: "Failed to retrieve billing profile" });
        // });
      })
      .catch(() => {
        console.log(`[${context}][.then][find] Error`);
        return res.status(400).send({
          auth: false,
          code: 'invalid_invoice',
          message:
            'Monthly invoice already exists. At least 1 paymentId is already in another invoice',
        });
      });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

router.post(
  '/api/private/billing/reprocessBillingExcel',
  async (req, res, next) => {
    var context = 'POST /api/private/billing/reprocessBillingExcel';
    try {
      if (!req.body.invoiceId) {
        return res
          .status(400)
          .send({ code: 'invoice_missing', message: 'Invoice missing' });
      }

      if (!req.body.email) {
        return res
          .status(400)
          .send({ code: 'email_missing', message: 'email missing' });
      }

      if (!req.body.sheetName) {
        return res
          .status(400)
          .send({ code: 'sheet name_missing', message: 'sheet name missing' });
      }

      const invoice = await Invoice.findOne({ _id: req.body.invoiceId }).lean();

      // Fetch user to get its languageCode
      const user = await getUserById(invoice.userId);

      console.log('user: ', user);

      const language = user?.language ?? Constants.defaultLanguage;

      // Fetch language microservice to get translations to a specific languageCode
      const translations = await Utils.getTranslations(language);

      //Create Excel Buffer to attach
      const columns = Utils.createBillingPeriodExcelColumns(translations);

      let attachLines = invoice.attach.chargingSessions.lines;
      let sessions = attachLines
        .map((obj) => Object.values(obj)[0])
        .flat(1)
        .sort((a, b) => moment(a.startDateTime) - moment(b.startDateTime));
      // sessions = await Promise.all(sessions.map(async session => await addMissingUserInfo(session)))
      let inputSessions = [];
      for (let sessionI of sessions) {
        let pushSession = await addMissingUserInfo(sessionI);
        inputSessions.push(pushSession);
        // await sleep(2000)
      }
      const billingDates = {
        startDate: invoice.startDate,
        endDate: invoice.endDate,
        dueDate: invoice.dueDate,
        emissionDate: invoice.emissionDate,
      };

      const lines = mappingExcelLinesValues(
        inputSessions,
        invoice,
        billingDates,
      );
      const excelBuffer = await Utils.createExcelBuffer(
        req.body.sheetName,
        columns,
        lines,
      );

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

      let mailOptions = {
        source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
        from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
        to: req.body.email,
        subject: 'Reprocessamento Excel',
        text: 'EVIO - Reprocessamento Excel',
        html: '',
        attachments: [
          {
            filename:
              req.body.sheetName +
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
              return res.status(500).send('Email not sent: ' + error);
            } else {
              if (info) {
                return res.status(200).send('Email sent');
              }
            }
          });
        }
      });
    } catch (error) {
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error?.message);
    }
  },
);

router.post(
  '/api/private/billing/forceJobProcessFailedInvoices',
  async (req, res, next) => {
    var context = 'POST /api/private/billing/forceJobProcessFailedInvoices';
    try {
      processFailedInvoices();
      return res.status(200).send('Process failed invoices job started');
    } catch (error) {
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error?.message);
    }
  },
);

router.post(
  '/api/private/billing/reprocessAttachments',
  async (req, res, next) => {
    var context = 'POST /api/private/billing/reprocessAttachments';
    try {
      const {
        invoiceIds = [],
        test = true,
        testEmail = process.env.EVIOMAIL,
        reprocessInvoicePdf,
        reprocessSummaryPdf,
        reprocessExcel,
      } = req.body;

      InvoiceHandler.reprocessAttachments(
        invoiceIds,
        test,
        testEmail,
        reprocessInvoicePdf,
        reprocessSummaryPdf,
        reprocessExcel,
      );

      return res.status(200).send('Reprocessing invoices');
    } catch (error) {
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error.message);
    }
  },
);

//POST para atualizar o objecto se existir o _id ou criar um novo objeto factura
router.post(
  '/api/private/billing/reprocessAttachAtribute',
  async (req, res, next) => {
    const context = 'POST /api/private/billing/reprocessAttachAtribute';

    const featureFlagEnabled = await toggle.isEnable(
      'reprocess-attach-of-sessions-6739',
    );
    if (!featureFlagEnabled) {
      console.log(
        `[${context}][FEATUREFLAG][reprocess-attach-of-sessions-6739]`,
      );
      return res
        .status(403)
        .send({ code: 'feature_deactivated', message: 'Feature deactivated' });
    }

    try {
      const { invoice, attach, billingProfile, documentNumber } = req.body;

      let paymentIdList = invoice?.paymentIdList;
      let paymentId = invoice?.paymentId;

      let invoiceObject = new Invoice({
        paymentId: paymentId,
        paymentIdList: paymentIdList,
        userId: billingProfile.userId,
        clientName: billingProfile.clientName,
        type: billingProfile.invoiceWithoutPayment
          ? process.env.budgetType
          : process.env.invoiceType,
        billingType: process.env.monthlyType,
        documentNumber: documentNumber,
        status: process.env.createdStatus,
        attach: attach,
        billingProfile: billingProfile,
      });

      console.log('createInvoice');
      await Invoice.createInvoice(invoiceObject);
      return res.status(200).send(invoiceObject);
    } catch (error) {
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error.message);
    }
  },
);

//Job invoicesToHistory
router.post('/api/job/invoicesToHistory', async (req, res) => {
  var context = 'POST /api/job/invoicesToHistory';
  try {
    console.info(`[${context}]: ${new Date().toISOString()}`);
    invoicesToHistory();
    return res.status(StatusCodes.OK).send(`${context} - Job started`);
  } catch (error) {
    console.error(`[${context}] Error:`, error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send({ error: `${context} - An error occurred while processing` });
  }
});

function createBillingDocument(
  billingData,
  payments,
  paymentId,
  dueDate,
  emissionDate,
  optionalCountryCodeToVAT,
) {
  const context = 'FUNCTION createBillingDocument';
  return new Promise((resolve, reject) => {
    let documentDescription;
    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = 'EVIO Mobility';
    } else {
      documentDescription = 'EVIO Mobility-' + billingData.purchaseOrder;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let invoiceLine = {
          APIInvoicingProduct: {
            //Code: process.env.invoiceCode,
            //Description: process.env.invoiceDescription,
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };

        if (optionalCountryCodeToVAT) {
          invoiceLine.APIInvoicingProduct.TaxValueCountry =
            optionalCountryCodeToVAT;
        }

        if (payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode) {
          invoiceLine.APIInvoicingProduct.TaxExemptionReasonCode =
            payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode;
        }

        invoices.push(invoiceLine);
      });

      // let email = null;
      // let token = null;

      // if (process.env.NODE_ENV === 'production') {
      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      // }
      // else if (process.env.NODE_ENV === 'pre-production') {
      //     /*TODO change to prod when have key

      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      //     */
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }
      // else {
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }
      let { email, token } = getAuthenticationEmailCredentials();

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
          PublicEntity: billingData.publicEntity,
          CompanyTaxIdNumber: billingData.companyTaxIdNumber,
        },
        Document: {
          // Date: moment().format('YYYY-MM-DD'),
          Date: emissionDate,
          // DueDate: moment().format('YYYY-MM-DD'),
          DueDate: dueDate,
          Description: documentDescription,
          Type: 'T', //Fatura/Recibo   //Real 'T'
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      addSeriesToDocumentEVIO(arg, 'DOC');
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      console.log(`[${context}]Error`, error?.message);
      reject(error);
    }
  });
}

function createPublicNetworkBillingDocument(
  billingData,
  payments,
  paymentId,
  optionalCountryCodeToVAT,
) {
  let context = 'FUNCTION createPublicNetworkBillingDocument';
  return new Promise((resolve, reject) => {
    console.log(`${context} billingData `, billingData);

    let documentDescription;
    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = 'EVIO Mobility';
    } else {
      documentDescription = 'EVIO Mobility-' + billingData.purchaseOrder;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let paymentInfo = {
          payment: payment.unitPrice,
          iva: payment.vat,
        };

        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };

        if (optionalCountryCodeToVAT) {
          invoiceLine.APIInvoicingProduct.TaxValueCountry =
            optionalCountryCodeToVAT;
        }

        if (payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode) {
          invoiceLine.APIInvoicingProduct.TaxExemptionReasonCode =
            payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode;
        }
        invoices.push(invoiceLine);
      });

      // let email = null;
      // let token = null;

      // if (process.env.NODE_ENV === 'production') {
      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      // }
      // else if (process.env.NODE_ENV === 'pre-production') {
      //     /*TODO change to prod when have key

      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      //     */
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }
      // else {
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }

      let { email, token } = getAuthenticationEmailCredentials();

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          Date: moment().format('YYYY-MM-DD'),
          DueDate: moment().format('YYYY-MM-DD'),
          Description: documentDescription,
          Type: 'T', //Fatura/Recibo //Real 'T'
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      addSeriesToDocumentEVIO(arg, 'DOC');
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      console.log(`[${context}]Error`, error?.message);
      reject(error);
    }
  });
}

function createBudgetDocument(
  billingData,
  payments,
  paymentId = null,
  dueDate,
  emissionDate,
  optionalCountryCodeToVAT,
) {
  let context = 'FUNCTION createBudgetDocument';

  return new Promise((resolve, reject) => {
    let documentDescription;
    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = 'EVIO Mobility';
    } else {
      documentDescription = 'EVIO Mobility-' + billingData.purchaseOrder;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let paymentInfo = {
          payment: payment.unitPrice,
          iva: payment.vat,
        };

        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };

        if (optionalCountryCodeToVAT) {
          console.log(
            `[${context}] optionalCountryCodeToVAT`,
            optionalCountryCodeToVAT,
          );
          invoiceLine.APIInvoicingProduct.TaxValueCountry =
            optionalCountryCodeToVAT;
        }

        if (payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode) {
          invoiceLine.APIInvoicingProduct.TaxExemptionReasonCode =
            payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode;
        }

        invoices.push(invoiceLine);
      });

      // let email = null;
      // let token = null;

      // if (process.env.NODE_ENV === 'production') {
      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      // }
      // else if (process.env.NODE_ENV === 'pre-production') {
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }
      // else {
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }

      let { email, token } = getAuthenticationEmailCredentials();

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          // Date: moment().format('YYYY-MM-DD'),
          Date: emissionDate,
          // DueDate: moment.utc().endOf('month').format("DD/MM/YYYY"),
          DueDate: dueDate,
          Description: documentDescription,
          Type: 'I', //Fatura //Real 'I'
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      addSeriesToDocumentEVIO(arg, 'BUDGET');
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      console.log(`[${context}]Error`, error?.message);
      reject(error);
    }
  });
}

function taxValue(iva) {
  return iva * 100;
}

function updateOrCreateInvoice(invoiceInfo) {
  return new Promise((resolve, reject) => {
    const context = 'FUNCTION updateOrCreateInvoice';

    let query = {
      $and: [
        invoiceInfo?.paymentId ? { paymentId: invoiceInfo?.paymentId } : {},
        invoiceInfo?.paymentIdList
          ? { paymentIdList: invoiceInfo?.paymentIdList }
          : {},
        {
          $or: [
            { status: process.env.failedStatus },
            { status: process.env.beforeThirdPartyStatus },
          ],
        },
      ],
    };

    Invoice.updateInvoice(query, { $set: invoiceInfo }, (err, doc) => {
      if (doc != null) {
        console.log(`[${context}][updateOrCreateInvoice] Updated invoice`);
        resolve(doc);
      } else {
        query = {
          $and: [
            invoiceInfo?.paymentId ? { paymentId: invoiceInfo?.paymentId } : {},
            invoiceInfo?.paymentIdList
              ? { paymentIdList: invoiceInfo?.paymentIdList }
              : {},
            {
              $or: [
                { status: process.env.processingStatus },
                { status: process.env.createdStatus },
                { status: process.env.unknownStatus },
              ],
            },
          ],
        };

        //check if a invoice already exists for the paymentId
        Invoice.find(query, (error, invoices) => {
          if (error) {
            console.log(`[${context}][updateOrCreateInvoice] Error`, error);
            reject(error);
          } else {
            //no invoice created for the given paymentId, so creates a new invoice
            if (invoices.length === 0) {
              let invoice = new Invoice(invoiceInfo);

              Invoice.createInvoice(invoice, (error, result) => {
                if (error) {
                  console.log(
                    `[${context}][updateOrCreateInvoice] Error`,
                    error,
                  );
                  reject(error);
                } else {
                  if (result) {
                    console.log(`[${context}][updateOrCreateInvoice] Success`);
                    resolve(result);
                  } else {
                    console.log(
                      `[${context}][updateOrCreateInvoice] Failed to create invoice`,
                    );
                    reject('Failed to create invoice');
                  }
                }
              });
            } else {
              console.log(
                `[${context}][updateOrCreateInvoice] PaymentId already has an invoice`,
              );
              reject('PaymentId already has an invoice');
            }
          }
        });
      }
    });
  });
}

function createInvoice(invoiceInfo) {
  return new Promise((resolve, reject) => {
    var context = 'FUNCTION createInvoice';

    let invoice = new Invoice(invoiceInfo);

    Invoice.createInvoice(invoice, (error, result) => {
      if (error) {
        console.log(`[${context}][createInvoice] Error`, error);
        reject(error);
      } else {
        if (result) {
          console.log(`[${context}][createInvoice] Success`);
          resolve(result);
        } else {
          console.log(`[${context}][createInvoice] Failed to create invoice`);
          reject('Failed to create invoice');
        }
      }
    });
  });
}

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

function getProcessingBillings() {
  var context = 'FUNCTION getProcessingBillings';
  return new Promise((resolve, reject) => {
    let query = {
      $or: [
        { type: process.env.invoiceType },
        { type: process.env.budgetType },
        { type: process.env.creditNoteType },
      ],
      status: process.env.processingStatus,
      $or: [
        { clientName: { $exists: false } },
        { clientName: { $eq: process.env.evioClientName } },
      ],
    };

    Invoice.find(query, (err, billings) => {
      if (err) {
        console.log(`[${context}][find] Error `, err);
        reject(err);
      } else {
        if (billings.length === 0) {
          console.log('Invoices to process not found');
          resolve(false);
        } else {
          resolve(billings);
        }
      }
    });
  });
}

function sendMobiEEmail(userId, invoice, attach, pdfBuffer, emailUserId) {
  var context = 'FUNCTION sendMobiEEmail';
  return new Promise((resolve, reject) => {
    let params = {
      userId: userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        Utils.sendMobieInvoiceEmail(
          billingData,
          invoice,
          attach,
          pdfBuffer,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function sendBudgetDocumentToSupport(
  userId,
  invoice,
  attach,
  billingDates,
  pdfBuffer,
  emailUserId,
) {
  var context = 'FUNCTION sendBudgetDocumentToSupport';
  return new Promise((resolve, reject) => {
    let params = {
      userId: userId,
    };

    console.log('invoice');
    console.log(invoice);

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        Utils.sendBudgetDocumentoToSupport(
          billingData,
          invoice,
          attach,
          billingDates,
          pdfBuffer,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to Support');
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function sendMobiECreditNote(
  userId,
  invoice,
  invoiceNumber,
  attach,
  pdfBuffer,
  emailUserId,
) {
  var context = 'FUNCTION sendMobiECreditNote';
  return new Promise((resolve, reject) => {
    let params = {
      userId: userId,
    };

    console.log('FUNCTION sendMobiECreditNote');
    console.log('invoice');
    console.log(invoice);

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        Utils.sendMobiECreditNoteEmail(
          billingData,
          invoice,
          invoiceNumber,
          attach,
          pdfBuffer,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function sendEmailToSupport(
  userId,
  invoice,
  attach,
  billingDates,
  pdfBuffer,
  emailUserId,
) {
  var context = 'FUNCTION sendEmailToSupport';
  return new Promise((resolve, reject) => {
    let params = {
      userId: userId,
    };

    console.log('invoice');
    console.log(invoice);

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        Utils.sendBudgetDocumentoToSupport(
          billingData,
          invoice,
          attach,
          billingDates,
          pdfBuffer,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to Support');
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function sendEmail(userId, invoice, pdfBuffer, emailUserId) {
  var context = 'FUNCTION sendEmail';
  return new Promise((resolve, reject) => {
    console.log('FUNCTION sendEmail');
    console.log('invoice');
    console.log(invoice);

    let params = {
      userId: userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        Utils.sendInvoiceEmail(billingData, invoice, pdfBuffer, emailUserId)
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[getBillingProfile][.then][find] Error`, error);
        reject();
      });
  });
}

function sendGireveEmail(userId, invoice, attach, pdfBuffer, emailUserId) {
  var context = 'FUNCTION sendGireveEmail';
  return new Promise((resolve, reject) => {
    let params = {
      userId: userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        Utils.sendGireveInvoiceEmail(
          billingData,
          invoice,
          attach,
          pdfBuffer,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function sendEVIOEmail(userId, invoice, attach, pdfBuffer, emailUserId) {
  var context = 'FUNCTION sendEVIOEmail';
  return new Promise((resolve, reject) => {
    let params = {
      userId: userId,
    };

    console.log('FUNCTION sendEVIOEmail');
    console.log('invoice');
    console.log(invoice);

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        Utils.sendEVIOInvoiceEmail(
          billingData,
          invoice,
          attach,
          pdfBuffer,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[getBillingProfile][.then][find] Error`, error);
        reject();
      });
  });
}

function updatePaymentsModel(payments) {
  let list = [];
  payments.forEach((payment) => {
    let paymentModel = {
      unitPrice: payment.payment,
      vat: payment.iva,
      currency: payment.currency,
    };
    list.push(paymentModel);
  });
  return list;
}

function sendMonthlyEmail(
  userId,
  invoice,
  attach,
  billingDates,
  pdfBuffer,
  emailUserId,
) {
  var context = 'FUNCTION sendMonthlyEmail';
  return new Promise((resolve, reject) => {
    let params = {
      userId: userId,
    };

    console.log('FUNCTION sendMonthlyEmail');
    console.log('invoice');
    console.log(invoice);

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        Utils.sendMonthlyInvoiceEmail(
          billingData,
          invoice,
          attach,
          billingDates,
          pdfBuffer,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function downloadAndStorePDF(url, docTitle) {
  return new Promise((resolve, reject) => {
    var path = './pdf/';
    pdf2base64(url)
      .then((response) => {
        //console.log(response); //cGF0aC90by9maWxlLmpwZw==
        let file_path = path + docTitle + '.pdf';

        fs.writeFile(
          file_path,
          response,
          { encoding: 'base64' },
          function (err, result) {
            if (err) {
              console.log(`Error `, err.message);
              reject(err);
            } else {
              console.log('Success');
              resolve(response);
            }
          },
        );
      })
      .catch((error) => {
        console.log(`[downloadAndStorePDF] Error `, error?.message); //Exepection error....
        reject(error);
      });
  });
}

function getLocalPdfDocument(docTitle) {
  return new Promise((resolve, reject) => {
    var path = './pdf/' + docTitle;

    pdf2base64(path)
      .then((response) => {
        resolve(response);
      })
      .catch((error) => {
        console.log(error); //Exepection error....
        reject();
      });
  });
}

//Update processing invoices status
/*

I changed this timer since this is an asynchrounous task
and there's no need to keep the routine running every 2 minutes.

We were also, every few times, sending duplicate emails. Probably when the
services were a bit more slow and the routines would overlap each other since we send the emails every 4 seconds

*/
// Cron Schedule */30 * * * *
router.post('/api/job/checkProcessingBillings', async (req, res) => {
  const context = 'JOB /api/job/checkProcessingBillings';
  try {
    let { email, token } = getAuthenticationEmailCredentials();
    getProcessingBillings()
      .then((invoices) => {
        if (invoices) {
          for (let i = 0; i < invoices.length; i++) {
            const invoice = invoices[i];

            //Tipo Orçamento
            if (invoice.type === process.env.budgetType) {
              console.log('Budget document');

              const arg = {
                Authentication: {
                  Email: email,
                  Token: token,
                },
                DocumentId: invoice.documentId,
              };

              MagnifinanceClient.DocumentGet(arg, (err, result) => {
                if (err) {
                  console.log(`[GetProcessingBillings] Error `, err);
                } else {
                  let type = result.Response.Type;
                  if (type) {
                    if (type === 'Success') {
                      let object = result.Response.Object;

                      let invoiceData = {
                        documentNumber: object.DocumentNumber,
                        documentUrl: object.DownloadUrl,
                        chargerType: invoice.chargerType,
                        clientName: invoice.clientName,
                      };

                      let billingDates = {
                        startDate: invoice.startDate,
                        endDate: invoice.endDate,
                        dueDate: invoice.dueDate,
                        emissionDate: invoice.emissionDate,
                      };

                      if (!invoice.emailStatus) {
                        downloadAndStorePDF(object.DownloadUrl, invoice._id)
                          .then((pdfBuffer) => {
                            //Periodic budget billing type
                            setTimeout(function () {
                              sendBudgetDocumentToSupport(
                                invoice.userId,
                                invoiceData,
                                invoice.attach,
                                billingDates,
                                pdfBuffer,
                                invoice.emailUserId,
                              )
                                .then((info) => {
                                  let updateInvoice = {
                                    status: process.env.createdStatus,
                                    documentNumber: object.DocumentNumber,
                                    documentUrl: object.DownloadUrl,
                                    pdfDocumentName: invoice._id + '.pdf',
                                    invoiceDocumentName:
                                      info.invoiceDocumentName,
                                    summaryDocumentName:
                                      info.summaryDocumentName,
                                    emailStatus: true,
                                  };

                                  let query = { _id: invoice._id };

                                  updateInvoiceDatabase(query, updateInvoice);
                                  ExternalRequest.updateBillingHistory(invoice);
                                })
                                .catch(() => {
                                  let updateInvoice = {
                                    status: process.env.createdStatus,
                                    documentNumber: object.DocumentNumber,
                                    documentUrl: object.DownloadUrl,
                                    pdfDocumentName: invoice._id + '.pdf',
                                  };

                                  let query = { _id: invoice._id };

                                  updateInvoiceDatabase(query, updateInvoice)
                                  ExternalRequest.updateBillingHistory(invoice);
                                });
                            }, i * 3 * 1000);
                          })
                          .catch((error) => {
                            console.log('[Error] ' + error);
                          });
                      } else {
                        downloadAndStorePDF(
                          object.DownloadUrl,
                          invoice._id,
                        ).catch((error) => {
                          console.log('[Error] ' + error);
                        });

                        let updateInvoice = {
                          status: process.env.createdStatus,
                          documentNumber: object.DocumentNumber,
                          documentUrl: object.DownloadUrl,
                        };

                        let query = { _id: invoice._id };

                        updateInvoiceDatabase(query, updateInvoice);
                        ExternalRequest.updateBillingHistory(invoice);
                      }
                    } else {
                      console.log(
                        'Document ' + invoice.documentId + ' still processing',
                      );
                    }
                  }
                }
              });
            } else {
              const arg = {
                Authentication: {
                  Email: email,
                  Token: token,
                },
                DocumentId: invoice.documentId,
              };

              MagnifinanceClient.DocumentGet(arg, (err, result) => {
                if (err) {
                  console.log(`[GetProcessingBillings] Error `, err);
                } else {
                  let type = result.Response.Type;
                  if (type) {
                    if (type === 'Success') {
                      let object = result.Response.Object;

                      let invoiceData = {
                        documentNumber: object.DocumentNumber,
                        documentUrl: object.DownloadUrl,
                        chargerType: invoice.chargerType,
                        clientName: invoice.clientName,
                      };

                      if (!invoice.emailStatus) {
                        downloadAndStorePDF(object.DownloadUrl, invoice._id)
                          .then((pdfBuffer) => {
                            if (invoice.billingType == undefined) {
                              sendInvoiceEmail(
                                invoice,
                                invoiceData,
                                object,
                                i,
                                pdfBuffer,
                                invoice.emailUserId,
                              );
                            } else {
                              //AD_HOC billing type
                              if (
                                invoice.billingType == process.env.instantType
                              ) {
                                sendInvoiceEmail(
                                  invoice,
                                  invoiceData,
                                  object,
                                  i,
                                  pdfBuffer,
                                  invoice.emailUserId,
                                );
                              } else {
                                let billingDates = {
                                  startDate: invoice.startDate,
                                  endDate: invoice.endDate,
                                  dueDate: invoice.dueDate,
                                  emissionDate: invoice.emissionDate,
                                };
                                //MONTHLY billing type
                                setTimeout(function () {
                                  sendMonthlyEmail(
                                    invoice.userId,
                                    invoiceData,
                                    invoice.attach,
                                    billingDates,
                                    pdfBuffer,
                                    invoice.emailUserId,
                                  )
                                    .then((info) => {
                                      let updateInvoice = {
                                        status: process.env.createdStatus,
                                        documentNumber: object.DocumentNumber,
                                        documentUrl: object.DownloadUrl,
                                        pdfDocumentName: invoice._id + '.pdf',
                                        invoiceDocumentName:
                                          info.invoiceDocumentName,
                                        summaryDocumentName:
                                          info.summaryDocumentName,
                                        emailStatus: true,
                                      };

                                      let query = { _id: invoice._id };

                                      updateInvoiceDatabase(
                                        query,
                                        updateInvoice,
                                      );
                                      ExternalRequest.updateBillingHistory(invoice);
                                    })
                                    .catch(() => {
                                      let updateInvoice = {
                                        status: process.env.createdStatus,
                                        documentNumber: object.DocumentNumber,
                                        documentUrl: object.DownloadUrl,
                                        pdfDocumentName: invoice._id + '.pdf',
                                      };

                                      let query = { _id: invoice._id };

                                      updateInvoiceDatabase(
                                        query,
                                        updateInvoice,
                                      );
                                      ExternalRequest.updateBillingHistory(invoice);
                                    });
                                }, i * 3 * 1000);
                              }
                            }
                          })
                          .catch((error) => {
                            console.log('[Error] ' + error);
                          });
                      } else {
                        downloadAndStorePDF(
                          object.DownloadUrl,
                          invoice._id,
                        ).catch((error) => {
                          console.log('[Error] ' + error);
                        });

                        let updateInvoice = {
                          status: process.env.createdStatus,
                          documentNumber: object.DocumentNumber,
                          documentUrl: object.DownloadUrl,
                        };

                        let query = { _id: invoice._id };

                        updateInvoiceDatabase(query, updateInvoice);
                        ExternalRequest.updateBillingHistory(invoice);
                      }
                    } else {
                      console.log(
                        'Document ' + invoice.documentId + ' still processing',
                      );
                    }
                  }
                }
              });
            }
          }
        }
      })
      .catch((error) => {
        console.log(`[${context}] Error retrieving billings `, error);
      });
    return res.status(200).send('Job started');
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[${context}] Error `, error);
    return res.status(500).send(error);
  }
});

//Update failed invoices
cron.schedule('0 23 * * *', () => {
  processFailedInvoices();
});

function processFailedInvoices() {
  const context = 'FUNCTION processFailedInvoices';
  //check failed invoices created in the last 7 days
  let query = {
    //type: "invoice",
    status: process.env.failedStatus,
    createdAt: {
      $lt: new Date(),
      $gte: new Date(new Date().setDate(new Date().getDate() - 7)),
    },
  };

  Invoice.find(query, (err, invoices) => {
    if (err) {
      Sentry.captureException(err);
      console.log(`[${context}][find] Error `, err);
    }

    console.log(`[${context}] Invoices to Process - ${invoices?.length}`);

    if (!Array.isArray(invoices) || invoices.length === 0) {
      console.log('Failed invoices to process not found');
    } else {
      let promises = [];

      for (let i = 0; i < invoices.length; i++) {
        const invoice = invoices[i];

        setTimeout(() => {
          promises.push(
            new Promise((resolve, reject) => {
              if (invoice.type === process.env.budgetType) {
                processFailedBudgetDocumentEVIOWL(invoice)
                  .then(() => {
                    resolve();
                  })
                  .catch((error) => {
                    console.log(
                      `[${context}][processFailedBudgetDocumentEVIOWL] Error`,
                      error?.message,
                    );
                    resolve();
                  });
              } else if (invoice.paymentIdList.length > 0) {
                processFailedPeriodInvoice(invoice)
                  .then(() => {
                    resolve();
                  })
                  .catch((error) => {
                    console.log(
                      `[${context}][processFailedPeriodInvoice] Error`,
                      error?.message,
                    );
                    resolve();
                  });
              } else {
                if (invoice.clientName === process.env.evioClientName) {
                  if (invoice.chargerType === process.env.ChargerTypeMobiE) {
                    processFailedMobieDocument(invoice)
                      .then(() => {
                        resolve();
                      })
                      .catch(() => {
                        resolve();
                      });
                  } else if (
                    invoice.chargerType === process.env.ChargerTypeGireve ||
                    invoice.chargerType === Enums.ChargerTypes.Hubject
                  ) {
                    processFailedGireveDocument(invoice)
                      .then(() => {
                        resolve();
                      })
                      .catch(() => {
                        resolve();
                      });
                  } else {
                    processFailedEVIODocument(invoice)
                      .then(() => {
                        resolve();
                      })
                      .catch((error) => {
                        console.log(
                          `[${context}][processFailedEVIODocument] Error`,
                          error?.message,
                        );
                        resolve();
                      });
                  }
                } else {
                  //TODO
                  if (invoice.chargerType === process.env.ChargerTypeMobiE) {
                    processFailedMobieDocumentWL(invoice)
                      .then(() => {
                        resolve();
                      })
                      .catch(() => {
                        resolve();
                      });
                  } else if (
                    invoice.chargerType === process.env.ChargerTypeGireve ||
                    invoice.chargerType === Enums.ChargerTypes.Hubject
                  ) {
                    processFailedGireveDocumentWL(invoice)
                      .then(() => {
                        resolve();
                      })
                      .catch(() => {
                        resolve();
                      });
                  } else {
                    processFailedEVIODocumentWL(invoice)
                      .then(() => {
                        resolve();
                      })
                      .catch(() => {
                        resolve();
                      });
                  }
                }
              }
            }),
          );
        }, i * 30 * 1000);
      }

      Promise.all(promises)
        .then(() => {
          console.log('Update finished with success.');
        })
        .catch((error) => {
          Sentry.captureException(error);
          console.log('Process failed to update invoices');
        });
    }
  });
}

function processFailedMobieDocument(invoice) {
  var context = 'FUNCTION processFailedMobieDocument';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoice.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        processMobiEBillingDocument(
          billingData,
          invoice.payments,
          invoice.paymentId,
        )
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));

            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { paymentId: invoice.paymentId },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error `, err.response);

                let update = {
                  paymentId: invoice.paymentId,
                  status: process.env.failedStatus,
                  validationError: setValidationError(err, context),
                };

                updateOrCreateInvoice(update)
                  .then(() => {
                    console.log('Invoice failed to be created');
                    resolve();
                  })
                  .catch((error) => {
                    console.log(`[${context}] Error `, error.response);
                    reject();
                  });
              } else {
                if (result.Response.Type === 'Error') {
                  let update = {
                    paymentId: invoice.paymentId,
                    status: process.env.failedStatus,
                    validationError: result.Response,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (result.Response.Type === 'Success') {
                  let update = {
                    documentId: result.Response.Object.DocumentId,
                    paymentId: invoice.paymentId,
                    status: process.env.processingStatus,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log(
                        'Invoice ' +
                          invoice.paymentId +
                          ' updated with success',
                      );
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(update, result);
                  resolve();
                }
              }
            });
          })
          .catch((error) => {
            console.log(`[${context}][.then][find] Error`, error);
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function processFailedBudgetDocument(invoice) {
  var context = 'FUNCTION processFailedBudgetDocument';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoice.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        createBudgetDocument(
          billingData,
          invoice.payments,
          invoice.paymentId,
          invoice.dueDate,
          invoice.emissionDate,
        )
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));
            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { paymentId: invoice.paymentId },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error `, err.response);

                let update = {
                  paymentId: invoice.paymentId,
                  status: process.env.failedStatus,
                  validationError: setValidationError(err, context),
                };

                updateOrCreateInvoice(update)
                  .then(() => {
                    console.log('Invoice failed to be created');
                    resolve();
                  })
                  .catch((error) => {
                    console.log(`[${context}] Error `, error.response);
                    reject();
                  });
              } else {
                if (result.Response.Type === 'Error') {
                  let update = {
                    paymentId: invoice.paymentId,
                    status: process.env.failedStatus,
                    validationError: result.Response,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (result.Response.Type === 'Success') {
                  let update = {
                    documentId: result.Response.Object.DocumentId,
                    paymentId: invoice.paymentId,
                    status: process.env.processingStatus,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log(
                        'Invoice ' +
                          invoice.paymentId +
                          ' updated with success',
                      );
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(update, result);
                  resolve();
                }
              }
            });
          })
          .catch((error) => {
            console.log(`[${context}][.then][find] Error`, error);
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function processFailedBudgetDocumentEVIOWL(invoice) {
  let context = 'FUNCTION processFailedBudgetDocumentEVIOWL';
  return new Promise(async (resolve, reject) => {
    try {
      let params = {
        userId: invoice.userId,
      };

      let profileFound = await axios.get(billingProfileProxy, {
        params: params,
      });

      let billingData = profileFound.data;

      let emissionDate = moment.utc().format('YYYY-MM-DD');
      let dueDate = moment.utc().endOf('month').format('YYYY-MM-DD');
      let arg = await getPeriodBillingBudgetDocument(
        invoice.clientName,
        invoice.ceme,
        billingData,
        invoice,
        invoice.paymentId,
        dueDate,
        emissionDate,
      );

      try {
        let invoiceUpdated = await Invoice.findOneAndUpdate(
          { _id: invoice._id },
          { $set: { argData: arg } },
          { new: true },
        );
      } catch (error) {
        console.log(`[${context}][Invoice] Error`, error);
      }

      console.log(`[${context}] - Request body Magnifinance`);
      console.log('arg', JSON.stringify(arg));

      await saveInvoiceBeforeThirdParty(invoice, invoice.attach, arg);

      MagnifinanceClient.DocumentCreate(arg, async (err, result) => {
        if (err) {
          console.log(`[${context}] Error `, err.response);

          let billing = {
            payments: invoice.payments,
            paymentId: invoice.paymentId,
            userId: invoice.header.userId,
            type: process.env.budgetType,
            status: process.env.failedStatus,
            attach: invoice.attach,
            billingType: process.env.monthlyType,
            validationError: setValidationError(err, context),
            startDate: invoice.startDate,
            endDate: invoice.endDate,
            dueDate: dueDate,
            emissionDate: emissionDate,
            clientName: invoice.clientName,
            ceme: invoice.ceme,
            authEmail: arg.Authentication.Email,
            authToken: arg.Authentication.Token,
            argData: arg,
          };

          let resultInvoice = await updateOrCreateInvoice(billing);

          if (process.env.NODE_ENV === 'production') {
            Utils.sendInvoiceFailureEmail(resultInvoice._id, err, billingData);
          } else if (process.env.NODE_ENV === 'pre-production') {
            Utils.sendInvoiceFailureEmail(resultInvoice._id, err, billingData);
          }

          resolve();
        } else {
          console.log(`[${context}] `, result.Response);

          if (result.Response.Type === 'Error') {
            let billing = {
              payments: invoice.payments,
              paymentId: invoice.paymentId,
              userId: invoice.header ? invoice.header.userId : invoice.userId,
              type: process.env.budgetType,
              status: process.env.failedStatus,
              attach: invoice.attach,
              billingType: process.env.monthlyType,
              validationError: result.Response,
              startDate: invoice.startDate,
              endDate: invoice.endDate,
              dueDate: dueDate,
              emissionDate: emissionDate,
              clientName: invoice.clientName,
              ceme: invoice.ceme,
              authEmail: arg.Authentication.Email,
              authToken: arg.Authentication.Token,
              argData: arg,
            };

            let resultInvoice = await updateOrCreateInvoice(billing);

            if (process.env.NODE_ENV === 'production') {
              Utils.sendInvoiceFailureEmail(
                resultInvoice._id,
                billing.validationError,
                billingData,
              );
            } else if (process.env.NODE_ENV === 'pre-production') {
              Utils.sendInvoiceFailureEmail(
                resultInvoice._id,
                billing.validationError,
                billingData,
              );
            }

            resolve();
          }

          if (result.Response.Type === 'Success') {
            let billing = {
              payments: invoice.payments,
              paymentId: invoice.paymentId,
              userId: invoice.header ? invoice.header.userId : invoice.userId,
              documentId: result.Response.Object.DocumentId,
              type: process.env.budgetType,
              status: process.env.processingStatus,
              attach: invoice.attach,
              billingType: process.env.monthlyType,
              startDate: invoice.startDate,
              endDate: invoice.endDate,
              dueDate: dueDate,
              emissionDate: emissionDate,
              clientName: invoice.clientName,
              ceme: invoiceceme,
              authEmail: arg.Authentication.Email,
              authToken: arg.Authentication.Token,
              argData: arg,
            };

            await updateOrCreateInvoice(billing);

            resolve();
          }

          if (
            result.Response.Type !== 'Success' &&
            result.Response.Type !== 'Error'
          ) {
            saveThirdPartyUnknownResult(invoice, result);
            return res.status(200).send({
              invoiceId: result._id,
              invoiceStatus: process.env.unknownStatus,
            });
          }
        }
      });
    } catch (error) {
      console.log(`[${context}]`, error?.message);
      reject(error);
    }
  });
}

function processFailedPeriodInvoice(invoice) {
  let context = 'FUNCTION processFailedPeriodInvoice';
  return new Promise(async (resolve, reject) => {
    try {
      let params = {
        userId: invoice.userId,
      };

      let profileFound = await axios.get(billingProfileProxy, {
        params: params,
      });
      let billingData = profileFound.data;

      let dueDate = moment().format('YYYY-MM-DD');
      let emissionDate = moment().format('YYYY-MM-DD');
      // const uuid4 = UUID.create();
      let paymentId = invoice?.argData?.Document?.ExternalId;
      let arg = await getPeriodBillingDocument(
        invoice.clientName,
        invoice.ceme,
        billingData,
        invoice,
        paymentId,
        dueDate,
        emissionDate,
      );
      try {
        let invoiceUpdated = await Invoice.findOneAndUpdate(
          { _id: invoice._id },
          { $set: { argData: arg } },
          { new: true },
        );
      } catch (error) {
        console.log(`[${context}][Invoice] Error`, error);
      }

      console.log('Request body Magnifinance');
      console.log('ARG', JSON.stringify(arg));
      await saveInvoiceBeforeThirdPartyPaymentIdList(
        invoice,
        invoice.attach,
        arg,
      );

      MagnifinanceClient.DocumentCreate(arg, async (err, result) => {
        if (err) {
          console.log(`[${context}] Error `, err.response);

          let billing = {
            payments: invoice.payments,
            userId: invoice.header ? invoice.header.userId : invoice.userId,
            type: process.env.invoiceType,
            status: process.env.failedStatus,
            attach: invoice.attach,
            validationError: setValidationError(err, context),
            billingType: process.env.monthlyType,
            paymentIdList: invoice.paymentIdList,
            transactionId: paymentId,
            startDate: invoice.startDate,
            endDate: invoice.endDate,
            dueDate: dueDate,
            emissionDate: emissionDate,
            clientName: invoice.clientName,
            ceme: invoice.ceme,
            authEmail: arg.Authentication.Email,
            authToken: arg.Authentication.Token,
            argData: arg,
          };

          let resultInvoice = await updateOrCreateInvoice(billing);

          if (process.env.NODE_ENV === 'production') {
            Utils.sendInvoiceFailureEmail(resultInvoice._id, err, billingData);
          } else if (process.env.NODE_ENV === 'pre-production') {
            Utils.sendInvoiceFailureEmail(resultInvoice._id, err, billingData);
          }

          resolve();
        } else {
          if (result.Response.Type === 'Error') {
            let billing = {
              payments: invoice.payments,
              userId: invoice.header ? invoice.header.userId : invoice.userId,
              type: process.env.invoiceType,
              status: process.env.failedStatus,
              attach: invoice.attach,
              validationError: result.Response,
              billingType: process.env.monthlyType,
              paymentIdList: invoice.paymentIdList,
              transactionId: paymentId,
              startDate: invoice.startDate,
              endDate: invoice.endDate,
              dueDate: dueDate,
              emissionDate: emissionDate,
              clientName: invoice.clientName,
              ceme: invoice.ceme,
              authEmail: arg.Authentication.Email,
              authToken: arg.Authentication.Token,
              argData: arg,
            };

            let resultInvoice = await updateOrCreateInvoice(billing);

            if (process.env.NODE_ENV === 'production') {
              Utils.sendInvoiceFailureEmail(
                resultInvoice._id,
                billing.validationError,
                billingData,
              );
            } else if (process.env.NODE_ENV === 'pre-production') {
              Utils.sendInvoiceFailureEmail(
                resultInvoice._id,
                billing.validationError,
                billingData,
              );
            }

            resolve();
          } else if (result.Response.Type === 'Success') {
            let billing = {
              payments: invoice.payments,
              userId: invoice.header ? invoice.header.userId : invoice.userId,
              documentId: result.Response.Object.DocumentId,
              type: process.env.invoiceType,
              status: process.env.processingStatus,
              attach: invoice.attach,
              billingType: process.env.monthlyType,
              paymentIdList: invoice.paymentIdList,
              transactionId: paymentId,
              startDate: invoice.startDate,
              endDate: invoice.endDate,
              dueDate: dueDate,
              emissionDate: emissionDate,
              clientName: invoice.clientName,
              ceme: invoice.ceme,
              authEmail: arg.Authentication.Email,
              authToken: arg.Authentication.Token,
              argData: arg,
            };

            updateOrCreateInvoice(billing);

            resolve();
          } else {
            let billing = {
              payments: invoice.payments,
              userId: invoice.header ? invoice.header.userId : invoice.userId,
              type: process.env.invoiceType,
              status: process.env.failedStatus,
              attach: invoice.attach,
              validationError: result.Response,
              billingType: process.env.monthlyType,
              paymentIdList: invoice.paymentIdList,
              transactionId: paymentId,
              startDate: invoice.startDate,
              endDate: invoice.endDate,
              dueDate: dueDate,
              emissionDate: emissionDate,
              clientName: invoice.clientName,
              ceme: invoice.ceme,
              authEmail: arg.Authentication.Email,
              authToken: arg.Authentication.Token,
              argData: arg,
            };

            let resultInvoice = await updateOrCreateInvoice(billing);

            if (process.env.NODE_ENV === 'production') {
              Utils.sendInvoiceFailureEmail(
                resultInvoice._id,
                billing.validationError,
                billingData,
              );
            } else if (process.env.NODE_ENV === 'pre-production') {
              Utils.sendInvoiceFailureEmail(
                resultInvoice._id,
                billing.validationError,
                billingData,
              );
            }

            resolve();
          }
        }
      });
    } catch (error) {
      console.log(`[${context}]`, error?.message);
      reject(error);
    }
  });
}

function processFailedPeriodDocument(invoice) {
  var context = 'FUNCTION processFailedPeriodDocument';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoice.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        createBillingDocument(
          billingData,
          invoice.payments,
          invoice.transactionId,
          invoice.dueDate,
          invoice.emissionDate,
        )
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));
            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { _id: invoice._id },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            let query = { _id: invoice._id };
            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error `, err.response);

                let update = {
                  transactionId: invoice.transactionId,
                  status: process.env.failedStatus,
                  validationError: setValidationError(err, context),
                  argData: arg,
                };

                updateInvoiceDatabase(query, update)
                  .then(() => {
                    console.log('Invoice failed to be created');
                    resolve();
                  })
                  .catch((error) => {
                    console.log(`[${context}] Error `, error.response);
                    reject();
                  });
              } else {
                if (result.Response.Type === 'Error') {
                  let update = {
                    transactionId: invoice.transactionId,
                    status: process.env.failedStatus,
                    validationError: result.Response,
                    argData: arg,
                  };

                  updateInvoiceDatabase(query, update)
                    .then(() => {
                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (result.Response.Type === 'Success') {
                  let update = {
                    documentId: result.Response.Object.DocumentId,
                    transactionId: invoice.transactionId,
                    status: process.env.processingStatus,
                    argData: arg,
                  };

                  updateInvoiceDatabase(query, update)
                    .then(() => {
                      console.log(
                        'Invoice ' +
                          invoice.transactionId +
                          ' updated with success',
                      );
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(update, result);
                  resolve();
                }
              }
            });
          })
          .catch((error) => {
            console.log(`[${context}][.then][find] Error`, error);
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function createMobiECreditNote(invoice) {
  var context = 'FUNCTION createMobieCreditNote';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoice.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        createMobiECreditNoteDocument(billingData, invoice.payments)
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));
            // try {
            //     let invoiceUpdated = await Invoice.findOneAndUpdate({ _id: invoice._id }, { $set: { argData: arg } }, { new: true })
            // } catch (error) {
            //     console.log(`[${context}][Invoice] Error`, error);
            // }
            await saveInvoiceBeforeThirdParty(invoice, invoice.attach, arg);

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error `, err.response);

                let billing = {
                  payments: invoice.payments,
                  userId: invoice.userId,
                  chargerType: invoice.chargerType,
                  type: process.env.creditNoteType,
                  paymentId: invoice.paymentId,
                  status: process.env.failedStatus,
                  attach: invoice.attach,
                  invoiceNumber: invoice.documentNumber,
                  validationError: setValidationError(err, context),
                  argData: arg,
                  creditedInvoice: invoice._id,
                  billingType: invoice.billingType,
                  startDate: invoice.startDate,
                  endDate: invoice.endDate,
                  dueDate: invoice.dueDate,
                  emissionDate: invoice.emissionDate,
                  clientName: invoice.clientName,
                  ceme: invoice.ceme,
                  authEmail: invoice.authEmail,
                  authToken: invoice.authToken,
                };

                updateOrCreateInvoice(billing)
                  .then((result) => {
                    if (process.env.NODE_ENV === 'production') {
                      Utils.sendInvoiceFailureEmail(
                        result._id,
                        err,
                        billingData,
                      );
                    } else if (process.env.NODE_ENV === 'pre-production') {
                      Utils.sendInvoiceFailureEmail(
                        result._id,
                        err,
                        billingData,
                      );
                    }

                    console.log('Invoice failed to be created');
                    resolve();
                  })
                  .catch((error) => {
                    console.log(`[${context}] Error `, error.response);
                    reject();
                  });
              } else {
                if (result.Response.Type === 'Error') {
                  let billing = {
                    payments: invoice.payments,
                    userId: invoice.userId,
                    chargerType: invoice.chargerType,
                    type: process.env.creditNoteType,
                    paymentId: invoice.paymentId,
                    status: process.env.failedStatus,
                    attach: invoice.attach,
                    invoiceNumber: invoice.documentNumber,
                    validationError: result.Response,
                    argData: arg,
                    creditedInvoice: invoice._id,
                    billingType: invoice.billingType,
                    startDate: invoice.startDate,
                    endDate: invoice.endDate,
                    dueDate: invoice.dueDate,
                    emissionDate: invoice.emissionDate,
                    clientName: invoice.clientName,
                    ceme: invoice.ceme,
                    authEmail: invoice.authEmail,
                    authToken: invoice.authToken,
                  };

                  updateOrCreateInvoice(billing)
                    .then((result) => {
                      if (process.env.NODE_ENV === 'production') {
                        Utils.sendInvoiceFailureEmail(
                          result._id,
                          result.Response,
                          billingData,
                        );
                      } else if (process.env.NODE_ENV === 'pre-production') {
                        Utils.sendInvoiceFailureEmail(
                          result._id,
                          result.Response,
                          billingData,
                        );
                      }

                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (result.Response.Type === 'Success') {
                  let billing = {
                    payments: invoice.payments,
                    userId: invoice.userId,
                    chargerType: invoice.chargerType,
                    type: process.env.creditNoteType,
                    paymentId: invoice.paymentId,
                    status: process.env.processingStatus,
                    documentId: result.Response.Object.DocumentId,
                    invoiceNumber: invoice.documentNumber,
                    attach: invoice.attach,
                    argData: arg,
                    creditedInvoice: invoice._id,
                    billingType: invoice.billingType,
                    startDate: invoice.startDate,
                    endDate: invoice.endDate,
                    dueDate: invoice.dueDate,
                    emissionDate: invoice.emissionDate,
                    clientName: invoice.clientName,
                    ceme: invoice.ceme,
                    authEmail: invoice.authEmail,
                    authToken: invoice.authToken,
                  };

                  updateOrCreateInvoice(billing)
                    .then((result) => {
                      console.log(
                        'Invoice ' +
                          billing.paymentId +
                          ' updated with success',
                      );
                      // Atualizar nos payments o invoiceStatus
                      resolve();
                      //return res.status(200).send({ invoiceId: result._id, invoiceStatus: process.env.processingStatus });
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(invoice, result);
                  resolve();
                }
              }
            });
          })
          .catch((error) => {
            console.log(`[${context}][.then][find] Error`, error);
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function processFailedEVIODocument(invoice) {
  var context = 'FUNCTION processFailedEVIODocument';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoice.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        processEVIOBillingDocument(
          billingData,
          invoice.payments,
          invoice.paymentId,
        )
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));
            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { paymentId: invoice.paymentId },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error2 `, err.response);

                let update = {
                  paymentId: invoice.paymentId,
                  status: process.env.failedStatus,
                  validationError: setValidationError(err, context),
                };

                updateOrCreateInvoice(update)
                  .then(() => {
                    console.log('Invoice failed to be created');
                    resolve();
                  })
                  .catch((error) => {
                    console.log(`[${context}] Error `, error.response);
                    reject();
                  });
              } else {
                if (result.Response.Type === 'Error') {
                  let update = {
                    paymentId: invoice.paymentId,
                    status: process.env.failedStatus,
                    validationError: result.Response,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (result.Response.Type === 'Success') {
                  let update = {
                    documentId: result.Response.Object.DocumentId,
                    paymentId: invoice.paymentId,
                    status: process.env.processingStatus,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log(
                        'Invoice ' +
                          invoice.paymentId +
                          ' updated with success',
                      );
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(update, result);
                  resolve();
                }
              }
            });
          })
          .catch((error) => {
            return res.status(500).send(error);
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function createMobiECreditNoteDocument(billingData, payments) {
  return new Promise((resolve, reject) => {
    let documentDescription;
    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = 'EVIO Mobility';
    } else {
      documentDescription = 'EVIO Mobility-' + billingData.purchaseOrder;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let paymentInfo = {
          payment: payment.unitPrice,
          iva: payment.vat,
        };

        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };
        invoices.push(invoiceLine);
      });

      // let email = null;
      // let token = null;

      // if (process.env.NODE_ENV === 'production') {
      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      // }
      // else if (process.env.NODE_ENV === 'pre-production') {
      //     /*TODO change to prod when have key

      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      //     */
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }
      // else {
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }

      let { email, token } = getAuthenticationEmailCredentials();

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          Date: moment().format('YYYY-MM-DD'),
          DueDate: moment().format('YYYY-MM-DD'),
          Description: documentDescription,
          Type: 'C', //Credit note //Real 'C'
          Lines: invoices,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      //addSeriesToDocumentEVIO(arg, "NOTE")
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      reject(error);
    }
  });
}

function processFailedGireveDocument(invoice) {
  var context = 'FUNCTION processFailedGireveDocument';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoice.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        processGireveBillingDocument(
          billingData,
          invoice.payments,
          invoice.paymentId,
        )
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));
            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { paymentId: invoice.paymentId },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error2 `, err.response);

                let update = {
                  paymentId: invoice.paymentId,
                  status: process.env.failedStatus,
                  validationError: setValidationError(err, context),
                };

                updateOrCreateInvoice(update)
                  .then(() => {
                    console.log('Invoice failed to be created');
                    resolve();
                  })
                  .catch((error) => {
                    console.log(`[${context}] Error `, error.response);
                    reject();
                  });
              } else {
                if (result.Response.Type === 'Error') {
                  let update = {
                    paymentId: invoice.paymentId,
                    status: process.env.failedStatus,
                    validationError: result.Response,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (result.Response.Type === 'Success') {
                  let update = {
                    documentId: result.Response.Object.DocumentId,
                    paymentId: invoice.paymentId,
                    status: process.env.processingStatus,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log(
                        'Invoice ' +
                          invoice.paymentId +
                          ' updated with success',
                      );
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(update, result);
                  resolve();
                }
              }
            });
          })
          .catch((error) => {
            return res.status(500).send(error);
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function processEVIOBillingDocument(
  billingData,
  payments,
  paymentId,
  optionalCountryCodeToVAT,
) {
  return new Promise((resolve, reject) => {
    let documentDescription;
    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = 'EVIO Mobility';
    } else {
      documentDescription = 'EVIO Mobility-' + billingData.purchaseOrder;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };
        if (optionalCountryCodeToVAT) {
          invoiceLine.APIInvoicingProduct.TaxValueCountry =
            optionalCountryCodeToVAT;
        }

        if (payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode) {
          invoiceLine.APIInvoicingProduct.TaxExemptionReasonCode =
            payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode;
        }

        invoices.push(invoiceLine);
      });

      // let email = null;
      // let token = null;

      // if (process.env.NODE_ENV === 'production') {
      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      // }
      // else if (process.env.NODE_ENV === 'pre-production') {
      //     /*TODO change to prod when have key

      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      //     */
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }
      // else {
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }

      let { email, token } = getAuthenticationEmailCredentials();

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          Date: moment().format('YYYY-MM-DD'),
          DueDate: moment().format('YYYY-MM-DD'),
          Description: documentDescription,
          Type: 'T', //Fatura/Recibo //Real 'T'
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      addSeriesToDocumentEVIO(arg, 'DOC');
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      reject(error);
    }
  });
}

function processMobiEBillingDocument(billingData, payments, paymentId) {
  return new Promise((resolve, reject) => {
    let documentDescription;
    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = 'EVIO Mobility';
    } else {
      documentDescription = 'EVIO Mobility-' + billingData.purchaseOrder;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };
        invoices.push(invoiceLine);
      });

      // let email = null;
      // let token = null;

      // if (process.env.NODE_ENV === 'production') {
      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      // }
      // else if (process.env.NODE_ENV === 'pre-production') {
      //     /*TODO change to prod when have key

      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      //     */
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }
      // else {
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }

      let { email, token } = getAuthenticationEmailCredentials();

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          Date: moment().format('YYYY-MM-DD'),
          DueDate: moment().format('YYYY-MM-DD'),
          Description: documentDescription,
          Type: 'T', //Fatura/Recibo //Real 'T'
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      addSeriesToDocumentEVIO(arg, 'DOC');
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      reject(error);
    }
  });
}

function processGireveBillingDocument(billingData, payments, paymentId) {
  return new Promise((resolve, reject) => {
    let documentDescription;
    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = 'EVIO Mobility';
    } else {
      documentDescription = 'EVIO Mobility-' + billingData.purchaseOrder;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };
        invoices.push(invoiceLine);
      });

      // let email = null;
      // let token = null;

      // if (process.env.NODE_ENV === 'production') {
      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      // }
      // else if (process.env.NODE_ENV === 'pre-production') {
      //     /*TODO change to prod when have key

      //     email = process.env.userEmailPRD;
      //     token = process.env.companyTokenPRD;
      //     */
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }
      // else {
      //     email = process.env.userEmailQA;
      //     token = process.env.companyTokenQA;
      // }

      let { email, token } = getAuthenticationEmailCredentials();

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          Date: moment().format('YYYY-MM-DD'),
          DueDate: moment().format('YYYY-MM-DD'),
          Description: documentDescription,
          Type: 'T', //Fatura/Recibo //Real 'T'
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      addSeriesToDocumentEVIO(arg, 'DOC');
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      reject(error);
    }
  });
}

function checkIfInvoiceAlreadyExists(paymentId) {
  return new Promise((resolve, reject) => {
    var context = 'FUNCTION checkIfInvoiceAlreadyExists';

    /*let query = {
            paymentId: paymentId,
        }*/

    let query = {
      $or: [{ paymentId: paymentId }, { paymentIdList: paymentId }],
    };

    //check if a invoice already exists for the paymentId
    Invoice.findOne(query, (error, invoice) => {
      if (error) {
        console.log(`[${context}][checkIfInvoiceAlreadyExists] Error`, error);
        reject(error);
      } else {
        if (invoice) {
          reject();
        } else {
          resolve();
        }
      }
    });
  });
}

function checkIfPaymentIdWasAlreadyProcessed(paymentIdList) {
  return new Promise((resolve, reject) => {
    var context = 'FUNCTION checkIfPaymentIdWasAlreadyProcessed';

    let processFlag = false;
    let promises = [];

    for (let index = 0; index < paymentIdList.length; index++) {
      const paymentId = paymentIdList[index];

      promises.push(
        new Promise(function (resolve, reject) {
          /*$and: [
                    {
                        $or: [
                            { status: process.env.processingStatus },
                            { status: process.env.createdStatus }
                        ]
                    },
                    {
                        $or: [
                            { paymentId: paymentId },
                            { paymentIdList: paymentId }
                        ]
                    }
                ]*/

          let query = {
            $or: [{ paymentId: paymentId }, { paymentIdList: paymentId }],
          };

          Invoice.findOne(query, (err, invoice) => {
            if (err) {
              console.log(`[${context}][find] Error `, err);
              reject(err);
            } else {
              if (invoice) {
                processFlag = true;
                resolve();
              } else {
                resolve();
              }
            }
          });
        }),
      );
    }

    Promise.all(promises)
      .then(() => {
        if (processFlag === false) {
          console.log('Invoice paymentIdList is unique');
          resolve();
        } else {
          console.log(
            'Invoice paymentIdList is not unique. At least 1 paymentId was already processed',
          );
          reject();
        }
      })
      .catch(() => {
        console.log('Invoice paymentIdList is not unique');
        reject();
      });
  });
}

//addBillingType();
function addBillingType() {
  var context = 'PATCH addBillingType';
  Invoice.updateMany(
    {},
    { $set: { billingType: process.env.instantType } },
    (err, result) => {
      if (err) {
        console.log(`[${context}] Error `, err.message);
      } else {
        console.log('result', result);
      }
    },
  );
}

function sendInvoiceEmail(
  invoice,
  invoiceData,
  object,
  i,
  pdfBuffer,
  emailUserId,
) {
  //Send Email Mobie
  if (!invoice.chargerType && invoice.billingType == process.env.monthlyType) {
    let billingDates = {
      startDate: invoice.startDate,
      endDate: invoice.endDate,
      dueDate: invoice.dueDate,
      emissionDate: invoice.emissionDate,
    };

    sendMonthlyEmail(
      invoice.userId,
      invoiceData,
      invoice.attach,
      billingDates,
      pdfBuffer,
      invoice.emailUserId,
    )
      .then((info) => {
        let updateInvoice = {
          status: process.env.createdStatus,
          documentNumber: object.DocumentNumber,
          documentUrl: object.DownloadUrl,
          pdfDocumentName: invoice._id + '.pdf',
          invoiceDocumentName: info.invoiceDocumentName,
          summaryDocumentName: info.summaryDocumentName,
          emailStatus: true,
        };

        let query = { _id: invoice._id };

        updateInvoiceDatabase(query, updateInvoice);
      })
      .catch(() => {
        let updateInvoice = {
          status: process.env.createdStatus,
          documentNumber: object.DocumentNumber,
          documentUrl: object.DownloadUrl,
          pdfDocumentName: invoice._id + '.pdf',
        };

        let query = { _id: invoice._id };

        updateInvoiceDatabase(query, updateInvoice);
      });
  } else if (invoice.chargerType === process.env.ChargerTypeMobiE) {
    setTimeout(function () {
      if (invoice.type === process.env.creditNoteType) {
        sendMobiECreditNote(
          invoice.userId,
          invoiceData,
          invoice.invoiceNumber,
          invoice.attach,
          pdfBuffer,
          emailUserId,
        )
          .then((info) => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
              invoiceDocumentName: info.invoiceDocumentName,
              summaryDocumentName: info.summaryDocumentName,
              emailStatus: true,
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          })
          .catch(() => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          });
      } else {
        sendMobiEEmail(
          invoice.userId,
          invoiceData,
          invoice.attach,
          pdfBuffer,
          invoice.emailUserId,
        )
          .then((info) => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
              invoiceDocumentName: info.invoiceDocumentName,
              summaryDocumentName: info.summaryDocumentName,
              emailStatus: true,
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          })
          .catch(() => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          });
      }
    }, i * 4 * 1000);
  } else {
    //Send Email Gireve
    if (
      invoice.chargerType === process.env.ChargerTypeGireve ||
      invoice.chargerType === Enums.ChargerTypes.Hubject
    ) {
      setTimeout(function () {
        sendGireveEmail(
          invoice.userId,
          invoiceData,
          invoice.attach,
          pdfBuffer,
          invoice.emailUserId,
        )
          .then((info) => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
              invoiceDocumentName: info.invoiceDocumentName,
              summaryDocumentName: info.summaryDocumentName,
              emailStatus: true,
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          })
          .catch(() => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          });
      }, i * 4 * 1000);
    } else {
      //Send Email EVIO
      setTimeout(function () {
        sendEVIOEmail(
          invoice.userId,
          invoiceData,
          invoice.attach,
          pdfBuffer,
          invoice.emailUserId,
        )
          .then((info) => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
              invoiceDocumentName: info.invoiceDocumentName,
              summaryDocumentName: info.summaryDocumentName,
              emailStatus: true,
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          })
          .catch(() => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          });
      }, i * 4 * 1000);
    }
  }
}

//WHITELABEL
//=====GET=====
router.get('/api/private/billing/getPartnerAccessTokens', (req, res, next) => {
  var context = 'GET /api/private/billing/getPartnerAccessTokens';
  try {
    // let email = null;
    // let token = null;

    // if (process.env.NODE_ENV === 'production') {
    //     email = process.env.userEmailPRD;
    //     token = process.env.companyTokenPRD;
    // }
    // else if (process.env.NODE_ENV === 'pre-production') {
    //     email = process.env.userEmailQA;
    //     token = process.env.companyTokenQA;
    // }
    // else {
    //     email = process.env.userEmailQA;
    //     token = process.env.companyTokenQA;
    // }

    let { email, token } = getAuthenticationEmailCredentials();

    var arg = {
      Authentication: {
        Email: email,
        Token: token,
      },
      SpecialAuthentication: {
        Email: 'tiago.meireles@go-evio.com',
        Token: token,
        Password: 'E!vio12345',
      },
      PartnerTaxId: '272770701',
    };

    MagnifinanceClient.GetPartnerAccessTokens(arg, (err, result) => {
      if (err) {
        console.log('Failed');
        console.log(err);

        return res.status(500).send(err.response);
      } else {
        console.log('Nice');
        console.log(result);

        return res.status(200).send(result);
      }
    });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

router.get('/api/private/billing/getBillingDocumentWL', (req, res, next) => {
  var context = 'GET /api/private/getBillingDocumentWL';
  try {
    if (!req.query.documentId) {
      return res
        .status(400)
        .send({ code: 'documentId_missing', message: 'documentId missing' });
    }

    let email = null;
    let token = null;

    if (process.env.NODE_ENV === 'production') {
      email = 'tiago.meireles@go-evio.com';
      token = 'HgVkv8nvsJZvvMeGEgc6Xm9sV2VnZJpgdy5vRsW-';
    } else if (process.env.NODE_ENV === 'pre-production') {
      email = 'tiago.meireles@go-evio.com';
      token = 'HgVkv8nvsJZvvMeGEgc6Xm9sV2VnZJpgdy5vRsW-';
    } else {
      email = 'tiago.meireles@go-evio.com';
      token = 'HgVkv8nvsJZvvMeGEgc6Xm9sV2VnZJpgdy5vRsW-';
    }

    var arg = {
      Authentication: {
        Email: email,
        Token: token,
      },
      DocumentId: req.query.documentId,
    };

    console.log('TESTE');
    console.log(arg);

    const MagnifinanceClient = MagnifinanceUtils.magnifinanceClient();

    MagnifinanceClient.DocumentGet(arg, (err, result) => {
      if (err) {
        console.log(`[${context}] Error `, err.response);
        return res.status(500).send(err.response);
      } else {
        console.log(`[${context}] result `, result);
        res.status(200).send(result);
      }
    });
  } catch (error) {
    console.log(`[${context}] Error `, error);
    return res.status(500).send(error?.message);
  }
});

//=====POST=====
router.post(
  '/api/private/billing/createBillingDocumentWL',
  async (req, res, next) => {
    const context = 'POST /api/private/billing/createBillingDocumentWL';
    try {
      const clientName = req.headers['clientname'];
      const source = req.headers['source'];
      const ceme = req.headers['ceme'];

      const featureFlagEnabled = await toggle.isEnable(
        'foreign_invoice_deactivated_bp-54',
      );
      if (featureFlagEnabled && source == 'international') {
        console.log(
          `[${context}][FEATUREFLAG][foreign_invoice_deactivated_BP-54]`,
        );
        return res.status(StatusCodes.FORBIDDEN).send({
          code: 'foreign_invoice_deactivated',
          message: 'Foreign invoice deactivated',
        });
      }

      if (!req.body.invoice) {
        return res
          .status(400)
          .send({ code: 'invoice_missing', message: 'Invoice missing' });
      }

      if (!req.body.attach) {
        return res
          .status(400)
          .send({ code: 'attach_missing', message: 'Attach missing' });
      }

      if (!clientName) {
        return res
          .status(400)
          .send({ code: 'clientName_missing', message: 'Client name missing' });
      }

      const optionalCountryCodeToVAT = req.body.optionalCountryCodeToVAT;
      let invoice = req.body.invoice;
      let attach = req.body.attach;
      let paymentId = req.body.invoice.paymentId;

      checkIfInvoiceAlreadyExists(paymentId)
        .then(() => {
          let params = {
            userId: invoice.header.userId,
          };

          axios
            .get(billingProfileProxy, { params: params })
            .then(async (profileFound) => {
              let billingData = profileFound.data;

              if (ceme !== undefined) {
                //Processa apenas pedidos WL cujo clientName é diferente de Evio

                if (ceme === process.env.cemeEVIO) {
                  //ceme da EVIO
                  //token da EVIO (template fatura 2 a ser criada)

                  if (source === process.env.sourceInternational) {
                    //ceme da EVIO
                    //token 2 da EVIO (template fatura 2 a ser criada)

                    getAuthCredentialsFromTemplate(clientName, ceme)
                      .then((auth) => {
                        internationalPartnerInvoiceWL(
                          res,
                          invoice,
                          attach,
                          paymentId,
                          billingData,
                          auth,
                          clientName,
                          source,
                          ceme,
                          optionalCountryCodeToVAT,
                        );
                      })
                      .catch((error) => {
                        console.log(
                          `[${context}][getAuthCredentialsFromTemplate] Missing authentication credentials`,
                        );
                        return res.status(500).send(error);
                      });
                  } else if (source === process.env.sourceEVIO) {
                    //ceme da EVIO
                    //token 2 da EVIO (template fatura 2 a ser criada)

                    getAuthCredentialsFromTemplate(clientName, ceme)
                      .then((auth) => {
                        evioPartnerInvoiceWL(
                          res,
                          invoice,
                          attach,
                          paymentId,
                          billingData,
                          auth,
                          clientName,
                          source,
                          ceme,
                          optionalCountryCodeToVAT,
                        );
                      })
                      .catch((error) => {
                        console.log(
                          `[${context}][getAuthCredentialsFromTemplate] Missing authentication credentials`,
                        );
                        return res.status(500).send(error);
                      });
                  } else if (source === process.env.sourceMobie) {
                    //ceme da EVIO
                    //token 2 da EVIO (template fatura 2 a ser criada)

                    getAuthCredentialsFromTemplate(clientName, ceme)
                      .then((auth) => {
                        mobiePartnerInvoiceWL(
                          res,
                          invoice,
                          attach,
                          paymentId,
                          billingData,
                          auth,
                          clientName,
                          source,
                          ceme,
                          optionalCountryCodeToVAT,
                        );
                      })
                      .catch((error) => {
                        console.log(
                          `[${context}][getAuthCredentialsFromTemplate] Missing authentication credentials`,
                        );
                        return res.status(500).send(error);
                      });
                  }
                } else {
                  //rede do cliente
                  //token do cliente

                  getAuthCredentialsFromTemplate(clientName, ceme)
                    .then((auth) => {
                      UtilsWL.createPartnerBillingDocument(
                        billingData,
                        invoice.lines,
                        paymentId,
                        auth,
                        optionalCountryCodeToVAT,
                      )
                        .then(async (arg) => {
                          //console.log(arg);
                          console.log('Request body Magnifinance');
                          console.log('ARG', JSON.stringify(arg));
                          try {
                            let invoiceUpdated = await Invoice.findOneAndUpdate(
                              { _id: invoice._id },
                              { $set: { argData: arg } },
                              { new: true },
                            );
                          } catch (error) {
                            console.log(`[${context}][Invoice] Error`, error);
                          }

                          await saveInvoiceBeforeThirdParty(
                            invoice,
                            attach,
                            arg,
                          );

                          MagnifinanceClient.DocumentCreate(
                            arg,
                            (err, result) => {
                              if (err) {
                                console.log(
                                  `[${context}] Error `,
                                  err.response,
                                );

                                let billing = {
                                  payments: invoice.lines,
                                  paymentId: invoice.paymentId,
                                  userId: invoice.header.userId,
                                  chargerType: invoice.header.chargerType,
                                  type: process.env.invoiceType,
                                  status: process.env.failedStatus,
                                  attach: attach,
                                  validationError: setValidationError(
                                    err,
                                    context,
                                  ),
                                  billingType: process.env.instantType,
                                  clientName: clientName,
                                  source: source,
                                  ceme: ceme,
                                  authEmail: auth.email,
                                  authToken: auth.token,
                                  argData: arg,
                                };

                                updateOrCreateInvoice(billing)
                                  .then((result) => {
                                    if (process.env.NODE_ENV === 'production') {
                                      Utils.sendInvoiceFailureEmail(
                                        result._id,
                                        err,
                                        billingData,
                                      );
                                    } else if (
                                      process.env.NODE_ENV === 'pre-production'
                                    ) {
                                      Utils.sendInvoiceFailureEmail(
                                        result._id,
                                        err,
                                        billingData,
                                      );
                                    }

                                    return res.status(200).send({
                                      invoiceId: result._id,
                                      invoiceStatus: process.env.failedStatus,
                                    });
                                  })
                                  .catch((error) => {
                                    return res.status(500).send(error);
                                  });
                              } else {
                                if (result.Response.Type === 'Error') {
                                  let billing;

                                  billing = {
                                    payments: invoice.lines,
                                    paymentId: invoice.paymentId,
                                    userId: invoice.header.userId,
                                    chargerType: invoice.header.chargerType,
                                    type: process.env.invoiceType,
                                    status: process.env.failedStatus,
                                    attach: attach,
                                    validationError: result.Response,
                                    billingType: process.env.instantType,
                                    clientName: clientName,
                                    source: source,
                                    ceme: ceme,
                                    authEmail: auth.email,
                                    authToken: auth.token,
                                  };

                                  updateOrCreateInvoice(billing)
                                    .then((result) => {
                                      if (
                                        process.env.NODE_ENV === 'production'
                                      ) {
                                        Utils.sendInvoiceFailureEmail(
                                          result._id,
                                          billing.validationError,
                                          billingData,
                                        );
                                      } else if (
                                        process.env.NODE_ENV ===
                                        'pre-production'
                                      ) {
                                        Utils.sendInvoiceFailureEmail(
                                          result._id,
                                          billing.validationError,
                                          billingData,
                                        );
                                      }

                                      return res.status(200).send({
                                        invoiceId: result._id,
                                        invoiceStatus: process.env.failedStatus,
                                      });
                                    })
                                    .catch((error) => {
                                      return res.status(500).send(error);
                                    });
                                }

                                if (result.Response.Type === 'Success') {
                                  let billing = {
                                    payments: invoice.lines,
                                    paymentId: invoice.paymentId,
                                    userId: invoice.header.userId,
                                    chargerType: invoice.header.chargerType,
                                    documentId:
                                      result.Response.Object.DocumentId,
                                    type: process.env.invoiceType,
                                    billingType: process.env.instantType,
                                    status: process.env.processingStatus,
                                    clientName: clientName,
                                    source: source,
                                    ceme: ceme,
                                    attach: attach,
                                    authEmail: auth.email,
                                    authToken: auth.token,
                                  };

                                  updateOrCreateInvoice(billing)
                                    .then((result) => {
                                      return res.status(200).send({
                                        invoiceId: result._id,
                                        invoiceStatus:
                                          process.env.processingStatus,
                                      });
                                    })
                                    .catch((error) => {
                                      return res.status(500).send(error);
                                    });
                                }

                                if (
                                  result.Response.Type !== 'Success' &&
                                  result.Response.Type !== 'Error'
                                ) {
                                  saveThirdPartyUnknownResult(invoice, result);
                                  return res.status(200).send({
                                    invoiceId: result._id,
                                    invoiceStatus: process.env.unknownStatus,
                                  });
                                }
                              }
                            },
                          );
                        })
                        .catch((error) => {
                          return res.status(500).send(error);
                        });
                    })
                    .catch((error) => {
                      console.log(
                        `[${context}][getAuthCredentialsFromTemplate] Missing authentication credentials`,
                      );
                      return res.status(500).send(error);
                    });
                }
              } else {
                console.log(`[${context}] Missing CEME`);
                return res
                  .status(400)
                  .send({ code: 'missing_ceme', message: 'Missing CEME' });
              }
            })
            .catch((error) => {
              console.log(`[${context}][.then][find] Error`, error);
              return res.status(400).send({
                auth: false,
                code: 'billing_profile_failed',
                message: 'Failed to retrieve billing profile',
              });
            });
        })
        .catch(() => {
          console.log(
            `[${context}][checkIfInvoiceAlreadyExists] PaymentId already has an invoice` +
              paymentId,
          );
          return res.status(400).send({
            code: 'payment_already_has_invoice',
            message: 'PaymentId already has an invoice' + paymentId,
          });
        });
    } catch (error) {
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error?.message);
    }
  },
);

//Get only IPPN Partners invoices
//Cron schedule */2 * * * *
router.post('/api/job/checkProcessingBillingsWl', async (req, res) => {
  const context = 'JOB /api/job/checkProcessingBillingsWl';
  try {
    console.info(`[${context}]: ${new Date().toISOString()}`);

    getWLProcessingInvoices()
      .then((invoices) => {
        if (invoices) {
          for (let i = 0; i < invoices.length; i++) {
            const invoice = invoices[i];
            getDocumentToProcess(invoice, i);
          }
        }
      })
      .catch((error) => {
        console.log(`[${context}] Error retrieving billings `, error);
      });
    return res.status(200).send('Job started');
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[${context}] Error `, error);
    return res.status(500).send(error);
  }
});

//Função para determinar as credenciais de autenticação baseadas no Template
function getAuthCredentialsFromTemplate(clientName, ceme) {
  var context = 'FUNCTION getAuthCredentialsFromTemplate';
  return new Promise((resolve, reject) => {
    let environment;
    if (process.env.NODE_ENV === 'production') {
      environment = 'PRD';
    } else if (process.env.NODE_ENV === 'pre-production') {
      environment = 'PRE';
    } else {
      environment = 'PRE';
    }

    let query = {
      clientName: clientName,
      ceme: ceme,
      environment: environment,
    };

    console.log('query', query);

    Template.findOne(query, (err, template) => {
      if (err) {
        console.log(`[${context}][find] Error `, err.message);
        reject(err);
      } else {
        if (template) {
          auth = {
            email: template.email,
            token: template.token,
            ceme,
            clientName,
          };
          resolve(auth);
        } else {
          reject('Failed to find template for ' + clientName);
        }
      }
    });
  });
}

function evioPartnerInvoiceWL(
  res,
  invoice,
  attach,
  paymentId,
  billingData,
  auth,
  clientName,
  source,
  ceme,
  optionalCountryCodeToVAT,
) {
  var context = 'FUNCTION evioPartnerInvoiceWL';

  UtilsWL.createEVIOBillingDocumentWL(
    billingData,
    invoice.lines,
    paymentId,
    auth,
    optionalCountryCodeToVAT,
  )
    .then(async (arg) => {
      console.log('Request body Magnifinance');
      console.log('ARG', JSON.stringify(arg));
      try {
        let invoiceUpdated = await Invoice.findOneAndUpdate(
          { _id: invoice._id },
          { $set: { argData: arg } },
          { new: true },
        );
      } catch (error) {
        console.log(`[${context}][Invoice] Error`, error);
      }

      await saveInvoiceBeforeThirdParty(invoice, attach, arg);

      MagnifinanceClient.DocumentCreate(arg, (err, result) => {
        if (err) {
          console.log(`[${context}] Error `, err.response);

          let billing = {
            payments: invoice.lines,
            paymentId: invoice.paymentId,
            userId: invoice.header.userId,
            chargerType: invoice.header.chargerType,
            type: process.env.invoiceType,
            status: process.env.failedStatus,
            attach: attach,
            validationError: setValidationError(err, context),
            billingType: process.env.instantType,
            clientName: clientName,
            source: source,
            ceme: ceme,
            authEmail: auth.email,
            authToken: auth.token,
            argData: arg,
          };

          updateOrCreateInvoice(billing)
            .then((result) => {
              if (process.env.NODE_ENV === 'production') {
                Utils.sendInvoiceFailureEmail(result._id, err, billingData);
              } else if (process.env.NODE_ENV === 'pre-production') {
                Utils.sendInvoiceFailureEmail(result._id, err, billingData);
              }

              return res.status(200).send({
                invoiceId: result._id,
                invoiceStatus: process.env.failedStatus,
              });
            })
            .catch((error) => {
              return res.status(500).send(error);
            });
        } else {
          console.log(result.Response);

          if (result.Response.Type === 'Error') {
            let billing;

            billing = {
              payments: invoice.lines,
              paymentId: invoice.paymentId,
              userId: invoice.header.userId,
              chargerType: invoice.header.chargerType,
              type: process.env.invoiceType,
              status: process.env.failedStatus,
              attach: attach,
              validationError: result.Response,
              billingType: process.env.instantType,
              clientName: clientName,
              source: source,
              ceme: ceme,
              authEmail: auth.email,
              authToken: auth.token,
              argData: arg,
            };

            updateOrCreateInvoice(billing)
              .then((result) => {
                if (process.env.NODE_ENV === 'production') {
                  Utils.sendInvoiceFailureEmail(
                    result._id,
                    billing.validationError,
                    billingData,
                  );
                } else if (process.env.NODE_ENV === 'pre-production') {
                  Utils.sendInvoiceFailureEmail(
                    result._id,
                    billing.validationError,
                    billingData,
                  );
                }

                return res.status(200).send({
                  invoiceId: result._id,
                  invoiceStatus: process.env.failedStatus,
                });
              })
              .catch((error) => {
                return res.status(500).send(error);
              });
          }

          if (result.Response.Type === 'Success') {
            let billing = {
              payments: invoice.lines,
              paymentId: invoice.paymentId,
              userId: invoice.header.userId,
              chargerType: invoice.header.chargerType,
              documentId: result.Response.Object.DocumentId,
              type: process.env.invoiceType,
              billingType: process.env.instantType,
              status: process.env.processingStatus,
              attach: attach,
              clientName: clientName,
              source: source,
              ceme: ceme,
              authEmail: auth.email,
              authToken: auth.token,
              argData: arg,
            };

            updateOrCreateInvoice(billing)
              .then((result) => {
                return res.status(200).send({
                  invoiceId: result._id,
                  invoiceStatus: process.env.processingStatus,
                });
              })
              .catch((error) => {
                return res.status(500).send(error);
              });
          }

          if (
            result.Response.Type !== 'Success' &&
            result.Response.Type !== 'Error'
          ) {
            saveThirdPartyUnknownResult(invoice, result);
            return res.status(200).send({
              invoiceId: result._id,
              invoiceStatus: process.env.unknownStatus,
            });
          }
        }
      });
    })
    .catch((error) => {
      return res.status(500).send(error);
    });
}

function internationalPartnerInvoiceWL(
  res,
  invoice,
  attach,
  paymentId,
  billingData,
  auth,
  clientName,
  source,
  ceme,
  optionalCountryCodeToVAT,
) {
  var context = 'FUNCTION internationalPartnerInvoiceWL';

  UtilsWL.createInternationalBillingDocumentWL(
    billingData,
    invoice.lines,
    paymentId,
    auth,
    optionalCountryCodeToVAT,
  )
    .then(async (arg) => {
      console.log('Request body Magnifinance');
      console.log('ARG', JSON.stringify(arg));
      try {
        let invoiceUpdated = await Invoice.findOneAndUpdate(
          { _id: invoice._id },
          { $set: { argData: arg } },
          { new: true },
        );
      } catch (error) {
        console.log(`[${context}][Invoice] Error`, error);
      }

      await saveInvoiceBeforeThirdParty(invoice, attach, arg);

      MagnifinanceClient.DocumentCreate(arg, (err, result) => {
        if (err) {
          console.log(`[${context}] Error `, err.response);

          let billing = {
            payments: invoice.lines,
            paymentId: invoice.paymentId,
            userId: invoice.header.userId,
            chargerType: process.env.ChargerTypeGireve,
            type: process.env.invoiceType,
            billingType: process.env.instantType,
            status: process.env.failedStatus,
            attach: attach,
            validationError: setValidationError(err, context),
            clientName: clientName,
            source: source,
            ceme: ceme,
            authEmail: auth.email,
            authToken: auth.token,
            argData: arg,
          };

          updateOrCreateInvoice(billing)
            .then((result) => {
              if (process.env.NODE_ENV === 'production') {
                Utils.sendInvoiceFailureEmail(
                  result._id,
                  billing.validationError,
                  billingData,
                );
              } else if (process.env.NODE_ENV === 'pre-production') {
                Utils.sendInvoiceFailureEmail(
                  result._id,
                  billing.validationError,
                  billingData,
                );
              }

              return res.status(200).send({
                invoiceId: result._id,
                invoiceStatus: process.env.failedStatus,
              });
            })
            .catch((error) => {
              return res.status(500).send(error);
            });
        } else {
          console.log(result.Response);

          if (result.Response.Type === 'Error') {
            let billing = {
              payments: invoice.lines,
              paymentId: invoice.paymentId,
              userId: invoice.header.userId,
              chargerType: process.env.ChargerTypeGireve,
              type: process.env.invoiceType,
              billingType: process.env.instantType,
              status: process.env.failedStatus,
              attach: attach,
              validationError: result.Response,
              clientName: clientName,
              source: source,
              ceme: ceme,
              authEmail: auth.email,
              authToken: auth.token,
              argData: arg,
            };

            updateOrCreateInvoice(billing)
              .then((result) => {
                if (process.env.NODE_ENV === 'production') {
                  Utils.sendInvoiceFailureEmail(
                    result._id,
                    billing.validationError,
                    billingData,
                  );
                } else if (process.env.NODE_ENV === 'pre-production') {
                  Utils.sendInvoiceFailureEmail(
                    result._id,
                    billing.validationError,
                    billingData,
                  );
                }

                return res.status(200).send({
                  invoiceId: result._id,
                  invoiceStatus: process.env.failedStatus,
                });
              })
              .catch((error) => {
                return res.status(500).send(error);
              });
          }

          if (result.Response.Type === 'Success') {
            let billing = {
              payments: invoice.lines,
              paymentId: invoice.paymentId,
              userId: invoice.header.userId,
              chargerType: process.env.ChargerTypeGireve,
              documentId: result.Response.Object.DocumentId,
              type: process.env.invoiceType,
              billingType: process.env.instantType,
              status: process.env.processingStatus,
              attach: attach,
              clientName: clientName,
              source: source,
              ceme: ceme,
              authEmail: auth.email,
              authToken: auth.token,
            };

            updateOrCreateInvoice(billing)
              .then((result) => {
                return res.status(200).send({
                  invoiceId: result._id,
                  invoiceStatus: process.env.processingStatus,
                });
              })
              .catch((error) => {
                return res.status(500).send(error);
              });
          }

          if (
            result.Response.Type !== 'Success' &&
            result.Response.Type !== 'Error'
          ) {
            saveThirdPartyUnknownResult(invoice, result);
            return res.status(200).send({
              invoiceId: result._id,
              invoiceStatus: process.env.unknownStatus,
            });
          }
        }
      });
    })
    .catch((error) => {
      return res.status(500).send(error);
    });
}

function mobiePartnerInvoiceWL(
  res,
  invoice,
  attach,
  paymentId,
  billingData,
  auth,
  clientName,
  source,
  ceme,
  optionalCountryCodeToVAT,
) {
  var context = 'FUNCTION mobiePartnerInvoiceWL';

  UtilsWL.createInternationalBillingDocumentWL(
    billingData,
    invoice.lines,
    paymentId,
    auth,
    optionalCountryCodeToVAT,
  )
    .then(async (arg) => {
      console.log('Request body Magnifinance');
      console.log('ARG', JSON.stringify(arg));
      try {
        let invoiceUpdated = await Invoice.findOneAndUpdate(
          { _id: invoice._id },
          { $set: { argData: arg } },
          { new: true },
        );
      } catch (error) {
        console.log(`[${context}][Invoice] Error`, error);
      }

      await saveInvoiceBeforeThirdParty(invoice, attach, arg);

      MagnifinanceClient.DocumentCreate(arg, (err, result) => {
        if (err) {
          console.log(`[${context}] Error `, err.response);

          let billing = {
            payments: invoice.lines,
            paymentId: invoice.paymentId,
            userId: invoice.header.userId,
            chargerType: process.env.ChargerTypeMobiE,
            type: process.env.invoiceType,
            billingType: process.env.instantType,
            status: process.env.failedStatus,
            attach: attach,
            validationError: setValidationError(err, context),
            clientName: clientName,
            source: source,
            ceme: ceme,
            authEmail: auth.email,
            authToken: auth.token,
            argData: arg,
          };

          updateOrCreateInvoice(billing)
            .then((result) => {
              if (process.env.NODE_ENV === 'production') {
                Utils.sendInvoiceFailureEmail(
                  result._id,
                  billing.validationError,
                  billingData,
                );
              } else if (process.env.NODE_ENV === 'pre-production') {
                Utils.sendInvoiceFailureEmail(
                  result._id,
                  billing.validationError,
                  billingData,
                );
              }

              return res.status(200).send({
                invoiceId: result._id,
                invoiceStatus: process.env.failedStatus,
              });
            })
            .catch((error) => {
              return res.status(500).send(error);
            });
        } else {
          console.log(result.Response);

          if (result.Response.Type === 'Error') {
            let billing = {
              payments: invoice.lines,
              paymentId: invoice.paymentId,
              userId: invoice.header.userId,
              chargerType: process.env.ChargerTypeMobiE,
              type: process.env.invoiceType,
              billingType: process.env.instantType,
              status: process.env.failedStatus,
              attach: attach,
              validationError: result.Response,
              clientName: clientName,
              source: source,
              ceme: ceme,
              authEmail: auth.email,
              authToken: auth.token,
              argData: arg,
            };

            updateOrCreateInvoice(billing)
              .then((result) => {
                if (process.env.NODE_ENV === 'production') {
                  Utils.sendInvoiceFailureEmail(
                    result._id,
                    billing.validationError,
                    billingData,
                  );
                } else if (process.env.NODE_ENV === 'pre-production') {
                  Utils.sendInvoiceFailureEmail(
                    result._id,
                    billing.validationError,
                    billingData,
                  );
                }

                return res.status(200).send({
                  invoiceId: result._id,
                  invoiceStatus: process.env.failedStatus,
                });
              })
              .catch((error) => {
                return res.status(500).send(error);
              });
          }

          if (result.Response.Type === 'Success') {
            let billing = {
              payments: invoice.lines,
              paymentId: invoice.paymentId,
              userId: invoice.header.userId,
              chargerType: process.env.ChargerTypeMobiE,
              documentId: result.Response.Object.DocumentId,
              type: process.env.invoiceType,
              billingType: process.env.instantType,
              status: process.env.processingStatus,
              attach: attach,
              clientName: clientName,
              source: source,
              ceme: ceme,
              authEmail: auth.email,
              authToken: auth.token,
              argData: arg,
            };

            updateOrCreateInvoice(billing)
              .then((result) => {
                return res.status(200).send({
                  invoiceId: result._id,
                  invoiceStatus: process.env.processingStatus,
                });
              })
              .catch((error) => {
                return res.status(500).send(error);
              });
          }

          if (
            result.Response.Type !== 'Success' &&
            result.Response.Type !== 'Error'
          ) {
            saveThirdPartyUnknownResult(invoice, result);
            return res.status(200).send({
              invoiceId: result._id,
              invoiceStatus: process.env.unknownStatus,
            });
          }
        }
      });
    })
    .catch((error) => {
      return res.status(500).send(error);
    });
}

function sendInvoiceEmailWL(
  invoice,
  invoiceData,
  object,
  i,
  pdfBuffer,
  emailUserId,
) {
  //Send Email Mobie
  if (!invoice.chargerType && invoice.billingType == process.env.monthlyType) {
    sendPeriodicEmailWL(
      invoiceData,
      invoice.attach,
      pdfBuffer,
      invoice,
      invoice.emailUserId,
    )
      .then((info) => {
        let updateInvoice = {
          status: process.env.createdStatus,
          documentNumber: object.DocumentNumber,
          documentUrl: object.DownloadUrl,
          pdfDocumentName: invoice._id + '.pdf',
          invoiceDocumentName: info.invoiceDocumentName,
          summaryDocumentName: info.summaryDocumentName,
          emailStatus: true,
        };

        let query = { _id: invoice._id };

        updateInvoiceDatabase(query, updateInvoice);
      })
      .catch(() => {
        let updateInvoice = {
          status: process.env.createdStatus,
          documentNumber: object.DocumentNumber,
          documentUrl: object.DownloadUrl,
          pdfDocumentName: invoice._id + '.pdf',
        };

        let query = { _id: invoice._id };

        updateInvoiceDatabase(query, updateInvoice);
      });
  } else if (invoice.chargerType === process.env.ChargerTypeMobiE) {
    setTimeout(function () {
      if (invoice.type === process.env.creditNoteType) {
        sendMobiECreditNote(
          invoice.userId,
          invoiceData,
          invoice.invoiceNumber,
          invoice.attach,
          pdfBuffer,
          emailUserId,
        )
          .then((info) => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
              invoiceDocumentName: info.invoiceDocumentName,
              summaryDocumentName: info.summaryDocumentName,
              emailStatus: true,
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          })
          .catch(() => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          });
      } else {
        sendMobiEEmailWL(
          invoiceData,
          invoice.attach,
          pdfBuffer,
          invoice,
          invoice.emailUserId,
        )
          .then((info) => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
              invoiceDocumentName: info.invoiceDocumentName,
              summaryDocumentName: info.summaryDocumentName,
              emailStatus: true,
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          })
          .catch(() => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          });
      }
    }, i * 4 * 1000);
  } else {
    //Send Email Gireve
    if (
      invoice.chargerType === process.env.ChargerTypeGireve ||
      invoice.chargerType === Enums.ChargerTypes.Hubject
    ) {
      setTimeout(function () {
        sendGireveEmailWL(
          invoiceData,
          invoice.attach,
          pdfBuffer,
          invoice,
          invoice.emailUserId,
        )
          .then((info) => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
              invoiceDocumentName: info.invoiceDocumentName,
              summaryDocumentName: info.summaryDocumentName,
              emailStatus: true,
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          })
          .catch(() => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          });
      }, i * 4 * 1000);
    } else {
      //Send Email EVIO
      setTimeout(function () {
        sendEVIOEmailWL(
          invoiceData,
          invoice.attach,
          pdfBuffer,
          invoice,
          invoice.emailUserId,
        )
          .then((info) => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
              invoiceDocumentName: info.invoiceDocumentName,
              summaryDocumentName: info.summaryDocumentName,
              emailStatus: true,
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          })
          .catch(() => {
            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
              pdfDocumentName: invoice._id + '.pdf',
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
          });
      }, i * 4 * 1000);
    }
  }
}

function sendEVIOEmailWL(invoice, attach, pdfBuffer, invoiceInfo, emailUserId) {
  return new Promise((resolve, reject) => {
    let params = {
      userId: invoiceInfo.userId,
    };

    console.log('sendEVIOEmailWL');
    console.log('invoice');
    console.log(invoice);

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        UtilsWL.sendEVIOInvoiceEmailWL(
          billingData,
          invoice,
          attach,
          pdfBuffer,
          invoiceInfo,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[getBillingProfile][.then][find] Error`, error);
        reject();
      });
  });
}

function sendMobiEEmailWL(
  invoice,
  attach,
  pdfBuffer,
  invoiceInfo,
  emailUserId,
) {
  var context = 'FUNCTION sendMobiEEmailWL';
  return new Promise((resolve, reject) => {
    let params = {
      userId: invoiceInfo.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        UtilsWL.sendMobieInvoiceEmailWL(
          billingData,
          invoice,
          attach,
          pdfBuffer,
          invoiceInfo,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function sendGireveEmailWL(
  invoice,
  attach,
  pdfBuffer,
  invoiceInfo,
  emailUserId,
) {
  var context = 'FUNCTION sendGireveEmailWL';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoiceInfo.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        UtilsWL.sendGireveInvoiceEmailWL(
          billingData,
          invoice,
          attach,
          pdfBuffer,
          invoiceInfo,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function sendPeriodicEmailWL(
  invoice,
  attach,
  pdfBuffer,
  invoiceInfo,
  emailUserId,
) {
  var context = 'FUNCTION sendPeriodicEmailWL';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoiceInfo.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        UtilsWL.sendPeriodicInvoiceEmailWL(
          billingData,
          invoice,
          attach,
          pdfBuffer,
          invoiceInfo,
          emailUserId,
        )
          .then((result) => {
            console.log('Email sent to ' + billingData.email);
            resolve(result);
          })
          .catch(() => {
            console.log('Email not sent');
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function getDocumentToProcess(invoice, i) {
  var arg = {
    Authentication: {
      Email: invoice.authEmail,
      Token: invoice.authToken,
    },
    DocumentId: invoice.documentId,
  };

  console.log('AUTH');
  console.log(arg);

  MagnifinanceClient.DocumentGet(arg, (err, result) => {
    if (err) {
      console.log(`[GetProcessingBillings] Error `, err);
    } else {
      let type = result.Response.Type;
      if (type) {
        if (type === 'Success') {
          let object = result.Response.Object;

          let invoiceData = {
            documentNumber: object.DocumentNumber,
            documentUrl: object.DownloadUrl,
            chargerType: invoice.chargerType,
            clientName: invoice.clientName,
          };

          if (!invoice.emailStatus) {
            downloadAndStorePDF(object.DownloadUrl, invoice._id)
              .then((pdfBuffer) => {
                if (invoice.billingType == undefined) {
                  sendInvoiceEmailWL(
                    invoice,
                    invoiceData,
                    object,
                    i,
                    pdfBuffer,
                    invoice.emailUserId,
                  );
                } else {
                  //AD_HOC billing type
                  if (invoice.billingType == process.env.instantType) {
                    sendInvoiceEmailWL(
                      invoice,
                      invoiceData,
                      object,
                      i,
                      pdfBuffer,
                      invoice.emailUserId,
                    );
                  } else {
                    //MONTHLY billing type
                    setTimeout(function () {
                      sendPeriodicEmailWL(
                        invoiceData,
                        invoice.attach,
                        pdfBuffer,
                        invoice,
                        invoice.emailUserId,
                      )
                        .then((info) => {
                          let updateInvoice = {
                            status: process.env.createdStatus,
                            documentNumber: object.DocumentNumber,
                            documentUrl: object.DownloadUrl,
                            pdfDocumentName: invoice._id + '.pdf',
                            invoiceDocumentName: info.invoiceDocumentName,
                            summaryDocumentName: info.summaryDocumentName,
                            emailStatus: true,
                          };

                          let query = { _id: invoice._id };

                          updateInvoiceDatabase(query, updateInvoice);
                          ExternalRequest.updateBillingHistory(invoice);

                        })
                        .catch(() => {
                          let updateInvoice = {
                            status: process.env.createdStatus,
                            documentNumber: object.DocumentNumber,
                            documentUrl: object.DownloadUrl,
                            pdfDocumentName: invoice._id + '.pdf',
                          };

                          let query = { _id: invoice._id };

                          updateInvoiceDatabase(query, updateInvoice);
                          ExternalRequest.updateBillingHistory(invoice);
                        });
                    }, i * 4 * 1000);
                  }
                }
              })
              .catch((error) => {
                console.log('[Error] ' + error);
              });
          } else {
            downloadAndStorePDF(object.DownloadUrl, invoice._id).catch(
              (error) => {
                console.log('[Error] ' + error);
              },
            );

            let updateInvoice = {
              status: process.env.createdStatus,
              documentNumber: object.DocumentNumber,
              documentUrl: object.DownloadUrl,
            };

            let query = { _id: invoice._id };

            updateInvoiceDatabase(query, updateInvoice);
            ExternalRequest.updateBillingHistory(invoice);
          }
        } else {
          console.log('Document ' + invoice.documentId + ' still processing');
        }
      }
    }
  });
}

function getWLProcessingInvoices() {
  var context = 'FUNCTION getWLProcessingInvoices';
  return new Promise((resolve, reject) => {
    let query = {
      $or: [
        { type: process.env.invoiceType },
        { type: process.env.budgetType },
        { type: process.env.creditNoteType },
      ],
      status: process.env.processingStatus,
      $and: [
        { clientName: { $exists: true } },
        { clientName: { $ne: process.env.evioClientName } },
      ],
    };

    Invoice.find(query)
      .lean()
      .then((billings) => {
        if (billings.length === 0) {
          console.log('WL invoices to process not found');
          resolve(false);
        } else {
          resolve(billings);
        }
      })
      .catch((err) => {
        console.log(`[${context}][find] Error `, err);
        reject(err);
      });
  });
}

async function getPeriodBillingBudgetDocument(
  clientName,
  ceme,
  billingData,
  invoice,
  paymentId,
  dueDate,
  emissionDate,
  optionalCountryCodeToVAT,
) {
  const context = 'Function getPeriodBillingBudgetDocument';
  try {
    let arg = {};

    let lines;

    if (invoice.lines) {
      lines = invoice.lines;
    } else {
      lines = invoice.payments;
    }

    if (clientName === process.env.evioClientName) {
      arg = await createBudgetDocument(
        billingData,
        lines,
        paymentId,
        dueDate,
        emissionDate,
        optionalCountryCodeToVAT,
      );
    } else {
      let auth = await getAuthCredentialsFromTemplate(clientName, ceme);
      arg = await createPeriodBillingDocumentWL(
        billingData,
        lines,
        paymentId,
        dueDate,
        emissionDate,
        auth,
        process.env.documentTypeInvoice,
        optionalCountryCodeToVAT,
      );
    }

    console.log('arg', arg);
    return arg;
  } catch (error) {
    console.log(`[${context}] Error `, error?.message);
    return {
      Authentication: {
        Email: '',
        Token: '',
      },
    };
  }
}

async function getPeriodBillingDocument(
  clientName,
  ceme,
  billingData,
  invoice,
  paymentId,
  dueDate,
  emissionDate,
  optionalCountryCodeToVAT,
) {
  const context = 'Function getPeriodBillingDocument';
  try {
    let arg = {};

    let lines;

    if (invoice.lines) {
      lines = invoice.lines;
    } else {
      lines = invoice.payments;
    }

    if (clientName === process.env.evioClientName) {
      arg = await createBillingDocument(
        billingData,
        lines,
        paymentId,
        dueDate,
        emissionDate,
        optionalCountryCodeToVAT,
      );
    } else {
      let auth = await getAuthCredentialsFromTemplate(clientName, ceme);
      arg = await createPeriodBillingDocumentWL(
        billingData,
        lines,
        paymentId,
        dueDate,
        emissionDate,
        auth,
        process.env.documentTypeInvoiceReceipt,
        optionalCountryCodeToVAT,
      );
    }
    console.log('arg', arg);
    return arg;
  } catch (error) {
    console.log(`[${context}] Error `, error?.message);
    return {
      Authentication: {
        Email: '',
        Token: '',
      },
    };
  }
}

function createPeriodBillingDocumentWL(
  billingData,
  payments,
  paymentId = null,
  dueDate,
  emissionDate,
  auth,
  documentType,
  optionalCountryCodeToVAT,
) {
  return new Promise((resolve, reject) => {
    // let documentDescription;
    // if (billingData.purchaseOrder == undefined || billingData.purchaseOrder == "") {
    //     documentDescription = 'EVIO Mobility';

    // } else {
    //     documentDescription = 'EVIO Mobility-' + billingData.purchaseOrder;
    // }

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

    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = `${name}`;
    } else {
      documentDescription = `${name} - ${billingData.purchaseOrder}`;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };

        if (optionalCountryCodeToVAT) {
          invoiceLine.APIInvoicingProduct.TaxValueCountry =
            optionalCountryCodeToVAT;
        }

        if (payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode) {
          invoiceLine.APIInvoicingProduct.TaxExemptionReasonCode =
            payment.taxExemptionReasonCode ?? payment.TaxExemptionReasonCode;
        }

        invoices.push(invoiceLine);
      });

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: auth.email,
          Token: auth.token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          // LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          Date: emissionDate,
          DueDate: dueDate,
          Description: documentDescription,
          Type: documentType, // 'I' - Fatura , 'T' - Fatura Recibo //Real documentType
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
      };

      addSeriesToDocument(auth, arg);
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      reject(error);
    }
  });
}

function processFailedMobieDocumentWL(invoice) {
  var context = 'FUNCTION processFailedMobieDocumentWL';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoice.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        processMobiEBillingDocumentWL(billingData, invoice)
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));
            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { paymentId: invoice.paymentId },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error `, err.response);

                let update = {
                  paymentId: invoice.paymentId,
                  status: process.env.failedStatus,
                  validationError: setValidationError(err, context),
                };

                updateOrCreateInvoice(update)
                  .then(() => {
                    console.log('Invoice failed to be created');
                    resolve();
                  })
                  .catch((error) => {
                    console.log(`[${context}] Error `, error.response);
                    reject();
                  });
              } else {
                if (result.Response.Type === 'Error') {
                  let update = {
                    paymentId: invoice.paymentId,
                    status: process.env.failedStatus,
                    validationError: result.Response,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (result.Response.Type === 'Success') {
                  let update = {
                    documentId: result.Response.Object.DocumentId,
                    paymentId: invoice.paymentId,
                    status: process.env.processingStatus,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log(
                        'Invoice ' +
                          invoice.paymentId +
                          ' updated with success',
                      );
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(update, result);
                  resolve();
                }
              }
            });
          })
          .catch((error) => {
            console.log(`[${context}][.then][find] Error`, error);
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function processMobiEBillingDocumentWL(billingData, invoice) {
  return new Promise(async (resolve, reject) => {
    let payments = invoice.payments;
    let paymentId = invoice.paymentId;
    let clientName = invoice.clientName;
    let ceme = invoice.ceme;
    let documentDescription;
    let name;

    switch (invoice.clientName) {
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

    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = `${name}`;
    } else {
      documentDescription = `${name} - ${billingData.purchaseOrder}`;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };
        invoices.push(invoiceLine);
      });

      let auth = await getAuthCredentialsFromTemplate(clientName, ceme);
      let email = auth.email;
      let token = auth.token;

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          Date: moment().format('YYYY-MM-DD'),
          DueDate: moment().format('YYYY-MM-DD'),
          Description: documentDescription,
          Type: 'T', //Fatura/Recibo //Real 'T'
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      addSeriesToDocument(auth, arg);
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      reject(error);
    }
  });
}

function processFailedGireveDocumentWL(invoice) {
  var context = 'FUNCTION processFailedGireveDocumentWL';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoice.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        processGireveBillingDocumentWL(billingData, invoice)
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));
            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { paymentId: invoice.paymentId },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error2 `, err.response);

                let update = {
                  paymentId: invoice.paymentId,
                  status: process.env.failedStatus,
                  validationError: setValidationError(err, context),
                };

                updateOrCreateInvoice(update)
                  .then(() => {
                    console.log('Invoice failed to be created');
                    resolve();
                  })
                  .catch((error) => {
                    console.log(`[${context}] Error `, error.response);
                    reject();
                  });
              } else {
                if (result.Response.Type === 'Error') {
                  let update = {
                    paymentId: invoice.paymentId,
                    status: process.env.failedStatus,
                    validationError: result.Response,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (result.Response.Type === 'Success') {
                  let update = {
                    documentId: result.Response.Object.DocumentId,
                    paymentId: invoice.paymentId,
                    status: process.env.processingStatus,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log(
                        'Invoice ' +
                          invoice.paymentId +
                          ' updated with success',
                      );
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }

                if (
                  result.Response.Type !== 'Success' &&
                  result.Response.Type !== 'Error'
                ) {
                  saveThirdPartyUnknownResult(update, result);
                  resolve();
                }
              }
            });
          })
          .catch((error) => {
            return res.status(500).send(error);
          });
      })
      .catch((error) => {
        console.log(`[${context}][.then][find] Error`, error);
        reject();
      });
  });
}

function processGireveBillingDocumentWL(billingData, invoice) {
  return new Promise(async (resolve, reject) => {
    let payments = invoice.payments;
    let paymentId = invoice.paymentId;
    let clientName = invoice.clientName;
    let ceme = invoice.ceme;
    let documentDescription;
    let name;

    switch (invoice.clientName) {
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

    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = `${name}`;
    } else {
      documentDescription = `${name} - ${billingData.purchaseOrder}`;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };
        invoices.push(invoiceLine);
      });

      let auth = await getAuthCredentialsFromTemplate(clientName, ceme);
      let email = auth.email;
      let token = auth.token;

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          Date: moment().format('YYYY-MM-DD'),
          DueDate: moment().format('YYYY-MM-DD'),
          Description: documentDescription,
          Type: 'T', //Fatura/Recibo //Real 'T'
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      addSeriesToDocument(auth, arg);
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      reject(error);
    }
  });
}

function processFailedEVIODocumentWL(invoice) {
  var context = 'FUNCTION processFailedEVIODocumentWL';

  return new Promise((resolve, reject) => {
    let params = {
      userId: invoice.userId,
    };

    axios
      .get(billingProfileProxy, { params: params })
      .then((profileFound) => {
        let billingData = profileFound.data;

        processEVIOBillingDocumentWL(billingData, invoice)
          .then(async (arg) => {
            console.log('Request body Magnifinance');
            console.log('ARG', JSON.stringify(arg));
            try {
              let invoiceUpdated = await Invoice.findOneAndUpdate(
                { paymentId: invoice.paymentId },
                { $set: { argData: arg } },
                { new: true },
              );
            } catch (error) {
              console.log(`[${context}][Invoice] Error`, error);
            }

            MagnifinanceClient.DocumentCreate(arg, (err, result) => {
              if (err) {
                console.log(`[${context}] Error2 `, err.response);

                let update = {
                  paymentId: invoice.paymentId,
                  status: process.env.failedStatus,
                  validationError: setValidationError(err, context),
                };

                updateOrCreateInvoice(update)
                  .then(() => {
                    console.log('Invoice failed to be created');
                    resolve();
                  })
                  .catch((error) => {
                    console.log(`[${context}] Error `, error.response);
                    reject();
                  });
              } else {
                console.log('result.Response', result.Response);

                if (
                  result.Response.ErrorValue &&
                  result.Response.ErrorValue.Value == 14
                ) {
                  console.log(
                    'result.Response.ValidationErrors',
                    result.Response.ValidationErrors.ValidationError,
                  );
                }
                if (result.Response.Type === 'Error') {
                  let update = {
                    paymentId: invoice.paymentId,
                    status: process.env.failedStatus,
                    validationError: result.Response,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                } else if (result.Response.Type === 'Success') {
                  let update = {
                    documentId: result.Response.Object.DocumentId,
                    paymentId: invoice.paymentId,
                    status: process.env.processingStatus,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log(
                        'Invoice ' +
                          invoice.paymentId +
                          ' updated with success',
                      );
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                } else {
                  let update = {
                    paymentId: invoice.paymentId,
                    status: process.env.failedStatus,
                    validationError: result.Response,
                  };

                  updateOrCreateInvoice(update)
                    .then(() => {
                      console.log('Invoice failed to be created');
                      resolve();
                    })
                    .catch((error) => {
                      console.log(`[${context}] Error `, error.response);
                      reject();
                    });
                }
              }
            });
          })
          .catch((error) => {
            console.log(
              `[${context}][processEVIOBillingDocumentWL] Error`,
              error?.message,
            );
            reject();
          });
      })
      .catch((error) => {
        console.log(`[${context}][axios.get] Error`, error?.message);
        reject();
      });
  });
}

function processEVIOBillingDocumentWL(billingData, invoice) {
  return new Promise(async (resolve, reject) => {
    let payments = invoice.payments;
    let paymentId = invoice.paymentId;
    let clientName = invoice.clientName;
    let ceme = invoice.ceme;
    let documentDescription;
    let name;

    switch (invoice.clientName) {
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

    if (
      billingData.purchaseOrder == undefined ||
      billingData.purchaseOrder == ''
    ) {
      documentDescription = `${name}`;
    } else {
      documentDescription = `${name} - ${billingData.purchaseOrder}`;
    }

    try {
      let invoices = [];
      payments.forEach((payment) => {
        let invoiceLine = {
          APIInvoicingProduct: {
            Code: payment.code,
            Description: payment.description,
            UnitPrice: payment.unitPrice,
            Quantity: payment.quantity,
            Unit: payment.uom,
            Type: 'S',
            TaxValue: taxValue(payment.vat),
            ProductDiscount: payment.discount,
          },
        };
        invoices.push(invoiceLine);
      });

      let auth = await getAuthCredentialsFromTemplate(clientName, ceme);
      let email = auth.email;
      let token = auth.token;

      let address = addressS.parseAddressStreetToString(
        billingData.billingAddress,
      );

      var arg = {
        Authentication: {
          Email: email,
          Token: token,
        },
        Client: {
          NIF: billingData.nif,
          Name: billingData.billingName,
          LegalName: billingData.billingName,
          Address: address,
          City: billingData?.billingAddress?.city,
          PostCode:
            billingData?.billingAddress?.zipCode ??
            billingData?.billingAddress?.postCode,
          CountryCode: billingData?.billingAddress?.countryCode,
          CountryName: billingData?.billingAddress?.country,
          PhoneNumber: billingData.mobile,
          Email: billingData.email,
        },
        Document: {
          Date: moment().format('YYYY-MM-DD'),
          DueDate: moment().format('YYYY-MM-DD'),
          Description: documentDescription,
          Type: 'T', //Fatura/Recibo //Real 'T'
          Lines: invoices,
          ExternalId: paymentId,
        },
        IsToClose: true,
        //SendTo: billingData.email
      };

      addSeriesToDocument(auth, arg);
      addTaxExemptionCode(arg, payments);

      resolve(arg);
    } catch (error) {
      reject(error);
    }
  });
}

function getAuthenticationEmailCredentials() {
  try {
    let email = null;
    let token = null;

    if (Constants.environment === 'production') {
      email = process.env.userEmailPRD;
      token = process.env.companyTokenPRD;
    } else if (process.env.NODE_ENV === 'pre-production') {
      //TODO change to prod when have key

      // email = process.env.userEmailPRD;
      // token = process.env.companyTokenPRD;

      email = process.env.userEmailQA;
      token = process.env.companyTokenQA;
    } else {
      email = process.env.userEmailQA;
      token = process.env.companyTokenQA;
    }
    return { email, token };
  } catch (error) {
    let email = process.env.userEmailQA;
    let token = process.env.companyTokenQA;
    return { email, token };
  }
}

function addSeriesToDocument(auth, arg) {
  var context = 'addSeriesToDocument';
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
        serieGoCharge = process.env.serieGoCharge;
        serieACP = process.env.serieACP;
        serieHyundai = process.env.serieHyundai;
        serieFR = process.env.serieFR;
        serieGoChargeCemeGC = process.env.serieGoChargeCemeGC;
        serieHyundaiCemeGC = process.env.serieHyundaiCemeGC;
        serieFT = process.env.serieFT;
        serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFT;
        serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFT;
        break;
      case 'pre-production':
        serieGoCharge = process.env.serieGoChargePre;
        serieACP = process.env.serieACPPre;
        serieHyundai = process.env.serieHyundaiPre;
        serieFR = process.env.serieFRPre;
        serieGoChargeCemeGC = process.env.serieGoChargeCemeGCPre;
        serieHyundaiCemeGC = process.env.serieHyundaiCemeGCPre;
        serieFT = process.env.serieFTPre;
        serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFTPre;
        serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFTPre;
        break;
      case 'development':
        serieGoCharge = process.env.serieGoChargePre;
        serieACP = process.env.serieACPPre;
        serieHyundai = process.env.serieHyundaiPre;
        serieFR = process.env.serieFRPre;
        serieGoChargeCemeGC = process.env.serieGoChargeCemeGCPre;
        serieHyundaiCemeGC = process.env.serieHyundaiCemeGCPre;
        serieFT = process.env.serieFTPre;
        serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFTPre;
        serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFTPre;
        break;
      default:
        serieGoCharge = process.env.serieGoChargePre;
        serieACP = process.env.serieACPPre;
        serieHyundai = process.env.serieHyundaiPre;
        serieFR = process.env.serieFRPre;
        serieGoChargeCemeGC = process.env.serieGoChargeCemeGCPre;
        serieHyundaiCemeGC = process.env.serieHyundaiCemeGCPre;
        serieFT = process.env.serieFTPre;
        serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFTPre;
        serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFTPre;
        break;
    }

    switch (auth.clientName) {
      case process.env.WhiteLabelGoCharge:
        if (arg.Document.Type === process.env.documentTypeInvoiceReceipt) {
          if (auth.ceme === 'EVIO') {
            arg.Document.Serie = serieGoCharge;
          } else {
            arg.Document.Serie = serieGoChargeCemeGC;
          }
        } else {
          if (auth.ceme === 'EVIO') {
            arg.Document.Serie = serieGoChargeCemeGCFT;
          } else {
            arg.Document.Serie = serieGoChargeCemeGCFT;
          }
        }
        break;
      case process.env.WhiteLabelHyundai:
        if (arg.Document.Type === process.env.documentTypeInvoiceReceipt) {
          if (auth.ceme === 'EVIO') {
            arg.Document.Serie = serieHyundai;
          } else {
            arg.Document.Serie = serieHyundaiCemeGC;
          }
        } else {
          if (auth.ceme === 'EVIO') {
            arg.Document.Serie = serieGoChargeCemeGCFT;
          } else {
            arg.Document.Serie = serieHyundaiCemeGCFT;
          }
        }
        break;
      case process.env.WhiteLabelACP:
        if (arg.Document.Type === process.env.documentTypeInvoiceReceipt) {
          arg.Document.Serie = serieACP;
        } else {
          arg.Document.Serie = serieFT;
        }
        break;
      case process.env.WhiteLabelKLC:
        arg.Document.Serie = serieFR;
        break;
      case process.env.WhiteLabelKinto:
        if (arg.Document.Type === process.env.documentTypeInvoiceReceipt) {
          arg.Document.Serie = serieFR;
        } else {
          arg.Document.Serie = serieFT;
        }
        break;
      default:
        if (arg.Document.Type === process.env.documentTypeInvoiceReceipt) {
          arg.Document.Serie = serieFR;
        } else {
          arg.Document.Serie = serieFT;
        }
        break;
    }

    console.log('arg.Document.Serie - ', arg.Document.Serie);

    /*if (auth.clientName === process.env.WhiteLabelGoCharge && (auth.ceme === 'EVIO' || auth.ceme === process.env.WhiteLabelGoCharge)) {
            arg.Document.Serie = serieGoCharge
        } else if (auth.clientName === process.env.WhiteLabelACP && auth.ceme === 'EVIO') {
            arg.Document.Serie = serieACP
        } else if (auth.clientName === process.env.WhiteLabelHyundai && (auth.ceme === 'EVIO' || auth.ceme === process.env.WhiteLabelGoCharge)) {
            arg.Document.Serie = serieHyundai
        } else {
            arg.Document.Serie = serieFR
        }*/
  } catch (error) {
    console.log(`[${context}] Error `, error?.message);
  }
}

function addSeriesToDocumentEVIO(arg, flag) {
  var context = 'addSeriesToDocumentEVIO';
  try {
    let serieFR;
    let serieFT;
    let serieGoChargeCemeGCFT;
    let serieHyundaiCemeGCFT;

    switch (process.env.NODE_ENV) {
      case 'production':
        serieFT = process.env.serieFT;
        serieFR = process.env.serieFR;
        serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFT;
        serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFT;
        break;
      case 'pre-production':
        serieFT = process.env.serieFTPre;
        serieFR = process.env.serieFRPre;
        serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFTPre;
        serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFTPre;
        break;
      case 'development':
        serieFT = process.env.serieFTPre;
        serieFR = process.env.serieFRPre;
        serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFTPre;
        serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFTPre;
        break;
      default:
        serieFT = process.env.serieFTPre;
        serieFR = process.env.serieFRPre;
        serieGoChargeCemeGCFT = process.env.serieGoChargeCemeGCFTPre;
        serieHyundaiCemeGCFT = process.env.serieHyundaiCemeGCFTPre;
        break;
    }

    if (flag === 'DOC') {
      arg.Document.Serie = serieFR;
    } else {
      arg.Document.Serie = serieFT;
    }
  } catch (error) {
    console.log(`[${context}] Error `, error?.message);
  }
}

let invoicesToHistoryJob = null;
let sendInvoicesEmailJob = null;
initJogCheckInvoicesToHistory('*/10 * * * *')
  .then(() => {
    invoicesToHistoryJob.start();
    console.log('Check invoices to history Job Started');
  })
  .catch((error) => {
    console.log(
      'Error starting check invoices to history Job: ' + error?.message,
    );
  });

initJogSendInvoicesEmail('*/10 * * * *')
  .then(() => {
    sendInvoicesEmailJob.start();
    console.log('Send Invoices Email Job Started');
  })
  .catch((error) => {
    console.log('Error starting Send Invoices Email Job: ' + error?.message);
  });

function initJogCheckInvoicesToHistory(timer) {
  return new Promise((resolve, reject) => {
    invoicesToHistoryJob = cron.schedule(
      timer,
      () => {
        console.log(
          'Running Job Invoices To History: ' + new Date().toISOString(),
        );
        invoicesToHistory();
      },
      {
        scheduled: false,
      },
    );
    resolve();
  });
}

function initJogSendInvoicesEmail(timer) {
  return new Promise((resolve, reject) => {
    sendInvoicesEmailJob = cron.schedule(
      timer,
      () => {
        console.log(
          'Running Job Send Invoices Email: ' + new Date().toISOString(),
        );
        sendInvoicesEmail();
      },
      {
        scheduled: false,
      },
    );
    resolve();
  });
}

//invoicesToHistory()
async function invoicesToHistory() {
  const context = 'Function invoicesToHistory';
  try {
    const timeoutBetweenHistoryRequests = 1500;
    let query = {
      status: process.env.createdStatus,
      syncToHistory: { $ne: true },
      type: {
        $in: [Constants.invoiceType.invoice, Constants.invoiceType.budget],
      },
      sentToSyncToHistory: { $ne: true },
    };

    let invoicesFound = await Invoice.find(query);

    if (invoicesFound.length > 0) {
      await Invoice.updateMany(query, { $set: { sentToSyncToHistory: true } });
      console.log(`${context} - ${invoicesFound.length} sent to sync`);

      for (const invoice of invoicesFound) {
        await ExternalRequest.updateBillingHistory(invoice);
        // Await before send another invoice
        await new Promise((resolve) =>
          setTimeout(resolve, timeoutBetweenHistoryRequests),
        );
      }
    }
  } catch (error) {
    Sentry.captureException(error);
    console.log(`[${context}] Error `, error?.message);
  }
}

//sendInvoicesEmail();
async function sendInvoicesEmail() {
  const context = 'Function sendInvoicesEmail';
  try {
    let query = {
      status: '40',
      emailStatus: false,
      documentUrl: { $exists: true, $ne: '' },
    };

    let invoicesFound = await Invoice.find(query);

    console.log('Invoices to send email found - ', invoicesFound.length);
    if (invoicesFound.length > 0) {
      for (let i = 0; i < invoicesFound.length; i++) {
        console.log('Invoice - ', i, ' Date: ', new Date());
        let invoice = invoicesFound[i];
        setTimeout(() => {
          setTimeout(() => {
            downloadAndStorePDF(invoice.documentUrl, invoice._id)
              .then((pdfBuffer) => {
                let invoiceData = {
                  documentNumber: invoice.documentNumber,
                  documentUrl: invoice.documentUrl,
                  chargerType: invoice.chargerType,
                  clientName: invoice.clientName,
                };

                let object = {
                  DocumentNumber: invoice.documentNumber,
                  DownloadUrl: invoice.documentUrl,
                };

                if (invoice.clientName === 'EVIO') {
                  sendInvoiceEmail(
                    invoice,
                    invoiceData,
                    object,
                    i,
                    pdfBuffer,
                    invoice.emailUserId,
                  );
                } else {
                  sendInvoiceEmailWL(
                    invoice,
                    invoiceData,
                    object,
                    i,
                    pdfBuffer,
                    invoice.emailUserId,
                  );
                }
              })
              .catch((error) => {
                console.log(
                  `[${context}][downloadAndStorePDF] Error `,
                  error?.message,
                );
              });
          }, 5000);
        }, i * 5 * 1000);
      }
    }
  } catch (error) {
    console.log(`[${context}] Error `, error?.message);
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
        console.log(`[${context}]Error`, error?.message);
        resolve(null);
        //reject(error);
      });
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
    console.log(`[${context}] Error `, error?.message);
    return [];
  }
}

function insertSessionValue(value) {
  const context = 'Function insertSessionValue';
  try {
    return value !== null && value !== undefined && value !== '' ? value : '-';
  } catch (error) {
    console.log(`[Error][${context}]`, error?.message);
    return '-';
  }
}

function incrementOtherNetworksNumber(otherNetworksNumber, network) {
  otherNetworksNumber[network].exists = true;
  for (let otherNetwork in otherNetworksNumber) {
    if (!otherNetworksNumber[otherNetwork].exists) {
      otherNetworksNumber[otherNetwork].number += 1;
    }
  }
}

async function addMissingUserInfo(session) {
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
          ? evDetails?.listOfGroupDrivers?.find((group) =>
              group?.listOfDrivers?.find(
                (driver) => driver._id === foundSession.userId,
              ),
            )
          : null;
        // await sleep(1500)
        const fleet =
          foundSession.fleetDetails ??
          (evDetails &&
          evDetails.fleet !== null &&
          evDetails.fleet !== undefined &&
          evDetails.fleet !== '-1'
            ? await getFleetDetails(evDetails.fleet)
            : null);
        // await sleep(1500)
        const userInfo =
          foundSession.userIdInfo ?? (await getUserById(foundSession.userId));
        // await sleep(500)
        const userWillPayInfo =
          foundSession.userIdWillPayInfo ??
          (foundSession.userIdWillPay !== foundSession.userId
            ? await getUserById(foundSession.userIdWillPay)
            : userInfo);
        // await sleep(500)

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
        console.log(`[${context}]Error`, error?.message);
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
    console.log(`[${context}] Error `, error?.message);
    return null;
  }
}

async function getFleetDetails(fleetId) {
  let context = 'Function getFleetDetails';
  try {
    let headers = { 'origin-microservice': 'billing' };
    let proxyEV = process.env.HostEvs + process.env.PathGetFleetById;
    let params = {
      _id: fleetId,
    };

    let foundFleet = await axios.get(proxyEV, { params, headers });
    return foundFleet.data ? foundFleet.data : null;
  } catch (error) {
    console.log(`[${context}] Error `, error?.message);
    return null;
  }
}

const sleep = async (milliseconds) => {
  await new Promise((resolve) => {
    return setTimeout(resolve, milliseconds);
  });
};

async function checkIfEVIOInvouce(userId) {
  try {
    let params = {
      userId: userId,
    };

    let profileFound = await axios.get(billingProfileProxy, { params: params });

    if (profileFound.nif)
      if (profileFound.nif == process.env.EVIONIF) return true;

    return false;
  } catch (error) {
    return false;
  }
}

async function createEVIOInvoice(invoice, attach) {
  try {
    let billing = {
      payments: invoice.lines,
      paymentId: invoice.paymentId,
      userId: invoice.header.userId,
      chargerType: invoice.header.chargerType,
      status: process.env.sessionByEVIO,
      attach: attach,
    };

    let result = await updateOrCreateInvoice(billing);

    return { invoiceId: result._id, invoiceStatus: process.env.sessionByEVIO };
  } catch (error) {
    return error;
  }
}

function addTaxExemptionCode(arg, payments) {
  var context = 'addTaxExemptionCode';
  try {
    const foundExemption = payments.find(
      (elem) => elem.taxExemptionReasonCode || elem.TaxExemptionReasonCode,
    );
    if (foundExemption) {
      arg.Document.TaxExemptionReasonCode =
        foundExemption.taxExemptionReasonCode ?? elem.TaxExemptionReasonCode;
      console.log(
        `[Function addTaxExemptionCode] TaxExemptionReasonCode found ${arg?.Document?.TaxExemptionReasonCode}`,
      );
    }
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
  }
}

async function saveInvoiceBeforeThirdParty(invoice, attach, arg) {
  const billing = {
    payments: invoice.lines,
    paymentId: invoice.paymentId,
    userId: invoice.header.userId,
    chargerType: invoice.header.chargerType,
    type: process.env.invoiceType,
    status: process.env.beforeThirdPartyStatus,
    attach: attach,
    billingType: process.env.instantType,
    clientName: process.env.evioClientName,
    argData: arg,
  };

  await updateOrCreateInvoice(billing);
}

async function saveInvoiceBeforeThirdPartyPaymentIdList(invoice, attach, arg) {
  const billing = {
    payments: invoice.lines,
    userId: invoice.header.userId,
    type: process.env.invoiceType,
    status: process.env.beforeThirdPartyStatus,
    attach: attach,
    billingType: process.env.monthlyType,
    paymentIdList: invoice.paymentIdList,
    startDate: invoice.billingPeriodDates.startDate,
    endDate: invoice.billingPeriodDates.endDate,
    argData: arg,
  };

  await updateOrCreateInvoice(billing);
}

async function saveThirdPartyUnknownResult(invoice, response) {
  const billing = {
    paymentId: invoice.paymentId,
    response: response,
  };

  await updateOrCreateInvoice(billing);
}

async function saveThirdPartyUnknownResultPaymentIdList(invoice, response) {
  const billing = {
    paymentIdList: invoice.paymentIdList,
    response: response,
  };

  await updateOrCreateInvoice(billing);
}

function setValidationError(err, context) {
  try {
    if (typeof err == 'string') return err;
    return JSON.stringify(err);
  } catch (error) {
    Sentry.captureException(error);
    return `[${context}] Error contextStringify failed for err`;
  }
}

module.exports = router;
