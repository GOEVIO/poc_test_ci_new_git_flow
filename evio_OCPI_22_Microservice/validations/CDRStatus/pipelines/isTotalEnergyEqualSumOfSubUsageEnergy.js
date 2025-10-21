const calcSumSubUsageEnergy = require('../../../functions/calcSumSubUsageEnergy');
module.exports = isTotalEnergyEqualSumOfSubUsageEnergy = (params) => {
    return Math.abs(calcSumSubUsageEnergy(params.cdr?.mobie_cdr_extension?.subUsages) - params.cdr.total_energy) <= params.compareValue || !params.locations.includes(params.cdr?.cdr_location?.id)
}