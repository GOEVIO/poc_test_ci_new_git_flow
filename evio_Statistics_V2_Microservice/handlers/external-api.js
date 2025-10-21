require('dotenv-safe').load();
const Sentry = require('@sentry/node');
const {
  historyTypeEnums,
} = require('../utils/enums/historyEnums');

const { findInvoiceByDocumentNumber } = require('evio-library-billing/dist').default;

const HistoryV2 = require('../models/historyV2');
const { createOptions, projectInvoiceDetails, createQuery } = require('../middlewares/history');

async function historyFindExternalAPIOnlyInvoiceDetails(
  query,
  project,
  sort,
  options
) {
  const context = 'Function historyFindExternalAPIOnlyInvoiceDetails';
  try {
    const [sessions, total] = await Promise.all([
      HistoryV2.aggregate([
        { $match: query },
        { $unwind: "$invoiceDetails" },
        { $project: project },
        { $sort: sort },
        { $skip: options.skip || 0 },
        { $limit: options.limit || 10 }
      ]),
      HistoryV2.aggregate([
        { $match: query },
        { $unwind: "$invoiceDetails" },
        { $count: "total" }
      ])
    ])

    const totalOfEntries = sessions.length;
    if (!totalOfEntries) return { sessions: [], totalOfEntries, total: 0 };

    return { sessions, totalOfEntries, total: total[0] };
  } catch (error) {
    console.error(`[${context}] Error`, error.message);
    return { sessions: [], totalOfEntries: 0, total: 0 };
  }
}

async function buildOnlyInvoiceDetailsResponse(query, project, sort, options, type, userId) {
  const { sessions, totalOfEntries, total } = await historyFindExternalAPIOnlyInvoiceDetails(
    query,
    project,
    sort,
    options
  );
  const calculateNumberOfPagesForNonPaginatedQuery =
    options?.limit > 0 ? Math.ceil(totalOfEntries / options.limit) : 1;

  return {
    sessions,
    totalOfEntries,
    numberOfPages: calculateNumberOfPagesForNonPaginatedQuery,
    totalDocuments: total,
  };
}

const getHistoryExternalAPIOnlyInvoiceDetails = async (req) => {
  const context = 'Function getHistoryExternalAPIOnlyInvoiceDetails';
  try {
    const { startDate, endDate, type } = req.query;
    let { pageNumber = 1, limitQuery = process.env.LimiteQuery } = req.query;
    const userId = req.headers['userid'];
    pageNumber = Number(pageNumber);
    limitQuery = Number(limitQuery);

    const options = createOptions(pageNumber, limitQuery);
    const sort = { startDate: -1, _id: -1 };
    const project = projectInvoiceDetails();

    if (req.query.documentNumber) {
      const fetchedInvoice = await findInvoiceByDocumentNumber(
        req.query.documentNumber,
      );
      const query = { invoiceId: fetchedInvoice._id, userIdWillPay: userId };

      return await buildOnlyInvoiceDetailsResponse(query, project, sort, {}, type, userId);
    }

    let response;
    switch (type.toUpperCase()) {
      case historyTypeEnums.Evs:
        const primaryCondition = userId
          ? { $or: [{ userId }, { evOwner: userId }] }
          : {};
        const queryEvs = createQuery(
          {},
          primaryCondition,
          'startDate',
          startDate,
          endDate,
        );
        response = await buildOnlyInvoiceDetailsResponse(
          queryEvs,
          project,
          sort,
          options,
          type,
          userId,
        );
        break;
      case historyTypeEnums.Chargers:
        const queryChargers = createQuery(
          {},
          {
            chargerOwner: userId,
            network: networkEnums.evio,
          },
          'startDate',
          startDate,
          endDate,
        );
        response = await buildOnlyInvoiceDetailsResponse(
          queryChargers,
          project,
          sort,
          options,
          type,
          userId,
        );
        break;
      default:
        throw new Error('Type not supported')
    }

    return response;
  } catch (error) {
    console.error(`[${context}] Error`, error.message);
    Sentry.captureException(error);
    if(error.message === 'Type not supported'){
      throw {
        auth: false,
        code: 'server_type_not_supported',
        message: 'Type not supported',
      };
    }
    throw {
      auth: false,
      code: 'server_error',
      message: 'Internal server error',
    };
  }

}

module.exports = {
  getHistoryExternalAPIOnlyInvoiceDetails,
};