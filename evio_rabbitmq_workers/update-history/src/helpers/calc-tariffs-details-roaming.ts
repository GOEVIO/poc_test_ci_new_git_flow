import { calcRoamingCemeObjectTariff } from "./calc-roaming-ceme-object-tariff";

export const calcTariffsDetailsRoaming = (session) => {
    const context = 'calcTariffsDetailsRoaming';
    try {
        const ceme = calcRoamingCemeObjectTariff(session);

        let timeCost = ceme.time;
        let energyCost = ceme.energy;
        let flatCost = ceme.activation;
        let tariffTime = timeCost / (session.timeCharged / 60);
        let tariffEnergy = energyCost / session.kwh;

        return {
            timeCost,
            energyCost,
            flatCost,
            tariffTime,
            tariffEnergy
        }

    } catch (error: any) {
        console.log(`[${context}] Error : ${error.message}`);
        return {
            timeCost: 0,
            energyCost: 0,
            flatCost: 0,
            tariffTime: 0,
            tariffEnergy: 0
        }
    };

};