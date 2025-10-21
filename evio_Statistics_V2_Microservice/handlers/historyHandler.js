require('dotenv-safe').load();
const History = require('../models/historyV2');
const PaymentsHandler = require('./paymentHandler');
const BillingHandler = require('./billingHandler');
const { BillingEnums } = require('../utils/enums/billingEnums');
const { PaymentMethodEnums } = require('../utils/enums/history/paymentMethod');
const {
  ChargingSessionReadRepository: OcpiSessionRepository,
} = require('evio-library-ocpi');

const { findInvoiceById } = require('evio-library-billing/dist').default;
const {
  isValidBillingStatus,
  allowedBillingStatuses,
} = require('../helpers/billingStatus');

const {
  createOptions,
  createCommonFields,
  createQuery,
} = require('../middlewares/history');
const removeNegativeValuesFromHistory = require('../middlewares/removeNegativeValuesFromHistory');
const {
  historyTypeEnums,
  networkEnums,
} = require('../utils/enums/historyEnums');

const Sentry = require('@sentry/node');

const { findInvoiceByDocumentNumber } =
  require('evio-library-billing/dist').default;
const { findBySessionId } = require('evio-library-chargers/dist').default;
const { Enums } = require('evio-library-commons').default;
const { mapInvoiceLines } = require('evio-library-statistics');
const {
  checkSessionUserInListOfGroups,
} = require('../helpers/checkSessionUserInListOfGroups');

const buildInvoiceDetailsFromInvoiceLines = async (
  invoiceLines,
  invoiceProvider,
) => {
  const context = 'Function buildInvoiceDetailsFromInvoiceLines';
  try {
    return await mapInvoiceLines(invoiceLines, invoiceProvider);
  } catch (error) {
    console.warn(
      `[${context}] No third party product map found for ${invoiceProvider}`,
    );
    Sentry.captureMessage(
      `No third party product map found for ${invoiceProvider}`,
    );
    return [];
  }
};

const buildInvoiceProviderFromRequestBody = (requestBody) => {
  return requestBody?.invoiceProvider || Enums.ThirdParties.Magnifinance;
};

