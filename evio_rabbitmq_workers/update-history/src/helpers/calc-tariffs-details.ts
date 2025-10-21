import { calcRoamingCemeObjectTariff } from "./calc-roaming-ceme-object-tariff";
import { isEmptyObject } from "./is-empty-object";
import { roundValues } from "./round-values";

export const calcTariffsDetails = (session) => {
    const context = 'calcTariffsDetails';
    const sessionTariffs: any = {
        opc: {},
        ceme: {},
        fees: {}
    };
    
    try{
        let minimumBillingConditions = session.minimumBillingConditions
        if (session?.status === 'EXPIRED') {
            return sessionTariffs
        }
    
        if (!isEmptyObject(session?.finalPrices)) {
            if (!isEmptyObject(session?.finalPrices?.opcPrice)) {
                sessionTariffs.opc.total = session.finalPrices.opcPrice.excl_vat || 0;
    
                if (!isEmptyObject(session.finalPrices.opcPriceDetail)) {
                    sessionTariffs.opc.activation = session.finalPrices.opcPriceDetail?.flatPrice?.excl_vat || 0;
                    sessionTariffs.opc.time = session.finalPrices.opcPriceDetail?.timePrice?.excl_vat || 0;
                    sessionTariffs.opc.energy = session.finalPrices.opcPriceDetail?.powerPrice?.excl_vat || 0;
    
                    if (!isEmptyObject(session.finalPrices.opcPriceDetail.parkingTimePrice)) {
                        sessionTariffs.opc.parking = session.finalPrices.opcPriceDetail.parkingTimePrice?.excl_vat || 0;
                    }
                }
            }
    
            if (!isEmptyObject(session.finalPrices.cemePrice)) {
                if (session.source === 'Gireve') {
                    sessionTariffs.ceme = calcRoamingCemeObjectTariff(session, minimumBillingConditions);
                } else {
                    sessionTariffs.ceme.total = session.finalPrices?.cemePrice?.excl_vat;
    
                    if (!isEmptyObject(session.finalPrices.cemePriceDetail)) {
                        sessionTariffs.ceme.activation = session.finalPrices.cemePriceDetail?.flatPrice?.excl_vat || 0;
                        sessionTariffs.ceme.time = session.finalPrices.cemePriceDetail?.timePrice?.excl_vat || 0;
                        sessionTariffs.ceme.energy = session.finalPrices.cemePriceDetail?.powerPrice?.excl_vat || 0;
                    }
                    else {
                        sessionTariffs.ceme.activation = null;
                        sessionTariffs.ceme.time = null;
                        sessionTariffs.ceme.energy = null;
                    }
                }
            }
    
            sessionTariffs.fees.total = null;
            sessionTariffs.fees.tar = null;
            sessionTariffs.fees.iec = null;
            sessionTariffs.fees.iva = null;
    
            if (!isEmptyObject(session.finalPrices?.tarPrice) && !Number.isNaN(session.finalPrices.tarPrice?.excl_vat)) {
                sessionTariffs.fees.tar = session.finalPrices.tarPrice.excl_vat;
                sessionTariffs.fees.total += session.finalPrices.tarPrice.excl_vat;
            }
    
            if (!isEmptyObject(session.finalPrices?.iecPrice) && !Number.isNaN(session.finalPrices.iecPrice?.excl_vat)) {
                sessionTariffs.fees.iec = session.finalPrices.iecPrice?.excl_vat;
                sessionTariffs.fees.total += session.finalPrices.iecPrice?.excl_vat;
            }
    
            if (!isEmptyObject(session.finalPrices?.vatPrice) && !Number.isNaN(session.finalPrices.vatPrice?.value)) {
                sessionTariffs.fees.iva = session.finalPrices.vatPrice?.value;
                sessionTariffs.fees.total += session.finalPrices.vatPrice?.value;
            }
    
            if (sessionTariffs.fees.total !== null) {
                sessionTariffs.fees.total = roundValues(sessionTariffs.fees.total)
            }
        }
    
        return  sessionTariffs;
    }catch(error: any){
        console.log(`[${context}] Error : ${error.message}`);
        return  sessionTariffs;
    }
    
};