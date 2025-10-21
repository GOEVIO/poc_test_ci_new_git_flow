import { isInvalidField } from 'evio-library-statistics'

import { getCdrById, getPublicNetworkCharger } from "../repository";
import { calcTariffsDetails } from "./calc-tariffs-details";
import { calcTariffsDetailsRoaming } from "./calc-tariffs-details-roaming";
import { isEmptyObject } from "./is-empty-object";

import { mapFieldsToUpdateOcpi } from "./ocpi-map-fields-to-update";
import { setMetersOcpi } from "./ocpi-set-meters";

export async function _applyOcpiSpecificChanges(
    session: any,
    currentHistory: any | undefined | null,
    updatedHistory: any
) {
    if (
        session?.cdrId &&
        !["NA", "-1"].includes(session.cdrId)
    ) {
        updatedHistory.cdrProcessed = true;
        const cdr = await getCdrById(session.cdrId);
        if (cdr !== '-1') {
            updatedHistory.cdr = cdr
            updatedHistory.cdrId = session.cdrId 
        }
    }else{
        updatedHistory.cdrProcessed = false;
    }

    mapFieldsToUpdateOcpi(session).forEach(field => {
        if (!isInvalidField(field.sessionValue)) {
            updatedHistory[field.name] = field.sessionValue
        }
    })

    updatedHistory = setMetersOcpi(session, updatedHistory)
    updatedHistory.tariffsDetails = calcTariffsDetails(session)
    if (session?.chargerType !== '004' && !isEmptyObject(session?.finalPrices)) {
        updatedHistory.tariffsDetailsRoaming = calcTariffsDetailsRoaming(session)
    };
    
    // only first time
    if (!currentHistory) {
        updatedHistory.charger = await getPublicNetworkCharger(updatedHistory.hwId);
    }
}