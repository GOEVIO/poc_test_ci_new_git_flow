const toggle = require('evio-toggle').default;
const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
const Utils = require('../utils');
const { saveSessionLogs } = require('../utils/save-session-logs');
const { Enums } = require('evio-library-commons').default;
const context = "[StopTransaction] ";

const host = global.charger_microservice_host;
const chargingSessionProxy = `${host}/api/private/chargingSession`;
const commandType = 'STOP_SESSION'

module.exports = {
    handle: function (data, payload) {
        return new Promise(function (resolve, reject) {
            try {
                //Get running charging Session
                const idTag = payload.idTag;
                const sessionId = payload.transactionId;
                const reason = payload.reason ? payload.reason : "";
                const stopDate = moment(payload.timestamp).utc();

                /////////////////////////////////////////////////////////////////////////////
                //Get charging session
                let params = {
                    // idTag: idTag,
                    sessionId: sessionId
                };
                if (idTag) {
                    params.idTag = idTag
                }
                const baseDataToSaveLogs = {
                    userId: idTag ? `--put session- TAG-${idTag}` : '--put session- TAG-UNKNOWN',
                    hwId: data.chargeBoxIdentity || '',
                    plugId: '',
                    stage: "[Handle PUT session OCPP]",
                    action: 'stop',
                    status: Enums.SessionFlowLogsStatus.ERROR,
                    errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                    externalId: sessionId,
                    payload
                }

                Utils.getSession(chargingSessionProxy, params).then(async (session) => {
                    if (session) {
                        // console.log("Stop Session")
                        // console.log(JSON.stringify(session))
                        if (!session.stopTransactionReceived) {

                            const commandResultBody = {
                                response_url : session.response_url_stop,
                                party_id : session.party_id,
                                network : session.network,
                                hwId : session.hwId,
                                plugId : session.plugId,
                                commandType,
                                operatorId : session.operatorId,
                            }
                            baseDataToSaveLogs.plugId = session?.plugId || '';
                            baseDataToSaveLogs.hwId = session?.hwId || '';

                            Utils.sendCommandResult(session.response_url_stop , commandType , {...commandResultBody , result : 'ACCEPTED'  , message : reason})
                            
                            if (session.status == process.env.SessionStatusRunning) {
                                console.log(`${context}  Charging session ${session.sessionId} was stopped with RFID card, or UVE detached the plug manually, or reset function was called`);
                            }
    
                            /** {@link https://evio.atlassian.net/browse/CHARGE-94} */
                            const totalPowerConsumed = (await toggle.isEnable('charge-94'))
                                ? getTotalPowerConsumed(session, payload.meterStop)
                                : payload.meterStop - session.meterStart;
    
                            let timeChargedinSeconds = Utils.getChargingTime(session.startDate,stopDate);
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                status: Enums.SessionFlowLogsStatus.SUCCESS,
                                stage: baseDataToSaveLogs.stage += ' - Charging session StopTransaction accepted',
                            })
    
                            sendResponse(data, global.idTagStatusAccepted, resolve , payload , 'StopTransaction accpeted' , true , session.plugId);
    
                            //TODO - Validate se está a parar sessão caso esteja a correr, ou se está a parar sessão se já está parado
                            //Se já está parado já foi comunicado que user tirou plug e ja esta available, logo sessão ja esta parada, nao colocamos como estacionamento. Se ainda está a correr, então colocamos como estacionamento, e o status notification trata do resto quando ficar available (passando para parado em vez de estacionado)
                            //Update charging session Stoped
                            // let patchSession = {
                            //     country_code : session.country_code,
                            //     party_id : session.party_id,
                            //     ocpiId : session.ocpiId,
                            //     totalPower : totalPowerConsumed ? totalPowerConsumed/1000 : 0,
                            //     updatedAt : session.updatedAt,
                            //     network : session.network,
                            //     operatorId : session.operatorId,
                            //     status : process.env.SessionStatusStopped,
                            // }

                            if (session.status == process.env.SessionStatusAvailableButNotStopped) {
                                // patchSession.status = process.env.SessionStatusStopped
                                Utils.updateChargingSession2(chargingSessionProxy, process.env.SessionStatusStopped, session._id, payload.meterStop, totalPowerConsumed, timeChargedinSeconds,stopDate);
                            } else {
                                // patchSession.status = process.env.SessionStatusStoppedAndEvParked
                                Utils.updateChargingSession2(chargingSessionProxy, process.env.SessionStatusStoppedAndEvParked, session._id, payload.meterStop, totalPowerConsumed, timeChargedinSeconds,stopDate);
                            }
                            
                            // Utils.sendPatchSession(patchSession)
                        } else {
                            console.error(`${context} Charging session already received Stop Transaction: `, params);
                            saveSessionLogs({
                                ...baseDataToSaveLogs,
                                errorMessage: `Charging session already received Stop Transaction`,
                            })
                            sendResponse(data, global.idTagStatusAccepted, resolve , payload , 'Stop Transaction already received' , false , session.plugId);
                        }
                    } else {
                        saveSessionLogs({
                            ...baseDataToSaveLogs,
                            errorMessage: `Charging session not found for given parameters ${JSON.stringify(params)}`,
                        })
                        console.error(`${context} Charging session not found for given parameters: `, params);
                        sendResponse(data, global.idTagStatusAccepted, resolve , payload , 'Transaction not found' , false , 0);
                    }
                });

            } catch (err) {
                console.error("[Stop Transaction] Unxpected error: " + err)
                saveSessionLogs({
                    userId: payload?.idTag ? `--put session- TAG-${payload.idTag}` : '--put session- TAG-UNKNOWN',
                    hwId: payload?.hwId || '',
                    plugId: payload?.connectorId || '',
                    stage: "[Handle PUT session OCPP]",
                    action: 'stop',
                    status: Enums.SessionFlowLogsStatus.ERROR,
                    errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                    externalId: payload?.transactionId || '',
                    errorMessage: `Unexpected error: ${err?.message || ''}`,
                    payload
                })
                sendResponse(data, global.idTagStatusAccepted, resolve , payload , JSON.stringify(err) , false , 0);
            }
        });
    },
    getTotalPowerConsumed,
}


const sendResponse = (data, status, resolve , payload , text , success , plugId) => {
    const StopTransactionResponse = [global.callResult, data.messageId, {
        idTagInfo: {
            status: status
        }
    }];

    Utils.saveLog(data.chargeBoxIdentity , payload , StopTransactionResponse[2] , success , 'StopTransaction' , text , plugId , global.triggeredByCP)

    resolve(StopTransactionResponse);
};

/**
 * Calculates total power consumed based on meter stop and session data.
 * @param {object} session - charging session from chargers microservice
 * @param {number} meterStop - received from stop transaction message
 * @returns {number} The highest value between the meters calculation, readings or cero.
 */
function getTotalPowerConsumed(session, meterStop) {
    const meterReading = meterStop - session.meterStart
    const readingPoints = session.readingPoints?.map(rp => rp.totalPower) ?? []
    const notificationsReading = session.notificationsHistory?.map(nh => nh.totalPower) ?? []

    return Math.max(
        0, // in case none of the values is possitive or don't exist
        meterReading,
        ...readingPoints,
        ...notificationsReading
    )
}
