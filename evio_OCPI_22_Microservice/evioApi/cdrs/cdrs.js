const Session = require('../../models/sessions')
const CDR = require('../../models/cdrs')
const Utils = require('../../utils');
const global = require('../../global');



module.exports = {
    addSource: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "GET /api/private/cdrs/runFirstTime";

            try {
                CDR.find({}, async (err, cdrs) => {
                    if (err) {
                        console.log(`[${context}] Error CDRs not found`, err.message);
                        reject(err);
                    } else {
                        if (cdrs.length > 0) {
                            for (let cdr of cdrs) {
                                let query = {
                                    id: cdr.session_id
                                }
                                let cdrSession = cdr.session_id ? await Utils.chargingSessionFindOne(query) : null
                                if (cdrSession !== null && cdrSession !== undefined) {
                                    let query = {
                                        _id: cdr._id,
                                    };

                                    let newValues = {
                                        $set: { "source": cdrSession.source }
                                    };

                                    CDR.updateCDR(query, newValues, (err, result) => {

                                        if (err) {
                                            console.log(`[${context}][] Error `, err.message);
                                        }
                                        else {
                                            console.log(`CDR with _id ${cdr._id} updated its source to ${cdrSession.source}`)
                                        };

                                    });
                                }
                            }
                        }
                        resolve()
                    }

                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    fixTotalTime: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "POST /api/private/cdrs/runFirstTime";

            try {
                CDR.find({}, async (err, cdrs) => {
                    if (err) {
                        console.log(`[${context}] Error CDRs not found`, err.message);
                        reject(err);
                    } else {
                        if (cdrs.length > 0) {
                            for (let cdr of cdrs) {
                                if (cdr.id.includes('ftp')) {
                                    let totalTimeUsage = cdr.mobie_cdr_extension.usage.totalDuration
                                    await CDR.updateOne({ id: cdr.id }, { total_time: (totalTimeUsage / 60).toFixed(3) })
                                }
                            }
                        }
                        resolve()
                    }

                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    getCDRAgregate: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "POST /api/private/cdrs/agregate";

            try {

                let agregate = req.body

                CDR.aggregate(agregate, async (err, cdrs) => {
                    if (err) {
                        console.log(`[${context}] Error CDRs not found`, err.message);
                        reject(err);
                    } else {
                        resolve(cdrs)
                    }

                });


            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    getCDRFind: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "POST /api/private/cdrs/find";

            try {

                let query = req.body

                CDR.find(query, async (err, cdrs) => {
                    if (err) {
                        console.log(`[${context}] Error CDRs not found`, err.message);
                        reject(err);
                    } else {
                        console.log(cdrs.length)
                        resolve(cdrs)
                    }

                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    }
}
