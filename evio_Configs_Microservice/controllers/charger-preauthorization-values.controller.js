const { isPublicCharger, DBNames } = require('evio-library-commons');
const { findOneChargerInPublicNetworkOrChargers } = require('evio-library-chargers')
const { getCharge, saveOrUpdateCharge } = require('../models/charge-preauthorization-values.model');

const createOrUpdateChargerPreAuthorization = async (req, res) => {
    try {
        const validation = await validateChargerPreAuthorizationBody(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.message});
        };

        const { chargerType, hwId } = req.body;

        const chargerDbToFind = isPublicCharger(chargerType) ? DBNames.PublicNetworks : DBNames.Chargers;

        const charger = await findOneChargerInPublicNetworkOrChargers({ hwId }, chargerDbToFind, {"plugs.plugId": 1});
        if(!charger || !Object.keys(charger).length){
            return res.status(404).json({ error: 'Charger not found.' });
        }
        const chargerPreAuthorizationData = formatChargerPreAuthorizationBody(req.body, charger);

        await Promise.all(chargerPreAuthorizationData.plugs.map(async (plug) => {
            await saveOrUpdateCharge(chargerPreAuthorizationData.hwId, plug.plugId, plug.preAuthorizationValue);
        }));

        return res.status(200).json({ message: 'Configs successfully saved', data: chargerPreAuthorizationData });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ error: error.message });
    }
};

const getChargerPreAuthorization = async (req, res) => {
    try {
        const hwId = req.params?.hwId
        if(!hwId){
            return res.status(400).json({ error: 'Hardware ID is required.' });
        }
        const data = await getCharge(hwId);
        return res.status(200).json(data);
    } catch (error) {
       console.error(error);
        return res.status(400).json({ error: error.message });
    }
};

const validateChargerPreAuthorizationBody = async (preAuthBody, res) => {
    if(!preAuthBody || !Object.keys(preAuthBody).length) {
        return { valid: false, message: 'Invalid request body' };
    }

    if(!preAuthBody?.hwId) {
        return { valid: false, message: 'Charger hwId is required.' };
    }

    if(!preAuthBody?.chargerType) {
        return { valid: false, message: 'Charger type is required.' };
    }


    if(!preAuthBody?.plugs?.length){
        if(!preAuthBody?.preAuthorizationValue || typeof preAuthBody?.preAuthorizationValue !== 'number') {
           return { valid: false, message: 'Charger Pre Authorization value is required.' };
        }
        return {valid: true}
    }

    for(const plug of preAuthBody.plugs) {
        if(!plug?.plugId) {
            return { valid: false, message: 'Charger plugId is required.' };
        }

        if(!plug?.preAuthorizationValue || typeof plug?.preAuthorizationValue !== 'number') {
            return { valid: false, message: 'Invalid charger Pre Authorization value in plugs array' };
        }
    }

    return {valid: true}
}

const formatChargerPreAuthorizationBody = (preAuthBody, charger) => {
    const plugs =  charger.plugs.map((plug) => (plug.plugId))
    if(!preAuthBody?.plugs?.length){
        return {
            hwId: preAuthBody.hwId,
            plugs: plugs.map((plug) => ({
                plugId: plug,
                preAuthorizationValue: Number(preAuthBody.preAuthorizationValue)
            }))
        }
    }

    return {
        hwId: preAuthBody.hwId,
        plugs: preAuthBody.plugs.map((plug) => ({
            plugId: plug.plugId,
            preAuthorizationValue: Number(plug.preAuthorizationValue)
        }))
    }
}

module.exports = {
    createOrUpdateChargerPreAuthorization,
    getChargerPreAuthorization
};