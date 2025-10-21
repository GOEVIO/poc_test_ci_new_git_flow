// Services 
import chargersServices from '../services/chargersServices';
// Controllers
import { setPlugsSetPointsOnComms } from '../controllers/controllersControllers';

const { captureException } = require('@sentry/node');
const Charger = require('../models/charger');
const ChargingSession = require('../models/chargingSession');
const AxiosHandler = require('../services/axios');
const Utils = require('../utils')
const { getChargerOPCM } = require('../apis/publicNetwork');
const { getEVsMap } = require('../apis/evs');
const { getGroupsMap } = require('../apis/identity');
const { chargerConstants } = require('../constants/chargerConstants');
const { validateCountryCode, validateName, validateUserId, validateClientName } = require('../utils/validationUtils');
const commonLog = '[ chargerHandler ';
const ObjectId = require("mongoose").Types.ObjectId;
const { findGroupCSUser } = require('evio-library-identity').default;
const { findPrivateCharger } = require('evio-library-chargers').default;
const { isFlagChooseSearchCoordinatesActive, returnCoordinatesAccordingToFlag } = require('../utils/handleCoordinates')

async function setAllEnergyManagementConnectionToOffline() {
    const query = {
        energyManagementEnable: true
    }
    const update = {
        'plugs.$[].balancingInfo.isOnline': false
    }
    return await Charger.updateMany(query, update)
}

async function forceUpdateWhiteLists() {
    console.log("Running routine to update offline whitelists")
    const query = {
        chargerType: {$nin : [
            process.env.ChargerTypeSiemens,
            process.env.OCPPSTypeFastCharger,
            process.env.EVIOBoxType,
        ]},
        operationalStatus: { $ne: process.env.OperationalStatusRemoved }
    };

    const fields = { 
        hwId : 1, 
        accessType : 1, 
        createUser : 1, 
        listOfGroups : 1, 
        listOfFleets : 1, 
        status : 1, 
        chargerType : 1 
    }
    const whitelistChargers = await chargerFindFields(query , fields)
    if (whitelistChargers.length != 0) {
        for (const chargerFound of whitelistChargers) {
            await updateOfflineWhitelist(chargerFound)
            await Utils.sleep(5000)
        }
    } else {
        console.log("No charger found to update whitelist")
    };
}

/**
 * Updates single physical charger's whitelist by its hwId
 * @param {string} hwId
 */
async function forceUpdateWhiteListByHwId(hwId) {
    const query = {
        chargerType: {$nin : [
            process.env.ChargerTypeSiemens,
            process.env.OCPPSTypeFastCharger,
            process.env.EVIOBoxType,
        ]},
        operationalStatus: { $ne: process.env.OperationalStatusRemoved },
        hwId,
    }

    const fields = {
        hwId: 1,
        accessType: 1,
        createUser: 1,
        listOfGroups: 1,
        listOfFleets: 1,
        status: 1,
        chargerType: 1,
    };

    const charger = await findPrivateCharger(query, fields)

    if (!charger) {
        return { success: false, message: 'Not found charger by hwId', query }
    }

    return await updateOfflineWhitelist(charger)
}

