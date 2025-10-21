require("dotenv-safe").load();
const httpProxy = require('express-http-proxy');
const axios = require("axios");
const { findUserById } = require("evio-library-identity").default;

const { getEVByEvId, isCompanyPaymentResponsibility } = require("../apis/ev");
const { getContractByIdTagValidate, getContractByIdTag } = require('../apis/identity');
const { getTariff, getTariffFromPlug } = require('../apis/publicTariff');
const { validatePaymentConditions } = require('../apis/payments');
const { sendToStart, stoppedByOwner } = require('../apis/sessions');

const ConfigsService = require('../services/configsService');
const { validatePlugCapabilities } = require('../utils/validationUtils');
const { Enums, Helpers } = require('evio-library-commons').default;
const { handleSessionCompletion } = require('../helpers/algorithmCoordinates');
const { saveSessionLogs } = require('../helpers/save-session-logs');
const { getErrorMessageFromErrorResponse } = require("../utils/errorUtils");

function validateChargingStationConditions(userId, chargerFound, plugId, idTag, chargerType, evId, startByAdmin, isDeviceSession) {
    const context = "Function validateChargingStationConditions";
    return new Promise(async (resolve, reject) => {
        try {

            if (chargerFound.operationalStatus === process.env.OperationalStatusApproved) {

                let publicNetworkChargerType = process.env.PublicNetworkChargerType;

                publicNetworkChargerType = publicNetworkChargerType.split(',');

                let found = publicNetworkChargerType.find(type => {
                    return type === chargerType;
                });

                if (found) {

                    if (chargerFound.status === process.env.ChargerPointStatus) {

                        let plugFound = chargerFound.plugs.find(plug => {
                            return plug.plugId === plugId;
                        });

                        if (plugFound) {

                            //Check if selected plug status is active
                            if (plugFound.status === process.env.PlugStatusAvailable) resolve(true)
                            else reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });

                        } else reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });

                    } else {

                        if (chargerFound.status === process.env.ChargerPointStatusFaulted)
                            reject({ auth: false, code: 'server_charger_offline', message: 'The selected charging station is currently offline' });
                        else
                            reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                    };

                } else {

                    //Valida se o posto está dispinivel
                    if (chargerFound.status === process.env.ChargerPointStatus) {

                        //Valida o availability
                        let networkType = "";

                        switch (chargerType) {
                            case "011":
                                networkType = 'Go.Charge'
                                break;
                            case "012":
                                networkType = 'Hyundai'
                                break;
                            case process.env.chargerTypeKLC:
                                networkType = process.env.NetworkKLC
                                break;
                            case process.env.chargerTypeKinto:
                                networkType = process.env.NetworkKinto
                                break;
                            default:
                                networkType = 'EVIO'
                                break;
                        }
                        let contractFound = await getContractByIdTagValidate(userId, idTag, evId, networkType)
                        let networkActive;
                        if(isDeviceSession.isDevice){
                            resolve(true); 
                        }
                        if (contractFound) {
                            networkActive = contractFound.networks.some(network => {
                                return network.network === networkType && network.tokens.some(token => {
                                    return token.tokenType === process.env.AuthTypeApp_User && token.status === process.env.NetWorkStatusActive
                                })
                            });
                        } else {
                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                        };

                        console.log("networkActive", networkActive)

                        if (chargerFound.createUser === userId) {
                            resolve(true);
                        } else {

                            let plugFound;
                            switch (chargerFound.accessType) {

                                //Case charger access Type private (User and fleet contract)
                                case process.env.ChargerAccessPrivate:

                                    //Validate owner do charger
                                    if (userId === chargerFound.createUser /*|| contractFound.userId === chargerFound.createUser*/) {

                                        //Check if plug exists
                                        plugFound = chargerFound.plugs.find(plug => {
                                            return plug.plugId === plugId;
                                        });

                                        if (plugFound) {

                                            //Check if selected plug status is active
                                            if (plugFound.status === process.env.PlugStatusAvailable) {
                                                resolve(true);
                                            } else {
                                                reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                            };

                                        } else {
                                            reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                        };

                                    } else {

                                        reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                    };

                                    break;

                                //Case charger access Type free charge (User and fleet contract)
                                case process.env.ChargerAccessFreeCharge:

                                    //TODO validate if on free charge
                                    if (networkActive || contractFound.userId === chargerFound.createUser) {

                                        //Check if plug exists
                                        plugFound = chargerFound.plugs.find(plug => {
                                            return plug.plugId === plugId;
                                        });

                                        if (plugFound) {
                                            //Check if selected plug status is active
                                            if (plugFound.status === process.env.PlugStatusAvailable) {
                                                resolve(true);
                                            } else {
                                                reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                            };
                                        } else {
                                            reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                        };

                                    } else {

                                        if (chargerFound.listOfGroups.length === 0 && chargerFound.listOfFleets.length === 0) {

                                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                        } else {

                                            plugFound = chargerFound.plugs.find(plug => {
                                                return plug.plugId === plugId;
                                            });

                                            if (plugFound) {

                                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                                    switch (contractFound.contractType) {
                                                        case process.env.ContractTypeUser:

                                                            if (chargerFound.listOfGroups === undefined || chargerFound.listOfGroups.length === 0) {

                                                                reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                            } else {

                                                                let myCSGroups = chargerFound.listOfGroups.filter(group => {
                                                                    return group.listOfUsers.find(user => {
                                                                        return user.userId === userId;
                                                                    });
                                                                });

                                                                if (myCSGroups.length > 0) {

                                                                    let tariffs = await getTariffFromPlug(plugFound, myCSGroups);

                                                                    if (tariffs.length > 0) {
                                                                        resolve(true);
                                                                    } else {
                                                                        reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                                    };

                                                                } else {

                                                                    reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                                };

                                                            };

                                                            break;
                                                        case process.env.ContractTypeFleet:

                                                            if (contractFound.evId === evId) {

                                                                if (chargerFound.listOfFleets === undefined || chargerFound.listOfFleets.length === 0) {

                                                                    reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                                } else {

                                                                    let found = chargerFound.listOfFleets.find(fleet => {
                                                                        return fleet.fleetId === contractFound.fleetId;
                                                                    });

                                                                    if (found) {

                                                                        let tariff = plugFound.tariff.find(tariff => {
                                                                            return tariff.fleetId === contractFound.fleetId && tariff.tariffId != ""
                                                                        });

                                                                        if (tariff) {
                                                                            resolve(true);
                                                                        } else {
                                                                            reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                                        };

                                                                    } else {

                                                                        reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                                    };

                                                                };

                                                            } else {

                                                                reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                            };

                                                            break;
                                                        default:

                                                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                            break;
                                                    };

                                                } else {

                                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });

                                                };

                                            } else {

                                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });

                                            };

                                        };

                                    };

                                    break;

                                //Case charger access Type Public (User and fleet contract)
                                case process.env.ChargerAccessPublic:

                                    if (networkActive) {

                                        if (chargerFound.availability.availabilityType === process.env.ChargerAvailabilityAlways) {

                                            plugFound = chargerFound.plugs.find(plug => {
                                                return plug.plugId === plugId;
                                            });

                                            if (plugFound) {

                                                //Check if selected plug status is active
                                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                                    //Validate tariff of public
                                                    let tariff = plugFound.tariff.find(tariff => {
                                                        return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                    });

                                                    if (tariff) {
                                                        resolve(true);
                                                    } else {
                                                        reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                    };

                                                } else {
                                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                                };

                                            } else {
                                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                            };

                                        } else {
                                            /*
                                            infoDay.ranges.forEach(range => {
                                                //console.log("range.startTime >= time", range.startTime <= time);
                                                //console.log(" range.endTime <= time", range.endTime >= time);
                                                if (range.startTime <= time && range.endTime >= time) {
                                                    isValid = true
                                                }
                                            })

                                            console.log("isValid", isValid);

                                            if (isValid) {
                                */
                                            plugFound = chargerFound.plugs.find(plug => {
                                                return plug.plugId === plugId;
                                            });

                                            if (plugFound) {

                                                //Check if selected plug status is active
                                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                                    //Validate tariff of public
                                                    var tariff = plugFound.tariff.find(tariff => {
                                                        return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                    });

                                                    if (tariff) {
                                                        resolve(true);
                                                    }
                                                    else {
                                                        reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                    };

                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                                };
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                            };

                                        };

                                    } else {

                                        if (chargerFound.listOfGroups.length === 0 && chargerFound.listOfFleets.length === 0) {

                                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                        } else {

                                            plugFound = chargerFound.plugs.find(plug => {
                                                return plug.plugId === plugId;
                                            });

                                            if (plugFound) {

                                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                                    switch (contractFound.contractType) {
                                                        case process.env.ContractTypeUser:

                                                            if (chargerFound.listOfGroups === undefined || chargerFound.listOfGroups.length === 0) {

                                                                reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                            } else {

                                                                let myCSGroups = chargerFound.listOfGroups.filter(group => {
                                                                    return group.listOfUsers.find(user => {
                                                                        return user.userId === userId;
                                                                    });
                                                                });

                                                                if (myCSGroups.length > 0) {

                                                                    let tariffs = await getTariffFromPlug(plugFound, myCSGroups);

                                                                    if (tariffs.length > 0) {
                                                                        resolve(true);
                                                                    } else {
                                                                        reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                                    };

                                                                } else {

                                                                    reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                                };

                                                            };

                                                            break;
                                                        case process.env.ContractTypeFleet:

                                                            if (contractFound.evId === evId) {

                                                                if (chargerFound.listOfFleets === undefined || chargerFound.listOfFleets.length === 0) {

                                                                    reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                                } else {

                                                                    let found = chargerFound.listOfFleets.find(fleet => {
                                                                        return fleet.fleetId === contractFound.fleetId;
                                                                    });

                                                                    if (found) {

                                                                        let tariff = plugFound.tariff.find(tariff => {
                                                                            return tariff.fleetId === contractFound.fleetId && tariff.tariffId != ""
                                                                        });

                                                                        if (tariff) {
                                                                            resolve(true);
                                                                        } else {
                                                                            reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                                        };

                                                                    } else {

                                                                        reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                                    };

                                                                };

                                                            } else {

                                                                reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                            };

                                                            break;
                                                        default:

                                                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                            break;
                                                    };

                                                } else {

                                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });

                                                };

                                            } else {

                                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });

                                            };

                                        };

                                    };

                                    break;

                                //Case charger access Type Restrict (User and fleet contract)
                                case process.env.ChargerAccessRestrict:

                                    plugFound = chargerFound.plugs.find(plug => {
                                        return plug.plugId === plugId;
                                    });

                                    if (plugFound) {

                                        if (plugFound.status === process.env.PlugStatusAvailable) {

                                            switch (contractFound.contractType) {
                                                case process.env.ContractTypeUser:

                                                    if (chargerFound.listOfGroups === undefined || chargerFound.listOfGroups.length === 0) {

                                                        reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                    } else {

                                                        let myCSGroups = chargerFound.listOfGroups.filter(group => {
                                                            return group.listOfUsers.find(user => {
                                                                return user.userId === userId;
                                                            });
                                                        });

                                                        if (myCSGroups.length > 0) {

                                                            let tariffs = await getTariffFromPlug(plugFound, myCSGroups);

                                                            if (tariffs.length > 0) {
                                                                resolve(true);
                                                            } else {
                                                                reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                            };

                                                        } else {

                                                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                        };

                                                    };

                                                    break;
                                                case process.env.ContractTypeFleet:

                                                    if (contractFound.evId === evId) {

                                                        if (chargerFound.listOfFleets === undefined || chargerFound.listOfFleets.length === 0) {

                                                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                        } else {

                                                            let found = chargerFound.listOfFleets.find(fleet => {
                                                                return fleet.fleetId === contractFound.fleetId;
                                                            });

                                                            if (found) {

                                                                let tariff = plugFound.tariff.find(tariff => {
                                                                    return tariff.fleetId === contractFound.fleetId && tariff.tariffId != ""
                                                                });

                                                                if (tariff) {
                                                                    resolve(true);
                                                                } else {
                                                                    reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                                };

                                                            } else {

                                                                reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                            };

                                                        };

                                                    } else {

                                                        reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                    };

                                                    break;
                                                default:

                                                    reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                                    break;
                                            };

                                        } else {

                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });

                                        };

                                    } else {

                                        reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });

                                    };

                                    break;

                                default:

                                    reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                                    break;

                            };
                        };

                    } else {

                        reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                    };

                };

            } else if (chargerFound.operationalStatus === process.env.OperationalStatusWaitingAproval) {

                if (startByAdmin) {

                    let publicNetworkChargerType = process.env.PublicNetworkChargerType;

                    publicNetworkChargerType = publicNetworkChargerType.split(',');

                    let found = publicNetworkChargerType.find(type => {
                        return type === chargerType;
                    });

                    if (found) {

                        if (chargerFound.status === process.env.ChargerPointStatus) {

                            let plugFound = chargerFound.plugs.find(plug => {
                                return plug.plugId === plugId;
                            });

                            if (plugFound) {

                                //Check if selected plug status is active
                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                    resolve(true);

                                } else {

                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });

                                };

                            } else {

                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });

                            };

                        } else {

                            if (chargerFound.status === process.env.ChargerPointStatusFaulted)
                                reject({ auth: false, code: 'server_charger_offline', message: 'The selected charging station is currently offline' });
                            else
                                reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                        };

                    } else {

                        //Valida se o posto está dispinivel
                        if (chargerFound.status === process.env.ChargerPointStatus) {

                            resolve(true);

                        } else {

                            reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                        };

                    };

                } else {

                    reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                };

            } else {

                reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

            };

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

