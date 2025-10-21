const Utils = require('../../utils.js');
const { TariffsService } = require('evio-library-ocpi');
async function upsertTariffsData(element , data) {
    try {
        // Add source to the tariff element
        element.source = data.source
        
        // Transform the tariff according to the protocol
        const tariff = TariffsService.transformOcpiTariff(element)

        // Return the upsert operation for bulk write
        return Utils.mongoUpsertOperation({id: tariff.id}, tariff)

    } catch (error) {
        console.error("[upsertTariffsData] Error:  " , error);
    }
}


module.exports = {
    upsertTariffsData
};