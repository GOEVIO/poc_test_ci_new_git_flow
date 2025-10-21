const { describe, expect, it } = require('@jest/globals');
const validation = require('../../validations/CDRStatus/validation');
const { Enums } = require("evio-library-commons").default;


describe('CDR Status validation', () => {
    const {OcpiSessionSuspendedReason, OcpiSessionStatus} = Enums;
    const valuesParams = {
        minAcceptableToSumOfSubUsageEnergy: 4,
        minAcceptableToTotalEnergy: 0.1,
        maxAcceptableToTotalEnergy: 600,
        minAcceptableDaysOfDurations: 3,
        minAcceptablePriceOfSession: 0.10,
        maxAcceptablePriceOfSession: 150,
        minAcceptableCemePrice: 0,
        maxDaysOfNotExpiredSession: 30,
        dpcLocations: [
            "MOBI-MAI-00079",
            "MOBI-MAI-00057",
            "MOBI-MAI-00056"
        ]
    }

    const correctCDR = {
        mobie_cdr_extension:{
            subUsages: [
                {
                    energia_ponta: 10,
                    energia_cheias: 10,
                    energia_vazio: 10,
                    energia_fora_vazio: 10,
                    energia_vazio_normal: 10,
                    energia_super_vazio: 10
                }
            ]
        },
        total_energy: 60,
        start_date_time: new Date(new Date().getTime() - 1000 * 60 * 60).toJSON(),
        end_date_time: new Date().toJSON(),
    }

    const correctSession = {
        total_cost:{
            incl_vat: 50
        },
        finalPrices: {
            cemePrice:{
                incl_vat: 1
            }
        }
    }

    it('should return status to stop and reason null because not have values params', () => {
        expect(validation(correctCDR, correctSession, null, true)).toEqual({
            status: OcpiSessionStatus.SessionStatusStopped,
            reason: null,
            valid: true
        });
    });

    it('should return status SUSPENDED and reason MISMATCH_SUBUSAGES_ENERGY', () => {
        const cdr = { 
            ...correctCDR,
            total_energy: 1,
        }

        expect(validation(cdr, correctSession, valuesParams, true)).toEqual({
            status: OcpiSessionStatus.SessionStatusSuspended,
            reason: OcpiSessionSuspendedReason.SuspensionReasonMismatchSubusage,
            valid: false
        });
    });

    it('should return status INVALID_SYSTEM and reason MIN_TOTAL_ENERGY_NOT_REACHED', () => {
        const cdr = {
            ...correctCDR,
            total_energy: -1,
        }

        expect(validation(cdr, correctSession, valuesParams, false)).toEqual({
            status: OcpiSessionStatus.SessionStatusInvalidSystem,
            reason: OcpiSessionSuspendedReason.InvalidReasonMinTotalEnergyNotReached,
            valid: false
        });
    });
    
    it('should return status SUSPENDED and reason SUSPICIOUS_TOTAL_ENERGY', () => {
        const cdr = {
            total_energy: 700,
            mobie_cdr_extension:{
                subUsages: [
                    {
                        energia_ponta: 100,
                        energia_cheias: 100,
                        energia_vazio: 100,
                        energia_fora_vazio: 100,
                        energia_vazio_normal: 100,
                        energia_super_vazio: 200 
                    }
                ]
            },
        }

        expect(validation(cdr, correctSession, valuesParams, true)).toEqual({
            status: OcpiSessionStatus.SessionStatusSuspended,
            reason: OcpiSessionSuspendedReason.SuspensionReasonSuspiciousTotalEnergy,
            valid: false
        });
    });

    it('should return status SUSPENDED and reason SUSPICIOUS_DURATION', () => {
        const cdr = {
            ...correctCDR,
            start_date_time: '2024-10-10T10:00:00Z',
            end_date_time: '2024-10-15T13:00:00Z',
        }

        const session = {
            ...correctSession,
            finalPrices: {
                opcPriceDetail: {
                    timePrice: {
                        excl_vat: 0.04,
                        incl_vat: 0.05
                    },
                },
            }
        }

        expect(validation(cdr, session, valuesParams, true)).toEqual({
            status: OcpiSessionStatus.SessionStatusSuspended,
            reason: OcpiSessionSuspendedReason.SuspensionReasonSuspiciousDuration,
            valid: false
        });
    });

    it('should return status SUSPENDED and reason SUSPICIOUS_DURATION, because date is invalid', () => {
        const cdr = {
            ...correctCDR,
            start_date_time: null,
            end_date_time: null,
        }

        expect(validation(cdr, correctSession, valuesParams, true)).toEqual({
            status: OcpiSessionStatus.SessionStatusSuspended,
            reason: OcpiSessionSuspendedReason.SuspensionReasonSuspiciousDuration,
            valid: false
        });
    });

    it('should return status INVALID_SYSTEM and reason SUSPICIOUS_TOTAL_PRICE', () => {
        const session = {
            ...correctSession,
            total_cost:{
                incl_vat: 0.05
            }
        }

        expect(validation(correctCDR, session, valuesParams, true)).toEqual({
            status: OcpiSessionStatus.SessionStatusInvalidSystem,
            reason: OcpiSessionSuspendedReason.InvalidReasonSuspiciousTotalPrice,
            valid: false
        });
    });

    it('should return status SUSPENDED and reason SUSPICIOUS_EMSP_PRICE', () => {
        const session = {
            ...correctSession,
            finalPrices: {
                cemePrice:{
                    incl_vat: -1
                }
            }
        }

        expect(validation(correctCDR, session, valuesParams, true)).toEqual({
            status: OcpiSessionStatus.SessionStatusSuspended,
            reason: OcpiSessionSuspendedReason.SuspensionReasonSuspiciousEMSPPrice,
            valid: false
        });
    });

    it('should return status EXPIRED and reason NULL', () => {
        const cdr = {
            ...correctCDR,
            start_date_time: '2024-10-10T10:00:00Z',
            end_date_time: '2024-10-10T13:00:00Z',
        }

        expect(validation(cdr, correctSession, valuesParams, true)).toEqual({
            status: OcpiSessionStatus.SessionStatusExpired,
            reason: null,
            valid: false
        });
    });

    it('should return status to stop and reason NULL', () => {
        expect(validation(correctCDR, correctSession, valuesParams, true)).toEqual({
            status: OcpiSessionStatus.SessionStatusStopped,
            reason: null,
            valid: true
        });
    });
});
