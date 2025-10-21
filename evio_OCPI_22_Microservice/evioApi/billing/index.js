const express = require('express');
const router = express.Router();
const axios = require('axios')
const global = require('../../global');
// var handlerSession = require('./handlerSession');
const Session = require('../../models/sessions')
const CDR = require('../../models/cdrs')
const Utils = require('../../utils');
const moment = require('moment');
const Sentry = require('@sentry/node');
const toggle = require('evio-toggle').default;
const { Enums } = require('evio-library-commons').default;
const { sendSessionToHistoryQueue } = require('../../functions/sendSessionToHistoryQueue')
const vatService = require('../../services/vat')
const { CdrReadRepository, CdrsService } = require('evio-library-ocpi')
const { ChargerNetworks } = require('evio-library-commons')
const Constants = require('../../utils/constants')
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
   schedule: () => ({
      start: () => { },
      stop: () => { },
      validate: () => { },
      status: '',
   })
};


//Monthly billing for specific user
router.post('/monthly', (req, res) => {

   //esperar no body a lista de sessões
   //Depois pegar nelas, obter cdrId de cada uma e construir fatura a partir daqui

});

//AD_HOC confirmation card CAPTURE billing by sessionId
router.post('/ad_hoc/:sessionId', async (req, res) => {
   var context = "POST /api/private/billing/ad_hoc/:sessionId";
   try {

      var sessionId = req.params.sessionId;

      let sessionQuery = {
         _id: sessionId
      }
      let cdrSession = await Utils.chargingSessionFindOne(sessionQuery)

      var query = { session_id: cdrSession.id }
      //get CDRID
      CDR.findOne(query, (err, cdr) => {
         if (err) {
            console.log(`[${context}] Error CDR of session id ${sessionId} not found`, err.message);
            reject(err);
         }

         if (cdr) {
            if (cdr.source === process.env.MobiePlatformCode) {
               processBillingAndPayment(cdrSession.id, cdr).then((result) => {

                  return res.status(200).send(result);

               }).catch(err => {
                  console.log(`[${context}] Error processing billing`, err.message);
                  return res.status(500).send(`[${context}] Error processing billing: ` + err.message);
               });
            } else if (cdr.source === process.env.GirevePlatformCode || cdr.source === process.env.HubjectPlatformCode) {
               // When the network is not MobiE, the logic is a little bit different (no TAR, IEC, etc... and CPO tariffs calculations are different)
               processBillingAndPaymentRoaming(cdrSession.id, cdr).then((result) => {

                  return res.status(200).send(result);

               }).catch(err => {
                  console.log(`[${context}] Error processing billing`, err.message);
                  return res.status(500).send(`[${context}] Error processing billing: ` + err.message);
               });
            } else {
               processBillingAndPayment(cdrSession.id, cdr).then((result) => {

                  return res.status(200).send(result);

               }).catch(err => {
                  console.log(`[${context}] Error processing billing`, err.message);
                  return res.status(500).send(`[${context}] Error processing billing: ` + err.message);
               });
            }

         }
         else {
            console.log(`[${context}] Error CDR of session id ${cdrSession.id} not found`);
            return res.status(500).send(`[${context}] Error CDR of session id ${cdrSession.id} not found`);
         }


      });

   } catch (error) {
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error.message);
   };
});

//Process only CDR
router.post('/processOnlyCDR/:session_id', async (req, res) => {
   var context = "POST /api/private/billing/processOnlyCDR/:session_id";
   try {

      var session_id = req.params.session_id;


      var query = { session_id: session_id }
      //get CDRID
      CDR.findOne(query, (err, cdr) => {
         if (err) {
            console.log(`[${context}] Error CDR of session id ${session_id} not found`, err.message);
            reject(err);
         }

         if (cdr) {
            if (cdr.source === process.env.MobiePlatformCode) {
               processOnlyCDR(session_id, cdr).then((result) => {

                  return res.status(200).send(result);

               }).catch(err => {
                  console.log(`[${context}] Error processing billing`, err.message);
                  return res.status(500).send(`[${context}] Error processing billing: ` + err.message);
               });
            } else if (cdr.source === process.env.GirevePlatformCode || cdr.source === process.env.HubjectPlatformCode) {

               return res.status(200).send("Process only CDR in Gireve not implemented yet");

            } else {
               processOnlyCDR(session_id, cdr).then((result) => {

                  return res.status(200).send(result);

               }).catch(err => {
                  console.log(`[${context}] Error processing billing`, err.message);
                  return res.status(500).send(`[${context}] Error processing billing: ` + err.message);
               });
            }

         }
         else {
            console.log(`[${context}] Error CDR of session id ${session_id} not found`);
            return res.status(500).send(`[${context}] Error CDR of session id ${session_id} not found`);
         }


      });

   } catch (error) {
      console.log(`[${context}] Error `, error);
      return res.status(500).send(error.message);
   };
});

router.post('/billingPaidSessions', async (req, res) => {
   const context = "POST /api/private/billing/billingPaidSessions";
   try {
      billingPaidSessions()
      return res.status(200).send("OK");
   } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return res.status(500).send(error.message);
   };
});

