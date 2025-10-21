const Infrastructure = require('../models/infrastructure');
const ChargersHandler = require('./chargersHandler');
const AxiosHandler = require('../services/axios');
const { Enums } = require('evio-library-commons').default;


module.exports = {
    getMyInfrastructures: async function (userId) {
        const context = "Function getMyInfrastructures";
        try {

            let infrastructuresFound = await createUserInfrastructures(userId)

            let infrastructuresChargers = await ChargersHandler.getInfrastructuresChargers(infrastructuresFound)

            let chargersGroups = await ChargersHandler.getChargersGroupOfUsers(infrastructuresChargers)

            let chargersWithFees = await getFeesList(infrastructuresChargers)

            let myInfrastructures = joinChargersToInfrastructure(infrastructuresFound , chargersWithFees , chargersGroups)

            return myInfrastructures


        } catch(error) {
            console.error(`[${context}][find] Error `, error.message);
            throw new Error(error)
        }

    }
};


async function queryInfrastructures(query) {
    const context = "Function queryInfrastructures";
    try  {
        return await Infrastructure.find(query).lean()
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}

async function createUserInfrastructures(userId) {
    const context = "Function createUserInfrastructures";
    try {
        const query = {
            createUserId: userId
        };
        return await queryInfrastructures(query)
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}

async function getFeesList(chargers) {
    const context = "Function getFeesList";
    try {
        const host = process.env.HostConfigs + process.env.PathConfigFeesList;
        return await AxiosHandler.axiosGetBody(host, {chargers});
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}

function joinChargersToInfrastructure(infrastructures , chargers , chargersGroups) {
    let context = "Function joinChargersToInfrastructure";
    try  {
        let listOfInfrastructures = []
        for (let infrastructure of infrastructures) {
            infrastructure.listChargers = infrastructure.listChargers.map(elem => chargerToEvList(chargers ,chargersGroups , elem)).sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
            listOfInfrastructures.push(infrastructure)
        }
        return listOfInfrastructures.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}

function chargerToEvList(chargers , chargersGroups , elem) {
    let context = "Function chargerToEvList";
    try  {
        let foundCharger = chargers.find(charger => charger.chargerId === elem.chargerId)
        if (foundCharger) {

            if (foundCharger.operationalStatus === Enums.OperationalStatus.REJECTED) {
                foundCharger.operationalStatus = Enums.OperationalStatus.WAITINGAPROVAL;
            }

            foundCharger.listOfGroups = foundCharger.listOfGroups.map(listGroup => groupToChargerList(chargersGroups , listGroup))
            return foundCharger
        } else {
            return elem
        }
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        return elem
    }
}

function groupToChargerList(chargersGroups , listGroup) {
    let context = "Function groupToChargerList";
    try  {
        return chargersGroups.find(group => group.groupId === listGroup.groupId) ?? listGroup
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        return listGroup
    }
}
