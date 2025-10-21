const {Enums} = require("evio-library-commons").default;
const {OcpiSessionSuspendedReason, OcpiSessionStatus} = Enums;

const {
    isTotalEnergyEqualSumOfSubUsageEnergy,
    isTotalEnergyValid,
    isCemeEmspTotalValid,
    isDurationValid,
    isTotalPriceValid,
    isSessionOld
} = require('./pipelines');

const defaultValidationsSteps = (cdr, session, valuesParams) => ([
    {
        validation: isTotalEnergyValid,
        notValidReason: OcpiSessionSuspendedReason.InvalidReasonMinTotalEnergyNotReached,
        notValidStatus: OcpiSessionStatus.SessionStatusInvalidSystem,
        params: { compareValue: valuesParams.minAcceptableToTotalEnergy, lessOperator: true, cdr },
    },
    {
        validation: isTotalEnergyValid,
        notValidReason: OcpiSessionSuspendedReason.SuspensionReasonSuspiciousTotalEnergy,
        notValidStatus: OcpiSessionStatus.SessionStatusSuspended,
        params: { compareValue: valuesParams.maxAcceptableToTotalEnergy, lessOperator: false, cdr },
    },
    {
        validation: isDurationValid,
        notValidReason: OcpiSessionSuspendedReason.SuspensionReasonSuspiciousDuration,
        notValidStatus: OcpiSessionStatus.SessionStatusSuspended,
        params: { compareValue: valuesParams.minAcceptableDaysOfDurations, cdr, session },
    },
    {
        validation: isTotalPriceValid,
        notValidReason: OcpiSessionSuspendedReason.InvalidReasonSuspiciousTotalPrice,
        notValidStatus: OcpiSessionStatus.SessionStatusInvalidSystem,
        params: { compareValue: valuesParams.minAcceptablePriceOfSession, lessOperator: true, session },
    },
    {
        validation: isTotalPriceValid,
        notValidReason: OcpiSessionSuspendedReason.InvalidReasonSuspiciousTotalPrice,
        notValidStatus: OcpiSessionStatus.SessionStatusSuspended,
        params: { compareValue: valuesParams.maxAcceptablePriceOfSession, lessOperator: false, session },
    },
    {
        validation: isCemeEmspTotalValid,
        notValidReason: OcpiSessionSuspendedReason.SuspensionReasonSuspiciousEMSPPrice,
        notValidStatus: OcpiSessionStatus.SessionStatusSuspended,
        params: { compareValue: valuesParams.minAcceptableCemePrice, session },
    },
    {
        validation: isSessionOld,
        notValidReason: null,
        notValidStatus: OcpiSessionStatus.SessionStatusExpired,
        params: { compareValue: valuesParams.maxDaysOfNotExpiredSession, cdr },
    },
]);

const applyValidations = (validations = []) => {
    for (let validate of validations) {
        if (!validate.validation(validate.params)) {
            return {
                status: validate.notValidStatus,
                reason: validate.notValidReason,
                valid: false
            }
        }
    }
    
    return {
        status: OcpiSessionStatus.SessionStatusStopped,
        reason: null,
        valid: true
    }
}

const validation = (cdr, session, valuesParams, isMobiE) => {
    if(!valuesParams || !Object.keys(valuesParams).length){
        return applyValidations();
    }

    const validationsArray = defaultValidationsSteps(cdr, session, valuesParams);

    if(isMobiE){
        validationsArray.unshift({
            validation: isTotalEnergyEqualSumOfSubUsageEnergy,
            notValidReason: OcpiSessionSuspendedReason.SuspensionReasonMismatchSubusage,
            notValidStatus: OcpiSessionStatus.SessionStatusSuspended,
            params: { compareValue: valuesParams.minAcceptableToSumOfSubUsageEnergy, cdr, locations: valuesParams.dpcLocations || [] },
        })
    }
    return applyValidations(validationsArray);
}

module.exports = validation;