router.post('/cdrExtension', async (req, res) => {
  try {
    const chargingSession = req.body;

    if (!chargingSession?.cdrId || !chargingSession?.userIdToBilling || !chargingSession?.chargerType) {
      return res.status(400).send("Missing required charging session fields.");
    }

    const cdr = await CdrReadRepository.findOneByCdrId(chargingSession.cdrId);

    if (!cdr) {
      return res.status(404).send("CDR not found.");
    }

    let flat = 0, energy = 0, time = 0, parking = 0;
    if (chargingSession.source === ChargerNetworks.Gireve || chargingSession.source === ChargerNetworks.Hubject) {
      [flat, energy, time, parking] = calculateOpcCosts(cdr, chargingSession);
    }

    const invoiceLines = ( chargingSession.source === ChargerNetworks.Gireve || chargingSession.source === ChargerNetworks.Hubject)
      ? await Utils.getInvoiceLinesRoaming(cdr, chargingSession.userIdWillPay, chargingSession, flat, energy, time, parking)
      : await Utils.getInvoiceLines(cdr, chargingSession.userIdToBilling, chargingSession);

    let totalExclVAT = chargingSession?.finalPrices?.totalPrice?.excl_vat ?? 0;
    let totalInclVAT = chargingSession?.finalPrices?.totalPrice?.incl_vat ?? 0;

    let totalPrice = {
      excl_vat: Utils.round(totalExclVAT),
      incl_vat: Utils.round(totalInclVAT)
    };

    if (totalPrice.incl_vat < 0) {
      totalPrice = { excl_vat: 0, incl_vat: 0 };
      totalExclVAT = 0;
      totalInclVAT = 0;
    }

		let sessionInvoiceBody;
		console.log("[cdrExtension] network",chargingSession.source);
		switch (chargingSession.source) {
				case ChargerNetworks.Mobie:
					sessionInvoiceBody = await Utils.drawSingle_Ad_HocInvoice(
							cdr,
							chargingSession.userIdToBilling,
							chargingSession,
							chargingSession.paymentId,
							invoiceLines,
							totalPrice
					);
					break;
				case ChargerNetworks.Gireve:
					sessionInvoiceBody = await Utils.drawSingle_Ad_HocInvoiceRoaming(
							cdr,
							chargingSession.userIdToBilling,
							chargingSession,
							chargingSession.paymentId,
							invoiceLines,
							totalPrice
					);
					break;
				case ChargerNetworks.Hubject:
					sessionInvoiceBody = CdrsService.buildInvoice(chargingSession)
					break;
				default:
					sessionInvoiceBody = await Utils.drawSingle_Ad_HocInvoiceRoaming(
							cdr,
							chargingSession.userIdToBilling,
							chargingSession,
							chargingSession.paymentId,
							invoiceLines,
							totalPrice
					);
					break;
		}
    return res.status(200).send(sessionInvoiceBody);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Internal server error.");
  }
});

function calculateOpcCosts(cdr, chargingSession) {
  const timeZone = chargingSession.timeZone;
  const countryCode = chargingSession.country_code;
  const offset = Utils.getChargerOffset(timeZone, countryCode);

  const plugVoltage = cdr.cdr_location.connector_voltage;
  const plugAmperage = cdr.cdr_location.connector_amperage;
  const plugPower = (plugVoltage * plugAmperage) / 1000;

  let priceComponents = chargingSession.tariffOPC.elements;

  if (cdr.tariffs && cdr.tariffs.length > 0) {
    priceComponents = Utils.transformTariffElements(cdr.tariffs[0].elements);
    priceComponents = Utils.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time);
  } else if (priceComponents) {
    priceComponents = Utils.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time);
  }

  const totalPowerConsumed_Kw = cdr.total_energy;
  const total_parking_time = cdr.total_parking_time ?? 0;
  const totalTimeConsumed_h = cdr.total_time - total_parking_time;

  return Utils.opcTariffsPrices(
    null,
    priceComponents,
    cdr.start_date_time,
    cdr.end_date_time,
    offset,
    plugPower,
    plugVoltage,
    totalPowerConsumed_Kw,
    totalTimeConsumed_h,
    total_parking_time,
    chargingSession.source
  );
}

function processBillingAndPayment(sessionId, cdr) {
   const context = "EVIO API - processBillingAndPayment";
   return new Promise((resolve, reject) => {
      let query = { id: sessionId };

      chargingSessionFindOne(query).then(async (chargingSession) => {
         try {
            var invoiceLines = await Utils.getInvoiceLines(cdr, chargingSession.userIdWillPay, chargingSession);
            const total_exc_vat = chargingSession?.finalPrices?.totalPrice?.excl_vat ?? 0
            const total_inc_vat = chargingSession?.finalPrices?.totalPrice?.incl_vat ?? 0
            // var totalPrice = { excl_vat: Utils.round(total_exc_vat), incl_vat: Utils.round(total_exc_vat + (total_exc_vat * VAT_Price)) };
            var totalPrice = { excl_vat: total_exc_vat, incl_vat: total_inc_vat };

            let bodySession = {
               paymentStatus: 'PAID'
            };

            var timeChargedinSeconds = Utils.getChargingTime(moment(cdr.start_date_time), moment(cdr.end_date_time));

            let minimumBillingConditions = Utils.hasMinimumBillingConditionsMobiE(cdr)

            if (totalPrice?.incl_vat < 0) {
               minimumBillingConditions = false
            }

            bodySession.minimumBillingConditions = minimumBillingConditions

            if (minimumBillingConditions && chargingSession.billingPeriod == "AD_HOC" && totalPrice?.incl_vat >= 0) {
               Utils.billing(cdr, chargingSession.userIdToBilling, chargingSession, chargingSession.paymentId, invoiceLines, totalPrice).then((res) => {
                  bodySession.invoiceStatus = true;
                  bodySession.invoiceId = res.invoiceId;
                  updateSession(sessionId, bodySession);
                  sendSessionToHistoryQueue(chargingSession?._id, `${context} - billing`);
                  resolve(res)
               }).catch((err) => {
                  if (err?.response) {
                     if (err?.response?.data) {
                        bodySession.invoiceSubStatus = JSON.stringify(err?.response?.data)
                     } else {
                        bodySession.invoiceSubStatus = JSON.stringify(err?.message)
                     }
                  } else {
                     bodySession.invoiceSubStatus = err?.message
                  }
                  updateSession(sessionId, bodySession);
                  sendSessionToHistoryQueue(chargingSession?._id, `${context} - catch billing`);
                  reject(err);
               });
            } else {
               updateSession(sessionId, bodySession);
               sendSessionToHistoryQueue(chargingSession?._id, `${context} - no billing`);
               resolve("No minimum billing conditions were found!")
            }


         }
         catch (err) {
            console.log("Billing CDR - err", err)
            reject(err);
         }

      });
   });
}

