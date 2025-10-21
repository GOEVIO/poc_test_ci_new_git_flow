module.exports = calcSumSubUsageEnergy = (subUsages) => {
    return subUsages?.reduce((acc, su) => {
        const {
            energia_ponta,
            energia_cheias,
            energia_vazio,
            energia_fora_vazio,
            energia_vazio_normal,
            energia_super_vazio,
        } = su
        return acc + 
        (energia_ponta || 0) +
        (energia_cheias || 0) +
        (energia_vazio || 0) +
        (energia_fora_vazio || 0) +
        (energia_vazio_normal || 0) +
        (energia_super_vazio || 0)
    }, 0) || 0
}