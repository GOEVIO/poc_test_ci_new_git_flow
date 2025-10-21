const { getHubjectCEMETariff, getTariffCEME, getTariffCemeByDate  } = require('../../utils');
const { isEmptyObject, isNotEmptyObject } = require('./check-empty-object');

const getTariffCEMERemoteStart = async (ceme, clientName, isHubjectNetwork) => {
    let tariffCEME = '';

    if(isNotEmptyObject(ceme?.plan)) {
        tariffCEME = ceme.plan
    }

    if(!tariffCEME || isEmptyObject(tariffCEME)) {
        tariffCEME = await getTariffCEME(clientName);
    }

    const tariffArray = getTariffCemeByDate(tariffCEME, new Date().toISOString())
    tariffCEME.tariff = tariffArray

    return tariffCEME
}

module.exports = {
    getTariffCEMERemoteStart
};