const express = require('express');
const router = express.Router();
const Charger = require('../models/charger')
const timeZone = require("../controllers/timeZoneHandler")

function getPlugStatus(EvseStatus) {
    switch (EvseStatus) {
        case "Available":
            return '10'
        case "Reserved":
        case "Occupied":
            return '20'
        case "OutOfService":
        case "EvseNotFound":
        case "Unknown":
            return '40'
        default:
            return '50'
    }
}

function getPlugSubStatus(EvseStatus) {
    switch (EvseStatus) {
        case "Available":
            return 'AVAILABLE'
        case "Reserved":
            return 'RESERVED'
        case "Occupied":
            return 'CHARGING'
        case "OutOfService":
            return 'OUTOFORDER'
        case "EvseNotFound":
        case "Unknown":
            return 'UNKNOWN'
        default:
            return 'UNKNOWN'
    }
}

//========== POST ==========
//this will get new charges or Update that are obtain from Hubject eRoamingEVSEData message and save them 
router.post('/api/private/CreateOrUpdateHubjectChargers', async (req, res, next) => {
    const context = "[Post /api/private/CreateOrUpdateHubjectChargers]";
    try {
        // console.log("CreateOrUpdateHubjectCharger received an request : ",req.body)
        let chargers = req.body.chargers
        console.log("Updating / creating ", chargers.length, " chargers")
        for (let charger of chargers) {
            //console.log("charger: ",charger)not updated 
            if (typeof charger === 'undefined') {
                console.log(`${context} Error - Request without charger information`)
                return res.status(400).send(false);
            }
            if (!charger.hwId || charger.network !== "Hubject" || !charger.plugs || !charger.geometry) {
                console.log(`${context} Error - Basic charger information is missing in the request`, JSON.stringify(charger))
                return res.status(400).send(false);
            }

            if(charger?.geometry?.coordinates)
                charger.timeZone = timeZone.getTimezoneFromCoordinates(charger.geometry.coordinates)

            let query = {
                source: 'Hubject',
                hwId: charger.hwId
            };
            let dbCharger = await Charger.findOne(query)
            if (dbCharger) {
                let doc = await Charger.updateChargerAsync(query, { $set: charger })

                if (doc != null && doc.nModified === 1) console.log("Updated " + charger.hwId);
                else console.log(" Fail to Update charger " + charger.hwId);

            } else {
                const new_charger = new Charger(charger);
                await Charger.createCharger(new_charger)
                console.log("Created new Plublic Charger " + charger.hwId);
            }
        }

        return res.status(200).send(true);
    } catch (error) {
        console.error(`${context}[createHubjectCharger] ' Error `, error);
        return res.status(500).send(false);
    }
});


router.get('/api/private/chargerHubject', (req, res, next) => {
    const context = "[Get /api/private/chargerHubject]";
    try {
        const hwId = req.query.hwId
        const evse = req.query.evseID
        const connectorID = req.query.connectorID
        let query = {}

        if (hwId) {
            query = {
                source: 'Hubject',
                hwId: hwId
            }
        } else if (evse) {
            query = {
                source: 'Hubject',
                plugs: {
                    $elemMatch: {
                        "evse_id": evse
                    }
                }
            }
        } else if (connectorID) {
            query = {
                source: 'Hubject',
                plugs: {
                    $elemMatch: {
                        "plugId": connectorID
                    }
                }
            }
        } else {
            console.error(`${context} Error - missing input fields `);
            return res.status(400).send(false);
        }

        Charger.findOne(query, (err, charger) => {
            if (err) {
                console.error(`[${context}][GetHubjectCharger] Error `, err);
                return res.status(500).send(false);
            }
            return res.status(200).send(charger);

        });
    } catch (error) {
        console.error(`${context}[GetHubjectCharger] Error `, error);
        return res.status(500).send(false);
    }
})


router.post('/api/private/oicpEVSEStatusUpdate', async (req, res, next) => {
    const context = "[Post /api/private/oicpEVSEStatusUpdata]";
    try {
        const listEVSE = req.body.evseList
        // console.log("Recebi alguma coisa : ", listEVSE)
        if (!listEVSE) {
            console.error(`${context} Error - Missing input variables`);
            return res.status(500).send({ status: false, desc: "Missing input variables" });
        }
        console.log(`[oicpEVSEStatusUpdata] - Updating ${listEVSE.length} EVSE Status`)
        for (const evse of listEVSE) {
            //  console.log(" EVSE : ", evse)

            // check if the charger exist
            let query = {
                source: 'Hubject',
                plugs: {
                    $elemMatch: {
                        "evse_id": evse.EvseID
                    }
                }
            }
            let dateNow = new Date()
            let charger = await Charger.findOne(query)
            if (charger) {
                let result = await Charger.updateEVSEStatus(query,
                    { $set: { "plugs.$[x].subStatus": getPlugSubStatus(evse.EvseStatus), "plugs.$[x].status": getPlugStatus(evse.EvseStatus), "plugs.$[x].statusChangeDate": dateNow.toISOString() } },
                    { arrayFilters: [{ "x.evse_id": evse.EvseID }] })
                if (!result.nModified) {
                    console.error(`${context} Error - Fail to update EVSE `, evse.EvseID, "ERROR : ", result, " le charger: ", charger);
                    //return res.status(500).send({ status: false, desc: "Fail to update EVSE "+evse.EvseID});
                }
            }
        }

        console.log("[oicpEVSEStatusUpdata] - Update Finished")
        return res.status(200).send({ status: true });
    } catch (error) {
        console.error(`${context} Error `, error);
        return res.status(500).send({ status: false, desc: "Error " + error });
    }
})

