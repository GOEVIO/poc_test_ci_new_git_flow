const { ChargerNetworks } = require('evio-library-commons');
const { TariffsService } = require('evio-library-ocpi');

const getTariffOPCRemoteStart = async (charger, plug, userId,  evOwner) => {
    const defaultDynamicId = charger.source === ChargerNetworks.Hubject ? `default_dynamic_${charger.partyId}` : '';
    const tariff = await TariffsService.getOcpiCpoTariff(
        charger,
        plug?.serviceCost?.tariffs,
        defaultDynamicId,
        charger.geometry.coordinates[1],
        charger.geometry.coordinates[0],
        plug.power,
        userId,
        evOwner
    );
    return tariff
}

module.exports = {
    getTariffOPCRemoteStart
};