function processOnlyCDR(sessionId, cdr) {
   const context = "EVIO API - processOnlyCDR";
   return new Promise((resolve, reject) => {
      let query = { id: sessionId };
      var totalPowerConsumed_Kw = cdr.total_energy;

      chargingSessionFindOne(query).then(async (chargingSession) => {

         try {
            let minimumBillingConditions = Utils.hasMinimumBillingConditionsMobiE(cdr)

            var VAT_Price = chargingSession?.fees?.IVA ?? await vatService.getVATwithViesVAT(chargingSession); //Iva

            ////////////////////////////////////////////////
            //OPC Cost
            let {
               opcFlat,
               opcTime,
               opcPower,
               TAR_Price,
               CEME_Price,
               IEC_Price,
               mobiEGrant,
           } = Utils.calculateCdrTotalValues(cdr , chargingSession)
            const { isUserTariffOrDevice, flat, time, energy } = Utils.calculateUserOrDeviceCpoTariff(cdr, chargingSession)
            if (isUserTariffOrDevice) {
               opcFlat = flat
               opcTime = time
               opcPower = energy
            }
            var OPC_Price = opcFlat + opcTime + opcPower
            var opcPrice = { excl_vat: Utils.round(OPC_Price), incl_vat: Utils.round(OPC_Price + (VAT_Price * OPC_Price)) }



            var opcPriceDetail = {
               flatPrice: { excl_vat: Utils.round(opcFlat), incl_vat: Utils.round(opcFlat + (opcFlat * VAT_Price)) },
               timePrice: { excl_vat: Utils.round(opcTime), incl_vat: Utils.round(opcTime + (opcTime * VAT_Price)) },
               powerPrice: { excl_vat: Utils.round(opcPower), incl_vat: Utils.round(opcPower + (opcPower * VAT_Price)) }
            }

            var cdr_end_date_time = new Date(cdr.end_date_time)
            var Ad_Hoc_activationFee = Utils.getOcpiActivationFee(cdr_end_date_time, chargingSession ,OPC_Price , TAR_Price , CEME_Price , IEC_Price , mobiEGrant , VAT_Price , VAT_Price)

            var timeChargedinSeconds = Utils.getChargingTime(moment(cdr.start_date_time), moment(cdr.end_date_time));
            chargingSession.timeCharged = timeChargedinSeconds;


            ////////////////////////////////////////////////
            //Other Prices, 0.15€ activation fee

            var otherPrices = [
               { description: `Activation Fee ${Ad_Hoc_activationFee}`, price: { excl_vat: Utils.round(Ad_Hoc_activationFee), incl_vat: Utils.round(Ad_Hoc_activationFee + (VAT_Price * Ad_Hoc_activationFee)) } }
            ]

            ////////////////////////////////////////////////
            //CEME Price
            // var CEME_Price = 0
            // let tariffCemePriceEmpty = chargingSession.tariffCEME.tariff.find(elem => elem.tariffType === process.env.TariffTypeEmpty).price
            // let tariffCemePriceOutEmpty = chargingSession.tariffCEME.tariff.find(elem => elem.tariffType === process.env.TariffTypeOutEmpty).price

            // cdr.mobie_cdr_extension.subUsages.forEach(subUsage => {

            //    CEME_Price += Utils.round(tariffCemePriceOutEmpty * subUsage.energia_fora_vazio) + Utils.round(tariffCemePriceEmpty * subUsage.energia_vazio)
            // })
            let CEME_Price_total = CEME_Price + Ad_Hoc_activationFee
            let CEME_Price_Flat = Ad_Hoc_activationFee
            if (cdr_end_date_time.getFullYear() > 2021) {
               otherPrices.push({ description: `MobiE Grant ${mobiEGrant}`, price: { excl_vat: mobiEGrant, incl_vat: Utils.round(mobiEGrant + (VAT_Price * mobiEGrant)) } })
               CEME_Price_total += mobiEGrant
               CEME_Price_Flat += mobiEGrant
            }
            var cemePrice = { excl_vat: Utils.round(CEME_Price_total), incl_vat: Utils.round(CEME_Price_total + (VAT_Price * CEME_Price_total)) }

            var cemePriceDetail = {
               flatPrice: { excl_vat: Utils.round(CEME_Price_Flat), incl_vat: Utils.round(CEME_Price_Flat + (CEME_Price_Flat * VAT_Price)) },
               timePrice: { excl_vat: 0, incl_vat: 0 },
               powerPrice: { excl_vat: Utils.round(CEME_Price), incl_vat: Utils.round(CEME_Price + (CEME_Price * VAT_Price)) }
            }

            ////////////////////////////////////////////////
            //TAR Price
            // var TAR_Price = cdr.mobie_cdr_extension.subUsages.map(obj => obj.preco_com_desconto_acesso_redes).reduce((a, b) => a + b, 0);
            var tarPrice = { excl_vat: Utils.round(TAR_Price), incl_vat: Utils.round(TAR_Price + (VAT_Price * TAR_Price)) }

            ////////////////////////////////////////////////
            //IEC Price
            // var IEC_Price = totalPowerConsumed_Kw * chargingSession.fees.IEC;
            var iecPrice = { excl_vat: Utils.round(IEC_Price), incl_vat: Utils.round(IEC_Price + (VAT_Price * IEC_Price)) }


            var invoiceLines = await Utils.getInvoiceLines(cdr, chargingSession.userIdWillPay, chargingSession);
            let total_exc_vat = 0;
            let total_inc_vat = 0;
            invoiceLines.forEach(line => {
               // total_exc_vat += this.round(line.quantity * line.unitPrice);
               total_exc_vat += line.quantity * line.unitPrice;
               // total_inc_vat += line.quantity * line.unitPrice * (1 + line.vat);
            });
            const roundedExclVat = Utils.round(total_exc_vat);
            const roundedIncVat = Utils.round(roundedExclVat * (1 + VAT_Price));
            // total_inc_vat = total_exc_vat + (total_exc_vat * VAT_Price);
            const totalPrice = { excl_vat: roundedExclVat, incl_vat: roundedIncVat };

            const vatPrice = { vat: VAT_Price, value: Utils.round(roundedIncVat - roundedExclVat) }

            var finalPrices = {
               opcPrice: opcPrice,
               opcPriceDetail: opcPriceDetail,
               cemePrice: cemePrice,
               cemePriceDetail: cemePriceDetail,
               tarPrice: tarPrice,
               iecPrice: iecPrice,
               vatPrice: vatPrice,
               othersPrice: otherPrices,
               totalPrice: totalPrice
            }

            chargingSession.total_cost = totalPrice;
            chargingSession.finalPrices = finalPrices;
            chargingSession.invoiceLines = invoiceLines;

            var CO2emitted = 0;

            var totalPowerConsumed_W = 0;
            if (totalPowerConsumed_Kw >= 0) {
               totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
               CO2emitted = Utils.round(Number(process.env.CarbonIntensity) * totalPowerConsumed_Kw);// Kg CO₂ eq/kWh
               if (CO2emitted < 0)
                  CO2emitted = 0
            }

            // chargingSession.timeCharged = timeChargedinSeconds;
            chargingSession.kwh = totalPowerConsumed_Kw

            let bodySession = {
               timeCharged: timeChargedinSeconds,
               totalPower: totalPowerConsumed_W,
               kwh: totalPowerConsumed_Kw,
               CO2Saved: CO2emitted,
               cdrId: cdr.id,
               start_date_time: cdr.start_date_time,
               end_date_time: cdr.end_date_time,
               total_energy: cdr.total_energy,
               total_cost: totalPrice,
               finalPrices: finalPrices,
               invoiceLines: invoiceLines,
            };
            // let minimumBillingConditions = Utils.hasMinimumBillingConditionsMobiE(cdr)
            if (totalPrice?.incl_vat < 0) {
               minimumBillingConditions = false
            }
            bodySession.minimumBillingConditions = minimumBillingConditions
            updateSession(sessionId, bodySession);
            sendSessionToHistoryQueue(chargingSession?._id, context);
            resolve(bodySession)
         }
         catch (err) {
            console.log("Billing CDR - err", err)
            reject(err);
         }

      });
   });
}