module.exports = {
  updateImageChargersHistory: function (req, res) {
    let context = 'Function updateImageChargersHistory';
    return new Promise(async (resolve, reject) => {
      let charger = req.body.charger;

      let query = {
        'charger._id': charger._id,
      };

      let newValues = {
        'charger.imageContent': charger.imageContent,
        'charger.defaultImage': charger.defaultImage,
      };

      History.updateMany(query, { $set: newValues }, (err, result) => {
        if (err) {
          console.error(
            `[${context}][History.findOneAndUpdate] Error`,
            err.message,
          );
          reject(err);
        }

        resolve(result);
      });
    });
  },
  updateImageEVsHistory: function (req, res) {
    let context = 'Function updateImageEVsHistory';
    return new Promise(async (resolve, reject) => {
      let ev = req.body.ev;

      let query = {
        'ev._id': ev._id,
      };

      let newValues = {
        'ev.imageContent': ev.imageContent,
      };

      History.updateMany(query, { $set: newValues }, (err, result) => {
        if (err) {
          console.error(
            `[${context}][History.findOneAndUpdate] Error`,
            err.message,
          );
          reject(err);
        }

        resolve(result);
      });
    });
  },
  getHistoryApps: function (req, res) {
    let context = 'Function getHistoryApps';
    return new Promise(async (resolve, reject) => {
      let userId = req.headers['userid'];

      let received = req.query;

      let pageNumber = received.pageNumber;

      let limiteQuery;

      //console.log("userId", userId);

      if (received.limiteQuery) limiteQuery = received.limiteQuery;
      else limiteQuery = process.env.LimiteQuery;

      if (!received.startDate) {
        reject({
          auth: false,
          code: 'server_startDate_required',
          message: 'Start date is required',
        });
      }
      if (!received.endDate) {
        reject({
          auth: false,
          code: 'server_endDate_required',
          message: 'End date is required',
        });
      }

      let query = {
        userId: userId,
        $and: [
          { stopDate: { $gte: received.startDate } },
          { stopDate: { $lte: received.endDate } },
        ],
        status: { $ne: process.env.PaymentStatusFaild },
        ...(received.evId && { evId: { $in: received.evId.split(',') } }),
        ...(received.contractId && {
          'contract._id': { $in: received.contractId.split(',') },
        }),
      };

      let options = {
        skip: (Number(pageNumber) - 1) * Number(limiteQuery),
        limit: Number(limiteQuery),
        ...(received.sort && {
          sort: { createdAt: received.sort === 'asc' ? 1 : -1 },
        }),
        //allowDiskUse: true
      };

      let fields = {
        _id: 1,
        evId: 1,
        startDate: 1,
        stopDate: 1,
        ev: 1,
        carImage: 1,
        timeCharged: 1,
        totalPower: 1,
        totalPrice: 1,
        CO2Saved: 1,
        chargerType: 1,
        costDetails: 1,
        purchaseTariff: 1,
        paymentBillingInfo: 1,
        cdrId: 1,
        evKms: 1,
        updateKMs: 1,
        acceptKMs: 1,
        sessionBillingInfo: 1,
        invoice: 1,
      };

      var sort = { startDate: -1 };

      historyFindApp(query, fields, sort, options)
        .then(async (response) => {
          response = response.map(removeNegativeValuesFromHistory);

          let totalOfEntries = await History.find(query).count();
          let numberOfPages = Math.ceil(totalOfEntries / limiteQuery);

          let responseToFrontEnd = {
            sessions: response,
            totalOfEntries: totalOfEntries,
            numberOfPages: numberOfPages,
          };

          resolve(responseToFrontEnd);
        })
        .catch((error) => {
          console.error(`[${context}][historyFindApp] Error`, error.message);
          reject(error);
        });
    });
  },
  getHistory: function (req, res) {
    let context = 'Function getHistory';
    return new Promise(async (resolve, reject) => {
      let userId = req.headers['userid'];

      let received = req.query;

      let pageNumber = received.pageNumber;

      let limiteQuery;

      if (received.limiteQuery) limiteQuery = received.limiteQuery;
      else limiteQuery = process.env.LimiteQuery;

      let query = {
        userId: userId,
        $and: [
          { stopDate: { $gte: received.startDate } },
          { stopDate: { $lte: received.endDate } },
        ],
      };

      let options = {
        skip: (Number(pageNumber) - 1) * Number(limiteQuery),
        limit: Number(limiteQuery),
        //allowDiskUse: true
      };

      var sort = { startDate: -1 };

      History.find(query, {}, sort, options, (err, result) => {
        if (err) {
          console.error(`[${context}] Error`, err.message);
          //ErrorHandler.ErrorHandler(err, res)
          reject(err);
        } else {
          if (result.length === 0) {
            resolve(result);
          } else {
            Promise.all(
              result.map((session) => {
                return new Promise((resolve) => {
                  session.timeCharged = session.timeCharged / 3600;
                  session.totalPower = session.totalPower / 1000;
                  resolve();
                });
              }),
            ).then(() => {
              resolve(result);
            });
          }
        }
      });
    });
  },
  getHistoryWeb: function (req, res) {
    let context = 'Function getHistoryWeb';
    return new Promise(async (resolve, reject) => {
      //console.log("Test");
      let userId = req.headers['userid'];
      //let usersEvOwner = [userId];
      //let usersChargerOwner = [userId];
      let received = req.query;

      //console.log("userId", userId);
      //console.log("received", received);

      if (!received.startDate) {
        reject({
          auth: false,
          code: 'server_startDate_required',
          message: 'Start date is required',
        });
      }
      if (!received.endDate) {
        reject({
          auth: false,
          code: 'server_endDate_required',
          message: 'End date is required',
        });
      }

      if (
        received.billing_status &&
        !isValidBillingStatus(received.billing_status)
      ) {
        reject({
          auth: false,
          code: 'server_invalid_billing_status',
          message: `Invalid billing status. Valid status: ${allowedBillingStatuses()}`,
        });
      }

      if (!received.type) {
        reject({
          auth: false,
          code: 'server_reportsType_required',
          message: 'Type is required',
        });
      } else {
        let pageNumber;
        let limiteQuery;

        if (received.pageNumber && received.pageNumber != 0)
          pageNumber = received.pageNumber;
        else pageNumber = 1;

        if (received.limiteQuery && received.limiteQuery != 0)
          limiteQuery = received.limiteQuery;
        else limiteQuery = process.env.LimiteQuery;

        var sort = { startDate: -1 };

        if (received.type.toUpperCase() === 'EVS') {
          let queryEvs = {
            $or: [
              { evOwner: userId },
              { userId: userId },
              { userIdWillPay: userId },
            ],

            //Only my evs
            //evOwner: userId,
            $and: [
              { stopDate: { $gte: received.startDate } },
              { stopDate: { $lte: received.endDate } },
              { status: { $ne: process.env.PaymentStatusFaild } },
            ],
            createdWay: { $ne: 'APT_START_SESSION' },
          };

          if (received.billing_status) {
            queryEvs.$and.push({
              'sessionBillingInfo.sameUser.status': {
                $in: received.billing_status,
              },
            });
          }

          if (received.filter) {
            queryEvs = await makeQuery(queryEvs, received, userId);
          }

          let fieldsEvs = {
            _id: 1,
            totalPower: 1,
            batteryCharged: 1,
            timeCharged: 1,
            CO2Saved: 1,
            authType: 1,
            hwId: 1,
            chargerType: 1,
            evId: 1,
            tariffId: 1,
            plugId: 1,
            evOwner: 1,
            startDate: 1,
            parkingStartDate: 1,
            parkingStopDate: 1,
            feedBack: 1,
            chargerOwner: 1,
            model: 1,
            createdAt: 1,
            updatedAt: 1,
            sessionId: 1,
            totalPrice: 1,
            user: 1,
            ev: 1,
            stopDate: 1,
            feedBackText: 1,
            rating: 1,
            charger: 1,
            fleet: 1,
            groupDrivers: 1,
            costDetails: 1,
            purchaseTariff: 1,
            tariffsDetails: 1,
            tariffCEME: 1,
            purchaseTariffDetails: 1,
            network: 1,
            'address.city': 1,
            'tariff.tariff': 1,
            'tariff.name': 1,
            'tariff.billingType': 1,
            fees: 1,
            finalPrices: 1,
            tariffsDetailsRoaming: 1,
            'userEvOwner.name': 1,
            'userEvOwner._id': 1,
            paymentBillingInfo: 1,
            sessionBillingInfo: 1,
            invoice: 1,
            cdrId: 1,
            totalTime: 1,
            acceptKMs: 1,
            updateKMs: 1,
            evKms: 1,
            cardNumber: 1,
            costPerkWh: 1,
            efficiency: 1,
            overcost: 1,
          };

          let sessionsEvs = await historyFind(
            queryEvs,
            fieldsEvs,
            sort,
            {},
            received.type,
            userId,
            false,
          );


          sessionsEvs = sessionsEvs.map(removeNegativeValuesFromHistory);

          modififyChargeTime(sessionsEvs);
          modififyTotalTimeInMin(sessionsEvs);
          modififytTimeAfterChargedInMin(sessionsEvs);

          let totalOfEntries = await History.find(queryEvs).count();
          let numberOfPages = Math.ceil(totalOfEntries / limiteQuery);

          let response = {
            sessions: sessionsEvs,
            totalOfEntries: totalOfEntries,
            numberOfPages: numberOfPages,
          };

          resolve(response);
        } else if (received.type.toUpperCase() === 'CHARGERS') {
          let queryChargers = {
            chargerOwner: userId,
            $and: [
              { stopDate: { $gte: received.startDate } },
              { stopDate: { $lte: received.endDate } },
              { status: { $ne: process.env.PaymentStatusFaild } },
            ],
          };

          if (received.billing_status) {
            queryChargers.$and.push({
              'sessionBillingInfo.sameUser.status': {
                $in: received.billing_status,
              },
            });
          }

          if (received.filter) {
            queryChargers = await makeQuery(queryChargers, received, userId);
          }

          //let fieldsChargers = {};
          let fieldsChargers = {
            _id: 1,
            totalPower: 1,
            batteryCharged: 1,
            timeCharged: 1,
            CO2Saved: 1,
            authType: 1,
            hwId: 1,
            chargerType: 1,
            evId: 1,
            tariffId: 1,
            plugId: 1,
            evOwner: 1,
            startDate: 1,
            parkingStartDate: 1,
            parkingStopDate: 1,
            feedBack: 1,
            chargerOwner: 1,
            model: 1,
            createdAt: 1,
            updatedAt: 1,
            sessionId: 1,
            totalPrice: 1,
            user: 1,
            ev: 1,
            stopDate: 1,
            feedBackText: 1,
            rating: 1,
            charger: 1,
            fleet: 1,
            groupDrivers: 1,
            infrastructure: 1,
            costDetails: 1,
            purchaseTariff: 1,
            tariffsDetails: 1,
            purchaseTariffDetails: 1,
            tariffCEME: 1,
            network: 1,
            'address.city': 1,
            'tariff.tariff': 1,
            'tariff.name': 1,
            'tariff.billingType': 1,
            fees: 1,
            finalPrices: 1,
            tariffsDetailsRoaming: 1,
            'userEvOwner.name': 1,
            'userEvOwner._id': 1,
            paymentBillingInfo: 1,
            sessionBillingInfo: 1,
            cdrId: 1,
            totalTime: 1,
            acceptKMs: 1,
            updateKMs: 1,
            evKms: 1,
            cardNumber: 1,
            costPerkWh: 1,
            efficiency: 1,
            overcost: 1,
          };

          let sessionsChargers = await historyFind(
            queryChargers,
            fieldsChargers,
            sort,
            {},
            received.type,
            userId,
            received.filter,
          );
          let totalOfEntries = await History.find(queryChargers).count();

          sessionsChargers = sessionsChargers.map(
            removeNegativeValuesFromHistory,
          );

          modififyChargeTime(sessionsChargers);
          modififyTotalTimeInMin(sessionsChargers);
          modififytTimeAfterChargedInMin(sessionsChargers);

          //patchSalesTariff(sessionsChargers)

          let numberOfPages = Math.ceil(totalOfEntries / limiteQuery);

          let response = {
            sessions: sessionsChargers,
            totalOfEntries: totalOfEntries,
            numberOfPages: numberOfPages,
          };

          resolve(response);
        } else if (received.type.toUpperCase() === 'APT') {
          let queryApt = {
            $or: [
              { evOwner: userId },
              { userId: userId },
              { userIdWillPay: userId },
            ],

            $and: [
              { stopDate: { $gte: received.startDate } },
              { stopDate: { $lte: received.endDate } },
              { status: { $ne: process.env.PaymentStatusFaild } },
            ],
            createdWay: 'APT_START_SESSION',
          };

          if (received.aptId) {
            queryApt.$and.push({
              'user.username': {
                $in: received.aptId,
              },
            });
          }

          if (received.filter) {
            queryApt = await makeQuery(queryApt, received, userId);
          }

          let fieldsApt = {
            _id: 1,
            totalPower: 1,
            batteryCharged: 1,
            timeCharged: 1,
            CO2Saved: 1,
            authType: 1,
            hwId: 1,
            chargerType: 1,
            evId: 1,
            tariffId: 1,
            plugId: 1,
            evOwner: 1,
            startDate: 1,
            parkingStartDate: 1,
            parkingStopDate: 1,
            feedBack: 1,
            chargerOwner: 1,
            model: 1,
            createdAt: 1,
            updatedAt: 1,
            sessionId: 1,
            totalPrice: 1,
            user: 1,
            ev: 1,
            stopDate: 1,
            feedBackText: 1,
            rating: 1,
            charger: 1,
            fleet: 1,
            groupDrivers: 1,
            costDetails: 1,
            purchaseTariff: 1,
            tariffsDetails: 1,
            tariffCEME: 1,
            purchaseTariffDetails: 1,
            network: 1,
            'address.city': 1,
            'tariff.tariff': 1,
            'tariff.name': 1,
            'tariff.billingType': 1,
            fees: 1,
            finalPrices: 1,
            tariffsDetailsRoaming: 1,
            'userEvOwner.name': 1,
            'userEvOwner._id': 1,
            paymentBillingInfo: 1,
            sessionBillingInfo: 1,
            invoice: 1,
            cdrId: 1,
            totalTime: 1,
            acceptKMs: 1,
            updateKMs: 1,
            evKms: 1,
            cardNumber: 1,
            costPerkWh: 1,
            efficiency: 1,
            overcost: 1,
          };

          let sessionsApt = await historyFind(
            queryApt,
            fieldsApt,
            sort,
            {},
            received.type,
            userId,
            false,
          );

          sessionsApt = sessionsApt.map(removeNegativeValuesFromHistory);

          modififyChargeTime(sessionsApt);
          modififyTotalTimeInMin(sessionsApt);
          modififytTimeAfterChargedInMin(sessionsApt);

          let totalOfEntries = await History.find(queryApt).count();
          let numberOfPages = Math.ceil(totalOfEntries / limiteQuery);

          let response = {
            sessions: sessionsApt,
            totalOfEntries: totalOfEntries,
            numberOfPages: numberOfPages,
          };

          resolve(response);
        } else {
          reject({
            auth: false,
            code: 'server_type_not_supported',
            message: 'Type not supported',
          });
        }
      }
    });
  },
  getHistoryWebFilter: function (req, res) {
    let context = 'Function getHistoryWebFilter';
    return new Promise(async (resolve, reject) => {
      let received = req.query;
      let userId = req.headers['userid'];

      if (!received.startDate) {
        reject({
          auth: false,
          code: 'server_startDate_required',
          message: 'Start date is required',
        });
      }
      if (!received.endDate) {
        reject({
          auth: false,
          code: 'server_endDate_required',
          message: 'End date is required',
        });
      }

      if (received.type !== 'EVS' && received.type !== 'CHARGERS') {
        reject({
          auth: false,
          code: 'server_reportsType_required',
          message: 'Type is required',
        });
      } else {
        let startDate = received.startDate;
        let endDate = received.endDate;
        let pageNumber;
        let limiteQuery;

        delete received.startDate;
        delete received.endDate;

        if (received.pageNumber && received.pageNumber != 0) {
          pageNumber = received.pageNumber;
          delete received.pageNumber;
        } else {
          pageNumber = 1;
        }

        if (received.limiteQuery && received.limiteQuery != 0) {
          limiteQuery = received.limiteQuery;
          delete received.limiteQuery;
        } else {
          limiteQuery = process.env.LimiteQuery;
        }

        let query = {
          $and: [
            { stopDate: { $gte: startDate } },
            { stopDate: { $lte: endDate } },
          ],
        };

        if (received.type === 'EVS') {
          query = Object.assign(query, { evOwner: userId });
        } else {
          query = Object.assign(query, { chargerOwner: userId });
        }

        let options = {
          skip: (Number(pageNumber) - 1) * Number(limiteQuery),
          limit: Number(limiteQuery),
          //allowDiskUse: true
        };

        console.log('query', query);

        makeQuery(query, received, userId)
          .then((query) => {
            console.log('query 1', query);

            historyFind(query, {}, {}, options, '', userId, false)
              .then((response) => {
                response = response.map(removeNegativeValuesFromHistory);
                resolve(response);
              })
              .catch((error) => {
                console.error(`[${context}][historyFind] Error`, error.message);
                reject(error);
              });
          })
          .catch((error) => {
            console.error(`[${context}][makeQuery] Error`, error.message);
            reject(error);
          });
      }
    });
  },
  removeHistory: function (req, res) {
    let context = 'Function removeHistory';
    return new Promise(async (resolve, reject) => {
      let session = req.body;
      //console.log("session", session);
      History.removeHistory({ sessionId: session.id }, (err, result) => {
        if (err) {
          console.error(
            `[${context}][History.removeHistory] Error`,
            err.message,
          );
          //ErrorHandler.ErrorHandler(err, res)
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  },
  getHistoryByEV: function (req, res) {
    let context = 'Function getHistoryByEV';
    return new Promise(async (resolve, reject) => {
      let evId = req.query.evId;

      let month = new Date().getMonth();
      let year = new Date().getFullYear();

      //console.log("month", month);
      //console.log("evId", evId);

      let startMonth;
      let endMonth;
      let startYear;
      let endYear;

      if (month + 1 === 12) {
        startYear = year;
        endYear = year + 1;
        startMonth = month + 1;
        endMonth = '01';
      } else {
        if (month + 1 < 10) {
          if (month + 1 === 9) {
            startYear = year;
            endYear = year;
            startMonth = `0${month + 1}`;
            endMonth = `${month + 2}`;
          } else {
            startYear = year;
            endYear = year;
            startMonth = `0${month + 1}`;
            endMonth = `0${month + 2}`;
          }
        } else {
          startYear = year;
          endYear = year;
          startMonth = month + 1;
          endMonth = month + 2;
        }
      }

      let pipeline = [
        {
          $match: {
            evId: evId,
            $and: [
              {
                stopDate: {
                  $gte: new Date(`${startYear}-${startMonth}-01T00:00:00.000Z`),
                },
              },
              {
                stopDate: {
                  $lt: new Date(`${endYear}-${endMonth}-01T00:00:00.000Z`),
                },
              },
            ],
            plafondId: { $ne: '-1' },
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          $project: {
            //_id: 1,
            startDate: 1,
            stopDate: 1,
            timeCharged: {
              $divide: ['$timeCharged', 3600],
            },
            totalPrice: 1,
            network: 1,
            costDetails: 1,
            hwId: 1,
            'charger.address': 1,
            'charger.chargerType': 1,
            'charger.name': 1,
            cdrId: 1,
          },
        },
      ];

      History.aggregate(pipeline, (err, result) => {
        if (err) {
          console.error(`[${context}] Error`, err.message);
          //ErrorHandler.ErrorHandler(err, res)
          reject(err);
        } else {
          result = result.map(removeNegativeValuesFromHistory);
          resolve(result);
        }
      });
    });
  },
  getHistoryBySessionId: async function (req, res) {
    let context = 'GET /api/private/history_v2/bySessionId';
    try {
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      const result = await History.findOne({ sessionId });

      if (!result) {
        return res
          .status(404)
          .json({ error: 'No history found for this sessionId' });
      }

      return result;
    } catch (error) {
      console.error(`[${context}] Error:`, error);
      throw error;
    }
  },
  getHistoryByEVAndMonth: function (req, res) {
    let context = 'Function getHistoryByEVAndMonth';
    return new Promise(async (resolve, reject) => {
      let received = req.query;

      let pipeline = [
        {
          $match: {
            evId: received.evId,
            $and: [
              { stopDate: { $gte: new Date(received.startDate) } },
              { stopDate: { $lt: new Date(received.endDate) } },
            ],
            status: { $ne: process.env.PaymentStatusFaild },
          },
        },
        {
          $project: {
            //_id: 1,
            startDate: 1,
            stopDate: 1,
            timeCharged: {
              $divide: ['$timeCharged', 3600],
            },
            totalPrice: 1,
            network: 1,
            costDetails: 1,
            hwId: 1,
            'charger.address': 1,
            'charger.chargerType': 1,
            'charger.name': 1,
            cdrId: 1,
          },
        },
      ];

      History.aggregate(pipeline, (err, result) => {
        if (err) {
          console.error(`[${context}] Error`, err.message);
          //ErrorHandler.ErrorHandler(err, res)
          reject(err);
        } else {
          result = result.map(removeNegativeValuesFromHistory);
          resolve(result);
        }
      });
    });
  },
  getHistoryExternalAPI: async function (req, res) {
    const context = 'Function getHistoryExternalAPI';
    const { startDate, endDate, type, withCDR, pageNumber, limitQuery } =
      req.query;
    const userId = req.headers['userid'];
    const dateField =
      String(withCDR).toLocaleLowerCase() === 'true'
        ? 'updatedAt'
        : 'startDate';

    const page = Number(pageNumber) || 1;
    const limit = Number(limitQuery) || process.env.LimiteQuery;

    const options = createOptions(page, limit);
    const sort = { startDate: -1 };
    const cdrCondition =
      String(withCDR).toLocaleLowerCase() === 'true'
        ? {
            cdrId: { $exists: true, $ne: null, $ne: '-1' },
            cdr: { $exists: true, $ne: null },
          }
        : {};
    const commonFields = createCommonFields();

    if (req.query.documentNumber) {
      const fetchedInvoice = await findInvoiceByDocumentNumber(
        req.query.documentNumber,
      );
      const query = {
        $or: [
          { invoiceId: fetchedInvoice?._id },
          { documentNumber: req.query.documentNumber },
        ],
        userIdWillPay: userId,
      };

      return await buildResponse(query, commonFields, sort, {}, type, userId);
    }

    let response;
    switch (type.toUpperCase()) {
      case historyTypeEnums.Evs:
        const primaryCondition = userId
          ? { $or: [{ userId }, { evOwner: userId }] }
          : {};
        const queryEvs = createQuery(
          cdrCondition,
          primaryCondition,
          dateField,
          startDate,
          endDate,
        );
        response = await buildResponse(
          queryEvs,
          commonFields,
          sort,
          options,
          type,
          userId,
        );
        break;
      case historyTypeEnums.Chargers:
        const queryChargers = createQuery(
          cdrCondition,
          {
            chargerOwner: userId,
            network: networkEnums.evio,
          },
          dateField,
          startDate,
          endDate,
        );
        response = await buildResponse(
          queryChargers,
          commonFields,
          sort,
          options,
          type,
          userId,
        );
        break;
      default:
        throw {
          auth: false,
          code: 'server_type_not_supported',
          message: 'Type not supported',
        };
    }

    return response;
  },
  updateBillingHistory: async (body) => {
    let context = 'Function updateBillingHistory';
    try {
      const invoiceProvider = buildInvoiceProviderFromRequestBody(body);

      console.info(
        `[${context}] Performing for invoice${body?._id} with invoiceProvider=${invoiceProvider}`,
      );

      if (body?.invoiceLines?.length) {
        body.invoiceDetails = await buildInvoiceDetailsFromInvoiceLines(
          body.invoiceLines,
          invoiceProvider,
        );
      }

      if (body?.paymentIdList?.length) {
        console.info(`[${context}] body.paymentIdList`, body.paymentIdList);

        const updateHistories = await Promise.all(
          body.paymentIdList.map(async (paymentId) => {
            try {
              const response = await updateHistoryBilling(body, paymentId);
              return response;
            } catch (error) {
              console.error(
                `[${context}] body.paymentIdList Error`,
                error.message,
              );
              Sentry.captureException(error);
              return error;
            }
          }),
        );
        return updateHistories;
      } else {
        if (body.paymentId) {
          console.log('body.paymentId', body.paymentId);
          try {
            const response = await updateHistoryBilling(body, body.paymentId);
            return response;
          } catch (error) {
            console.error(`[${context}] body.paymentId Error`, error.message);
            Sentry.captureException(error);
            return error;
          }
        } else if (body?.payments?.length) {
          console.log('body.payments', body?.payments);
          const updateHistories = await Promise.all(
            body.payments.map(async (payment) => {
              try {
                const response = await updateHistoryBilling(
                  body,
                  payment.paymentRef,
                );
                return response;
              } catch (error) {
                console.error(
                  `[${context}] body.payments Error`,
                  error.message,
                );
                Sentry.captureException(error);
                return error;
              }
            }),
          );
          return updateHistories;
        }
        console.error(
          `[${context}] body.paymentId and body.payments not a valid or is empty`,
        );
        return [];
      }
    } catch (error) {
      Sentry.captureException(error);
      console.error(`[${context}] Error`, error.message);
      return error;
    }
  },
  anonymizeUserDataHistory: async function (userId) {
    const context = 'Function anonymizeUserDataHistory';

    try {
      const randomize = () => Math.random().toString(36).substring(2, 10);

      const query = { userId: userId };
      const historyFound = await History.find(query);

      if (!historyFound || historyFound.length === 0) {
        return;
      }

      await History.updateMany(query, {
        $set: {
          'user.email': `anon-${randomize()}`,
          'user.mobile': `anon-${randomize()}`,
          'user.name': `anon-${randomize()}`,
          'contract.cardName': `anon-${randomize()}`,
          'contract.cardPhysicalName': `anon-${randomize()}`,
          'contract.email': `anon-${randomize()}`,
          'contract.mobile': `anon-${randomize()}`,
          'contract.name': `anon-${randomize()}`,
          'contract.nif': `anon-${randomize()}`,
        },
      });
    } catch (error) {
      console.error(`[${context}] Error`, error);
      throw error;
    }
  },
};

//========== FUNCTION ==========
function makeQuery(query, received, userId) {
  var context = 'Function makeQuery';
  return new Promise((resolve, reject) => {
    //console.log("query", query);
    if (received.type.toUpperCase() === 'EVS') {
      //Validate if have an fleet

      //console.log("fleet", typeof received.filter)
      //console.log("evId", received.filter.evId)

      received.filter = JSON.parse(received.filter);
      //console.log("received 1", received.filter)

      //console.log("fleet", received.filter.fleet)
      //console.log("evId", received.filter.evId)

      if (received.filter.fleet && received.filter.fleet != '') {
        let queryFleet;
        if (received.filter.fleet === '-1') {
          queryFleet = {
            evId: '-1',
          };
        } else {
          queryFleet = {
            'ev.fleet': received.filter.fleet,
          };
        }

        query = Object.assign(query, queryFleet);
      }

      //Validate if have an EV
      if (received.filter.evId && received.filter.evId != '') {
        let queryEvId = {
          evId: received.filter.evId,
        };
        query = Object.assign(query, queryEvId);
      }

      //Validate if have network
      if (received.filter.network && received.filter.network != '') {
        let queryNetwork;

        switch (received.filter.network) {
          case 'MOBIE':
            queryNetwork = {
              network: received.filter.network,
            };
            break;

          case 'EVIO':
            queryNetwork = {
              network: received.filter.network,
              chargerOwner: { $ne: userId },
            };

            break;

          case 'INTERNAL':
            queryNetwork = {
              chargerOwner: userId,
            };

            break;

          default:
            queryNetwork = {
              chargerOwner: userId,
            };

            break;
        }
        /*if (received.filter.network === "MOBIE") {
                    queryNetwork = {
                        "chargerType": process.env.ChargerTypeMobie
                    };
                }
                else {
                    queryNetwork = {
                        "chargerType": { $ne: process.env.ChargerTypeMobie }
                    };
                };*/

        query = Object.assign(query, queryNetwork);
      }

      //Validate if have group of drivers
      if (
        received.filter.groupDriverId &&
        received.filter.groupDriverId != ''
      ) {
        let queryGroupDriver = {
          groupDrivers: { $exists: true },
          'groupDrivers.groupId': received.filter.groupDriverId,
        };

        //console.log("queryGroupDriver", queryGroupDriver);

        query = Object.assign(query, queryGroupDriver);
      }

      //Validate if have driver
      if (received.filter.driverId && received.filter.driverId != '') {
        let queryDriver = {
          userId: received.filter.driverId,
        };

        query = Object.assign(query, queryDriver);
      }
    } else {
      received.filter = JSON.parse(received.filter);

      //Validate if have infrastructure
      if (
        received.filter.infrastructure &&
        received.filter.infrastructure != ''
      ) {
        let queryInfrastructure = {
          'infrastructure._id': received.filter.infrastructure,
        };

        query = Object.assign(query, queryInfrastructure);
      }

      //Validate if have charger hwId
      if (received.filter.hwId && received.filter.hwId != '') {
        let queryHwId = {
          hwId: received.filter.hwId,
        };

        query = Object.assign(query, queryHwId);
      }

      //Validate if have an fleet
      if (received.filter.fleet && received.filter.fleet != '') {
        let queryFleet;
        if (received.filter.fleet === '-1') {
          queryFleet = {
            evId: '-1',
          };
        } else if (received.filter.fleet.toUpperCase() === 'OTHERS') {
          queryFleet = {
            $or: [
              {
                evId: '-1',
              },
              {
                $and: [
                  {
                    fleet: { $exists: true },
                  },
                  {
                    'fleet.createUserId': { $ne: query.chargerOwner },
                  },
                ],
              },
            ],
          };
        } else {
          queryFleet = {
            'ev.fleet': received.filter.fleet,
          };
        }

        query = Object.assign(query, queryFleet);
      }

      //Validate if have an EV
      if (received.filter.evId && received.filter.evId != '') {
        let queryEvId = {
          evId: received.filter.evId,
        };
        query = Object.assign(query, queryEvId);
      }

      //Query com grupos de CSUsers

      //Validate if have csUserId
      /*if (received.filter.csUserId && received.filter.csUserId != "") {
                ;
                let queryCSUserId;

                if (received.filter.csUserId.toUpperCase() === "OTHERS") {

                    queryCSUserId = {
                        "groupCSUsers": { $exists: false }
                    };

                } else {

                    queryCSUserId = {
                        userId: received.filter.csUserId
                    };

                };

                query = Object.assign(query, queryCSUserId);
            };*/

      //Query com as sessões de um grupo

      //Validate if have csGroupId
      if (received.filter.csGroupId && received.filter.csGroupId != '') {
        let queryCSGroupId;

        if (received.filter.csGroupId.toUpperCase() === 'OTHERS') {
          if (received.filter.csUserId && received.filter.csUserId != '') {
            if (received.filter.csUserId.toUpperCase() === 'OTHERS') {
              queryCSGroupId = {
                userId: { $ne: query.chargerOwner },
                'charger.listOfGroups': { $exists: false },
              };
            } else {
              queryCSGroupId = {
                userId: received.filter.csUserId,
              };
            }
          } else {
            queryCSGroupId = {
              $or: [
                {
                  userId: query.chargerOwner,
                },
                {
                  'charger.listOfGroups': { $exists: false },
                },
              ],
            };
          }

          console.log('queryCSGroupId', queryCSGroupId);
        } else {
          if (received.filter.csUserId && received.filter.csUserId != '') {
            let queryCSUserId;

            if (received.filter.csUserId.toUpperCase() === 'OTHERS') {
              queryCSGroupId = {
                'charger.listOfGroups.groupId': received.filter.csGroupId,
                'charger.listOfGroups': { $exists: false },
              };
            } else {
              queryCSGroupId = {
                'charger.listOfGroups.groupId': received.filter.csGroupId,
                userId: received.filter.csUserId,
              };
            }
          } else {
            queryCSGroupId = {
              'charger.listOfGroups.groupId': received.filter.csGroupId,
            };
          }
        }

        query = Object.assign(query, queryCSGroupId);
        //console.log("query", query);
      }
    }

    //console.log("query", query);
    resolve(query);
  });
}

function historyFind(query, fields, sort, options, type, userId, filter) {
  var context = 'Function historyFind';
  return new Promise(async (resolve, reject) => {
    try {
      let result = await History.find(query, fields, options).sort(sort).lean();

      if (result.length === 0) {
        resolve(result);
      } else {
        //console.log(result)
        //Errro abaixo daqui

        let responseFrontend = [];
        Promise.all(
          result.map((session) => {
            return new Promise((resolve) => {
              session = JSON.parse(JSON.stringify(session));
              if (type.toUpperCase() === 'CHARGERS') {
                if (session.evOwner != session.chargerOwner) {
                  //console.log("session.charger.listOfFleets", session.charger.listOfFleets)

                  let found;
                  if (session.charger?.listOfFleets?.length) {
                    found = session.charger.listOfFleets.find((fleet) => {
                      return (
                        fleet?.fleetId && fleet.fleetId === session?.ev?.fleet
                      );
                    });
                  }

                  //console.log("found", found);

                  if (found) {
                    //session.ev = "-";
                    if (session.fleet.shareEVData === false) {
                      session.ev = '-';
                    }
                    if (session.userEvOwner)
                      session.user.name = session.userEvOwner.name;
                    else session.user.name = '';
                  } else {
                    if (
                      !session?.user?._id ||
                      !checkSessionUserInListOfGroups(
                        session.charger,
                        session.user?._id,
                      )
                    ) {
                      session.ev = '-';
                      session.fleet = '-';
                      session.user = 'history_public';
                    }
                  }
                }
              }

              if (type.toUpperCase() === 'EVS') {
                console.log('userId: ' + userId);
                //Ver network
                if (session.chargerOwner === userId) {
                  session.network = 'history_internalNetwork';
                  if (session.charger)
                    session.charger.network = 'history_internalNetwork';
                }
              }

              session.timeCharged = session.timeCharged / 3600;
              session.totalPower = session.totalPower / 1000;

              if (session.fees) {
                session.vatRate = session.fees.IVA * 100;
              } else {
                session.vatRate = 23;
              }

              if (
                session.network === 'history_internalNetwork' ||
                session.network === 'EVIO' ||
                session.network === 'Go.Charge' ||
                session.network === 'GO.CHARGE'
              ) {
                if (session.costDetails) {
                  session.timeChargedInMin =
                    session.costDetails.timeCharged / 60;
                  session.totalTimeInMin = session.costDetails.totalTime / 60;
                  session.activationFee = session.costDetails.activationFee;
                  session.timeAfterChargedInMin =
                    session.costDetails.totalTime / 60 -
                    session.costDetails.timeCharged / 60;
                } else {
                  session.timeChargedInMin = 0;
                  session.totalTimeInMin = 0;
                  session.activationFee = 0;
                  session.timeAfterChargedInMin = 0;
                }

                if (session.tariff) {
                  if (session.tariff.tariff) {
                    if (session.tariff.tariff.chargingAmount)
                      if (
                        session.tariff.tariff.chargingAmount.uom?.toUpperCase() ===
                        'MIN'
                      ) {
                        session.tariffkWh = 0;
                        session.tariffMin =
                          session.tariff.tariff.chargingAmount.value;
                      } else {
                        session.tariffkWh =
                          session.tariff.tariff.chargingAmount.value;
                        session.tariffMin = 0;
                      }

                    session.parkingDuringChargingAmount = 0;
                    session.parkingAmount = 0;

                    if (session.tariff.tariff.parkingDuringChargingAmount)
                      session.parkingDuringChargingAmount =
                        session.tariff.tariff.parkingDuringChargingAmount.value;

                    if (session.tariff.tariff.parkingAmount)
                      session.parkingAmount =
                        session.tariff.tariff.parkingAmount.value;
                  } else {
                    session.tariffkWh = 0;
                    session.tariffMin = 0;
                    session.parkingDuringChargingAmount = 0;
                    session.parkingAmount = 0;
                  }
                } else {
                  session.tariffkWh = 0;
                  session.tariffMin = 0;
                  session.parkingDuringChargingAmount = 0;
                  session.parkingAmount = 0;
                }
              } else if (session.network === 'MobiE') {
                session.timeChargedInMin = session.timeCharged / 60;
                session.totalTimeInMin = session.totalTime / 60;
                session.cemeTariff = session.tariffCeme.tariff[0].price;
                if (session.finalPrices) {
                  if (session.finalPrices.othersPrice) {
                    let foundEgme = session.finalPrices.othersPrice.find(
                      (elem) => {
                        return elem.description.includes('Activation Fee');
                      },
                    );

                    let foundActivationFee =
                      session.finalPrices.othersPrice.find((elem) => {
                        return elem.description.includes('MobiE Grant');
                      });

                    if (foundEgme) {
                      session.egmeTariff = foundEgme.price.excl_vat;
                    } else {
                      session.egmeTariff = 0;
                    }

                    if (foundActivationFee) {
                      session.supportElectricMobility =
                        foundActivationFee.price.excl_vat;
                    } else {
                      session.supportElectricMobility = 0;
                    }
                  } else {
                    session.egmeTariff = 0;
                    session.supportElectricMobility = 0;
                  }
                } else {
                  session.egmeTariff = 0;
                  session.supportElectricMobility = 0;
                }
              } else {
                session.timeChargedInMin = session.timeCharged / 60;
                session.totalTimeInMin = session.totalTime / 60;

                if (session.tariffsDetailsRoaming) {
                  session.activationFee =
                    session.tariffsDetailsRoaming.flatCost;
                  session.timeCost = session.tariffsDetailsRoaming.timeCost;
                  session.energyCost = session.tariffsDetailsRoaming.energyCost;
                  session.tariffkWh =
                    session.tariffsDetailsRoaming.tariffEnergy;
                  session.tariffMin = session.tariffsDetailsRoaming.tariffTime;
                } else {
                  session.activationFee = 0;
                  session.timeCost = 0;
                  session.energyCost = 0;
                  session.tariffkWh = 0;
                  session.tariffMin = 0;
                }
              }

              responseFrontend.push(session);

              resolve();
            });
          }),
        )
          .then(() => {
            if (filter) {
              if (filter.fleet) {
                if (filter.fleet.toUpperCase() === 'OTHERS') {
                  /*let response = result.filter(session => {
                                    return session.user === "history_public";
                                })*/
                  let response = responseFrontend.filter((session) => {
                    return session.user === 'history_public';
                  });
                  resolve(response);
                } else {
                  //resolve(result);
                  resolve(responseFrontend);
                }
              } else {
                //resolve(result);
                resolve(responseFrontend);
              }
            } else {
              //resolve(result);
              resolve(responseFrontend);
            }
          })
          .catch((error) => {
            console.error(
              `[${context}][Promise all historyFind] Error `,
              error.message,
            );
            Sentry.captureException(error);
            resolve([]);
          });
      }
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      resolve([]);
    }
  });
}

function historyFindApp(query, fields, sort, options) {
  var context = 'Function historyFind';
  return new Promise(async (resolve, reject) => {
    try {
      let result = await History.find(query, fields, options).sort(sort);
      let newListSession = [];

      if (result.length === 0) {
        resolve(result);
      } else {
        Promise.all(
          result.map((session) => {
            return new Promise((resolve) => {
              session = JSON.parse(JSON.stringify(session));
              if (session.ev === '-1') {
                session.ev = {
                  _id: '-1',
                };
              }

              if (session.timeCharged) parseFloat(session.timeCharged);
              if (session.totalPower) parseFloat(session.totalPower);

              if (session.timeCharged)
                session.timeCharged = parseFloat(session.timeCharged) / 3600;
              if (session.totalPower)
                session.totalPower = parseFloat(session.totalPower) / 1000;
              newListSession.push(session);

              resolve();
            });
          }),
        ).then(() => {
          //console.log("result", result[0]);
          //console.log("newListSession", newListSession[0]);
          resolve(newListSession);
        });
      }
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      resolve([]);
    }
  });
}

// TODO: Refactor this function, because seems type and userId are not being used
async function historyFindExternalAPI(
  query,
  fields,
  sort,
  options,
  type,
  userId,
) {
  var context = 'Function historyFindExternalAPI';
  try {
    const filterWithoutExpiredSessions = {
      ...query,
      status: { $ne: 'EXPIRED' },
    };

    let result = await History.find(
      filterWithoutExpiredSessions,
      fields,
      options,
    )
      .sort(sort)
      .lean();
    const totalOfEntries = result.length;
    if (totalOfEntries === 0) return { sessions: [], totalOfEntries };
    const sessions = await Promise.all(
      result.map((session) => {
        if (session.status == '20') {
          session.status = 'CHARGING';
        } else {
          session.status = 'STOPPED';
        }

        if (!session.estimatedPrice) {
          session.estimatedPrice = 0;
        }

        if (!session.finalPrice) {
          session.finalPrice = 0;
        }

        if (!session.paymentStatus) {
          session.paymentStatus = 'NA';
        }

        if (!session.readingPoints) {
          session.readingPoints = [];
        }

        session.timeCharged = session.timeCharged / 3600;
        session.totalPower = session.totalPower / 1000;
        return session;
      }),
    );
    return { sessions, totalOfEntries };
  } catch (error) {
    console.error(`[${context}] Error`, error.message);
    return { sessions: [], totalOfEntries: 0 };
  }
}

function getInfoPaymentBilling(history) {
  const context = 'Function getInfoPaymentBilling';
  return new Promise(async (resolve, reject) => {
    try {
      if (!history.paymentMethod) {
        resolve(process.env.PaymentBillingInfoNotApplicable);
      } else if (history.paymentMethod === process.env.PaymentMethodNotPay) {
        resolve(process.env.PaymentBillingInfoNotApplicable);
      } else if (
        history.paymentMethod === process.env.PaymentMethodUnknown ||
        history.paymentMethod === process.env.PaymentMethodUnknownPayments
      ) {
        resolve(process.env.PaymentBillingInfoFailedPayment);
      } else if (history.paymentMethod === process.env.PaymentMethodPlafond) {
        resolve(process.env.PaymentBillingInfoToProcess);
      } else if (
        history.paymentMethod === process.env.PaymentMethodTypeTransfer ||
        history.paymentMethod === process.env.PaymentMethodTransfer
      ) {
        resolve(process.env.PaymentBillingInfoToProcess);
      } else {
        let payment = false;
        let billing = false;
        let paymentFound;
        let invoiceFound;

        if (history.paymentId && history.paymentId !== '-1') {
          paymentFound = await PaymentsHandler.getPayment(history.paymentId);

          switch (paymentFound.status) {
            case process.env.PaymentStatusCanceled:
              payment = true;
              break;
            case process.env.PaymentStatusPaidOut:
              payment = true;
              break;
            case process.env.PaymentStatusRefund:
              payment = true;
              break;
            case process.env.PaymentStatusWaitingCapturByEVIO:
              payment = true;
              break;
            default:
              payment = false;
              break;
          }
        }
        if (payment) {
          //Paid

          if (
            paymentFound.status === process.env.PaymentStatusWaitingCapturByEVIO
          ) {
            resolve(process.env.PaymentBillingInfoBilledAndNotPaid);
          } else {
            if (history.invoiceId && history.invoiceId !== '-1') {
              invoiceFound = await BillingHandler.getInvoice(history.invoiceId);
              if (invoiceFound.status === process.env.createdStatus) {
                billing = true;
              } else {
                billing = false;
              }
            }
            if (billing) {
              //Billed
              resolve(process.env.PaymentBillingInfoPaidAndBilled);
            } else {
              //Not Billed
              if (invoiceFound) {
                if (invoiceFound.status === process.env.processingStatus) {
                  resolve(process.env.PaymentBillingInfoPaid);
                } else {
                  resolve(process.env.PaymentBillingInfoFailedBilling);
                }
              } else {
                resolve(process.env.PaymentBillingInfoPaid);
              }
            }
          }
        } else {
          //Not Paid
          if (paymentFound) {
            if (paymentFound.status === process.env.PaymentStatusInPayment) {
              resolve(process.env.PaymentBillingInfoFailedPayment);
            } else {
              resolve(process.env.PaymentBillingInfoToProcess);
            }
          } else {
            resolve(process.env.PaymentBillingInfoToProcess);
          }
        }
      }
    } catch (error) {
      console.error(`[${context}] Error : ${error.message}`);
      resolve(process.env.PaymentBillingInfoToProcess);
    }
  });
}

async function getInfoStatusBilling(history) {
  const context = 'Function getInfoStatusBilling';

  console.info(`${context} - sessionId`, history.sessionId);
  const invoice = await mapInvoiceWithSession(history);

  console.info(
    `${context} - history.invoice.documentNumber:`,
    invoice.documentNumber,
  );

  const sessionBillingInfo = await mapSessionBillingInfo(invoice.session);

  const isSameUser = history.userId === history.userIdWillPay;

  console.info('sessionBillingData', {
    status:
      sessionBillingInfo.sameUser?.status ||
      sessionBillingInfo.differentUser?.status,
    description:
      sessionBillingInfo.sameUser?.description ||
      sessionBillingInfo.differentUser?.description,
    user: isSameUser ? 'sameUser' : 'differentUser',
  });

  const { session, ...invoiceWithoutSession } = invoice;

  return { sessionBillingInfo, invoice: invoiceWithoutSession };
}

async function mapSessionBillingInfo(history) {
  const hasTotalPrice = history?.totalPrice !== undefined;

  const sameUserData = hasTotalPrice
    ? mapSessionBillingInfoForSameUserInternalNetwork(history)
    : mapSessionBillingInfoForSameUserExternalNetwork(history);

  const differentUserData = hasTotalPrice
    ? mapSessionBillingInfoForDifferentUserInternalNetwork(history)
    : mapSessionBillingInfoForDifferentUserExternalNetwork(history);

  return {
    ...sameUserData,
    ...differentUserData,
  };
}

function mapSessionBillingInfoForSameUserExternalNetwork(history) {
  const mappingRules = [
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId === '-1' &&
        h.paymentStatus === 'UNPAID',
      status: BillingEnums.Status.ESTIMATION,
      description: BillingEnums.Description.ESTIMATION,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        ![PaymentMethodEnums.TRANSFER, PaymentMethodEnums.NOT_PAY].includes(
          h.paymentMethod,
        ),
      status: BillingEnums.Status.NOT_PAID,
      description: BillingEnums.Description.NOT_PAID,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER &&
        h.billingPeriod !== 'AD_HOC',
      status: BillingEnums.Status.IN_BILLING,
      description: BillingEnums.Description.IN_BILLING,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER &&
        h.billingPeriod === 'AD_HOC',
      status: BillingEnums.Status.FAILED_BILLING,
      description: BillingEnums.Description.FAILED_BILLING_SUPPORT,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'PAID' &&
        h.billingPeriod === 'AD_HOC',
      status: BillingEnums.Status.FAILED_BILLING,
      description: BillingEnums.Description.FAILED_BILLING,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'PAID' &&
        h.billingPeriod !== 'AD_HOC',
      status: BillingEnums.Status.IN_BILLING,
      description: BillingEnums.Description.IN_BILLING_PAID,
    },
    {
      condition: (h) =>
        h?.invoiceStatus &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        ![PaymentMethodEnums.TRANSFER, PaymentMethodEnums.NOT_PAY].includes(
          h.paymentMethod,
        ),
      status: BillingEnums.Status.MISSING_PAYMENT,
      description: BillingEnums.Description.MISSING_PAYMENT,
    },
    {
      condition: (h) =>
        h?.invoiceStatus &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER,
      status: BillingEnums.Status.INVOICED,
      description: null,
    },
    {
      condition: (h) =>
        h?.invoiceStatus &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'PAID',
      status: BillingEnums.Status.INVOICED_PAID,
      description: null,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        h.paymentMethod === PaymentMethodEnums.NOT_PAY,
      status: BillingEnums.Status.NOT_BILLABLE,
      description: BillingEnums.Description.NOT_BILLABLE,
    },
    {
      condition: (h) => [60, 'EXPIRED'].includes(h.status),
      status: BillingEnums.Status.NOT_BILLABLE,
      description: BillingEnums.Description.NOT_BILLABLE,
    },
    {
      condition: (h) => (h.total_cost && h.total_cost.excl_vat) <= 0,
      status: BillingEnums.Status.NOT_BILLABLE,
      description: BillingEnums.Description.NOT_BILLABLE,
    },
    {
      condition: () => true,
      status: BillingEnums.Status.UNKNOWN,
      description: BillingEnums.Description.UNKNOWN,
    },
  ];

  const result = mappingRules.find((rule) => rule.condition(history)) || {
    status: BillingEnums.Status.UNKNOWN,
    description: BillingEnums.Description.UNKNOWN,
  };

  console.info('mapSessionBillingInfoForSameUserExternalNetwork', {
    invoiceProcessed: history.invoiceStatus,
    status: history.status,
    cdrId: history.cdrId,
    paymentStatus: history.paymentStatus,
    paymentMethod: history.paymentMethod,
    totalCostExclVat: history.total_cost?.excl_vat,
    billingPeriod: history.billingPeriod,
    id: history._id,
    enum: result.status,
  });

  return {
    sameUser: {
      status: result.status,
      description: result.description,
    },
  };
}

function mapSessionBillingInfoForDifferentUserExternalNetwork(history) {
  const mappingRules = [
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId === '-1' &&
        h.paymentStatus === 'UNPAID' &&
        !h?.invoiceStatus,
      status: BillingEnums.Status.ESTIMATION,
      description: BillingEnums.Description.ESTIMATION,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        !h?.invoiceStatus &&
        h.paymentMethod !== PaymentMethodEnums.TRANSFER,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        !h?.invoiceStatus &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER &&
        h.billingPeriod !== 'AD_HOC',
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        !h?.invoiceStatus &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER &&
        h.billingPeriod === 'AD_HOC',
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'PAID' &&
        !h?.invoiceStatus &&
        h.billingPeriod === 'AD_HOC',
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'PAID' &&
        !h?.invoiceStatus &&
        h.billingPeriod !== 'AD_HOC',
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        h?.invoiceStatus &&
        h.paymentMethod !== PaymentMethodEnums.TRANSFER,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        h?.invoiceStatus &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'PAID' &&
        h?.invoiceStatus,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0 &&
        h.cdrId !== '-1' &&
        h.paymentStatus === 'UNPAID' &&
        h?.invoiceStatus &&
        h.paymentMethod === PaymentMethodEnums.NOT_PAY,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['60', 'EXPIRED'].includes(h.status) &&
        (h.total_cost && h.total_cost.excl_vat) > 0,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) => (h.total_cost && h.total_cost.excl_vat) <= 0,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: () => true,
      status: BillingEnums.Status.UNKNOWN,
      description: BillingEnums.Description.UNKNOWN,
    },
  ];

  const result = mappingRules.find((rule) => rule.condition(history)) || {
    status: BillingEnums.Status.UNKNOWN,
    description: BillingEnums.Description.UNKNOWN,
  };

  console.info('mapSessionBillingInfoForDifferentUserExternalNetwork', {
    invoiceProcessed: history.invoiceStatus,
    status: history.status,
    cdrId: history.cdrId,
    paymentStatus: history.paymentStatus,
    paymentMethod: history.paymentMethod,
    totalCostExclVat: history.total_cost?.excl_vat,
    billingPeriod: history.billingPeriod,
    id: history._id,
    enum: result.status,
  });

  return {
    differentUser: {
      status: result.status,
      description: result.description,
    },
  };
}

function mapSessionBillingInfoForSameUserInternalNetwork(history) {
  // Check if tariff exists and is billable
  const billableCheckResult = checkIfTariffIsBillable(history);
  if (billableCheckResult) {
    return billableCheckResult;
  }

  const mappingRules = [
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.paymentStatus === 'UNPAID' &&
        ![PaymentMethodEnums.TRANSFER, PaymentMethodEnums.NOT_PAY].includes(
          h.paymentMethod,
        ),
      status: BillingEnums.Status.NOT_PAID,
      description: BillingEnums.Description.NOT_PAID,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.paymentStatus === 'UNPAID' &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER &&
        h.billingPeriod !== 'AD_HOC',
      status: BillingEnums.Status.IN_BILLING,
      description: BillingEnums.Description.IN_BILLING,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.paymentStatus === 'UNPAID' &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER &&
        h.billingPeriod === 'AD_HOC',
      status: BillingEnums.Status.FAILED_BILLING,
      description: BillingEnums.Description.FAILED_BILLING_SUPPORT,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.paymentStatus === 'PAID' &&
        h.billingPeriod === 'AD_HOC',
      status: BillingEnums.Status.FAILED_BILLING,
      description: BillingEnums.Description.FAILED_BILLING,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.paymentStatus === 'PAID' &&
        h.billingPeriod !== 'AD_HOC',
      status: BillingEnums.Status.IN_BILLING,
      description: BillingEnums.Description.IN_BILLING_PAID,
    },
    {
      condition: (h) =>
        h?.invoiceStatus &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.paymentStatus === 'UNPAID' &&
        ![PaymentMethodEnums.TRANSFER, PaymentMethodEnums.NOT_PAY].includes(
          h.paymentMethod,
        ),
      status: BillingEnums.Status.MISSING_PAYMENT,
      description: BillingEnums.Description.MISSING_PAYMENT,
    },
    {
      condition: (h) =>
        h?.invoiceStatus &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.paymentStatus === 'UNPAID' &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER,
      status: BillingEnums.Status.INVOICED,
      description: null,
    },
    {
      condition: (h) =>
        h?.invoiceStatus &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.paymentStatus === 'PAID',
      status: BillingEnums.Status.INVOICED_PAID,
      description: null,
    },
    {
      condition: (h) =>
        !h?.invoiceStatus &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        h.paymentStatus === 'UNPAID' &&
        h.paymentMethod === PaymentMethodEnums.NOT_PAY,
      status: BillingEnums.Status.NOT_BILLABLE,
      description: BillingEnums.Description.NOT_BILLABLE,
    },
    {
      condition: (h) => [60, 'EXPIRED'].includes(h.status),
      status: BillingEnums.Status.NOT_BILLABLE,
      description: BillingEnums.Description.NOT_BILLABLE,
    },
    {
      condition: (h) => (h.totalPrice && h.totalPrice.excl_vat) <= 0,
      status: BillingEnums.Status.NOT_BILLABLE,
      description: BillingEnums.Description.NOT_BILLABLE,
    },
    {
      condition: () => true,
      status: BillingEnums.Status.UNKNOWN,
      description: BillingEnums.Description.UNKNOWN,
    },
  ];

  const result = mappingRules.find((rule) => rule.condition(history)) || {
    status: BillingEnums.Status.UNKNOWN,
    description: BillingEnums.Description.UNKNOWN,
  };

  console.info('mapSessionBillingInfoForSameUserInternalNetwork', {
    invoiceProcessed: history.invoiceStatus,
    status: history.status,
    paymentStatus: history.paymentStatus,
    paymentMethod: history.paymentMethod,
    totalPriceExclVat: history.totalPrice?.excl_vat,
    billingPeriod: history.billingPeriod,
    id: history._id,
    enum: result.status,
  });

  return {
    sameUser: {
      status: result.status,
      description: result.description,
    },
  };
}

function mapSessionBillingInfoForDifferentUserInternalNetwork(history) {
  // Check if tariff exists and is billable
  const billableCheckResult = checkIfTariffIsBillable(history);
  if (billableCheckResult) {
    return billableCheckResult;
  }

  const mappingRules = [
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        h.paymentStatus === 'UNPAID' &&
        !h?.invoiceStatus &&
        h.paymentMethod !== PaymentMethodEnums.TRANSFER,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        h.paymentStatus === 'UNPAID' &&
        !h?.invoiceStatus &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER &&
        h.billingPeriod !== 'AD_HOC',
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        h.paymentStatus === 'UNPAID' &&
        !h?.invoiceStatus &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER &&
        h.billingPeriod === 'AD_HOC',
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        h.paymentStatus === 'PAID' &&
        !h?.invoiceStatus &&
        h.billingPeriod === 'AD_HOC',
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        h.paymentStatus === 'PAID' &&
        !h?.invoiceStatus &&
        h.billingPeriod !== 'AD_HOC',
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        h.paymentStatus === 'UNPAID' &&
        h?.invoiceStatus &&
        h.paymentMethod !== PaymentMethodEnums.TRANSFER,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        h.paymentStatus === 'UNPAID' &&
        h?.invoiceStatus &&
        h.paymentMethod === PaymentMethodEnums.TRANSFER,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        h.paymentStatus === 'PAID' &&
        h?.invoiceStatus,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['40', '70', 'COMPLETED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0 &&
        h.paymentStatus === 'UNPAID' &&
        h?.invoiceStatus &&
        h.paymentMethod === PaymentMethodEnums.NOT_PAY,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) =>
        ['60', 'EXPIRED'].includes(h.status) &&
        (h.totalPrice && h.totalPrice.excl_vat) > 0,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: (h) => (h.totalPrice && h.totalPrice.excl_vat) <= 0,
      status: BillingEnums.Status.CLOSED,
      description: null,
    },
    {
      condition: () => true,
      status: BillingEnums.Status.UNKNOWN,
      description: BillingEnums.Description.UNKNOWN,
    },
  ];

  const result = mappingRules.find((rule) => rule.condition(history)) || {
    status: BillingEnums.Status.UNKNOWN,
    description: BillingEnums.Description.UNKNOWN,
  };

  console.info('mapSessionBillingInfoForDifferentUserInternalNetwork', {
    invoiceProcessed: history.invoiceStatus,
    status: history.status,
    paymentStatus: history.paymentStatus,
    paymentMethod: history.paymentMethod,
    totalPriceExclVat: history.totalPrice?.excl_vat,
    billingPeriod: history.billingPeriod,
    id: history._id,
    enum: result.status,
  });

  return {
    differentUser: {
      status: result.status,
      description: result.description,
    },
  };
}

function checkIfTariffIsBillable(history) {
  const isBillable =
    history.tariff && history.tariff.billingType === 'billingTypeForBilling';

  if (!history.tariff || !history.tariff.billingType || !isBillable) {
    return {
      sameUser: {
        status: BillingEnums.Status.NOT_BILLABLE,
        description: BillingEnums.Description.NOT_BILLABLE,
      },
    };
  }

  return null;
}

async function mapInvoiceWithSession(history) {
  const context = 'mapInvoiceWithSession';
  console.info(
    `[${context}] Mapping invoice with session for sessionId: ${history.sessionId}`,
  );

  let session;

  if (
    Number.isNaN(Number(history.sessionId)) ||
    ['003', '004', '009', '010', '015'].includes(history?.chargerType)
  ) {
    session = await OcpiSessionRepository.findBySessionId(history.sessionId);
  } else {
    session = await findBySessionId(Number(history.sessionId));
  }

  if (session?.invoiceId) {
    console.info(
      `[${context}] Found invoiceId: ${session.invoiceId} for sessionId: ${history.sessionId}`,
    );

    return {
      processed: true,
      documentNumber: session?.documentNumber || '',
      session,
    };
  }

  console.warn(
    `[${context}] No invoice found for sessionId: ${history.sessionId}`,
  );
  return {
    processed: false,
    documentNumber: '',
    session,
  };
}

function modififyChargeTime(sessions) {
  const context = 'Function modififyChargeTime';
  try {
    for (let i = 0; i != sessions.length; i++) {
      if (sessions[i].timeCharged) {
        sessions[i].timeChargedInMinExcel =
          Math.round(sessions[i].timeCharged * 60 * 1000) / 1000;
        let hour = Math.floor(sessions[i].timeCharged);
        let min = Math.floor((sessions[i].timeCharged % 1) * 60);
        let sec = Math.round((sessions[i].timeCharged * 3600) % 60);
        sessions[i].timeChargedInMin = '';
        if (hour > 0) sessions[i].timeChargedInMin += hour + 'h ';
        if (min > 0 || hour > 0) sessions[i].timeChargedInMin += min + 'm ';
        sessions[i].timeChargedInMin += sec + 's';
      }
    }
  } catch (error) {
    console.error(`[${context}] Error`, error.message);
  }
}

function modififyTotalTimeInMin(sessions) {
  const context = 'Function modififyTotalTimeInMin';
  try {
    for (let i = 0; i != sessions.length; i++) {
      if (sessions[i].totalTimeInMin) {
        sessions[i].totalTimeInMinExcel =
          Math.round(sessions[i].totalTimeInMin * 1000) / 1000;
        let hour = Math.floor(sessions[i].totalTimeInMin / 60);
        let min = Math.floor(sessions[i].totalTimeInMin % 60);
        let sec = Math.round((sessions[i].totalTimeInMin % 1) * 60);
        sessions[i].totalTimeInMin = '';
        if (hour > 0) sessions[i].totalTimeInMin += hour + 'h ';
        if (min > 0 || hour > 0) sessions[i].totalTimeInMin += min + 'm ';
        sessions[i].totalTimeInMin += sec + 's';
      } else {
        if (sessions[i].timeCharged) {
          sessions[i].totalTimeInMinExcel =
            Math.round(sessions[i].timeCharged * 60 * 1000) / 1000;
          let hour = Math.floor(sessions[i].timeCharged);
          let min = Math.floor((sessions[i].timeCharged % 1) * 60);
          let sec = Math.round((sessions[i].timeCharged * 3600) % 60);
          sessions[i].totalTimeInMin = '';
          if (hour > 0) sessions[i].totalTimeInMin += hour + 'h ';
          if (min > 0 || hour > 0) sessions[i].totalTimeInMin += min + 'm ';
          sessions[i].totalTimeInMin += sec + 's';
        }
      }
    }
  } catch (error) {
    console.error(`[${context}] Error`, error.message);
  }
}

//TODO Descubrir o valor misterio
//Parking (min)
//timeAfterChargedInMin
function modififytTimeAfterChargedInMin(sessions) {
  const context = 'Function modififytTimeAfterChargedInMin';
  try {
    for (let i = 0; i != sessions.length; i++) {
      if (sessions[i].timeAfterChargedInMin) {
        sessions[i].timeAfterChargedInMinExcel =
          Math.round(sessions[i].timeAfterChargedInMin * 1000) / 1000;
        let hour = Math.floor(sessions[i].timeAfterChargedInMin / 60);
        let min = Math.floor(sessions[i].timeAfterChargedInMin % 60);
        let sec = Math.round((sessions[i].timeAfterChargedInMin % 1) * 60);
        sessions[i].timeAfterChargedInMin = '';
        if (hour > 0) sessions[i].timeAfterChargedInMin += hour + 'h ';
        if (min > 0 || hour > 0)
          sessions[i].timeAfterChargedInMin += min + 'm ';
        sessions[i].timeAfterChargedInMin += sec + 's';
      } else {
        sessions[i].timeAfterChargedInMin = '0s';
        sessions[i].timeAfterChargedInMinExcel = 0;
      }
    }
  } catch (error) {
    console.error(`[${context}] Error`, error.message);
  }
}

async function updateHistoryBilling(body, paymentId) {
  const context = 'Function updateHistoryBilling';
  try {
    let query = {
      paymentId: paymentId,
    };

    const historyV2Found = await History.findOne(query);

    if (!historyV2Found) {
      console.log(
        `[${context}] History v2 not found for paymentId: ${paymentId}`,
      );
      return;
    }

    const response = await updateHistoriesInvoicePayment(
      historyV2Found,
      body,
      query,
    );

    return response;
  } catch (error) {
    console.error(`[${context}] Error`, error.message);
    throw error;
  }
}

async function updateHistoriesInvoicePayment(historyFound, body, query) {
  const context = 'updateHistoriesInvoicePayment';

  let invoiceId = body._id;
  let invoiceStatus = true;

  console.info(`[${context}] Starting update for invoiceId: ${invoiceId}`);

  historyFound.invoiceId = invoiceId;
  historyFound.invoiceStatus = invoiceStatus;

  console.info(`[${context}] Fetching payment billing info...`);
  let paymentBillingInfo = await getInfoPaymentBilling(historyFound);
  console.info(`[${context}] Payment billing info fetched.`);

  console.info(`[${context}] Fetching status billing info...`);
  const statusBillingInfo = await getInfoStatusBilling(historyFound);
  console.info(`[${context}] Status billing info fetched.`);

  let history = {
    invoiceId: invoiceId,
    invoiceStatus: invoiceStatus,
    paymentBillingInfo: paymentBillingInfo,
    sessionBillingInfo: statusBillingInfo.sessionBillingInfo,
    invoice: statusBillingInfo.invoice,
    documentNumber: body.documentNumber,
  };

  let response = await History.findOneAndUpdate(query, { $set: history });
  console.info(`[${context}] Update complete`);

  return response;
}

function renameFinalPriceExclVat(session) {
  return {
    ...session,
    finalPriceExclVat: session?.totalPrice?.excl_vat,
    totalPrice: undefined,
  };
}

function renameEvsFields(session) {
  return {
    ...session,
    evBrand: session?.ev?.brand,
    evModel: session?.ev?.model,
    evLicensePlate: session?.ev?.licensePlate,
    ev: undefined,
  };
}

function renameFieldsPipeline(sessions) {
  return sessions.map(renameFinalPriceExclVat).map(renameEvsFields);
}

async function buildResponse(query, commonFields, sort, options, type, userId) {
  console.log('Response', JSON.stringify(query, 0, 2), sort, options, type);
  const { sessions, totalOfEntries } = await historyFindExternalAPI(
    query,
    commonFields,
    sort,
    options,
    type,
    userId,
  );
  const calculateNumberOfPagesForNonPaginatedQuery =
    options?.limit > 0 ? Math.ceil(totalOfEntries / options.limit) : 1;

  return {
    sessions: renameFieldsPipeline(sessions),
    totalOfEntries,
    numberOfPages: calculateNumberOfPagesForNonPaginatedQuery,
  };
}
