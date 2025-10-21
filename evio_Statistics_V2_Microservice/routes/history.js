const express = require('express');
const router = express.Router();
const History = require('../handlers/historyHandler');
const ErrorHandler = require('../handlers/errorHandler');
const HistoryDB = require('../models/historyV2');
const { Constants } = require('../utils/constants');
require('dotenv-safe').load();

const { sortby } = require('../helpers/sort.by');

//========== DEPRECATED ROUTES ==========
router.post('/', (req, res) => {
  console.warn(`Route POST: ${req.originalUrl} is deprecated`);
  return res.status(410).send({
    message: 'This endpoint is deprecated.',
  });
});

router.post('/runFirstTime', (req, res) => {
  console.warn(`Route POST: ${req.originalUrl} is deprecated`);
  return res.status(410).send({
    message: 'This endpoint is deprecated.',
  });
});

router.patch('/', (req, res) => {
  console.warn(`Route PATCH: ${req.originalUrl} is deprecated`);
  return res.status(410).send({
    message: 'This endpoint is deprecated.',
  });
});

router.patch('/ev/acceptKMs', (req, res) => {
  console.warn(`Route PATCH: ${req.originalUrl} is deprecated`);
  return res.status(410).send({
    message: 'This endpoint is deprecated.',
  });
});

router.patch('/ev/updateKMs', (req, res) => {
  console.warn(`Route PATCH: ${req.originalUrl} is deprecated`);
  return res.status(410).send({
    message: 'This endpoint is deprecated.',
  });
});

router.patch('/updatePaymentHistory', (req, res) => {
  console.warn(`Route PATCH: ${req.originalUrl} is deprecated`);
  return res.status(410).send({
    message: 'This endpoint is deprecated.',
  });
});

router.patch('/updateInvoiceHistory', (req, res) => {
  console.warn(`Route PATCH: ${req.originalUrl} is deprecated`);
  return res.status(410).send({
    message: 'This endpoint is deprecated.',
  });
});

router.patch('/session/cdr', (req, res) => {
  console.warn(`Route PATCH: ${req.originalUrl} is deprecated`);
  return res.status(410).send({
    message: 'This endpoint is deprecated.',
  });
});

