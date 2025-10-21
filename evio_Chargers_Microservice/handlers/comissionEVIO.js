require("dotenv-safe").load();
const Comission = require('../models/comissionEVIO');
const Charger = require('../models/charger');


module.exports = {
    patch: (req, res) => patchComissionEVIO(req, res),
    patchSpecialClientsAdd: (req, res) => patchComissionEVIOSpecialClientsAdd(req, res),
    patchSpecialClientsRemove: (req, res) => patchComissionEVIOSpecialClientsRemove(req, res),
    create: (req, res) => createComission(req, res),
    get: (req, res) => getComission(req, res)
}

//========== CREATE ==========
//Function to create comission
async function createComission(req, res) {
    var context = "function createComission";
    try {

        if (!req.body.userId) {
            return res.status(400).send("User is needed");
        }

        if (!req.body.minAmount) {
            return res.status(400).send("Min Amount is needed");
        }

        if (!req.body.percentage) {
            return res.status(400).send("Percentage is needed");
        }

        let userId = req.body.userId

        let comission = {
            "userId": req.body.userId,
            "minAmount": req.body.minAmount,
            "percentage": req.body.percentage,
            "specialClients": []
        }

        let UserComission = await Comission.find({ userId: userId })

        if (UserComission.length == 0) {
            let newComission = new Comission(comission);
            let result = await newComission.save()
            return res.status(200).send(result);
        }
        
        return res.status(200).send("User already exists!");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}


//========== GET ==========
async function getComission(req, res) {
    var context = "function getComission";
    try {

        if (!req.query.userId) {
            return res.status(400).send("User is needed");
        }

        let query = {
            "userId": req.query.userId
        }

        let result = await Comission.find(query)

        return res.status(200).send(result);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

//========== PATCH ==========

async function patchComissionEVIO(req, res) {
    var context = "function patchComission"; 
    try {
        
        if (!req.body.userId) {
            return res.status(400).send("User is needed");
        }

        if (!req.body.percentage) {
            return res.status(400).send("Percentage is needed");
        }

        if (!req.body.minAmount) { 
            return res.status(400).send("Min amount is needed");
        }  

        let updateQuery = {
            $set: {
                percentage: req.body.percentage,
                minAmount: req.body.minAmount
            } 
        }

        

        let query = {
            "userId": req.body.userId
        }

        let result = await Comission.updateMany(query, updateQuery)

        return res.status(200).send(result);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function patchComissionEVIOSpecialClientsAdd(req, res) {
    var context = "function patchComission";
    try {

        if (!req.body.userId) {
            return res.status(400).send("User is needed");
        }

        if (!req.body.specialClient) {
            return res.status(400).send("Special client is needed");
        }

        if (!req.body.minAmount) {
            return res.status(400).send("Min Amount is needed");
        }

        if (!req.body.percentage) {
            return res.status(400).send("Percentage is needed");
        }

        let updateQuery = {
            $push: {
                specialClients: {
                    userId: req.body.specialClient,
                    minAmount: req.body.minAmount,
                    percentage: req.body.percentage
                }
            }
        }

        let query = {
            "userId": req.body.userId
        }

        let result = await Comission.updateMany(query, updateQuery)

        return res.status(200).send(result);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function patchComissionEVIOSpecialClientsRemove(req, res) {
    var context = "function patchComission";
    try {

        if (!req.body.userId) {
            return res.status(400).send("User is needed");
        }

        if (!req.body.specialClient) {
            return res.status(400).send("Special client is needed");
        }

        let updateQuery = {
            $pull: {
                specialClients: {
                    userId: req.body.specialClient
                }
            }
        }

        let query = {
            "userId": req.body.userId
        }

        let result = await Comission.updateMany(query, updateQuery)

        return res.status(200).send(result);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}
