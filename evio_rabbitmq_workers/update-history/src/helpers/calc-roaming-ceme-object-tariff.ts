import { roundValues } from "./round-values"

export const calcRoamingCemeObjectTariff = (session, minimumBillingConditions = null) => {
    let CEME_PERCENTAGE = {price:0};
    let evioPercentage = 0;
    let gireveActivationFee = 0;

    const ceme: any = {
        time: 0,
        energy: 0,
        activation: 0,
        total: 0,
    }

    const opcDetail = session.finalPrices?.opcPriceDetail || {}
    const cemeDetail = session.finalPrices?.cemePriceDetail || {}


    const opcDetailTimePrice = opcDetail?.timePrice?.excl_vat || 0
    const opcDetailPowerPrice = opcDetail?.powerPrice?.excl_vat || 0
    const opcDetailFlatPrice = opcDetail?.flatPrice?.excl_vat || 0

    const cemeDetailTimePrice = cemeDetail?.timePrice?.excl_vat || 0
    const cemeDetailPowerPrice = cemeDetail?.powerPrice?.excl_vat || 0
    const cemeDetailFlatPrice = cemeDetail?.flatPrice?.excl_vat || 0

    if(minimumBillingConditions === null) {
        CEME_PERCENTAGE = session?.tariffCEME?.tariff?.find(tariff => tariff.type === "percentage")
        evioPercentage = session?.minimumBillingConditions ? (CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0) : 0
        gireveActivationFee = session?.minimumBillingConditions ? 0.5 : 0
    }else{
        CEME_PERCENTAGE = session.tariffCEME.tariff.find(tariff => tariff.type === "percentage")
        evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0
        gireveActivationFee = Number(process.env.GireveCommission)
    }

    ceme.time = roundValues(roundValues(opcDetailTimePrice) + roundValues(cemeDetailTimePrice) + roundValues((opcDetailTimePrice) * evioPercentage))
    ceme.energy = roundValues(roundValues(opcDetailPowerPrice) + roundValues(cemeDetailPowerPrice) + roundValues((opcDetailPowerPrice) * evioPercentage))
    ceme.activation = roundValues(roundValues(opcDetailFlatPrice) + roundValues(cemeDetailFlatPrice) + roundValues((opcDetailFlatPrice) * evioPercentage) + roundValues(gireveActivationFee))
    ceme.total = session.finalPrices?.totalPrice?.excl_vat || 0;

    return ceme
}