const FeatureFlagGuard = require('../guard/feature.flag.guard');
const Configs = require('../models/configs');

const minimumValueToAddCard = async (clientName) => { 
    const preAuthWLActivated = await FeatureFlagGuard.canActivate('preauthorization_wl');
    if (preAuthWLActivated) {
        return 30;
    }

    const paymentConfig = await Configs.findOne({});
    const { blockCreditCard } = paymentConfig;
    return blockCreditCard.clientNames.includes(clientName) ? 31 : 30;
};

const verifyIfUserCanAddCard = async (userInfo) => {
    //@sBaptistaEvio ver se é para desativar
    const paymentConfig = await Configs.findOne({});
    const { blockCreditCard } = paymentConfig;

    const ensureBlockCard = blockCreditCard.clientNames.includes(userInfo.clientName) && blockCreditCard?.minAccoutCreatedDays > 0;
    const whitelistBlockCard = blockCreditCard.whitelist.find((elem) => userInfo.email.includes(elem)) != undefined;

    if (!whitelistBlockCard && ensureBlockCard) return blockCreditCard;
    return null;
}

module.exports = {
    minimumValueToAddCard,
    verifyIfUserCanAddCard
};
