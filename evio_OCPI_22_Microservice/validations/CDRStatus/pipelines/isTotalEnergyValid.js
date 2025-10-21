module.exports = isTotalEnergyValid = (params) => {
    if(params.lessOperator){
        return params?.cdr?.total_energy >= params.compareValue
    }

    return params?.cdr?.total_energy <= params.compareValue
}