function chargingSessionFindOne(query) {
   var context = "Funciton chargingSessionFindOne";
   return new Promise((resolve, reject) => {
      Session.findOne(query, (err, chargingSessionFound) => {
         if (err) {
            console.log(`[${context}][findOne] Error `, err.message);
            reject(err);
         }
         else {
            resolve(chargingSessionFound);
         };
      });
   });
}


function updateSession(sessionId, body) {
   let query = {
      id: sessionId
   };

   Session.findOneAndUpdate(query, body, (err, session) => { });
}

function processBillingAndPaymentRoaming(sessionId, cdr) {
   const context = "EVIO API - processBillingAndPaymentRoaming";
   return new Promise((resolve, reject) => {

      let query = { id: sessionId };
      var totalPowerConsumed_Kw = cdr.total_energy;
      let total_parking_time = (typeof cdr.total_parking_time !== "undefined" && cdr.total_parking_time !== null) ? cdr.total_parking_time : 0
      let totalTimeConsumed_h = cdr.total_time - total_parking_time
      chargingSessionFindOne(query).then(async (chargingSession) => {

         if (chargingSession) {

            try {
               ////////////////////////////////////////////////
               //OPC Cost
               //Calculate OPC Prices

               // Timezone info to get offset of charger
               let timeZone = chargingSession.timeZone
               let countryCode = chargingSession.country_code
               let offset = Utils.getChargerOffset(timeZone, countryCode)

               // Arbitrary power and voltage values
               let plugVoltage = cdr.cdr_location.connector_voltage
               let plugAmperage = cdr.cdr_location.connector_amperage
               let plugPower = (plugVoltage * plugAmperage) / 1000;

               // Charging periods and chargin opc tariffs
               let charging_periods = cdr.charging_periods
               let priceComponents = chargingSession.tariffOPC.elements;

               if (cdr.tariffs !== null && cdr.tariffs !== undefined && cdr.tariffs.length > 0) {
                  priceComponents = Utils.transformTariffElements(cdr.tariffs[0].elements)
                  priceComponents = Utils.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time)
               } else if (priceComponents !== null && priceComponents !== undefined) {
                  priceComponents = Utils.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time)
               }


               /*
                  This function calculates the final prices for each dimension. If eventually there's a wrong price, the testTariffs file should be used to test new changes
                  and add more use cases if necessary.

                  Update - > This function also returns a key of information about each dimension. That info contains the amount consumed in each charging period and
                              other details about the tariff and its restrictions

               */
               let [flat, energy, time, parking] = Utils.opcTariffsPrices(null, priceComponents, cdr.start_date_time, cdr.end_date_time, offset, plugPower, plugVoltage, totalPowerConsumed_Kw, totalTimeConsumed_h, total_parking_time, chargingSession.source)

               ////////////////////////////////////////////////
               //Total Prices

               var invoiceLines = await Utils.getInvoiceLinesRoaming(cdr, chargingSession.userIdWillPay, chargingSession, flat, energy, time, parking);
               const total_exc_vat = chargingSession?.finalPrices?.totalPrice?.excl_vat ?? 0
               const total_inc_vat = chargingSession?.finalPrices?.totalPrice?.incl_vat ?? 0
               // total_inc_vat = total_exc_vat + (total_exc_vat * VAT_Price);
               var totalPrice = { excl_vat: total_exc_vat, incl_vat: total_inc_vat };

               let bodySession = {
                  paymentStatus: 'PAID'
               };

               var timeChargedinSeconds = Utils.getChargingTime(moment(cdr.start_date_time), moment(cdr.end_date_time));

               let minimumBillingConditions = true
               if (
                  // (timeChargedinSeconds <= Number(process.env.MinimumChargingTimeToBilling)) ||
                  (totalPowerConsumed_Kw * 1000 <= Number(process.env.MinimumEnergyToBillingGireve))
               ) {
                  minimumBillingConditions = false
               }

               if (totalPrice?.incl_vat < 0) {
                  minimumBillingConditions = false
               }
               bodySession.minimumBillingConditions = minimumBillingConditions

               if (minimumBillingConditions && chargingSession.billingPeriod == "AD_HOC" && totalPrice?.incl_vat >= 0) {
                  Utils.billingRoaming(cdr, chargingSession.userIdToBilling, chargingSession, chargingSession.paymentId, invoiceLines, totalPrice, null, null, null, null).then((res) => {
                     bodySession.invoiceStatus = true;
                     bodySession.invoiceId = res.invoiceId;
                     updateSession(sessionId, bodySession);
                     sendSessionToHistoryQueue(chargingSession?._id, `${context} - billing`);
                     resolve(res)
                  }).catch((err) => {
                     if (err?.response?.data) {
                        bodySession.invoiceSubStatus = JSON.stringify(err?.response?.data)
                     } else {
                        bodySession.invoiceSubStatus = err?.message
                     }
                     updateSession(sessionId, bodySession);
                     sendSessionToHistoryQueue(chargingSession?._id, `${context} - catch billing`);
                     reject(err);
                  });
               } else {
                  updateSession(sessionId, bodySession);
                  resolve("No minimum billing conditions were found!")
               }


            }
            catch (err) {
               console.log("Billing CDR - err", err)
               reject(err);
            }

         }
         else {
            console.log("[Utils - processBillingAndPaymentRoaming] - Charging session " + sessionId + " not found");
            resolve({});
         }

      });
   })

}

