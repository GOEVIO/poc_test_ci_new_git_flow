const { captureException } = require('@sentry/node');
const { operatorService } = require('evio-library-chargers').default;
const Charger = require('../models/charger');
const Operator = require('../models/operator');
const toggle = require('evio-toggle').default;

function createPipeline(query, fields, distance, lng, lat) {
    /**
     * The EPO and GFX are the ids of international charging point operators. 
     * those operators are ignored by the query because they have some 
     * issues regarding their OCPI tariffs. As long as this is
     * not solved, this filter needs to stay in.
     */
    query = { ...query , partyId: { "$nin": ["EPO", "GFX"] }};
    return [
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [lng, lat],
                },
                distanceField: 'dist.calculated',
                maxDistance: distance,
                includeLocs: 'dist.location',
                spherical: true,
                key: "geometry.coordinates",
                query: { ...query }
            },
        },
        {
            $project: fields,
        },
    ];
}

async function getChargers(query, fields, req, res) {
    const context = 'Function getChargers';

    try {
        const distance = parseInt(req.query.distance);
        const lng = parseFloat(req.query.lng);
        const lat = parseFloat(req.query.lat);
        const pipeline = createPipeline(query, fields, distance, lng, lat);
        return res.status(200).send(await Charger.aggregate(pipeline).exec());
    } catch (error) {
        console.error(`[${context}][.then][find] Error `, error.message);
        captureException(error);
        return res.status(500).send(error.message);
    }
}

async function getChargerOperator(charger) {
    const context = "Function getChargerOperator";
    const operatorResult = {
        operator: "",
        operatorContact: "",
        operatorEmail: "",
    }

    try {
        const isFeatureFlagEnable = await toggle.isEnable('charger-98');
        let operator;
        
        if (!isFeatureFlagEnable) {
            operator = await Operator.findOne({ partyId: charger?.partyId });
        } else {
            const partyId = charger?.network === "Gireve" ? charger?.operator : charger?.partyId;
            operator = await operatorService.findOperator(partyId);
        }

        if (operator) {
            operatorResult.operator = operator?.companyName || '';
            operatorResult.operatorContact = operator?.contact || '';
            operatorResult.operatorEmail = operator?.email || '';
        }

        return operatorResult
    } catch (error) {
        console.error(`${context} [Error]: ${error}`);
        captureException(error)
        return operatorResult;
    }
}

module.exports = {
    getChargers,
    getChargerOperator
};
