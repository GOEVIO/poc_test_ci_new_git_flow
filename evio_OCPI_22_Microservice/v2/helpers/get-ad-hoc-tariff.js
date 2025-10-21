const { ChargerNetworks } = require('evio-library-commons');
const { TariffsRepository } = require('evio-library-ocpi');

const getAdHocTariff = async (tariffId, charger) => {
    const defaultDynamicId = charger.source === ChargerNetworks.Hubject ? `default_dynamic_${charger?.partyId}` : '';
    const tariff = await TariffsRepository.getTariff(tariffId, defaultDynamicId);
    return tariff
}

module.exports = {
    getAdHocTariff
};
