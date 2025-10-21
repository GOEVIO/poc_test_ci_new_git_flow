const { StatusCodes } = require('http-status-codes');
const Utils = require('../../../../utils');
const cdrService = require('../services/cdrService');

class CdrController {
    async getCdrById(req, res) {
        const { cdrId } = req.params;
        try {
            const cdr = await cdrService.findCdrById(cdrId);
            if (!cdr) {
                return res.status(StatusCodes.NOT_FOUND).send(Utils.response(null, StatusCodes.NOT_FOUND, "CDR not found"));
            }
            return res.status(StatusCodes.OK).send(Utils.response(cdr, StatusCodes.OK, "CDR found successfully"));
        } catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(Utils.response(null, StatusCodes.INTERNAL_SERVER_ERROR, "Error finding CDR"));
        }
    }
}

module.exports = new CdrController();