//========== PATCH ==========
// it will update the the kms of a specific charging session
// Do not remove the endpoint, as it is used
router.patch('/session/kms', async (req, res) => {
  const context = 'PATCH /api/private/history_v2/session/kms';
  try {
    const evKms = req.body.updateObject;
    const sessionID = req.body.sessionID;
    if (!sessionID || !evKms) {
      console.error(`[${context}] Error - Missing input variables`);
      return res.status(400).send({
        auth: false,
        code: 'error',
        message: 'Missing input variables',
      });
    }
    let query = {
      sessionId: sessionID,
    };

    HistoryDB.findOneAndUpdate(query, { $set: evKms }, (err, result) => {
      if (err) {
        console.error(`[${context}][History.updateMany] Error`, err.message);
        return res
          .status(500)
          .send({ auth: false, code: 'error', message: 'err.message' });
      } else
        res
          .status(200)
          .send({ auth: true, code: 'success', message: 'Success' });
    });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

// Do not remove the endpoint, as it is used
router.patch('/updateImage', (req, res) => {
  const context = 'PATCH /api/private/history_v2/updateImage';
  try {
    switch (req.body.type) {
      case 'CHARGERS':
        History.updateImageChargersHistory(req, res)
          .then((result) => {
            return res.status(200).send(result);
          })
          .catch((error) => {
            console.error(
              `[${context}][History.updateImageChargersHistory] Error `,
              error.message,
            );
            ErrorHandler.ErrorHandler(error, res);
          });
        break;
      case 'EVS':
        History.updateImageEVsHistory(req, res)
          .then((result) => {
            return res.status(200).send(result);
          })
          .catch((error) => {
            console.error(
              `[${context}][History.updateImageEVsHistory] Error `,
              error.message,
            );
            ErrorHandler.ErrorHandler(error, res);
          });
        break;
      default:
        let message = {
          auth: false,
          code: 'server_code_type_authorize',
          message: 'Type not authorize',
        };
        ErrorHandler.ErrorHandler(message, res);
        break;
    }
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

// Do not remove the endpoint, as it is used
router.patch('/updateBillingHistory', async (req, res) => {
  const context = 'PATCH /api/private/history_v2/updateBillingHistory';
  try {
    const historyResult = await History.updateBillingHistory(req.body);
    return res.status(200).send(historyResult);
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

// Do not remove the endpoint, as it is used
router.patch('/anonymizeUserDataHistory', async (req, res) => {
  const context = 'PATCH /api/private/history_v2/anonymizeUserDataHistory';

  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).send({ message: 'UserId is required' });
    }

    await History.anonymizeUserDataHistory(userId);

    return res
      .status(200)
      .send({ message: 'User history data anonymized successfully' });
  } catch (error) {
    console.error(`[${context}] Error:`, error.message);
    return ErrorHandler.ErrorHandler(error, res);
  }
});

// Do not remove the endpoint, as it is used
router.patch('/session/acceptKMs', async (req, res) => {
  const context = 'PATCH /api/private/history_v2/session/acceptKMs';
  try {
    const arrayEvID = req.body.evID;
    const acceptKMs = req.body.acceptKMs;

    if (!Array.isArray(arrayEvID) || typeof acceptKMs !== 'boolean') {
      console.log(`[${context}] Error - Missing input variables`);
      return res.status(400).send('Missing input variables');
    }
    let query = null;
    if (arrayEvID.length > 1) {
      let ids = [];
      for (let evID of arrayEvID) {
        ids.push({ evId: evID });
      }
      query = { $or: ids };
    } else {
      query = {
        evId: arrayEvID[0],
      };
    }

    HistoryDB.updateMany(query, {
      $set: { acceptKMs: acceptKMs, 'ev.acceptKMs': acceptKMs },
    })
      .then(function (updated) {
        return res.status(200).send(true);
      })
      .catch(function (error) {
        console.error(`[${context}] Error updateMany`, error.message);
        ErrorHandler.ErrorHandler(error, res);
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

// Do not remove the endpoint, as it is used
router.patch('/session/updateKMs', async (req, res) => {
  const context = 'PATCH /api/private/history_v2/session/updateKMs';
  try {
    const arrayEvID = req.body.evID;
    const sessionId = req.body.sessionID;
    const updateKMs = req.body.updateKMs;
    if (
      (!Array.isArray(arrayEvID) && !sessionId) ||
      typeof updateKMs !== 'boolean' ||
      (arrayEvID && arrayEvID.length < 1)
    ) {
      console.log('Missing input variables');
      return res.status(400).send('Missing input variables');
    }

    if (arrayEvID) query = { evId: { $in: arrayEvID } };
    else query = { sessionId };

    if (updateKMs) query.evKms = { $exists: false };

    const updated = await HistoryDB.updateMany(query, {
      $set: { updateKMs: updateKMs, 'ev.acceptKMs': updateKMs },
    });
    if (!updated) {
      console.error(`[${context}] Fail to update updateKMs`);
      ErrorHandler.ErrorHandler(new Error('Fail to update updateKMs'), res);
    }
    return res.status(200).send(true);
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

//========== GET ==========
//Get history
router.get('/', (req, res) => {
  const context = 'GET /api/private/history_v2';
  try {
     let { client, component, version } = req.headers;
    const { BackOffice, Web, Webapp } = Constants.permissionToRetrieveHistory;

    if (client === BackOffice || client === Web || component === Webapp) {
      console.log('Client is authorized to access history');
      History.getHistoryWeb(req, res)
        .then((result) => {
           const response = version && version === '2' ? sortby(result.sessions, req.query) : result.sessions;

          return res
            .status(200)
            .header({
              'Access-Control-Expose-Headers': [
                'totalOfEntries',
                'numberOfPages',
              ],
              totalOfEntries: result.totalOfEntries,
              numberOfPages: result.numberOfPages,
            })
            .send(response);
        })
        .catch((error) => {
          console.error(
            `[${context}][History.getHistory] Error `,
            error.message,
          );
          ErrorHandler.ErrorHandler(error, res);
        });
    } else {
      console.log('Client is NOT authorized to access history');
      History.getHistoryApps(req, res)
        .then((result) => {
          return res
            .status(200)
            .header({
              'Access-Control-Expose-Headers': [
                'totalOfEntries',
                'numberOfPages',
              ],
              totalOfEntries: result.totalOfEntries,
              numberOfPages: result.numberOfPages,
            })
            .send(result.sessions);
        })
        .catch((error) => {
          console.error(
            `[${context}][History.getHistoryApps] Error `,
            error.message,
          );
          ErrorHandler.ErrorHandler(error, res);
        });
    }
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

//Get history
router.get('/filter', (req, res) => {
  var context = 'GET /api/private/history_v2/filter';
  try {
    //console.log("req", req.headers['client']);
    let client = req.headers['client'];
    //TODO
    if (client === process.env.ClientWeb) {
      History.getHistoryWebFilter(req, res)
        .then((result) => {
          return res.status(200).send(result);
        })
        .catch((error) => {
          console.error(
            `[${context}][History.getHistory] Error `,
            error.message,
          );
          ErrorHandler.ErrorHandler(error, res);
        });
    } else {
      //TODO
    }
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

router.get('/byEV', (req, res) => {
  let context = 'GET /api/private/history_v2/byEV';
  try {
    History.getHistoryByEV(req, res)
      .then((result) => {
        return res.status(200).send(result);
      })
      .catch((error) => {
        console.error(
          `[${context}][History.getHistoryByEV] Error `,
          error.message,
        );
        ErrorHandler.ErrorHandler(error, res);
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

router.get('/byEVAndMonth', (req, res) => {
  var context = 'GET /api/private/history_v2/byEVAndMonth';
  try {
    History.getHistoryByEVAndMonth(req, res)
      .then((result) => {
        return res.status(200).send(result);
      })
      .catch((error) => {
        console.error(
          `[${context}][History.getHistoryByEV] Error `,
          error.message,
        );
        ErrorHandler.ErrorHandler(error, res);
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});

router.get('/bySessionId', async (req, res) => {
  let context = 'GET /api/private/history_v2/bySessionId';
  try {
    const result = await History.getHistoryBySessionId(req, res);
    return res.status(200).send(result);
  } catch (error) {
    console.error(`[${context}] Error`, error);
    ErrorHandler.ErrorHandler(error, res);
  }
});
//========== DELETE ==========
//delete history
router.delete('/', (req, res) => {
  var context = 'DELETE /api/private/history_v2';
  try {
    History.removeHistory(req, res)
      .then((result) => {
        return res.status(200).send(result);
      })
      .catch((error) => {
        console.error(`[${context}][History.addHistory] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res);
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    ErrorHandler.ErrorHandler(error, res);
  }
});



module.exports = router;
