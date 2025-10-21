const locationsService = require('../services/locations');
const { errorResponse } = require('../utils/errorHandling');

const getLocations = async (req, res) => {
    const context = `${req.method} ${req.path}`;
    try {
        return res.status(200).json(await locationsService.getLocations(req));
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

module.exports = {
    getLocations
};