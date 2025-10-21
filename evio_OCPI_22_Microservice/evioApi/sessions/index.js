const express = require('express');
const router = express.Router();
const sessions = require('./sessions')
const Session = require('../../models/sessions')
const global = require('../../global');
const toggle = require('evio-toggle').default;
const { Enums } = require('evio-library-commons').default;

//Get all active charging sessions
router.get('/myActiveSessions', (req, res) => {
    sessions.myActiveSessions(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.put('/addPaymentId', (req, res) => {
    sessions.addPaymentId(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.put('/updateSyncPlafond', (req, res) => {
    sessions.updateSyncPlafond(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

//Update payment status
router.put('/cancelPaymentFailedSessions', (req, res) => {
    sessions.cancelPaymentFailedSessions(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

//Endpoint to get all charging sessions that for any reason was completed without valid payment conditions. Each session will be checked and paid for.
router.get('/emptySessions', (req, res) => {
    sessions.emptySessions(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/findChargingSessions', (req, res) => {
    sessions.findChargingSessions(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/chargingSessionById', (req, res) => {
    sessions.chargingSessionById(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/sessionInfo', (req, res) => {
    sessions.sessionInfo(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/toHistory', (req, res) => {
    sessions.toHistory(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });

});

router.get('/updatedToHistory', (req, res) => {
    sessions.updatedToHistory(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });

});

router.get('/plafondCompleteSessionCost', (req, res) => {
    sessions.plafondCompleteSessionCost(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });

});

router.put('/sessionRating', (req, res) => {
    sessions.sessionRating(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

//Endpoint to get all charging sessions that was started with wallet payment method and AD_HOC payment method. Each session will be checked if is to automatically stop in case of missing credit amount
router.get('/checkMissingPayment', (req, res) => {

    var context = "GET /api/private/chargingSession/checkMissingPayment";

    try {
        var userId = req.headers['userid'];

        var query = {
            status: global.SessionStatusRunning,
            id : {$exists : true},
            $or: [
                {
                    paymentType: "AD_HOC",
                    $or: [
                        { paymentMethod: "Wallet" },
                        { paymentMethod: "unknown" },
                        { paymentMethod: "Unknown" },
                        { paymentMethod: "Card" }
                    ]
                },
                {
                    paymentType: "MONTHLY",
                    paymentMethod: "Unknown"
                },
                {
                    plafondId: { $exists: true, $ne: '-1' }
                }
            ]
        };

        Session.find(query, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err);
                return res.status(500).send(err);
            }
            else {
                if (chargingSession.length > 0) {
                    let mySessions = chargingSession.map(session => {
                        var estimatedPrice = 0;
                        if (session.total_cost) {
                            if (session.total_cost.incl_vat)
                                estimatedPrice = session.total_cost.incl_vat;
                        }

                        let status = Enums.SessionStatusesNumberTypes[session.status] || Enums.SessionStatusesNumberTypes.INVALID
                        var idTag = "";
                        if (session.cdr_token != undefined)
                            idTag = session.cdr_token.uid;
                        else
                            idTag = session.token_uid;

                        return {
                            "totalPower": session.totalPower,
                            "estimatedPrice": estimatedPrice,
                            "batteryCharged": session.batteryCharged,
                            "timeCharged": session.timeCharged,
                            "CO2Saved": session.CO2Saved,
                            "stoppedByOwner": session.stoppedByOwner,
                            "counter": 0,
                            "_id": session._id,
                            "hwId": session.location_id,
                            "evId": session.evId,
                            "tarrifId": "-1",
                            "command": session.command,
                            "chargerType": session.chargerType,
                            "status": status,
                            "userId": session.userId,
                            "plugId": session.connector_id,
                            "idTag": idTag,
                            "startDate": session.start_date_time,
                            "stopDate": session.end_date_time,
                            "readingPoints": session.readingPoints,
                            "feedBack": session.feedBack,
                            "chargerOwner": session.chargeOwnerId,
                            "bookingId": "-1",
                            "sessionId": session.id,
                            "cdrId": session.cdrId,
                            "paymentId": session.paymentId,
                            "paymentMethod": session.paymentMethod,
                            "paymentMethodId": session.paymentMethodId,
                            "walletAmount": session.walletAmount,
                            "reservedAmount": session.reservedAmount,
                            "confirmationAmount": session.confirmationAmount,
                            "userIdWillPay": session.userIdWillPay,
                            "adyenReference": session.adyenReference,
                            "transactionId": session.transactionId,
                            "plafondId": session.plafondId,
                            "clientName": session.clientName,
                            "fleetDetails": session.fleetDetails,
                            "paymentSubStatus": session.paymentSubStatus,
                        }
                    })
                    return res.status(200).send(mySessions);

                } else {
                    return res.status(200).send([]);
                }
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Endpoint to get all charging sessions that were made with a reserved amount, and for any reason, the reserved amount was not canceled. Each session will be checked and canceled the amount previously reserved .
router.get('/cancelPaymentFailedSessions', (req, res) => {

    var context = "GET /api/private/chargingSession/cancelPaymentFailedSessions";

    try {
        var query = {
            status: global.SessionStatusFailed,
            paymentStatus: { "$ne": "CANCELED" }
        };

        Session.find(query, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err);
                return res.status(500).send(err);
            }
            else {
                if (chargingSession.length > 0) {
                    let mySessions = chargingSession.map(session => {
                        var estimatedPrice = 0;
                        if (session.total_cost) {
                            if (session.total_cost.incl_vat)
                                estimatedPrice = session.total_cost.incl_vat;
                        }

                        let status = Enums.SessionStatusesNumberTypes[session.status] || Enums.SessionStatusesNumberTypes.INVALID

                        var idTag = "";
                        if (session.cdr_token != undefined)
                            idTag = session.cdr_token.uid;
                        else
                            idTag = session.token_uid;

                        return {
                            "totalPower": session.totalPower,
                            "estimatedPrice": estimatedPrice,
                            "batteryCharged": session.batteryCharged,
                            "timeCharged": session.timeCharged,
                            "CO2Saved": session.CO2Saved,
                            "stoppedByOwner": session.stoppedByOwner,
                            "counter": 0,
                            "_id": session._id,
                            "hwId": session.location_id,
                            "evId": session.evId,
                            "tarrifId": "-1",
                            "command": session.command,
                            "chargerType": session.chargerType,
                            "status": status,
                            "userId": session.userId,
                            "plugId": session.connector_id,
                            "idTag": idTag,
                            "startDate": session.start_date_time,
                            "stopDate": session.end_date_time,
                            "readingPoints": session.readingPoints,
                            "feedBack": session.feedBack,
                            "chargerOwner": session.chargeOwnerId,
                            "bookingId": "-1",
                            "sessionId": session.id,
                            "cdrId": session.cdrId,
                            "paymentId": session.paymentId,
                            "paymentMethod": session.paymentMethod,
                            "paymentMethodId": session.paymentMethodId,
                            "walletAmount": session.walletAmount,
                            "reservedAmount": session.reservedAmount,
                            "confirmationAmount": session.confirmationAmount,
                            "userIdWillPay": session.userIdWillPay,
                            "adyenReference": session.adyenReference,
                            "transactionId": session.transactionId,
                            "plafondId": session.plafondId,
                        }
                    })
                    return res.status(200).send(mySessions);

                } else {
                    return res.status(200).send([]);
                }
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

router.get('/activeSessionsMyChargers', (req, res) => {
    //TODO
    //Devolver sessões ativas nos meus postos
    //Quando avançarmos com isto, temos que guardar o operador do posto nas sessões.
    //Só os operadores, vão conseguir ver as sessões ativas nos seus postos. De qualquer modo, acrescentar atributo de charger owner, para não confundir, com dono de posto e operador da rede publica.


});

router.get('/sessionsByEV/:evId', (req, res) => {
    sessions.sessionsByEV(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/numberOfSessions/:userId', (req, res) => {
    sessions.numberOfSessions(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.post('/runFirstTime', (req, res) => {
    var context = "POST /api/private/chargingSession/runFirstTime";

    if (!req.body.startDate) {
        return res.status(400).send({ auth: true, code: 'server_startDate_required', message: "Start date is required" });
    }
    if (!req.body.endDate) {
        return res.status(400).send({ auth: true, code: 'server_endDate_required', message: "End date is required" });
    }
    /*sessions.changeMobiEWrongSessionId(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });*/

    sessions.updateCardNumber(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.post('/newRunFirstTime', (req, res) => {
    var context = "POST /api/private/chargingSession/newRunFirstTime";

    sessions.newRunFirstTime(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });

});


router.get('/sessionsKPIs', (req, res) => {
    sessions.sessionsKPIs(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/monthlyBilling', (req, res) => {
    sessions.getMonthlyBilling(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.put('/paymentStatusMonthlyBilling', (req, res) => {
    sessions.paymentStatusMonthlyBilling(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.put('/invoiceStatusMonthlyBilling', (req, res) => {
    sessions.invoiceStatusMonthlyBilling(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.patch('/updateSessionSync/:id', (req, res) => {
    sessions.updateSessionSync(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/activeSessionsByEV/:evId', (req, res) => {
    sessions.activeSessionsByEV(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.patch('/getSessionOCPIById/:id', (req, res) => {
    sessions.getSessionOCPIById(req, res)
        .then(result => {
            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/getSessionOCPIById/:id', (req, res) => {
    sessions.getSessionOCPIById(req, res)
        .then(result => {
            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.patch('/sessionFinalPrices', (req, res) => {
    sessions.updateSessionsFinalPrices(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/billingPeriodSessions', (req, res) => {
    sessions.getBillingPeriodSessions(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/getCountryCodesToBillingPeriodSessionsV2', (req, res) => {
    sessions.getCountryCodesToBillingPeriodSessionsV2(req)
      .then((result) => {
          return res.status(200).send(result);
      })
      .catch((e) => {
          return res.status(400).send(e);
      });
});

router.get('/billingPeriodSessionsV2', (req, res) => {
    sessions.getBillingPeriodSessionsV2(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/getBillingSessions', async (req, res) => {
    
    const featureFlagEnabled = await toggle.isEnable('reprocess-attach-of-sessions-6739');
    if(!featureFlagEnabled) {
        console.log(`[${context}][FEATUREFLAG][reprocess-attach-of-sessions-6739]`)
        return res.status(403).send({ code: 'feature_deactivated', message: "Feature deactivated" });
    }

    sessions.getBillingSessions(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.post('/billingPeriodSessionsGetBillingInformation', (req, res) => {
    sessions.getbillingPeriodSessionsGetBillingInformation(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});



router.get('/sessionsToPaymentPeriodic', (req, res) => {
    sessions.sessionsToPaymentPeriodic(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/allActiveSessions', (req, res) => {
    sessions.allActiveSessions(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/getFees/:session', (req, res) => {

    var context = "GET /api/private/chargingSession/getFees/:session";
    sessions.getFees(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/notPaid', (req, res, next) => {
    sessions.notPaid(req, res)
    .then(result => {

        return res.status(200).send(result);

    })
    .catch((e) => {
        return res.status(400).send(e);
    });
});

router.patch('/endOfEnergyDate', (req, res) => {
    sessions.updateEndOfEnergyDate(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.post('/chargersUsage', (req, res) => {
    sessions.chargersUsage(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.post('/find', (req, res) => {
    sessions.findChargingSessionPost(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.post('/agregate', (req, res) => {
    sessions.getSessionAgregate(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.patch('/updateEvAndUsersInfo', (req, res) => {
    sessions.updateEvAndUsersInfo(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.patch('/forceValidatePayments', (req, res) => {
    sessions.forceValidatePayments(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});

router.get('/byId', (req, res) => {
    sessions.getsessionById(req, res)
        .then(result => {
            return res.status(200).send(result);
        })
        .catch((e) => {
            return res.status(400).send(e);
        });
});


module.exports = router;