const handleSessionAction = async (req, res, useV2 = false) => {
    var context = "POST /api/private/connectionstation";
    try {
        var chargersServiceProxy = process.env.ChargersServiceProxy;


        let clientType = req.headers['usertype'];
        let clientName = req.headers['clientname'];

        const isDeviceSession = Helpers.verifyIsDeviceRequest(clientType || '');

        var chargerTypesServiceProxy = `${chargersServiceProxy}/api/private/chargerTypes`;

        //Validate if necessary info is present on request body
        var chargerId = req.body.chargerId;
        var evId = req.body.evId;
        var action = req.body.action;
        var plugId = req.body.plugId;
        var stopReason = req.body.stopReason;
        var chargerType = req.body.chargerType;
        var hwId = chargerId;
        var address = req.body.address;
        var fees = req.body.fees;
        var startByAdmin = req.body.startByAdmin;
        // console.log("le data: ", req.body)
        if (req.body.autoStop === undefined) {
            var autoStop = {};
        }
        else {
            var autoStop = req.body.autoStop;
        };
        if (req.body.idTag === undefined) {
            var idTag = "";
        }
        else {
            var idTag = req.body.idTag;
        };
        if (req.body.userId == undefined) {
            var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        }
        else {
            var userId = req.body.userId;
        };

        const baseDataToSaveLog = {
            userId: isDeviceSession.deviceType === Enums.DeviceTypes.QR_CODE && userId === '-1' ? 'QR_Code_User' : userId,
            hwId,
            plugId,
            stage: 'Route [POST /api/private/connectionstation]',
            action,
            status: Enums.SessionFlowLogsStatus.ERROR,
            payload: req.body,
            errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
        }

        if (!userId) {
            saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'UserId is required' })
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User Id required" });
        }
        if (!chargerId) {
            saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'ChargerId is required' })
            return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: 'Charger id is required' });
        }
        if (!action) {
            saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Action is required' })
            return res.status(400).send({ auth: false, code: 'server_charger_action_required', message: 'Charger action is required' });
        }
        if (!chargerType) {
            saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'ChargerType type is required' })
            return res.status(400).send({ auth: false, code: 'server_charger_type_not_conf', message: 'Charger type not configured' });
        }

        var publicNetworkChargerType = process.env.PublicNetworkChargerType;

        publicNetworkChargerType = publicNetworkChargerType.split(',');

        var found = publicNetworkChargerType.find(type => {
            return type === chargerType;
        });

        if (found) {
            chargersServiceProxy = process.env.PublicChargersHost + `/api/private/chargers/?hwId=${chargerId}&&chargerType=${chargerType}`;
        }
        else {
            chargersServiceProxy = `${chargersServiceProxy}/api/private/chargers/?hwId=${chargerId}&&chargerType=${chargerType}`;
        };

        // Only use V2 if received useV2 is true and the charger is public and the action is start
        // Remove charger public verification after implements OCPP remote start retries
        if (useV2) useV2 = (found && action === process.env.ChargerActionStart);

        const middleURL = useV2 ? "api/private/v2/connectionstation" : "api/private/connectionstation";

        const userAccount = isDeviceSession?.isDevice ? { blocked: false } : await findUserById(userId);
        const isCompanyWillPay = isDeviceSession?.isDevice ? false : await isCompanyPaymentResponsibility(evId, userId);

        if (userAccount.blocked && !isCompanyWillPay && action === process.env.ChargerActionStart) {
            saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'User is blocked', errorType: Enums.SessionFlowLogsErrorTypes.AUTHENTICATION_ERROR })
            return res.status(400).send({ auth: false, code: 'server_blocked', message: 'Cannot start charging session, user is blocked' });
        }
        else {
            //Get Info about charger
            axios.get(chargersServiceProxy, { req })
                .then(async function (response) {


                    if (response.data.length > 0) {

                        var chargerFound = response.data[0];
                        // this is just to keep the code more centralized as possible, so Hubject will use the OCPI routine to start session from APP
                        if (chargerType == "015") chargerType = "010"

                        const params = {
                            chargerType: chargerType
                        };
                        const plugToBeChecked = chargerFound.plugs?.find(plug => plug._id === plugId);

                        const validCapabilities = validatePlugCapabilities(plugToBeChecked, res);
                        if (!validCapabilities) {
                            saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'The charger does not support login via the app' })
                            return res;
                        }
                        //start command
                        if (action === process.env.ChargerActionStart) {
                            // Validate if we have fees for this charger
                            try {
                                await ConfigsService.getFeesByCountryAndPostalCode(chargerFound?.address?.country, chargerFound?.address?.zipCode, chargerFound?.countryCode);
                            } catch (error) {
                                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Fees not found for this charger' })
                                return res.status(400).send({ code: 'unable_start_remote_session', message: 'Unable to start session at this time. Please try later or use the physical card.' });
                            }

                            validateChargingStationConditions(userId, chargerFound, plugId, idTag, chargerType, evId, startByAdmin, isDeviceSession)
                                .then(async (result) => {
                                    let evOwner = '-1'
                                    if (evId != '-1') {
                                        let ev = await getEVByEvId(evId);
                                        evOwner = ev.userId;
                                    };

                                    axios.get(chargerTypesServiceProxy, { params })
                                        .then(async (response) => {
                                            //Get charger data configuration
                                            var remoteChargerData = response.data.chargerTypes[0];
                                            console.log(remoteChargerData);
                                            var finded = false;
                                            remoteChargerData.actions.forEach(actionElement => {

                                                if (actionElement.command === action) {
                                                    finded = true;

                                                    if (!actionElement.enabled) {
                                                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Action not enabled by charger' })
                                                        return res.status(400).send({ auth: false, code: 'server_action_not_supported', message: 'Action not supported by charger' });
                                                    }
                                                    return;
                                                }
                                            });

                                            if (!finded) {
                                                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Action not supported by charger' })
                                                return res.status(400).send({ auth: false, code: 'server_action_not_supported', message: 'Action not supported by charger' });
                                            }
                                            var path = remoteChargerData.path;

                                            if (!path) {
                                                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Charger type not configured - path not found' })
                                                return res.status(400).send({ auth: false, code: 'server_charger_type_not_conf', message: 'Charger type not configured' });
                                            }
                                            var host = remoteChargerData.host;
                                            if (!host) {
                                                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Charger type not configured - host not found' })
                                                return res.status(400).send({ auth: false, code: 'server_charger_type_not_conf', message: 'Charger type not configured' });
                                            }
                                            const stationUrl = `${host}/${middleURL}/${path}/${action}`;

                                            const dinamicallyStationServiceProxy = httpProxy(host, {
                                                forwardPath: req => stationUrl
                                            });

                                            var tariff;
                                            if (req.body.tariffId != '-1') {

                                                tariff = await getTariff(req.body.tariffId);

                                            }
                                            else {
                                                tariff = {};
                                            };

                                            var cardNumber;

                                            if (idTag == "-1") {
                                                cardNumber = "-1";
                                            }
                                            else {
                                                cardNumber = await getContractByIdTag(userId, idTag, evId);
                                            };

                                            console.log("cardNumber", cardNumber);

                                            req.body.chargerId = chargerId;
                                            req.body.hwId = hwId;
                                            req.body.evId = evId;
                                            req.body.plugId = plugId;
                                            req.body.idTag = idTag;
                                            req.body.autoStop = autoStop;
                                            req.body.address = address;

                                            //req.body.clientType = clientType;
                                            req.body.fees = fees;
                                            req.body.tariff = tariff;
                                            req.body.cardNumber = cardNumber;
                                            req.body.evOwner = evOwner;
                                            var data = req.body;
                                            var headers = {
                                                userid: userId
                                            };
                                            var publicNetworkChargerType = process.env.PublicNetworkChargerType;

                                            publicNetworkChargerType = publicNetworkChargerType.split(',');

                                            var found = publicNetworkChargerType.find(type => {
                                                return type === chargerType;
                                            });

                                            console.log("New");
                                            if (isDeviceSession?.isDevice) {
                                                // Device sessions always will pay for the charging session
                                                data.fees = await ConfigsService.getFeesByCountryAndUserId(chargerFound?.address?.country, chargerFound?.address?.zipCode, chargerFound?.countryCode, '');
                                                sendToStart(stationUrl, data, headers, res, stopReason, autoStop, req);
                                            } else if (found) {
                                                
                                                validatePaymentConditions(userId, data, baseDataToSaveLog)
                                                    .then(async (paymentInfo) => {
                                                        //console.log("paymentInfo", paymentInfo);

                                                        data.paymentMethod = paymentInfo.paymentMethod;
                                                        data.paymentMethodId = paymentInfo.paymentMethodId;
                                                        data.walletAmount = paymentInfo.walletAmount;
                                                        data.reservedAmount = paymentInfo.reservedAmount;
                                                        data.confirmationAmount = paymentInfo.confirmationAmount;
                                                        data.userIdWillPay = paymentInfo.userIdWillPay;
                                                        data.adyenReference = paymentInfo.adyenReference;
                                                        data.transactionId = paymentInfo.transactionId;
                                                        data.clientType = paymentInfo.clientType;
                                                        data.ceme = paymentInfo.ceme;
                                                        data.viesVAT = paymentInfo.viesVAT;
                                                        data.paymentType = paymentInfo.paymentType;
                                                        data.billingPeriod = paymentInfo.billingPeriod;
                                                        data.clientName = paymentInfo.clientName;
                                                        data.cardNumber = paymentInfo.cardNumber;
                                                        data.userIdToBilling = paymentInfo.userIdToBilling;
                                                        data.plafondId = paymentInfo.plafondId;
                                                        data.fees = await ConfigsService.getFeesByCountryAndUserId(chargerFound?.address?.country, chargerFound?.address?.zipCode, chargerFound?.countryCode, data.userIdToBilling);
                                                        // console.log("data", data);
                                                        sendToStart(stationUrl, data, headers, res, stopReason, autoStop, req);

                                                    })
                                                    .catch((error) => {

                                                        if (error.status === 400) {
                                                            console.log("error.data 1", error.data)
                                                            return res.status(400).send(error.data);
                                                        }
                                                        else {
                                                            console.log(`[${context}][validatePaymentConditions][] Error`, error.message);
                                                            return res.status(500).send(error);
                                                        };
                                                    });
                                            }
                                            else {
                                                
                                                if (req.body.tariffId === '-1' || userId === chargerFound.createUser) {

                                                    data.paymentMethod = process.env.PaymentMethodNotPay;
                                                    data.paymentMethodId = "";
                                                    data.walletAmount = 0;
                                                    data.reservedAmount = 0;
                                                    data.confirmationAmount = 0;
                                                    data.userIdWillPay = userId;
                                                    req.body.tariffId = '-1';
                                                    req.body.tariff = {};
                                                    data.clientType = clientType;
                                                    data.clientName = clientName;
                                                    data.userIdToBilling = userId;
                                                    data.fees = await ConfigsService.getFeesByCountryAndUserId(chargerFound?.address?.country, chargerFound?.address?.zipCode, chargerFound?.countryCode, data.userIdToBilling);

                                                    //console.log("data", data);
                                                    sendToStart(stationUrl, data, headers, res, stopReason, autoStop, req);
                                                }
                                                else {
                                                    switch (tariff.tariffToCharge) {
                                                        case process.env.BillingTypeNotApplicable:
                                                            data.paymentMethod = process.env.PaymentMethodNotPay;
                                                            data.paymentMethodId = "";
                                                            data.walletAmount = 0;
                                                            data.reservedAmount = 0;
                                                            data.confirmationAmount = 0;
                                                            data.userIdWillPay = userId;
                                                            data.clientType = clientType;
                                                            data.clientName = clientName;
                                                            data.userIdToBilling = userId;
                                                            data.fees = await ConfigsService.getFeesByCountryAndUserId(chargerFound?.address?.country, chargerFound?.address?.zipCode, chargerFound?.countryCode, data.userIdToBilling);

                                                            //console.log("data", data);
                                                            sendToStart(stationUrl, data, headers, res, stopReason, autoStop, req);
                                                            break;
                                                        case process.env.BillingTypeForImportingCosts:
                                                            data.paymentMethod = process.env.PaymentMethodNotPay;
                                                            data.paymentMethodId = "";
                                                            data.walletAmount = 0;
                                                            data.reservedAmount = 0;
                                                            data.confirmationAmount = 0;
                                                            data.userIdWillPay = userId;
                                                            data.clientType = clientType;
                                                            data.clientName = clientName;
                                                            data.userIdToBilling = userId;
                                                            data.fees = await ConfigsService.getFeesByCountryAndUserId(chargerFound?.address?.country, chargerFound?.address?.zipCode, chargerFound?.countryCode, data.userIdToBilling);

                                                            //console.log("data", data);
                                                            sendToStart(stationUrl, data, headers, res, stopReason, autoStop, req);
                                                            break;
                                                        case process.env.BillingTypeForBilling:
                                                            validatePaymentConditions(userId, data, baseDataToSaveLog)
                                                                .then(async (paymentInfo) => {
                                                                    console.log("paymentInfo", paymentInfo);

                                                                    data.paymentMethod = paymentInfo.paymentMethod;
                                                                    data.paymentMethodId = paymentInfo.paymentMethodId;
                                                                    data.walletAmount = paymentInfo.walletAmount;
                                                                    data.reservedAmount = paymentInfo.reservedAmount;
                                                                    data.confirmationAmount = paymentInfo.confirmationAmount;
                                                                    data.userIdWillPay = paymentInfo.userIdWillPay;
                                                                    data.adyenReference = paymentInfo.adyenReference;
                                                                    data.transactionId = paymentInfo.transactionId;
                                                                    data.clientType = paymentInfo.clientType;
                                                                    data.viesVAT = paymentInfo.viesVAT;
                                                                    data.paymentType = paymentInfo.paymentType;
                                                                    data.billingPeriod = paymentInfo.billingPeriod;
                                                                    data.clientName = paymentInfo.clientName;
                                                                    data.cardNumber = paymentInfo.cardNumber;
                                                                    data.userIdToBilling = paymentInfo.userIdToBilling;
                                                                    data.plafondId = paymentInfo.plafondId;
                                                                    data.fees = await ConfigsService.getFeesByCountryAndUserId(chargerFound?.address?.country, chargerFound?.address?.zipCode, chargerFound?.countryCode, data.userIdToBilling);
                                                                    //console.log("data", data);
                                                                    sendToStart(stationUrl, data, headers, res, stopReason, autoStop, req);


                                                                })
                                                                .catch((error) => {
                                                                    if (error.status === 400) {
                                                                        console.log("error 4 ", error.data);
                                                                        return res.status(400).send(error.data);
                                                                    }
                                                                    else {
                                                                        console.log(`[${context}][validatePaymentConditions][] Error`, error.message);
                                                                        return res.status(500).send(error);
                                                                    };
                                                                });
                                                            break;
                                                        default:
                                                            validatePaymentConditions(userId, data, baseDataToSaveLog)
                                                                .then(async (paymentInfo) => {
                                                                    console.log("paymentInfo", paymentInfo);

                                                                    data.paymentMethod = paymentInfo.paymentMethod;
                                                                    data.paymentMethodId = paymentInfo.paymentMethodId;
                                                                    data.walletAmount = paymentInfo.walletAmount;
                                                                    data.reservedAmount = paymentInfo.reservedAmount;
                                                                    data.confirmationAmount = paymentInfo.confirmationAmount;
                                                                    data.userIdWillPay = paymentInfo.userIdWillPay;
                                                                    data.adyenReference = paymentInfo.adyenReference;
                                                                    data.transactionId = paymentInfo.transactionId;
                                                                    data.clientType = paymentInfo.clientType;
                                                                    data.viesVAT = paymentInfo.viesVAT;
                                                                    data.paymentType = paymentInfo.paymentType;
                                                                    data.billingPeriod = paymentInfo.billingPeriod;
                                                                    data.clientName = paymentInfo.clientName;
                                                                    data.cardNumber = paymentInfo.cardNumber;
                                                                    data.userIdToBilling = paymentInfo.userIdToBilling;
                                                                    data.plafondId = paymentInfo.plafondId;
                                                                    data.fees = await ConfigsService.getFeesByCountryAndUserId(chargerFound?.address?.country, chargerFound?.address?.zipCode, chargerFound?.countryCode, data.userIdToBilling);
                                                                    //console.log("data", data);
                                                                    sendToStart(stationUrl, data, headers, res, stopReason, autoStop, req);
                                                                })
                                                                .catch((error) => {
                                                                    if (error.status === 400) {
                                                                        console.log("error 3 ", error.data);
                                                                        return res.status(400).send(error.data);
                                                                    }
                                                                    else {
                                                                        console.log(`[${context}][validatePaymentConditions][] Error`, error.message);
                                                                        return res.status(500).send(error);
                                                                    };

                                                                });

                                                            break;
                                                    };

                                                };
                                                //dinamicallyStationServiceProxy(req, res);

                                            };

                                        })
                                        .catch(function (error) {
                                            const message = getErrorMessageFromErrorResponse(error) || 'An error occurred while fetching charger types';
                                            const stageChargerTypes = `[${context}][GET /api/private/chargerTypes]`
                                            if (error.response) {
                                                if (error.response.data.auth != undefined) {
                                                    console.log("error 2 ", error.response.data);
                                                    saveSessionLogs({ ...baseDataToSaveLog, stage: stageChargerTypes, errorMessage: message })
                                                    return res.status(400).send(error.response.data);
                                                }
                                                else {
                                                    console.log(`[${context}][${chargerTypesServiceProxy}][.catch] Error`, error.response.data);
                                                    saveSessionLogs({ ...baseDataToSaveLog, stage: stageChargerTypes, errorMessage: message, errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR })
                                                    return res.status(500).send(error.response.data);
                                                };

                                            }
                                            else {
                                                console.log(`[${context}][${chargerTypesServiceProxy}][.catch] Error`, error.message);
                                                saveSessionLogs({ ...baseDataToSaveLog, stage: stageChargerTypes, errorMessage: message, errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR })
                                                return res.status(500).send(error.message);
                                            };

                                        });

                                })
                                .catch((error) => {
                                    const message = error?.message || 'An error occurred while validating charging station conditions';
                                    const stageValidateChargingStationConditions = `[${context}][validateChargingStationConditions]`
                                    if (error.auth !== undefined) {
                                        saveSessionLogs({ ...baseDataToSaveLog, stage: stageValidateChargingStationConditions, errorMessage: message })
                                        return res.status(400).send(error);
                                    }
                                    else {
                                        console.log(`[${context}][validateChargingStationConditions][.catch] Error`, error.message);
                                        saveSessionLogs({ ...baseDataToSaveLog, stage: stageValidateChargingStationConditions, errorMessage: message, errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR })
                                        return res.status(500).send(error.message);
                                    };

                                });
                        }
                        else {
                            axios.get(chargerTypesServiceProxy, { params })
                                .then(function (response) {
                                    //Get charger data configuration
                                    var remoteChargerData = response.data.chargerTypes[0];

                                    var finded = false;
                                    remoteChargerData.actions.forEach(actionElement => {

                                        if (actionElement.command === action) {
                                            finded = true;

                                            if (!actionElement.enabled) {
                                                console.log("server_action_not_supported")
                                                saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Action not enabled by charger' })
                                                return res.status(400).send({ auth: false, code: 'server_action_not_supported', message: 'Action not supported by charger' });
                                            }
                                            return;
                                        }
                                    });

                                    if (!finded) {
                                        console.log("server_action_not_supported")
                                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Action not supported by charger' })
                                        return res.status(400).send({ auth: false, code: 'server_action_not_supported', message: 'Action not supported by charger' });
                                    }
                                    var path = remoteChargerData.path;

                                    if (!path) {
                                        console.log("server_charger_type_not_conf")
                                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Charger type not configured - path not found' })
                                        return res.status(400).send({ auth: false, code: 'server_charger_type_not_conf', message: 'Charger type not configured' });
                                    }
                                    var host = remoteChargerData.host;
                                    if (!host) {
                                        console.log("server_charger_type_not_conf")
                                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: 'Charger type not configured - host not found' })
                                        return res.status(400).send({ auth: false, code: 'server_charger_type_not_conf', message: 'Charger type not configured' });

                                    }
                                    const stationUrl = `${host}/${middleURL}/${path}/${action}`;

                                    const dinamicallyStationServiceProxy = httpProxy(host, {
                                        forwardPath: req => stationUrl
                                    });

                                    req.body.chargerId = chargerId;
                                    req.body.hwId = hwId;
                                    req.body.evId = evId;
                                    req.body.plugId = plugId;
                                    req.body.idTag = idTag;
                                    var data = req.body;
                                    var headers = {
                                        userid: userId
                                    };

                                    if (action === 'stop') {
                                        //Not use await because handleSessionCompletion is asynchronous process
                                        handleSessionCompletion(hwId, req.body.chargerType, req.body.sessionId)
                                    }

                                    axios.post(stationUrl, data, { headers: headers })
                                        .then((result) => {
                                            if (stopReason !== undefined) {
                                                stoppedByOwner(stopReason, req.body._id);
                                            };
                                            return res.status(200).send(result.data);
                                        })
                                        .catch((error) => {
                                            const stageStop = `[${context}][Post /api/private/connectionstation/path/stop]`
                                            const message = getErrorMessageFromErrorResponse(error) || 'An error occurred while processing the request /api/private/connectionstation';
                                            if (error.response) {
                                                if (error.response.data.auth != undefined) {
                                                    console.log("(error.response.data 67", error.response.data)
                                                    saveSessionLogs({ ...baseDataToSaveLog, stage: stageStop, errorMessage: message })
                                                    return res.status(400).send(error.response.data);
                                                }
                                                else {
                                                    console.log(`[${context}][${stationUrl}][.catch] Error`, error.response.data);
                                                    saveSessionLogs({ ...baseDataToSaveLog, stage: stageStop, errorMessage: message, errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR })
                                                    return res.status(500).send(error.response.data);
                                                };
                                            }
                                            else {
                                                console.log(`[${context}][${stationUrl}][.catch] Error`, error.message);
                                                saveSessionLogs({ ...baseDataToSaveLog, stage: stageStop, errorMessage: message, errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR })
                                                return res.status(500).send(error.message);
                                            };
                                        });

                                    //dinamicallyStationServiceProxy(req, res);

                                })
                                .catch(function (error) {
                                    const stageChargerTypes = `[${context}][GET /api/private/chargerTypes]`
                                    const message = getErrorMessageFromErrorResponse(error) || 'An error occurred while fetching charger types';
                                    if (error.response) {
                                        if (error.response.data.auth != undefined) {
                                            console.log("(error.response.data 67", error.response.data)
                                            saveSessionLogs({ ...baseDataToSaveLog, stage: stageChargerTypes, errorMessage: message })
                                            return res.status(400).send(error.response.data);
                                        }
                                        else {
                                            console.log(`[${context}][${chargerTypesServiceProxy}][.catch] Error`, error.response.data);
                                            saveSessionLogs({ ...baseDataToSaveLog, stage: stageChargerTypes, errorMessage: message, errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR })
                                            return res.status(500).send(error.response.data);
                                        };
                                    }
                                });
                            //};
                        };

                    }
                    else {
                        console.log("server_charger_not_found")
                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: "Charger not found for given parameters" })
                        return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                    };

                })
                .catch(function (error) {
                    console.log(`[${context}][${chargersServiceProxy}][.catch] Error`, error.message);
                    if (error?.code && error?.message) {
                        saveSessionLogs({ ...baseDataToSaveLog, errorMessage: "Charger not found for given parameters" })
                        return res.status(400).send({ code: error?.code, message: error?.message });
                    }
                    saveSessionLogs({ ...baseDataToSaveLog, errorMessage: error.message, errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR })

                    return res.status(500).send(error.message);
                });
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        saveSessionLogs({
            userId: '',
            hwId: '',
            plugId: '',
            stage: 'Route [POST /api/private/connectionstation]',
            action: '',
            status: Enums.SessionFlowLogsStatus.ERROR,
            payload: req.body,
            errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
            errorMessage: `Error during request processing ${error.message}`,
        })
        return res.status(500).send(error.message);
    };
}

module.exports = {
    handleSessionAction
}