router.post('/api/private/updateEvseTariffs', async (req, res, next) => {
    const context = "[get /api/private/updateEvseTariffs]"
    try {
        const evseTariffs = req.body.list
        const operatorID = req.body.operatorID

        if (!evseTariffs || !operatorID) {
            console.error(`${context} Error `, error)
            return res.status(400).send(false)
        }
        for (let evseTar of evseTariffs) {
            evseTar.tariffList.push(operatorID + "_Default")
            let saved = await Charger.updateMany(
                { "source": "Hubject", "operatorID": operatorID, "plugs": { $elemMatch: { 'evse_id': evseTar.evseID } } },
                { $set: { "plugs.$[x].tariffId": evseTar.tariffList } },
                {
                    arrayFilters: [{ 'x.evse_id': evseTar.evseID }]
                })
            if (!saved.ok) {
                console.error(`${context} Error - Fail to update chargers from `, saved)
                return res.status(400).send(false)
            }
        }
        return res.status(200).send(true)
    } catch (error) {
        console.error(`${context} Error `, error)
        return res.status(500).send(false)
    }
})

router.get('/api/private/getHubjectOperatorsID', (req, res, next) => {
    const context = "[get /api/private/getHubjectOperatorsID]"
    try {
        let query = {
            source: 'Hubject',
        }
        Charger.distinct("operatorID", query).then(function (operatorList) {
            if (!operatorList) {
                console.error(`${context} Error - No Operators`, error)
                return res.status(500).send(false);

            } else res.status(200).send(operatorList)
        }).catch(function (error) {
            console.error(`${context} Error `, error)
            return res.status(500).send(false);
        })
    } catch (error) {
        console.error(`${context} Error `, error)
        return res.status(500).send(false)
    }
})

router.post('/api/private/removeChargers', (req, res, next) => {
    const context = "[post /api/private/removeChargers]"
    try {
        const operatorID = req.body.operatorID
        if (!operatorID) {
            console.error(`${context} Error - No operatorID`, operatorID)
            return res.status(500).send(false);
        }
        const query = {
            source: 'Hubject',
            operatorID: operatorID,
            operationalStatus: "APPROVED"
        }
        Charger.updateMany(query, { $set: { "operationalStatus": "REMOVED" } }).then(function (ret) {
            if (!ret.ok) return res.status(400).send(false)
            else return res.status(200).send(true)
        }).catch(function (err) {
            console.error(`${context} Error `, err.message)
            return res.status(500).send(false)
        })

    } catch (error) {
        console.error(`${context} Error `, error)
        return res.status(500).send(false)
    }
})

router.post('/api/private/changeTariffsFromChargers', async (req, res, next) => {
    const context = "[post /api/private/changeTariffsFromChargers]"
    try {
        const tariffObject = req.body.tariffObject

        if (!tariffObject) {
            console.error(`${context} Error - No operatorID`, operatorID)
            return res.status(500).send(false)
        }
        for (let tariffOperator of tariffObject) {
            let query = {
                source: "Hubject",
                operatorID: tariffOperator.operatorID
            }
            let saved = await Charger.updateMany(query, { $set: { "plugs.$[].tariffId": tariffOperator.listTariffsID } })
            if (!saved.ok) {
                console.error(`${context} Error - Fail to update chargers from `, saved)
                return res.status(400).send(false)
            }
        }
        console.log(`${context} - Tariffs updated`)
        return res.status(200).send(true)

    } catch (error) {
        console.error(`${context} Error `, error)
        return res.status(500).send(false)
    }
})

router.get('/api/private/chargerByPlugID', async (req, res, next) => {
    const context = "[post /api/private/chargerByPlugID]"
    try {
        let plugID = req.query.plugId
        if (!plugID) {
            console.error(`${context} Error - No operatorID`, operatorID)
            return res.status(500).send(false)
        }
        let query = {
            source: "Hubject",
            plugs: {
                $elemMatch: { "plugId": plugID }
            }
        }
        Charger.findOne(query, (err, charger) => {
            if (err) {
                console.error(`${context} Error `, err);
                return res.status(500).send(false);
            }
            if (charger) {
                return res.status(200).send(charger);
            } else {
                console.log(`${context} Error - Did not find charger ${plugID}`);
                return res.status(200).send(false);
            }
        });
    } catch (error) {
        console.error(`${context} Error `, error)
        return res.status(500).send(false)
    }
})

module.exports = router;