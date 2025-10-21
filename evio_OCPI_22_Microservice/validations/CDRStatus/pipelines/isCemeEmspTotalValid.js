module.exports = isCemeEmspTotalValid = (params) => {
    return params?.session?.finalPrices?.cemePrice?.incl_vat > params.compareValue
}