async function updateOfflineWhitelist(chargerFound) {
    const context = "Function updateOfflineWhitelist";
    try {
      const {
        hwId,
        accessType,
        createUser,
        listOfGroups,
        listOfFleets,
        status,
        chargerType,
      } = chargerFound;
      const contractsHost =
        process.env.HostUser + process.env.PathGetContractsByParams;
      let authorizationList = [];
      const updateType = process.env.WhitelistFullUpdate;
      if (
        status !==
        process.env
          .ChargePointStatusEVIOFaulted
      ) {
        console.log(`Offline Whitelist update on charger ${hwId}`);
        if (accessType === process.env.ChargerAccessPrivate) {
          const query = {
            userId: createUser,
          };
          const allContracts = await getAllContracts(contractsHost, query);
          const idTags = getIdTags(
            allContracts,
            process.env.NetworkEVIO,
            process.env.AuthTypeRFID,
            process.env.TokenStatusActive
          );
          authorizationList.push(...idTags);
        } else if (accessType === process.env.ChargerAccessRestrict) {
          //Groups of users
          const usersIdTags = await getUsersGroupIdtags(
            listOfGroups,
            contractsHost
          );
          //Groups of fleet
          const fleetsIdTags = await getFleetsGroupIdtags(
            listOfFleets,
            contractsHost
          );
  
          authorizationList.push(...usersIdTags, ...fleetsIdTags);
        } else if (
          accessType === process.env.ChargerAccessPublic ||
          accessType === process.env.ChargerAccessFreeCharge
        ) {
          const allContracts = await getAllContracts(contractsHost, {});
          const idTags = getIdTags(
            allContracts,
            process.env.NetworkEVIO,
            process.env.AuthTypeRFID,
            process.env.TokenStatusActive
          );
          authorizationList.push(...idTags);
        }
        authorizationList = removeRepeatedIdTags(authorizationList);
        authorizationList = await prioritizeIdTags(authorizationList, hwId);
        await sendLocalList(hwId, updateType, authorizationList);
        return { success: true, message: `Successfully updated charger ${hwId} with attached authorization list`, authorizationList }
      } else {
        console.log(
          `[${context}] No update! Charger ${hwId} is type ${chargerType} with status ${status}`
        );
        return { success: false, message: `No update! Charger ${hwId} is type ${chargerType} with status ${status}` }
      }
    } catch (error) {
      console.error(`[${context}] Error `, error?.message);
      return { success: false, message: 'Unexpected error', cause: error }
    }
  }
  
  async function getAllContracts(host, params) {
    const context = "Function getAllContracts";
    try {
      const resp = await AxiosHandler.axiosGet(host,  params);
      if (resp) {
        return resp;
      }
      return [];
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  }
  
  function getIdTags(allContracts, networkEnum, tokenType, tokenStatus) {
    const context = "Function getIdTags";
    try {
      let idTags = [];
      for (const contract of allContracts) {
        const token = getSpecificToken(contract, networkEnum, tokenType);
        const idTagsArray = token
          ? retrieveIdTagsFromToken(token, tokenStatus)
          : [];
        idTags.push(...idTagsArray);
      }
      return idTags;
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  }
  
  async function getFleetsGroupIdtags(listOfFleets, contractsHost) {
    const context = "Function getFleetsGroupIdtags";
    try {
      let idTagsArray = [];
      for (const fleet of listOfFleets) {
        const contractsQuery = {
          fleetId: fleet.fleetId,
          contractType: process.env.ContractTypeFleet,
        };
        const allContracts = await getAllContracts(contractsHost, contractsQuery);
        const idTags = getIdTags(
          allContracts,
          process.env.NetworkEVIO,
          process.env.AuthTypeRFID,
          process.env.TokenStatusActive
        );
        idTagsArray.push(...idTags);
      }
      return idTagsArray;
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  }
  
  async function getUsersGroupIdtags(listOfGroups, contractsHost) {
    const context = "Function getUsersGroupIdtags";
    try {
      const listOfUsers = await getListOfUsersArray(listOfGroups);
      const idTags = await getListOfUsersIdTags(listOfUsers, contractsHost);
      return idTags;
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  }
  
  async function getGroupOfUsers(host, params) {
    const context = "Function getGroupOfUsers";
    try {
      const resp = await AxiosHandler.axiosGet(host,  params);
      if (resp) {
        return resp;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return null;
    }
  }
    
    async function getListOfUsersArray(listOfGroups) {
        const context = "Function getListOfUsersArray";
        try {
        const groupIds = listOfGroups.map(group => group.groupId).filter(group=>Boolean(group))

            const query = { "_id" : { $in : groupIds } }

            const groupsResult = await findGroupCSUser(query);

            const listOfUsers = groupsResult.reduce((accm,group)=>{
                if (!group?.listOfUsers?.length){
                    return accm;
                }
                return [
                    ...accm,
                    ...usersGroup.listOfUsers
                ]
            },[])
            return listOfUsers;
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            throw error;
        }
    }
  
  async function getListOfUsersIdTags(listOfUsers, contractsHost) {
    const context = "Function getListOfUsersIdTags";
    try {
      let idTagsArray = [];
      for (const user of listOfUsers) {
        const contractsQuery = {
          userId: user.userId,
          contractType: process.env.ContractTypeUser,
        };
        const allContracts = await getAllContracts(contractsHost, contractsQuery);
        const idTags = getIdTags(
          allContracts,
          process.env.NetworkEVIO,
          process.env.AuthTypeRFID,
          process.env.TokenStatusActive
        );
        idTagsArray.push(...idTags);
      }
      return idTagsArray;
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  }
   
  function getSpecificToken(contract, networkEnum, tokenType) {
    return contract.networks
      .find((network) => network.network === networkEnum)
      .tokens.find((token) => token.tokenType === tokenType);
  }
  
  function retrieveIdTagsFromToken(token, status) {
    const context = "Function retrieveIdTagsFromToken";
    try {
      const idTagInfoStatus = {
        active: "Accepted",
        inactive: "Blocked",
        toRequest: "Blocked",
      };
      if (token.status === status) {
        if (token.tokenType === process.env.AuthTypeRFID) {
          let returnTokens = [];
          if (token.idTagDec) {
            returnTokens.push(
              formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status])
            );
          }
          if (token.idTagHexa) {
            returnTokens.push(
              formatIdTagToWhitelist(token.idTagHexa, idTagInfoStatus[status])
            );
          }
          if (token.idTagHexaInv) {
            returnTokens.push(
              formatIdTagToWhitelist(token.idTagHexaInv, idTagInfoStatus[status])
            );
          }
          return returnTokens;
        } else if (token.tokenType === process.env.AuthTypeApp_User) {
          let returnTokens = [];
          if (token.idTagDec) {
            returnTokens.push(
              formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status])
            );
          }
          return returnTokens;
        }
      }
      return [];
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  }
  
  function formatIdTagToWhitelist(idTag, status) {
    return {
      idTag: idTag,
      idTagInfo: {
        status: status,
      },
    };
  }
  
  function removeRepeatedIdTags(authorizationArray) {
    /**
          If eventually there're repeated idTags, we can't send them, else the charger will return an error
          when updating local authorization list
      */
    return authorizationArray.filter(
      (obj, index, self) => index === self.findIndex((t) => t.idTag === obj.idTag)
    );
  }
  
  async function chargerFindFields(query, fields) {
    const context = "Function chargerFindFields";
    return await Charger.find(query, fields).lean();
  }
  
  async function prioritizeIdTags(idTagsInfoArray, hwId) {
    const context = "Function prioritizeIdTags";
    try {
      const idTags = idTagsInfoArray.map((obj) => obj.idTag);
      const query = [
        {
          $match: {
            idTag: {
              $in: idTags,
            },
            hwId: hwId,
          },
        },
        {
          $group: {
            _id: {
              idTag: "$idTag",
            },
            "COUNT(*)": {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            idTag: "$_id.idTag",
            count: "$COUNT(*)",
            _id: 0,
          },
        },
      ];
  
      const idTagsCount = await ChargingSession.aggregate(query);
      const sortedIdTags = idTagsCount
        .sort((a, b) => b.count - a.count)
        .map((idTagCount) =>
          idTagsInfoArray.find((obj) => obj.idTag === idTagCount.idTag)
        );
      const inexistingIdTagsOnSessions = idTagsInfoArray.filter(
        (obj) => !sortedIdTags.find((sortedObj) => sortedObj.idTag === obj.idTag)
      );
      return [...sortedIdTags, ...inexistingIdTagsOnSessions];
    } catch (error) {
      console.error(`[${context}][.catch] Error `, error.message);
      return idTagsInfoArray;
    }
  }
  
  async function sendLocalList(hwId, updateType, authorizationList) {
    const context = "Function sendLocalList";
    try {
      const body = {
        hwId,
        updateType,
        authorizationList,
      };
      const host = process.env.HostOCPP16 + process.env.PathSendLocalList;
      const resp = await AxiosHandler.axiosPostBody(host, body);
      if (resp) {
        console.log(`[${context}] Update success!`);
        return resp;
      }
      return [];
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  }
function getGroupsCSUsersListIds(groups) {
    var context = "Funciton getGroupsCSUsersListIds";
    return new Promise(async (resolve, reject) => {
        try {
            var host = process.env.HostUser + process.env.PathGetGroupCSUsersByIdList;
            var listOfGroups = [];
            let data = {
                listOfGroupsIds: groups.map(group => group.groupId)
            }
            let allGroups = await AxiosHandler.axiosGetBody(host, data);
            for (let newGroup of allGroups) {
                let originalGroup = groups.find(og => og.groupId === newGroup._id)
                newGroup._id = originalGroup?._id ?? newGroup._id;
                newGroup.groupId = originalGroup?.groupId ?? newGroup._id;
                listOfGroups.push(newGroup);
            }
            resolve(listOfGroups);
        } catch (error) {
            console.error(`[${context}][find] Error `, error.message);
            resolve(groups);
        }
    });
};

async function queryCharger(query, filter = {}) {
    let context = "Function queryCharger";
    try {
        return await Charger.findOne(query, filter).lean()
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}

async function getChargerListOfCharger(chargerId) {
    let context = "Function getChargerListOfCharger";
    try {
        let query = {
            _id: chargerId,
            hasInfrastructure: true
        };
        return await Charger.findOne(query).lean()
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}


function changeTariff(charger) {
    const context = "Function changeTariff";
    return new Promise((resolve) => {

        Promise.all(

            charger.plugs.map(plug => {
                return new Promise((resolve) => {
                    let tariff = [];
                    plug.statusChangeDate = new Date();
                    if (charger.accessType === process.env.ChargerAccessRestrict) {

                        if (charger.listOfGroups.length > 0 && charger.listOfFleets.length === 0) {

                            //Só tem lista de grupos
                            Promise.all(
                                charger.listOfGroups.map(group => {
                                    return new Promise(resolve => {
                                        let found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                            return tariff.groupId == group.groupId;
                                        }));
                                        if (found > -1) {

                                            let newTariff = {
                                                groupName: group.groupName,
                                                groupId: plug.tariff[found].groupId,
                                                tariffId: plug.tariff[found].tariffId,
                                                tariff: plug.tariff[found].tariff,
                                                tariffType: plug.tariff[found].tariffType,
                                                name: plug.tariff[found].name
                                            };

                                            /*
                                            var found = tariff.find(verifyTariff => {
                                                return verifyTariff.groupId == newTariff.groupId
                                            });
                                            */

                                            tariff.push(newTariff);
                                            resolve(true);

                                        }
                                        else {
                                            let newTariff = {
                                                groupName: group.groupName,
                                                groupId: group.groupId,
                                                tariffId: "",
                                                tariffType: "",
                                                tariff: {},
                                                name: ""
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        };
                                    });
                                })
                            ).then(async () => {
                                let newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {
                                        let found = newTariffs.find(tar => {
                                            return tar.groupId == tariff[index].groupId;
                                        });
                                        if (!found) {
                                            newTariffs[index] = tariff[index];
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });

                        }
                        else if (charger.listOfGroups.length === 0 && charger.listOfFleets.length > 0) {

                            //Só tem lista de fleets
                            Promise.all(
                                charger.listOfFleets.map(group => {
                                    return new Promise(resolve => {
                                        let found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                            return tariff.fleetId == group.fleetId;
                                        }));
                                        if (found > -1) {

                                            let newTariff = {
                                                fleetName: group.fleetName,
                                                fleetId: plug.tariff[found].fleetId,
                                                tariffId: plug.tariff[found].tariffId,
                                                tariff: plug.tariff[found].tariff,
                                                tariffType: plug.tariff[found].tariffType,
                                                name: plug.tariff[found].name
                                            };

                                            tariff.push(newTariff);
                                            resolve(true);

                                        }
                                        else {
                                            let newTariff = {
                                                fleetName: group.fleetName,
                                                fleetId: group.fleetId,
                                                tariffId: "",
                                                tariff: {},
                                                tariffType: "",
                                                name: ""
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        };
                                    });
                                })
                            ).then(async () => {

                                let newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {
                                        var found = newTariffs.find(tar => {
                                            return tar.fleetId == tariff[index].fleetId;
                                        });
                                        if (!found) {
                                            newTariffs[index] = tariff[index];
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });
                        }
                        else {

                            //Tem lista de fleets e de grupos
                            let newlist = charger.listOfGroups.concat(charger.listOfFleets);
                            Promise.all(
                                newlist.map(group => {
                                    return new Promise(resolve => {

                                        if (group.groupId != undefined) {

                                            let found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                return tariff.groupId == group.groupId;
                                            }));
                                            if (found > -1) {

                                                let newTariff = {
                                                    groupName: group.groupName,
                                                    groupId: plug.tariff[found].groupId,
                                                    tariffId: plug.tariff[found].tariffId,
                                                    tariff: plug.tariff[found].tariff,
                                                    tariffType: plug.tariff[found].tariffType,
                                                    name: plug.tariff[found].name
                                                };

                                                tariff.push(newTariff);
                                                resolve(true);

                                            }
                                            else {
                                                let newTariff = {
                                                    groupName: group.groupName,
                                                    groupId: group.groupId,
                                                    tariffId: "",
                                                    tariff: {},
                                                    tariffType: "",
                                                    name: ""
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            };
                                        }
                                        else {

                                            let found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                return tariff.fleetId == group.fleetId;
                                            }));
                                            if (found > -1) {

                                                let newTariff = {
                                                    fleetName: group.fleetName,
                                                    fleetId: plug.tariff[found].fleetId,
                                                    tariffId: plug.tariff[found].tariffId,
                                                    tariff: plug.tariff[found].tariff,
                                                    tariffType: plug.tariff[found].tariffType,
                                                    name: plug.tariff[found].name
                                                };

                                                /*
                                                var found = tariff.find(verifyTariff => {
                                                    return verifyTariff.fleetId == newTariff.fleetId
                                                });
                                                */

                                                tariff.push(newTariff);
                                                resolve(true);

                                            }
                                            else {
                                                let newTariff = {
                                                    fleetName: group.fleetName,
                                                    fleetId: group.fleetId,
                                                    tariffId: "",
                                                    tariff: {},
                                                    tariffType: "",
                                                    name: ""
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            };
                                        }

                                    });
                                })
                            ).then(async () => {

                                let newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {

                                        if (tariff[index].groupId != undefined) {
                                            let found = newTariffs.find(tar => {
                                                return tar.groupId == tariff[index].groupId;
                                            });
                                            if (!found) {
                                                newTariffs[index] = tariff[index];
                                            };
                                        }
                                        else {
                                            let found = newTariffs.find(tar => {
                                                return tar.fleetId == tariff[index].fleetId;
                                            });
                                            if (!found) {
                                                newTariffs[index] = tariff[index];
                                            };
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });
                        };

                    }
                    else if (charger.accessType === process.env.ChargerAccessPublic) {

                        let found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                            return tariff.groupName === process.env.ChargerAccessPublic;
                        }));
                        let newTariff
                        if (found > -1) {
                            newTariff = {
                                groupName: process.env.ChargerAccessPublic,
                                groupId: plug.tariff[found].groupId,
                                tariffId: plug.tariff[found].tariffId,
                                tariff: plug.tariff[found].tariff,
                                tariffType: plug.tariff[found].tariffType,
                                name: plug.tariff[found].name
                            };
                        }
                        else {
                            newTariff = {
                                groupName: process.env.ChargerAccessPublic,
                                groupId: "",
                                tariffId: "",
                                tariff: {},
                                tariffType: "",
                                name: ""
                            };
                        }

                        tariff.push(newTariff);

                        if (charger.listOfGroups.length > 0 && charger.listOfFleets.length === 0) {

                            //Só tem lista de grupos
                            Promise.all(
                                charger.listOfGroups.map(group => {
                                    return new Promise(resolve => {
                                        let found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                            return tariff.groupId === group.groupId;
                                        }));
                                        if (found > -1) {
                                            let newTariff = {
                                                groupName: group.groupName,
                                                groupId: plug.tariff[found].groupId,
                                                tariffId: plug.tariff[found].tariffId,
                                                tariff: plug.tariff[found].tariff,
                                                tariffType: plug.tariff[found].tariffType,
                                                name: plug.tariff[found].name
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        }
                                        else {
                                            let newTariff = {
                                                groupName: group.groupName,
                                                groupId: group.groupId,
                                                tariffId: "",
                                                tariff: {},
                                                tariffType: "",
                                                name: ""
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        };
                                    });
                                })
                            ).then(async () => {
                                let newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {
                                        let found = newTariffs.find(tar => {
                                            return tar.groupId == tariff[index].groupId;
                                        });
                                        if (!found) {
                                            newTariffs[index] = tariff[index];
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });
                        }
                        else if (charger.listOfGroups.length === 0 && charger.listOfFleets.length > 0) {

                            //Só tem lista de fleets
                            Promise.all(
                                charger.listOfFleets.map(group => {
                                    return new Promise(resolve => {
                                        var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                            return tariff.fleetId === group.fleetId;
                                        }));
                                        if (found > -1) {
                                            var newTariff = {
                                                fleetName: group.fleetName,
                                                fleetId: plug.tariff[found].fleetId,
                                                tariffId: plug.tariff[found].tariffId,
                                                tariff: plug.tariff[found].tariff,
                                                tariffType: plug.tariff[found].tariffType,
                                                name: plug.tariff[found].name
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        }
                                        else {
                                            var newTariff = {
                                                fleetName: group.fleetName,
                                                fleetId: group.fleetId,
                                                tariffId: "",
                                                tariff: {},
                                                tariffType: "",
                                                name: ""
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        };
                                    });
                                })
                            ).then(async () => {
                                var newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {
                                        var found = newTariffs.find(tar => {
                                            return tar.fleetId == tariff[index].fleetId;
                                        });
                                        if (!found) {
                                            newTariffs[index] = tariff[index];
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });

                        }
                        else if (charger.listOfGroups.length > 0 && charger.listOfFleets.length > 0) {
                            //Tem lista de fleets e de grupos
                            let newlist = charger.listOfGroups.concat(charger.listOfFleets);
                            Promise.all(
                                newlist.map(group => {
                                    return new Promise(resolve => {

                                        if (group.groupId != undefined) {
                                            var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                return tariff.groupId === group.groupId;
                                            }));
                                            if (found > -1) {
                                                var newTariff = {
                                                    groupName: group.groupName,
                                                    groupId: plug.tariff[found].groupId,
                                                    tariffId: plug.tariff[found].tariffId,
                                                    tariff: plug.tariff[found].tariff,
                                                    tariffType: plug.tariff[found].tariffType,
                                                    name: plug.tariff[found].name
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            }
                                            else {
                                                var newTariff = {
                                                    groupName: group.groupName,
                                                    groupId: group.groupId,
                                                    tariffId: "",
                                                    tariff: {},
                                                    tariffType: "",
                                                    name: ""
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            };
                                        }
                                        else {
                                            var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                return tariff.fleetId === group.fleetId;
                                            }));
                                            if (found > -1) {
                                                var newTariff = {
                                                    fleetName: group.fleetName,
                                                    fleetId: plug.tariff[found].fleetId,
                                                    tariffId: plug.tariff[found].tariffId,
                                                    tariff: plug.tariff[found].tariff,
                                                    tariffType: plug.tariff[found].tariffType,
                                                    name: plug.tariff[found].name
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            }
                                            else {
                                                var newTariff = {
                                                    fleetName: group.fleetName,
                                                    fleetId: group.fleetId,
                                                    tariffId: "",
                                                    tariff: {},
                                                    tariffType: "",
                                                    name: ""
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            };
                                        };
                                    });
                                })
                            ).then(async () => {
                                var newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {

                                        if (tariff[index].groupId != undefined) {
                                            var found = newTariffs.find(tar => {
                                                return tar.groupId == tariff[index].groupId;
                                            });
                                            if (!found) {
                                                newTariffs[index] = tariff[index];
                                            };
                                        }
                                        else {
                                            var found = newTariffs.find(tar => {
                                                return tar.fleetId == tariff[index].fleetId;
                                            });
                                            if (!found) {
                                                newTariffs[index] = tariff[index];
                                            };
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });

                        }
                        else {
                            plug.tariff = tariff;
                            resolve(true);
                        };

                    }
                    else {
                        plug.tariff = [];
                        resolve(true);
                    };

                });

            })
        ).then(() => {
            resolve(charger);
        });

    });
};


function addQrCodeId(charger) {
    var context = "Function addQrCodeId";
    return new Promise(async (resolve, reject) => {
        try {
            Promise.all(
                charger.plugs.map(plug => {
                    return new Promise((resolve, reject) => {
                        if (plug.qrCodeId !== undefined) {
                            var query = {
                                qrCodeId: plug.qrCodeId
                            };
                            var qrCode = {
                                qrCode: {
                                    hwId: charger.hwId,
                                    plugId: plug.plugId,
                                    chargerType: charger.chargerType,
                                    chargingDistance: charger.chargingDistance,
                                    geometry: charger.geometry
                                }
                            };
                            var newValues = { $set: qrCode };
                            QrCode.updateQrCode(query, newValues, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][updateQrCode] Error `, err.message);;
                                }
                                else {
                                    if (result) {
                                        resolve(true);
                                    }
                                    else {
                                        resolve(false);
                                    };
                                };
                            });
                        }
                        else {
                            var query = {
                                $and: [
                                    {
                                        "qrCode.hwId": charger.hwId
                                    },
                                    {
                                        "qrCode.plugId": plug.plugId
                                    }
                                ]
                            };
                            qrCodeFindOnde(query)
                                .then((qrCodeFound) => {
                                    if (qrCodeFound) {
                                        qrCodeFound.qrCode.geometry = charger.geometry;
                                        qrCodeFound.qrCode.chargerType = charger.chargerType;
                                        qrCodeFound.qrCode.chargingDistance = charger.chargingDistance;

                                        var query = {
                                            _id: qrCodeFound._id
                                        };
                                        var newValues = { $set: qrCodeFound };
                                        QrCode.updateQrCode(query, newValues, (err, result) => {
                                            if (err) {
                                                console.error(`[${context}][updateQrCode] Error `, err.message);;
                                            }
                                            else {
                                                if (result) {
                                                    plug.qrCodeId = qrCodeFound.qrCodeId;
                                                    resolve(true);
                                                }
                                                else {
                                                    resolve(false);
                                                };
                                            };
                                        });


                                    }
                                    else {
                                        var qrCode = new QrCode(
                                            {
                                                qrCode: {
                                                    hwId: charger.hwId,
                                                    plugId: plug.plugId,
                                                    chargerType: charger.chargerType,
                                                    chargingDistance: charger.chargingDistance,
                                                    geometry: charger.geometry
                                                }
                                            }
                                        );
                                        saveQrCode(qrCode)
                                            .then((result) => {
                                                plug.qrCodeId = result.qrCodeId;
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][saveQrCode] Error `, error.message);
                                                reject(error);
                                            });
                                    };

                                })
                                .catch((error) => {
                                    console.error(`[${context}][qrCodeFindOnde] Error `, error.message);
                                    reject(error);
                                })

                        };
                    });
                })
            ).then(() => {
                resolve(charger);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};


function getChargerFilterExternalApi() {
    return {
        id: 1,
        "geometry.coordinates": 1,
        accessType: 1,
        active: 1,
        status: 1,
        chargingDistance: 1,
        imageContent: 1,
        allowRFID: 1,
        parkingSessionAfterChargingSession: 1,
        mapVisibility: 1,
        hwId: 1,
        name: 1,
        energyManagementEnable: 1,
        switchBoardId: 1,
        "address._id": 1,
        "address.street": 1,
        "address.number": 1,
        "address.zipCode": 1,
        "address.city": 1,
        "address.state": 1,
        "address.country": 1,
        "address.countryCode": 1,
        infoPoints: 1,
        "plugs.status": 1,
        "plugs.plugId": 1,
        "plugs.connectorType": 1,
        "plugs.qrCodeId": 1,
        "plugs.amperage": 1,
        "plugs.voltage": 1,
        "plugs.power": 1,
        "plugs.active": 1,
        heartBeat: 1,
        offlineNotification: 1,
        offlineEmailNotification: 1,
        model: 1,
        vendor: 1,
        manufacturer: 1,
        chargePointSerialNumber: 1,
        firmwareVersion: 1,
        iccid: 1,
        imsi: 1,
        operationalStatus: 1,
        updatedAt: 1,
        CPE: 1,
        infrastructure: 1,
        originalCoordinates: 1

    }
}

async function getChargerExternalApi(query) {
    const context = '[ Function getChargerExternalApi ]'
    const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive()
    try {
        if (!query) {
            console.error(`${context} Error - Missing Input Data`);
            throw new Error('Missing Input Data');
        }

        const chargers = await Charger.find(query, getChargerFilterExternalApi())
        if (!chargers) return chargers

        let listChargers = []
        for (let charger of chargers) {

            if (charger.status) {
                switch (charger.status) {
                    case '10':
                        charger.status = 'AVAILABLE';
                        break;
                    case '50':
                        charger.status = 'UNAVAILABLE';
                        break;
                    default:
                        charger.status = 'UNKNOWN';
                        break;
                };
            }

            if (charger.plugs && charger.plugs.length > 0) {
                charger.plugs = charger.plugs.map(plug => {
                    switch (plug.status) {
                        case '10':
                            plug.status = 'AVAILABLE';
                            break;
                        case '20':
                            plug.status = 'CHARGING';
                            break;
                        case '30':
                            plug.status = 'RESERVED';
                            break;
                        case '40':
                            plug.status = 'UNAVAILABLE';
                            break;
                        default:
                            chargerFound.status = 'UNKNOWN';
                            break;
                    }
                    return plug
                })
            }

            const newCharger = {
                id: charger._id,
                geometry: returnCoordinatesAccordingToFlag(charger, searchCoordinatesFlagActive),
                accessType: charger.accessType,
                active: charger.active,
                status: charger.status,
                chargingDistance: charger.chargingDistance,
                imageContent: charger.imageContent,
                allowRFID: charger.allowRFID,
                parkingSessionAfterChargingSession: charger.parkingSessionAfterChargingSession,
                mapVisibility: charger.mapVisibility,
                hwId: charger.hwId,
                name: charger.name,
                address: charger.address,
                InfoPoints: charger.InfoPoints,
                plugs: charger.plugs,
                heartBeat: charger.heartBeat,
                offlineNotification: charger.offlineNotification,
                offlineEmailNotification: charger.offlineEmailNotification,
                model: charger.model,
                vendor: charger.vendor,
                manufacturer: charger.manufacturer,
                chargePointSerialNumber: charger.chargePointSerialNumber,
                firmwareVersion: charger.firmwareVersion,
                iccid: charger.iccid,
                imsi: charger.imsi,
                operationalStatus: charger.operationalStatus,
                updatedAt: charger.updatedAt,
                energyManagementEnable: charger.energyManagementEnable,
                switchBoardId: charger.switchBoardId,
                deliveryPoint: charger.CPE,
                infrastructureId: charger.infrastructure
            }

            listChargers.push(newCharger)
        }
        return listChargers
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw (error);
    }
}

async function getChargerForPlugEnergyRequest(createUser, chargerId, plugId) {
    const context = `${commonLog} getChargerForPlugEnergyRequest]`

    if (!createUser || !chargerId) {
        console.error(`${context}Error - Missing input data`, createUser, chargerId, plugId);
        throw new Error('Missing input data');
    }
    const query = plugId ? { _id: chargerId, "plugs.plugId": plugId, createUser } : { _id: chargerId, createUser };
    const filters = { _id: 0, switchboardId: 1, energyManagementEnable: 1 }
    plugId ? filters['plugs.$'] = 1 : filters.plugs = 1
    return await Charger.findOne(query, filters)
}

async function getPlugsExternalApi(req, res) {
    const context = `${commonLog} getPlugsExternalApi]`
    try {
        const { userid: userId, plugid: plugId } = req.headers;
        const { chargerId } = req.params;
        if (!userId) return res.status(400).send('Missing Token');
        if (!chargerId) return res.status(400).send('Missing chargerId');
        if (!ObjectId.isValid(chargerId)) return res.status(400).send('chargerId with wrong format');

        const chargers = await getChargerForPlugEnergyRequest(userId, chargerId, plugId);
        if (!chargers) return res.status(200).send([]);
        const returnObject = chargers.plugs.map(plug => {
            let resultPlug = {
                plugId: plug._id,
            }
            if (chargers.switchboardId) resultPlug.switchBoardId = chargers.switchboardId
            if (plug.balancingInfo?.lastMeasurement) resultPlug.updatedAt = plug.balancingInfo.lastMeasurement
            if (typeof plug.balancingInfo?.currentLimit === 'number') resultPlug.currentLimit = plug.balancingInfo.currentLimit
            if (typeof plug.balancingInfo?.totalCurrent === 'number') resultPlug.amperage = plug.balancingInfo.totalCurrent
            if (typeof plug.balancingInfo?.voltage === 'number') resultPlug.voltage = plug.balancingInfo.voltage
            if (typeof plug.balancingInfo?.power === 'number') resultPlug.power = plug.balancingInfo.power
            return resultPlug
        })
        return res.status(200).send(returnObject);
    } catch (error) {
        console.error(`${context}Error -`, error.message);
        return res.status(500).send('Internal Server Error');
    }
}

async function getChargerByhwId(hwId, userId, plugId) {
    const context = `${commonLog} getChargerByhwId ]`
    try {
        if (!hwId || !userId) {
            console.error(`${context}Error - Missing input data`, hwId, userId, plugId);
            throw new Error('Missing input data');
        }
        const filter = {
            'plugs.$': 1,
            'energyManagementEnable': 1,
            'energyManagementInterface': 1,
            '_id': 1,
            'controllerId': 1,
        }
        const query = plugId ? { hwId, "plugs.plugId": plugId, createUser: userId } : { hwId, createUser: userId };
        return await queryCharger(query, filter);
    } catch (error) {
        console.error(`${context}Error -`, error.message);
        throw error
    }
}


function buildQueryForSearch(nameForQuery, userId, groups, fleets) {
    const accessToChargerQuery = [
        { 'accessType': chargerConstants.access.chargerAccessPublic },
        { createUser: userId }
    ];

    if (groups.groupCSUsers.length > 0) {
        accessToChargerQuery.push({
            'listOfGroups': {
                $elemMatch: {
                    'groupId': { $in: groups.groupCSUsers }
                }
            }
        });
    }

    if (fleets.length > 0) {
        accessToChargerQuery.push({
            'listOfFleets': {
                $elemMatch: {
                    'fleetId': { $in: fleets }
                }
            }
        });
    }

    return {
        $and: [
            {
                $or: [
                    { name: { $regex: nameForQuery } },
                    { hwId: { $regex: nameForQuery } }
                ]
            },
            { hasInfrastructure: true },
            { active: true },
            { operationalStatus: chargerConstants.status.operationalStatusApproved },
            {
                $or: accessToChargerQuery
            }
        ]
    };
}

async function aggregateChargers(query, fields, chargersLimit, countryCode, name) {
    const nameRegExpStart = new RegExp('^' + `${name}.*`, 'i');
    return await Charger.aggregate([
        { $match: query },
        { $project: fields },
        {
            $addFields: {
                startsWithNameForQuery: { $regexMatch: { input: "$name", regex: nameRegExpStart } }
            }
        },
        {
            $facet: {
                matchingCountryCode: [
                    { $match: { "address.countryCode": { $in: countryCode } } },
                    { $addFields: { isMatchingCountryCode: true } },
                    { $sort: { isMatchingCountryCode: -1, startsWithNameForQuery: -1, name: 1 } }
                ],
                notMatchingCountryCode: [
                    { $match: { "address.countryCode": { $nin: countryCode } } },
                    { $addFields: { isMatchingCountryCode: false } },
                    { $sort: { isMatchingCountryCode: -1, startsWithNameForQuery: -1, name: 1 } }
                ],
            },
        },
        {
            $project: {
                chargers: {
                    $concatArrays: ["$matchingCountryCode", "$notMatchingCountryCode"],
                },
            },
        },
        { $unwind: "$chargers" },
        { $limit: chargersLimit },
    ]);
}

async function sortAndMapChargersByCountryCode(chargers, name) {
    const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive()
    return chargers.sort((a, b) => {
        if (a.isMatchingCountryCode !== b.isMatchingCountryCode) {
            return a.isMatchingCountryCode ? -1 : 1;
        }
        if (a.startsWithNameForQuery !== b.startsWithNameForQuery) {
            return a.startsWithNameForQuery ? -1 : 1;
        }
        if (a.name.includes(name) && !b.name.includes(name)) {
            return -1;
        }
        if (!a.name.includes(name) && b.name.includes(name)) {
            return 1;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }).map((charger) => {
        charger.geometry = returnCoordinatesAccordingToFlag(charger, searchCoordinatesFlagActive);
        delete charger.isMatchingCountryCode;
        delete charger.startsWithNameForQuery;
        return charger;
    });
}

function validateChargerDetails(userId, clientName, countryCode, name) {
    const context = 'ValidateChargerDetails';
    try {
        if (!validateUserId(userId)) return { status: false, message: 'Invalid userId', code: 'invalid_userId' };
        if (!validateClientName(clientName)) return { status: false, message: 'Invalid clientName', code: 'invalid_clientName' };
        if (!validateCountryCode(countryCode)) return { status: false, message: 'Invalid countryCode', code: 'invalid_countryCode' };
        if (!validateName(name)) return { status: false, message: 'Invalid name', code: 'invalid_name' };
        return { status: true };
    } catch (error) {
        console.error(`${context}Error -`, error.message);
        return { status: false, message: 'Internal Server Error', code: 'internal_server_error' };
    }
}

async function getChargersByName(req, res) {
    const context = 'getChargersByName';
    try {
        const { query: receivedParams, headers: requestHeaders } = req;
        const { countryCode, name } = receivedParams;

        const { userid: userId, clientname: clientName } = requestHeaders;

        const isRequestValid = validateChargerDetails(userId, clientName, countryCode, name);
        if (!isRequestValid.status) {
            console.error(`${context}Error - ${isRequestValid.message ? isRequestValid.message : 'Missing input data'}`);
            return res.status(400).send({ status: false, message: isRequestValid.message ? isRequestValid.message : 'Missing input data', code: isRequestValid.code ? isRequestValid.code : 'missing_input_data' });
        }

        const publicChargers = await getChargerOPCM(receivedParams, clientName);
        const maxChargersToBeReturned = 20;
        let listOfChargers = publicChargers || [];
        const countNoMatch = listOfChargers.filter((charger) => !charger.isMatchingCountryCode).length;
        if ((countNoMatch > 0 && countNoMatch <= maxChargersToBeReturned) || listOfChargers.length < maxChargersToBeReturned) {
            const groups = await getGroupsMap(userId);
            const fleets = await getEVsMap(userId, groups.groupDrivers);
            // This regex matches any string containing 'name', regardless of case or position.
            const nameRegExp = new RegExp('^' + `.*${name}.*`, 'i');

            const query = buildQueryForSearch(nameRegExp, userId, groups, fleets);
            
            const fields = { _id: 1, geometry: 1, address: 1, name: 1, hwId: 1, chargerType: 1, countryCode: 1, originalCoordinates: 1 };

            const chargersLimit = maxChargersToBeReturned - listOfChargers.length + countNoMatch;

            const chargersFound = await aggregateChargers(query, fields, chargersLimit, countryCode, name);

            listOfChargers = listOfChargers.concat(chargersFound.map(charger => charger.chargers));
        }
        listOfChargers = await sortAndMapChargersByCountryCode(listOfChargers, name);
        const formattedChargers = listOfChargers.slice(0, maxChargersToBeReturned);
        return res.status(200).send(formattedChargers);
    } catch (error) {
        captureException(error);
        throw error;
    }
}


async function handlePatchSetPointsRequest(req, res) {
    const context = `${commonLog} handlePatchSetpointsRequest ]`
    try {
        const { hwId, plugId, userId, controlType, minActivePower, setCurrentLimit } = req.body;
        const charger = await chargersServices.getChargerByhwId(hwId, userId, plugId)
        if (!charger) {
            console.error(`${context}Error - Charger not found `, charger);
            return res.status(400).send({ status: false, message: 'Charger not found', code: 'server_charger_not_found' });
        }
        if (!charger.energyManagementEnable) {
            console.error(`${context}Error - Charger not enabled for energy management `, charger);
            return res.status(400).send({ status: false, message: 'Charger without energy management capabilities activated', code: 'charger_not_energyManagement_enabled' });
        }
        if (!charger.controllerId) {
            console.error(`${context}Error - Charger without controllerId`, charger);
            return res.status(500).send('Internal Server Error');
        }

        let updateQueryObject = {}
        let updateObject = {}
        if (controlType) {
            updateQueryObject['plugs.$.balancingInfo.controlType'] = controlType
            updateObject.controlType = controlType
        }
        if (minActivePower) {
            updateQueryObject['plugs.$.balancingInfo.minActivePower'] = Number(minActivePower).toFixed(2)
            updateObject.minActivePower = Number(minActivePower).toFixed(2)
        }
        if (setCurrentLimit) {
            updateQueryObject['plugs.$.balancingInfo.setCurrentLimit'] = Number(setCurrentLimit).toFixed(2)
            updateObject.setCurrentLimit = Number(setCurrentLimit).toFixed(2)
        }

        const updated = await chargersServices.updateEnergyManagementPlugsSetPoints(hwId, userId, plugId, updateQueryObject)
        if (!updated) {
            console.error(`${context}Error - Charger not updated `, charger);
            return res.status(500).send('Internal Server Error');
        }

        if (!(await setPlugsSetPointsOnComms(hwId, plugId, charger.controllerId, updateObject))) {
            console.error(`${context}Error - fail to set setpoints on the controller`);
            return res.status(500).send('Internal Server Error');
        }
        return res.status(200).send({ status: true, message: 'success' });
    } catch (error) {
        console.error(`${context}Error -`, error.message);
        captureException(error);
        return res.status(500).send('Internal Server Error');
    }
}

module.exports = {
    chargersPlugs: (req) => {
        let context = "Function chargersPlugs";
        return new Promise(async (resolve, reject) => {
            try {
                if (!req.body._id) {
                    reject({ auth: false, code: 'server_id_required', message: "Id is required" })
                }

                let query = {
                    _id: req.body._id,
                    hasInfrastructure: true
                };

                let charger = req.body;

                let chargerFound = await Charger.findOne(query);

                if (chargerFound) {

                    if (chargerFound.plugs.length === 0) {

                        chargerFound.plugs = charger.plugs;
                        changeTariff(chargerFound)
                            .then((result) => {
                                addQrCodeId(result)
                                    .then((result) => {

                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][addQrCodeId][.catch] Error `, error.message);
                                        reject(error)
                                    });
                            })
                            .catch((error) => {
                                console.error(`[${context}][changeTariff][.catch] Error `, error.message);
                                reject(error)
                            });
                    }

                } else {
                    reject({ auth: false, code: "server_charger_not_found", message: 'Charger not found for given parameters' });
                };

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error)
            }
        })
    },
    getInfrastructuresChargers: async (infrastructures) => {
        const context = "Function getInfrastructuresChargers"
        try {
            let chargers = []
            for (let infrastructure of infrastructures) {
                for (let chargerI of infrastructure.listChargers) {
                    let charger = await getChargerListOfCharger(chargerI.chargerId)
                    if (charger) {
                        charger._id = chargerI._id;
                        charger.chargerId = chargerI.chargerId;
                        chargers.push(charger)
                    }
                }
            }
            return chargers
        } catch (error) {
            console.error(`[${context}][find] Error `, error.message);
            throw new Error(error)
        }
    },
    getChargersGroupOfUsers: async (chargers) => {
        const context = "Function getChargersGroupOfUsers"
        try {
            let groups = chargers.map(charger => charger.listOfGroups).flat(1)
            return await getGroupsCSUsersListIds(groups)
        } catch (error) {
            console.error(`[${context}][find] Error `, error.message);
            throw new Error(error)
        }
    },
    forceUpdateWhiteLists,
    setAllEnergyManagementConnectionToOffline,
    getChargerExternalApi,
    getPlugsExternalApi,
    getChargersByName,
    handlePatchSetPointsRequest,
};