const { Enums: { OcpiTariffType } } = require('evio-library-commons').default;

const getPlugTariffAdHocId = (plug) => {
    if(!plug?.serviceCost?.tariffs?.length){
        return null
    }

    const adHocTariff = plug.serviceCost.tariffs.find(tariff => tariff.type === OcpiTariffType.AdHoc);
    return adHocTariff ? adHocTariff.id : null;
}

module.exports = {
    getPlugTariffAdHocId
};