const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
const Utils = require('../utils');
const context = '[MeterValues] '
// var Notification = require('../notifications');

const host = global.charger_microservice_host;
const chargingSessionProxy = `${host}/api/private/chargingSession`;
const chargingSessionStatServiceProxy = `${host}/api/private/chargingSession/statistics`;
const chargerHeartBeatServiceProxy = `${host}/api/private/chargers/heartBeat`;
const trigger = global.triggeredByCP

module.exports = {
    handle: function (data, payload) {
        return new Promise(function (resolve, reject) {
            const MeterValuesResponse = [global.callResult, data.messageId, {}];

            try {
                const communicationDate = moment.utc();

                let params = {
                    hwId: data.chargeBoxIdentity
                };

                //////////////////////////////////////////////////////////////////////
                // GET SESSION VALUES
                let instantPower = -1;
                let instantVoltage = -1;
                let instantAmperage = -1;
                let totalConsumed = -1;
                let evBattery = -1;

                // console.log(payload.meterValue[0].sampledValue.length);
                if (payload.meterValue[0].sampledValue) {

                    for (let i = 0; i < payload.meterValue[0].sampledValue.length; i++) {
                        let meterRegistered = payload.meterValue[0].sampledValue[i];

                        if (meterRegistered.value >= 0) {

                            if (meterRegistered.measurand == global.ocppMeasTypePAI) {
                                instantPower = meterRegistered.value; //2325.970
                                const uom = meterRegistered.unit;
                                if (uom == 'kW') {
                                    instantPower *= 1000; // Convert KWh to Wh
                                }
                            }
                            else if (meterRegistered.measurand == global.ocppMeasTypeEAIR) {
                                totalConsumed = meterRegistered.value
                                const uom = meterRegistered.unit;
                                if (uom == 'kWh') {
                                    totalConsumed *= 1000; // Convert KWh to Wh
                                }
                            }
                            else if (meterRegistered.measurand == global.ocppMeasTypeSoC) {
                                evBattery = meterRegistered.value
                            }
                            else if (meterRegistered.measurand == global.ocppMeasTypeVoltage) {
                                instantVoltage = meterRegistered.value
                            }
                            else if (meterRegistered.measurand == global.ocppMeasTypeCI) {
                                instantAmperage = meterRegistered.value //0.0
                            }

                        }
                    }
                }

                const plugId = payload.connectorId;
                const sessionId = payload.transactionId;
                const meterDate = moment(payload.meterValue[0].timestamp).utc()

                //Experiência por DC - 10/03/2021. Muitas vezes o posto envia meter values com delay e a sessão já não está a correr. Devemos guardar na mesma. Não parece haver problema pois o sessionId é único. De qualquer modo, em caso de problema, trocar filtro em baixo.
                params = {
                    plugId: plugId,
                    sessionId: sessionId
                };

                ///////////////////////////////////////////////////////////////
                //Get Running Session
                if (sessionId !== null && sessionId !== undefined && sessionId != "-1") {
                    Utils.getSession(chargingSessionProxy, params).then((chargingSession) => {

                        if (chargingSession) {

                            const meterStart = chargingSession.meterStart;

                            // Charging Time
                            const timeChargedinSeconds = Utils.getChargingTime(chargingSession.startDate , meterDate);

                            let totalPowerConsumed = chargingSession.totalPower;

                            if (totalConsumed >= meterStart)
                                totalPowerConsumed = totalConsumed - meterStart;

                            const body = {
                                _id: chargingSession._id,
                                readingPoints: [{
                                    totalPower: totalPowerConsumed,
                                    instantPower: instantPower,
                                    instantVoltage: instantVoltage,
                                    instantAmperage: instantAmperage,
                                    readDate : meterDate,
                                    communicationDate: communicationDate
                                }],
                                timeCharged: timeChargedinSeconds,
                                batteryCharged: evBattery,
                                totalPower: totalPowerConsumed
                            }

                            Utils.updateChargingSessionMeterValues(chargingSessionStatServiceProxy, body);

                            // Utils.sendPatchSession(patchSession)
                            Utils.inteligentHeartBeat(chargerHeartBeatServiceProxy, chargingSession.hwId , true);

                            Utils.saveLog(data.chargeBoxIdentity , payload , MeterValuesResponse[2] , true , 'MeterValues' , 'Meter Values Received' , payload.connectorId , trigger)

                            resolve(MeterValuesResponse);
                        }
                        else {
                            console.error(`${context} Critical error - Charging session not found for given parameters: `, params);
                            Utils.saveLog(data.chargeBoxIdentity , payload , MeterValuesResponse[2] , false , 'MeterValues' , 'Charging session not found' , payload.connectorId , trigger)
                            resolve(MeterValuesResponse);
                        }
                    });
                } else {
                    console.error(`${context} Critical error - Charging session not found for given parameters: `, params);
                    Utils.saveLog(data.chargeBoxIdentity , payload , MeterValuesResponse[2] , false , 'MeterValues' , 'Charging session not found' , payload.connectorId , trigger)
                    resolve(MeterValuesResponse);
                }
            } catch (error) {
                Utils.saveLog(data.chargeBoxIdentity , payload , MeterValuesResponse[2] , false , 'MeterValues' , `${error.message}` , payload.connectorId , trigger)
                reject(error)
                console.error('[MeterValues] error :' + error);
            }
        });
    }
}
