const CDRModel = require('../../../../models/cdrs')

class CdrService {
    async findCdrById(cdrId) {
            const cdr = await CDRModel.findOne({ id: cdrId }); 
            return cdr;
    }
}

module.exports = new CdrService();