// TODO: Add the fields belonging to the new data model AFIR/AD-HOC
// Fields: preco_adhoc, preco_unitario_adhoc_tempo, preco_unitario_adhoc_energia e preco_unitario_adhoc_ativacao
router.get('/completedBillings', (req, res) => {
   var context = "GET /api/private/billing/completedBillings";
   console.log(context);

   let query = [
      {
         "$project": {
            "_id": 0,
            "t1": "$$ROOT"
         }
      },
      {
         "$lookup": {
            "localField": "t1.session_id",
            "from": "chargingsessions",
            "foreignField": "id",
            "as": "t2"
         }
      },
      {
         "$unwind": {
            "path": "$t2",
            "preserveNullAndEmptyArrays": false
         }
      },
      {
         "$match": {
            "t1.end_date_time": {
               $gte: req.query.cdr_start_date,
               $lte: req.query.cdr_end_date
            }
         }
      },
      {
         "$project": {
            "t1.tariffs": "$t1.tariffs",
            "t1.party_id": "$t1.party_id",
            "t1.start_date_time": "$t1.start_date_time",
            "t1.end_date_time": "$t1.end_date_time",
            "t1.session_id": "$t1.session_id",
            "t1.cdr_location": "$t1.cdr_location",
            "t1.mobie_cdr_extension": "$t1.mobie_cdr_extension",
            "t1.total_energy": "$t1.total_energy",
            "t1.total_time": "$t1.total_time",
            "t2.userId": "$t2.userId",
            "t2.userIdWillPay": "$t2.userIdWillPay",
            "t2.evOwner": "$t2.evOwner",
            "t2.status": "$t2.status",
            "t2.evId": "$t2.evId",
            "t2.token_type": "$t2.token_type",
            "t2.paymentStatus": "$t2.paymentStatus",
            "t2.paymentMethod": "$t2.paymentMethod",
            "t2.paymentType": "$t2.paymentType",
            "t2.operator": "$t2.operator",
            "t2.location_id": "$t2.location_id",
            "t2.tariffOPC": "$t2.tariffOPC",
            "t2.source": "$t2.source",
            "t2.tariffCEME": "$t2.tariffCEME",
            "t2.fees": "$t2.fees",
            "t2.finalPrices": "$t2.finalPrices",
            "_id": 0
         }
      }
   ];

   CDR.aggregate(query, async (error, result) => {
      if (error) {
         console.log(error.message);
         return res.status(500).send(error.message);
      }

      if (result) {

         let aux = [];

         for (let index = 0; index < result.length; index++) {
            const element = result[index];

            let source = element.t2.source;

            if (source === process.env.MobiePlatformCode) {

               let ceme_price = 0.09 * element.t1.mobie_cdr_extension.subUsages[0].energia_total_periodo;
               let total = (element.t1.mobie_cdr_extension.subUsages[0].preco_opc + element.t1.mobie_cdr_extension.subUsages[0].preco_com_desconto_acesso_redes + ceme_price);
               let tota_civa = total * 1.23;

               if (element.t2.finalPrices !== null && element.t2.finalPrices !== undefined) {
                  ceme_price = element.t2.finalPrices.cemePrice.excl_vat
                  total = element.t2.finalPrices.totalPrice.excl_vat
                  tota_civa = element.t2.finalPrices.totalPrice.incl_vat
               }

               let new_element = {
                  "rede": element.t2.source,
                  "preco_opc": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_opc).reduce((a, b) => a + b, 0)),
                  "preco_unitario_opc_tempo": roundToTwo(element.t1.mobie_cdr_extension.subUsages[0].preco_unitario_opc_tempo),
                  "preco_unitario_opc_energia": roundToTwo(element.t1.mobie_cdr_extension.subUsages[0].preco_unitario_opc_energia),
                  "preco_unitario_opc_ativacao": roundToTwo(element.t1.mobie_cdr_extension.subUsages[0].preco_unitario_opc_ativacao),
                  "preco_opc_tempo": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_opc_tempo).reduce((a, b) => a + b, 0)),
                  "preco_opc_energia": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_opc_energia).reduce((a, b) => a + b, 0)),
                  "preco_opc_ativacao": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_opc_ativacao).reduce((a, b) => a + b, 0)),
                  "energia_vazio": roundToThree(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.energia_vazio).reduce((a, b) => a + b, 0)),
                  "energia_fora_vazio": roundToThree(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.energia_fora_vazio).reduce((a, b) => a + b, 0)),
                  "energia_total_periodo": roundToThree(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.energia_total_periodo).reduce((a, b) => a + b, 0)),
                  "preco_unitario_acesso_redes_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages[0].preco_unitario_acesso_redes_vazio),
                  "preco_unitario_acesso_redes_fora_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages[0].preco_unitario_acesso_redes_fora_vazio),
                  "desconto_unitario_acesso_redes_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages[0].desconto_unitario_acesso_redes_vazio),
                  "desconto_unitario_acesso_redes_fora_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages[0].desconto_unitario_acesso_redes_fora_vazio),
                  "preco_unitario_com_desconto_acesso_redes_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages[0].preco_unitario_com_desconto_acesso_redes_vazio),
                  "preco_unitario_com_desconto_acesso_redes_fora_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages[0].preco_unitario_com_desconto_acesso_redes_fora_vazio),
                  "desconto_acesso_redes_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.desconto_acesso_redes_vazio).reduce((a, b) => a + b, 0)),
                  "desconto_acesso_redes_fora_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.desconto_acesso_redes_fora_vazio).reduce((a, b) => a + b, 0)),
                  "preco_sem_desconto_acesso_redes_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_sem_desconto_acesso_redes_vazio).reduce((a, b) => a + b, 0)),
                  "preco_sem_desconto_acesso_redes_fora_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_sem_desconto_acesso_redes_fora_vazio).reduce((a, b) => a + b, 0)),
                  "preco_com_desconto_acesso_redes_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_com_desconto_acesso_redes_vazio).reduce((a, b) => a + b, 0)),
                  "preco_com_desconto_acesso_redes_fora_vazio": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_com_desconto_acesso_redes_fora_vazio).reduce((a, b) => a + b, 0)),
                  "desconto_acesso_redes": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.desconto_acesso_redes).reduce((a, b) => a + b, 0)),
                  "preco_sem_desconto_acesso_redes": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_sem_desconto_acesso_redes).reduce((a, b) => a + b, 0)),
                  "preco_com_desconto_acesso_redes": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_com_desconto_acesso_redes).reduce((a, b) => a + b, 0))
               }

               let tariff_components = element.t2.tariffOPC.elements;
               if (tariff_components.length === 1) {

                  Object.assign(new_element, { 'opc_tipo_component_1': tariff_components[0].price_components[0].type });
                  Object.assign(new_element, { 'opc_tipo_preco_1': roundToTwo(tariff_components[0].price_components[0].price) });

                  Object.assign(new_element, { 'opc_tipo_component_2': '' });
                  Object.assign(new_element, { 'opc_tipo_preco_2': '' });

               }
               else {
                  if (tariff_components.length === 2) {

                     Object.assign(new_element, { 'opc_tipo_component_1': tariff_components[0].price_components[0].type });
                     Object.assign(new_element, { 'opc_tipo_preco_1': roundToTwo(tariff_components[0].price_components[0].price) });

                     Object.assign(new_element, { 'opc_tipo_component_2': tariff_components[1].price_components[0].type });
                     Object.assign(new_element, { 'opc_tipo_preco_2': roundToTwo(tariff_components[1].price_components[0].price) });

                  }
                  else {
                     Object.assign(new_element, { 'opc_tipo_component_1': '' });
                     Object.assign(new_element, { 'opc_tipo_preco_1': '' });

                     Object.assign(new_element, { 'opc_tipo_component_2': '' });
                     Object.assign(new_element, { 'opc_tipo_preco_2': '' });
                  }
               }

               let tariffCemePriceEmpty = Utils.getCemeUnitPrice(element.t2.tariffCEME, process.env.TariffTypeEmpty, element.t2.voltageLevel)
               let tariffCemePriceOutEmpty = Utils.getCemeUnitPrice(element.t2.tariffCEME, process.env.TariffTypeOutEmpty, element.t2.voltageLevel)

               let new_info = {
                  "operador": element.t2.operator,
                  "start_date_time": moment(element.t1.start_date_time).format("YYYY-MM-DD HH:mm"),
                  "end_date_time": moment(element.t1.end_date_time).format("YYYY-MM-DD HH:mm"),
                  "session_id": element.t1.session_id,
                  "location_id": element.t2.location_id,
                  "address": element.t1.cdr_location.address,
                  "city": element.t1.cdr_location.city,
                  "connector_id": element.t1.cdr_location.connector_id,
                  "connector_standard": element.t1.cdr_location.connector_standard,
                  "connector_format": element.t1.cdr_location.connector_format,
                  "connector_power_type": element.t1.cdr_location.connector_power_type,
                  "user": element.t2.userId,
                  "userWillPay": element.t2.userIdWillPay,
                  "evOwner": element.t2.evOwner,
                  "evId": element.t2.evId,
                  "token_type": element.t2.token_type,
                  "paymentStatus": element.t2.paymentStatus,
                  "paymentMethod": element.t2.paymentMethod,
                  "paymentType": element.t2.paymentType,
                  "tariffCEME_empty": tariffCemePriceEmpty,
                  "tariffCEME_not_empty": tariffCemePriceOutEmpty,
                  "iec": element.t2.fees.IEC,
                  "iva": (element.t2.fees.IVA) * 100 + '%',
                  "total": roundToTwo(total),
                  "ceme_price": roundToTwo(ceme_price),
                  "total_civa": roundToTwo(tota_civa),
                  "total_time": element.t1.total_time
               }

               //Object.assign(resume_element, new_element);
               //Object.assign(new_element, new_info);

               let hours = Math.floor(element.t1.total_time % 60);
               let minutes = Math.floor((element.t1.total_time - hours) * 60);
               // let duration = hours + ":" + minutes;
               let duration = element.t1.total_time * 60

               //Object.assign(new_element, { "duration": duration });

               let egme_tariff = 0.30;
               let resume_total_ceme_value = roundToThree(ceme_price);
               let total_iec_value = roundToTwo(0.001 * roundToThree(element.t1.total_energy));

               let resume_custo_total_exc_vat_value = 0
               // if (element.t1.mobie_cdr_extension.subUsages[0].energia_total_periodo == 0
               //    && element.t1.mobie_cdr_extension.subUsages[0].preco_opc == 0) {

               //    resume_custo_total_exc_vat_value = 0;

               // } else {

               //    resume_custo_total_exc_vat_value = roundToTwo(
               //       element.t1.mobie_cdr_extension.subUsages[0].preco_opc
               //       + resume_total_ceme_value
               //       + element.t1.mobie_cdr_extension.subUsages[0].preco_com_desconto_acesso_redes
               //       + total_iec_value
               //       + egme_tariff
               //    );

               // }
               if (Utils.hasMinimumBillingConditionsMobiE(element.t1)) {
                  if (element.t2.finalPrices !== null && element.t2.finalPrices !== undefined) {
                     resume_custo_total_exc_vat_value = element.t2.finalPrices.totalPrice.excl_vat
                  } else {
                     resume_custo_total_exc_vat_value = roundToTwo(
                        element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_opc).reduce((a, b) => a + b, 0)
                        + resume_total_ceme_value
                        + element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_com_desconto_acesso_redes).reduce((a, b) => a + b, 0)
                        + total_iec_value
                        + egme_tariff
                     );
                  }
               }

               let resume_custo_total_inc_vat_value = roundToTwo(resume_custo_total_exc_vat_value * (1 + element.t2.fees.IVA));
               let mobiEGrant = element.t1?.mobie_cdr_extension?.usage?.apoio_mobilidade_eletrica_ceme > 0 ? -element.t1?.mobie_cdr_extension?.usage?.apoio_mobilidade_eletrica_ceme : 0

               let resume_element = {
                  "resume_start_date_time": moment(element.t1.start_date_time).format("YYYY-MM-DD HH:mm"),
                  "resume_end_date_time": moment(element.t1.end_date_time).format("YYYY-MM-DD HH:mm"),
                  "resume_location_id": element.t2.location_id,
                  "resume_city": element.t1.cdr_location.city,
                  "resume_duration": duration,
                  "resume_energia_total_periodo": roundToThree(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.energia_total_periodo).reduce((a, b) => a + b, 0)),
                  "resume_total_opc": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_opc).reduce((a, b) => a + b, 0)),
                  "resume_total_ceme": roundToTwo(resume_total_ceme_value),
                  "resume_preco_com_desconto_acesso_redes": roundToTwo(element.t1.mobie_cdr_extension.subUsages.map(obj => obj.preco_com_desconto_acesso_redes).reduce((a, b) => a + b, 0)),
                  "resume_desconto_acesso_redes": roundToTwo(mobiEGrant),
                  "resume_egme_tariff": egme_tariff,
                  "resume_tariff_CEME_empty": tariffCemePriceEmpty,
                  "resume_total_iec": total_iec_value,
                  "resume_custo_total_exc_vat": resume_custo_total_exc_vat_value,
                  "resume_vat": element.t2.fees.IVA,
                  "resume_custo_total_inc_vat": resume_custo_total_inc_vat_value,
                  "resume_evId": element.t2.evId,
                  // "resume_evOwner": element.t2.evOwner
                  // We were asked to change the content of this collumn
                  "resume_evOwner": element.t2.userIdWillPay
               }

               Object.assign(resume_element, new_element);
               Object.assign(resume_element, new_info);
               Object.assign(resume_element, { "duration": duration });

               aux.push(resume_element);

            }

         }

         return res.status(200).send(aux);
      }
      else {
         return res.status(400).send("Failed to retrieve completed sessions");
      }

   });

});

