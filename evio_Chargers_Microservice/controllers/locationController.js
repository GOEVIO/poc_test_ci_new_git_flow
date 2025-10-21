const { captureException } = require('@sentry/node');
const commonLog = '[ locationController '
//DB 
const Locations = require('../models/locations')
//Controllers
const { setAllEnergyManagementConnectionToOffline } = require('../controllers/chargersHandler')

async function putOfflineAllLocations() {
    const context = `${commonLog} putOfflineAllLocations]`

    return await Locations.updateMany({ online: true }, { $set: { online: false, onlineStatusChangedDate: new Date() } })

}

// set all locations to offline, this is used when Comms has restarted ( for some reason), 
// and to prevent some locations have the wrong communication status
async function offlineAllLocations(req, res) {
    const context = `${commonLog} offlineAllLocations]`
    try {
        await Promise.all([putOfflineAllLocations(), setAllEnergyManagementConnectionToOffline()])
        return res.status(204).send();
    } catch (error) {
        console.error(`${context} `, error.message);
        captureException(error)
        return res.status(500).send(error.message);
    }
}

async function updateLocationStatus(arrayDevicesIds, isOnline) {
    const context = `${commonLog} updateLocationStatus]`
    if (typeof isOnline !== 'boolean' || !Array.isArray(arrayDevicesIds)) {
        console.error(`${context} Error - Missing input data`, isOnline, arrayDevicesIds);
        throw new Error('Missing input data');
    }
    const query = {
        _id: { $in: arrayDevicesIds }
    }

    return await Locations.updateMany(query, { $set: { online: isOnline, onlineStatusChangedDate: new Date() } })
}

async function updateConnectionStatus(req, res) {
    const context = `${commonLog} updateConnectionStatus]`
    try {
        const { isOnline, arrayDevicesIds } = req.body
        if (typeof isOnline !== 'boolean' || !Array.isArray(arrayDevicesIds)) {
            console.error(`${context} Error - Missing input data`, isOnline, arrayDevicesIds);
            return res.status(400).send('Missing input data');
        }
        await updateLocationStatus(arrayDevicesIds, isOnline)

        return res.status(204).send();
    } catch (error) {
        console.error(`${context} `, error.message);
        captureException(error)
        return res.status(500).send(error.message);
    }
}
module.exports = {
    offlineAllLocations,
    updateConnectionStatus
}