
const Utils = require('../../../utils');
const global = require('../../../global');
const axios = require('axios');
const CDR = require('../../../models/cdrs')
const Session = require('../../../models/sessions')

module.exports = {
    post: function (req, res) {



        //Get Token, sent previously to partner
        var token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        var data = req.body;

        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        var cdrId = data.id;
        if (!cdrId)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing id parameters"));


        try {

            let query = {
                id: cdrId
            };

            CDR.find(query, { _id: 0 }, async (err, cdr) => {

                if (Utils.isEmptyObject(cdr)) {
                    let query = {
                        authorization_reference : data.authorization_id
                    }

                    let sessionExists = false
                    let cdrSession = data.authorization_id ? await Utils.chargingSessionFindOne(query) : null
                    if (cdrSession) {
                        data.source = cdrSession.source !== undefined ? cdrSession.source : "Gireve"
                        data.cdr_token = cdrSession.cdr_token !== undefined ? cdrSession.cdr_token : {}
                        data.session_id = cdrSession.id !== undefined ? cdrSession.id : "-1"
                        sessionExists = cdrSession.id !== undefined && cdrSession.id !== null ? true : false
                    } else {
                        //TODO For now it works. We should fall on the if statement though
                        data.source = "Gireve"
                    }
                    console.log(`Add CDR with authorization_reference ${data.authorization_id} from source ${data.source}` )
                    if (sessionExists) {
                        let cdrData = Utils.getCDRModelObj(data)
                        const new_cdr = new CDR(cdrData);
                        CDR.create(new_cdr, (err, result) => {
                            
                            if (result) {
                                var origin = req.protocol + '://' + req.get('host') + req.originalUrl;
                                var response = { Location: origin + cdrId };
                                
                                Utils.processBillingAndPaymentRoaming(new_cdr.session_id, cdrData);
                                
                                res.set("Location" , origin + cdrId )
                                return res.status(200).send(Utils.response(response, 1000, "Created CDR " + cdrId + ""));
                            } else {
                                console.log("CDR not created ", err);
                                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                            }

                        })
                    } else {
                        console.log("CDR " + cdrId + ` not created - session with authorization_reference ${data.authorization_id} does not exist yet`);
                        return res.status(200).send(Utils.response(null, 1000, "Corresponding session doesn't exist yet "));

                    }
                }
                else {
                    console.log("CDR not created - CDR already exists");
                    let cdrData = Utils.getCDRModelObj(data)
                    Utils.saveDifferentCdr(cdr, cdrData)
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error - CDR already exists"));
                }
            });
        }
        catch (e) {
            console.log("[add_CDR] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }


    }
}

///Deprecated. Moved to Utils class
// function processBillingAndPaymentRoaming(sessionId, cdr) {

//     let query = { id: sessionId };

//     var totalPowerConsumed_Kw = cdr.total_energy;
//     let totalTimeConsumed_h = cdr.total_time
//     let total_parking_time = (typeof cdr.total_parking_time !== "undefined" && cdr.total_parking_time !== null) ? cdr.total_parking_time : 0

//     chargingSessionFindOne(query).then(async (chargingSession) => {
//         if (chargingSession) {
//             try {


//                 ////////////////////////////////////////////////
//                 //OPC Cost
//                 //Calculate OPC Prices
                
//                 // Timezone info to get offset of charger 
//                 let timeZone = chargingSession.timeZone
//                 let countryCode = chargingSession.country_code
//                 let offset = Utils.getChargerOffset(timeZone , countryCode)
    
//                 // Power and voltage values
//                 let plugVoltage = cdr.cdr_location.connector_voltage
//                 let plugAmperage = cdr.cdr_location.connector_amperage
//                 let plugPower = (plugVoltage * plugAmperage) / 1000;
    
//                 // Charging periods and charging opc tariffs
//                 let charging_periods = cdr.charging_periods
//                 let priceComponents = chargingSession.tariffOPC.elements;
    
                
    
    
//                 /*
//                     This function calculates the final prices for each dimension. If eventually there's a wrong price, the testTariffs file should be used to test new changes
//                     and add more use cases if necessary.
    
//                     Update - > This function also returns a key of information about each dimension. That info contains the amount consumed in each charging period and 
//                                 other details about the tariff and its restrictions
    
//                  */
//                 let [flat, energy, time, parking] = Utils.opcTariffsPrices(charging_periods , priceComponents ,  cdr.start_date_time , cdr.stop_date_time , offset , plugPower , plugVoltage , totalPowerConsumed_Kw , totalTimeConsumed_h , total_parking_time)
    
//                 let [
//                     OCP_PRICE_FLAT,
//                     OCP_PRICE_ENERGY,
//                     OCP_PRICE_TIME,
//                     OCP_PRICE_PARKING_TIME
//                 ] = [flat.price, energy.price, time.price, parking.price]
    
//                 let OPC_Price = OCP_PRICE_FLAT + OCP_PRICE_ENERGY + OCP_PRICE_TIME + OCP_PRICE_PARKING_TIME
    
//                 let opcPrice = { excl_vat: OPC_Price, incl_vat: Number(OPC_Price + (chargingSession.fees.IVA * OPC_Price)).toFixed(2) }
    
//                 ////////////////////////////////////////////////
//                 //CEME Price
//                 let CEME_Price_POWER = chargingSession.tariffCEME.tariff[0].price;
//                 var CEME_Price = Number(CEME_Price_POWER * totalPowerConsumed_Kw).toFixed(2);
//                 var cemePrice = { excl_vat: CEME_Price, incl_vat: Number(CEME_Price + (chargingSession.fees.IVA * CEME_Price)).toFixed(2) }
    
               
//                 ////////////////////////////////////////////////
//                 //Other Prices, 0.15€ activation fee
//                 var Ad_Hoc_activationFee = 0;
//                 if (chargingSession.paymentType == "AD_HOC" && chargingSession.paymentMethod == "card") {
//                     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee);
//                 }
//                 var otherPrices = { description: "Activation Fee (0.15€)", price: { excl_vat: Number(Ad_Hoc_activationFee), incl_vat: Ad_Hoc_activationFee + (chargingSession.fees.IVA * Ad_Hoc_activationFee) } }
    
//                 ////////////////////////////////////////////////
//                 //Total Prices 
                
//                 var invoiceLines = await Utils.getInvoiceLinesRoaming(cdr, chargingSession.userIdWillPay, chargingSession , flat ,energy, time, parking);
//                 var total_exc_vat = 0;
//                 var total_inc_vat = 0;
//                 invoiceLines.forEach(line => {
//                     total_exc_vat += Number((line.quantity * line.unitPrice).toFixed(2));
//                 });
//                 var totalPrice = { excl_vat: Number(total_exc_vat.toFixed(2)), incl_vat: Number(total_exc_vat + (total_exc_vat * chargingSession.fees.IVA)).toFixed(2) };
    
//                 var finalPrices = {
//                     opcPrice: opcPrice,
//                     cemePrice: cemePrice,
//                     othersPrice: [otherPrices],
//                     totalPrice: totalPrice
//                 }
    
//                 chargingSession.total_cost = totalPrice;
//                 chargingSession.finalPrices = finalPrices;
//                 console.log("finalPrices", JSON.stringify(finalPrices));
    
//                 let bodySession = {
//                     cdrId: cdr.id,
//                     total_cost: totalPrice,
//                     finalPrices: finalPrices,
//                     paymentStatus: 'UNPAID'
//                 };
    
                
                
    
//                 if (chargingSession.paymentType == "AD_HOC") {
//                     //Billing
    
//                     //Call Payments Microservice
//                     var bodyPayment = {
//                         amount: { currency: cdr.currency, value: totalPrice.incl_vat },
//                         userId: chargingSession.userIdWillPay,
//                         sessionId: chargingSession._id,
//                         listOfSessions: [],
//                         hwId: chargingSession.location_id,
//                         chargerType: process.env.chargerTypeGireve,
//                         paymentMethod: chargingSession.paymentMethod,
//                         paymentMethodId: chargingSession.paymentMethodId,
//                         transactionId: chargingSession.transactionId,
//                         adyenReference: chargingSession.adyenReference,
//                         reservedAmount: chargingSession.reservedAmount
//                     }
    
//                     makePayment(bodyPayment).then((result) => {
    
//                         //If success (40) - Save paymentId and transactionId and change status to PAID 
//                         //If success (10/20) - Save paymentId and transactionId  
//                         bodySession.paymentId = result._id;
//                         bodySession.transactionId = result.transactionId;
                        
//                         //console.log("result payment", result);
//                         if (result.status == "40") {
//                             bodySession.paymentStatus = 'PAID';
//                             bodySession.paymentSubStatus = "PAID AND CLOSED";
                            
//                             Utils.billingRoaming(cdr, chargingSession.userIdWillPay, chargingSession, result._id, invoiceLines, totalPrice, flat , energy, time , parking).then((res) => {
//                                 bodySession.invoiceStatus = true;
//                                 bodySession.invoiceId = res.invoiceId;
//                                 updateSession(sessionId, bodySession);
//                             }).catch((err) => {
//                                 updateSession(sessionId, bodySession);
//                             });
//                         }
//                         else if (result.status == "10" || result.status == "20"){
//                             bodySession.paymentSubStatus = "PAID AND WAITING FOR ADYEN NOTIFICATION";
//                             updateSession(sessionId, bodySession);
//                         }
//                         else{
//                             bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON";
//                             updateSession(sessionId, bodySession);
//                         }
    
//                     }).catch((err) => {
//                         console.log("Error calling payment microservice: ", err.message)
//                         bodySession.paymentSubStatus = "PAYMENT FAILED FOR ANY REASON - " + err.message;
//                         updateSession(sessionId, bodySession);
//                     });
    
    
//                 }
//                 else {
//                     //Monthly Billing
//                     updateSession(sessionId, bodySession);
//                 }
    
//             }
//             catch (err) {
//                 console.log("Billing CDR - err", err)
//             }
//         } else {
//             console.log("[CDR - processBillingAndPaymentRoaming] - Charging session " + sessionId + " not found");

//         }
    
//     });


// }


// function chargingSessionFindOne(query) {
//     var context = "Funciton chargingSessionFindOne";
//     return new Promise((resolve, reject) => {
//         Session.findOne(query, (err, chargingSessionFound) => {
//             if (err) {
//                 console.error(`[${context}][findOne] Error `, err.message);
//                 reject(err);
//             }
//             else {
//                 resolve(chargingSessionFound);
//             };
//         });
//     });
// }

// function updateSession(sessionId, body) {
//     let query = {
//         id: sessionId
//     };

//     Session.findOneAndUpdate(query, body, (err, session) => { });
// }

// function makePayment(body) {
//     return new Promise((resolve, reject) => {

//         axios.post(global.paymentEndpoint, body, { headers: { 'userid': body.userId } }).then(function (response) {

//             if (typeof response.data !== 'undefined') {
//                 resolve(response.data);
//             }
//             else
//                 reject(false);

//         }).catch(function (error) {

//             reject(error);
//         });

//     });

// }

// function billing(cdr) {
//     return new Promise((resolve, reject) => {

//         var body = {
//             invoice: {

//             },
//             attach: {

//             }
//         }

//         axios.post(global.billingEndpoint, body, { headers: { 'userid': body.userId } }).then(function (response) {

//             if (typeof response.data !== 'undefined') {
//                 resolve(response.data);
//             }
//             else
//                 reject(false);

//         }).catch(function (error) {

//             reject(error);
//         });

//     });

// }


