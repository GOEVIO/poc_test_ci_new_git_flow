require("dotenv-safe").load();
const ComissionClient = require('../models/comissionClient');
const Charger = require('../models/charger');


module.exports = {
    patch: (req, res) => patchComission(req, res),
    create: (userId, chargerId) => createComission(userId, chargerId),
    createOld: (req, res) => createOldComission(req, res),
    get: (req, res) => getComission(req, res)
}

//========== CREATE ==========
//Function to create comission
async function createComission(userId, chargerId) {
    var context = "function createComission";
    try {

        let comission = {
            "userId": userId,
            "charger": chargerId,
            "percentage": 0
        }

        let comissionClient = new ComissionClient(comission);
        let result = await comissionClient.save()
        // console.log("result", result);
        //return res.status(200).send(result);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        // return res.status(500).send(error.message);
    };
}

async function createOldComission(req, res) {
    var context = "function createOldComission";
    try {

        let chargers = await Charger.find({})

        let comissions = await ComissionClient.find({})

        let chargersId = comissions.map(x => x.charger)

        let comissionsToBeAdd = []

        for (let i = 0; i != chargers.length; i++) {
            if (!chargersId.includes(chargers[i].hwId)) {
                comissionsToBeAdd.push({
                    "userId": chargers[i].createUser,
                    "charger": chargers[i].hwId,
                    "percentage": 0
                })
            }
        }

        // console.log(comissionsToBeAdd)

        for (let i = 0; i != comissionsToBeAdd.length; i++) {
            let newComission = new ComissionClient(comissionsToBeAdd[i]);
            let result = await newComission.save()
            // console.log(result)
        }

        return res.status(200).send();
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

//========== GET ==========
async function getComission(req, res) {
    var context = "function getComission";
    try {
        let userId = req.headers['userid'];


        // console.log(req.query)

        if (req.query.userId) {
            userId = req.query.userId
        }

        let query = {
            "userId": userId
        }

        // console.log(userId)

        let result = await ComissionClient.find(query)

        return res.status(200).send(result);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}


//========== PATCH ==========
//Edit comission percentage
async function patchComission(req, res) {
    var context = "function patchComission";
    try {

        let userId = req.headers['userid'];
        let chargers = "";

        if (req.body.userId) {
            userId = req.body.userId
        }

        if (req.body.chargers) {
            chargers = req.body.chargers
        }

        if (!req.body.percentage) {
            return res.status(400).send("Percentage is needed");
        }

        let updateQuery = {
            $set: {
                percentage: req.body.percentage
            }
        }

        let query = {
            "userId": userId
        }

        if (chargers != "") {
            query = {
                "userId": userId,
                "charger": chargers
            }
        }

        // console.log(query)
        // console.log(updateQuery)

        let result = await ComissionClient.updateMany(query, updateQuery)

        return res.status(200).send(result);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
};
