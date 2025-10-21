
const Tariff = require('../../models/tariff')
const axios = require('axios');
const Utils = require('../../utils')

module.exports = {
    add: async function (req, res) {
        const context = "Function add"
        try {
            const newTariff = new Tariff(req.body);
            await newTariff.save()
            return res.status(200).send(newTariff);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
    get: async function (req, res) {
        const context = "Function get"
        try {
            let tariff = await Tariff.findOne(req.query)
            if (tariff) {
                return res.status(200).send(tariff);
            } else {
                return res.status(400).send("Tariff not found");
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }   
        
    },
}