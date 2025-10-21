const Utils = require('../../utils')
const Constants = require('../../utils/constants')
const axiosS = require('../../services/axios')

module.exports = {
    get: (req, res) => getCemeTariffs(req, res),
    patchUser: (planId, userId) => patchUserCemeTarrif(planId, userId),
} 

async function getCemeTariffs(req, res) {
    const context = "GET /api/private/controlcenter/users/cemeTariffs - Function getCemeTariffs"
    try {
        const query = { clientName: req?.query?.clientName || "EVIO" }

        const project = { CEME: 1, activationFee: 1, country: 1, createdAt: 1, cycleType: 1, planName: 1, tariff: 1, tariffType: 1, updatedAt: 1 }

        const result = await Utils.getTariffCEMEWithProject({ match: query, project: project })

        return res.status(200).send(result);
    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    }
}

async function patchUserCemeTarrif(planId, userId) {
    const context = "Function patchUserCemeTarrif"
    try {
        const host = Constants.env.identity.host + Constants.env.identity.pathPatchCemeTarrifUser;
        const body = { planId, userId }

        await axiosS.axiosPostBody(host, body)
        console.error(`[${context}] CemeTarrifUser updated! ${JSON.stringify(body)}`);
    } catch (error) {
        console.error(`[${context}] Error `, error);
    }
}