async function billingPaidSessions() {
   const context = "Function billingPaidSessions"
   try {
      let params = {
         $and: [
            { clientName: process.env.WhiteLabelSC, chargerType: { $in: Constants.chargers.type.ChargerTypeGoCharge } },
            { paymentStatus: process.env.ChargingSessionPaymentStatusPaid },
            { invoiceStatus: false },
            { status: global.SessionStatusStopped },
            { cdrId: { "$exists": true, "$ne": "" } },
            { cdrId: { "$exists": true, "$ne": "NA" } },
            { cdrId: { "$exists": true, "$ne": "-1" } },
            { billingPeriod: process.env.BillingPeriodAdHoc },
            { minimumBillingConditions : true }
         ]
      };

      const featureFlagEnabled = await toggle.isEnable('foreign_invoice_deactivated_bp-54');
      if(featureFlagEnabled) {
         console.log(`[${context}][FEATUREFLAG][foreign_invoice_deactivated_BP-54]`)
         params = {
            $and: [
               { clientName: process.env.WhiteLabelSC, chargerType: { $in: Constants.chargers.type.ChargerTypeGoCharge } },
               { paymentStatus: process.env.ChargingSessionPaymentStatusPaid },
               { invoiceStatus: false },
               { status: global.SessionStatusStopped },
               { cdrId: { "$exists": true, "$ne": "" } },
               { cdrId: { "$exists": true, "$ne": "NA" } },
               { cdrId: { "$exists": true, "$ne": "-1" } },
               { billingPeriod: process.env.BillingPeriodAdHoc},
               { source: process.env.MobiePlatformCode},
               { minimumBillingConditions : true }
            ]
         };
      }

      let sessionsToBilling = await Session.find(params);
      for (let sessionI of sessionsToBilling) {
         try {
            await processSessionToBilling(sessionI);
         } catch (error) {
            Sentry.captureException(error);
            console.log(`[${context}] Error processing session ${sessionI?.id}`, { sessionId:  sessionI?.id });
            console.log(`[${context}] Moving to next session`);
         }
      }
      return sessionsToBilling;
   } catch (error) {
      console.log(`[${context}] Error `, error);
      return []
   }
}

