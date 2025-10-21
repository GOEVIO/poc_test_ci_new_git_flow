module.exports = isTotalPriceValid = (params) => {
    if(params.lessOperator){
        return params?.session?.total_cost?.incl_vat >= params.compareValue
    }

    return params?.session?.total_cost?.incl_vat <= params.compareValue
}