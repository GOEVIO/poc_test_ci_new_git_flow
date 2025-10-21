const express = require('express');
const router = express.Router();
const axios = require('axios')
const global = require('../../global');
// var handlerSession = require('./handlerSession');
const Session = require('../../models/sessions')

//Monthly payment for specific user
router.post('/monthly/:userId', (req, res) => {
   //Pegar em todas as sessões em aberto por pagar de um utilizador em especifico e pagar
   var bodyPayment = {
    amount: { currency: 'EUR', value: totalPrice.incl_vat },
    userId: chargingSession.userIdWillPay,
    sessionId: "", //Este vai vazio
    listOfSession: [], //***********************************************Usar Este
    hwId: chargingSession.location_id,
    chargerType: process.env.chargerTypeMobie,
    paymentMethod: chargingSession.paymentMethod,
    paymentMethodId: chargingSession.paymentMethodId,
    transactionId: chargingSession.transactionId,
    adyenReference: chargingSession.adyenReference,
    reservedAmount: chargingSession.reservedAmount
}
});

//Monthly payment for all open charging sessions group by user
router.post('/monthly', (req, res) => {
   //pegar em todas as sessões em aberto existentes. Depois agrupar por utilizador e pagar por um conjunto de sessões para esse utilizador 
});

module.exports = router;