async function processSessionToBilling(sessionI) {
   const context = "Function processSessionToBilling"
   return new Promise((resolve, reject) => {
      try {
         var query = { session_id: sessionI.id }
         //get CDRID
         CDR.findOne(query, async (err, cdr) => {
            if (err) {
               console.log(`[${context}] Error CDR of session id ${sessionI.id} not found`, err.message);
               reject(err)
            }

            if (cdr) {
               if (cdr.source === process.env.MobiePlatformCode) {
                  processBillingAndPayment(sessionI.id, cdr).then(async (result) => {
                     return resolve(result);

                  }).catch(err => {
                     console.log(`[${context}] Error processing billing`, err.message);
                     return resolve(`[${context}] Error processing billing: ` + err.message);
                  });
               } else if (cdr.source === process.env.GirevePlatformCode || cdr.source === process.env.HubjectPlatformCode) {
                  // When the network is not MobiE, the logic is a little bit different (no TAR, IEC, etc... and CPO tariffs calculations are different)
                  processBillingAndPaymentRoaming(sessionI.id, cdr).then(async (result) => {
                     return resolve(result);

                  }).catch(err => {
                     console.log(`[${context}] Error processing billing`, err.message);
                     return resolve(`[${context}] Error processing billing: ` + err.message);
                  });
               } else {
                  processBillingAndPayment(sessionI.id, cdr).then(async (result) => {
                     return resolve(result);

                  }).catch(err => {
                     console.log(`[${context}] Error processing billing`, err.message);
                     return resolve(`[${context}] Error processing billing: ` + err.message);
                  });
               }

            }
            else {
               console.log(`[${context}] Error CDR of session id ${sessionI.id} not found`);
               return resolve(`[${context}] Error CDR of session id ${sessionI.id} not found`);
            }


         });
      } catch (error) {
         console.log(`[${context}] Error `, error);
         return resolve(error)
      }
   })
}

function roundToTwo(num) {
   // return +(Math.round(num + "e+2") + "e-2");
   return Number(num.toFixed(2))
}

function roundToThree(num) {
   // return +(Math.round(num + "e+3") + "e-3");
   return Number(num.toFixed(3))
}

module.exports = router;
