const axios = require('axios')

// BD
const ChargingSession = require('./models/chargingSession')


let Utils = {
    removeKmsFromSession: function (sessionID, idSession) {
        const context = " Utils removeKmsFromSession"
        return new Promise((resolve, reject) => {
            try {
                if (!sessionID && !idSession) {
                    console.error(`[${context}] Error - Missing input data`);
                    return resolve('Missing input data')
                }

                const query = idSession ? {_id: idSession } : { sessionId: sessionID };

                ChargingSession.findOne(query).then(function (session) {
                    if (!session) {
                        console.error(`[${context}] Error - Unknown sessioID: `, sessionID);
                        return resolve('Unknown sessioID')
                    }
                    if (!session.evKms || session.evKms.length < 1 || !session.evId || session.evId == '-1') return resolve(true)

                    Utils.removeKmsFromEV(session.evId, session.sessionId).then(function (removed) {
                        if (!removed) {
                            console.error(`[${context}] Error - Fail to remove km from ev`);
                            return resolve('Fail to remove km from ev')
                        }

                        // remove kms from session
                        ChargingSession.updateOne(query, { $unset: { 'evKms': '' } }).then(function (updated) {
                            return resolve(true)

                        }).catch(function (error) {
                            console.error(`[${context}] Error `, error);
                            resolve(error.message)
                        })
                    }).catch(function (error) {
                        console.error(`[${context}] Error `, error);
                        resolve(error.message ? error.message : error)
                    })

                }).catch(function (error) {
                    console.error(`[${context}] Error `, error);
                    resolve(error.message)
                })

            } catch (error) {
                console.error(`[${context}] Error `, error);
                resolve(error.message)
            }
        })
    },
    removeKmsFromEV: function (evId, sessionId) {
        const context = " Utils removeKmsFromEV"
        return new Promise((resolve, reject) => {
            try {
                if (!evId || !sessionId) {
                    console.error(`[${context}] Error - Missing input data`);
                    return reject('Missing input data')
                }

                let data = {
                    evID: evId,
                    sessionID: sessionId
                }
                axios.delete(process.env.HostEvs + process.env.PathRemovekmEV, { data: data }).then(function (result) {
                    if (!result?.data?.message?.auth) {
                        console.error(`[${context}] Error - Fail to remove kms from EV`);
                        return reject(result?.data?.message?.message ? result.data.message.message : 'Fail to remove kms from EV')

                    } else return resolve(true)

                }).catch(function (error) {
                    if (error.data) {
                        console.error(`[${context}] Error `, error.data.message);
                    } else {
                        console.error(`[${context}] Error `, error.message);
                    }
                    reject(error.message)
                })
            } catch (error) {
                console.error(`[${context}] Error `, error);
                reject(error.message)
            }
        })
    },
    sleep: function(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

module.exports = Utils;