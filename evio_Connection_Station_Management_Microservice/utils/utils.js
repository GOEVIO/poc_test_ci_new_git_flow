const timeZoneMoment = require("moment-timezone");
const moment = require("moment");
const geoTimeZone = require("geo-tz");
const axios = require("axios");
const Constants = require("../utils/constants");
const{ StationsEnum	}= require("../utils/enums/enumStations")

function round(value, decimals = 2) {
	return Number(value.toFixed(decimals));
}


function calculatePowerValue(plug, chargingCapacity, totalBatteryCapacity) {
	return plug.power >= chargingCapacity ? chargingCapacity : Math.min(plug.power, totalBatteryCapacity);
}

function calculateTimeValue(plug, chargingCapacity, totalBatteryCapacity, timeCharger) {
	return (
		Math.min(
			timeCharger,
			(plug.power >= chargingCapacity
				? totalBatteryCapacity / chargingCapacity
				: totalBatteryCapacity / plug.power) * 60
		) / 60
	);
}

function getChargerOffset(timeZone, countryCode) {
	let offset = 0;
	// IANA tzdata’s TZ-values representing the time zone of the location.
	if (Array.isArray(timeZone)) {
		offset = timeZoneMoment.tz(timeZone[0])._offset;
	} else if (timeZone) {
		offset = timeZoneMoment.tz(timeZone)._offset;
	} else {
		/*
            this method returns negative offsets as it counts the offset of utc to this timezone

            I'm also retrieving the last value assuming that there's only one timezone for each country. In europe works kinda well,
            although there are countries like Spain and Portugal that have more than one timezone because of the Azores(Portugal), Madeira (Portugal) and Canary islands (Spain)
        */
		let countryTimeZones = timeZoneMoment.tz.zonesForCountry(countryCode, true);
		offset = -countryTimeZones[countryTimeZones.length - 1].offset;
	}

	return offset;
}






function calcTotalCost(
	initialCost,
	costByTime,
	timeCharger,
	costByPower,
	consumo,
	cemeEVIO,
	costEVIOTime,
	costEVIOPower,
	fees
) {
	try {
		initialCost = Number(initialCost);
		costByTime = Number(costByTime);

		var totalCost =
			initialCost +
			costByTime * timeCharger +
			costByPower * consumo +
			cemeEVIO * consumo +
			costEVIOTime * timeCharger +
			costEVIOPower * consumo;

		if (fees != undefined) {
			totalCost += totalCost * fees.IVA;
			totalCost += consumo * fees.IEC;
		}

		return totalCost;
	} catch (error) {
		console.error(`Function calcTotalCost Error `, error.message);
		throw error;
	}
}

function getFoundStations(filter) {
    let foundStations = [];

    if (filter && filter.stations && Array.isArray(filter.stations)) {
        filter.stations.forEach((station) => {
            if (StationsEnum[station]) {
                foundStations.push(StationsEnum[station]);
            }
        });
    }
    return foundStations;
}

function getPublicData(
    filter,
    foundStations
) {
    let dataPublic = {};
    const chargerTypes = [];
	const teslaChargerType = Constants.networks.tesla.chargerType;
	const mobieChargerType = Constants.networks.mobie.chargerType;
	const gireveChargerType = Constants.networks.gireve.chargerType;
	const hubjectChargerType = Constants.networks.hubject.chargerType;
	if (foundStations.includes(StationsEnum.public)) {
        if (isEmptyObject(dataPublic)) {
            dataPublic = queryCreation(filter);
        }
        chargerTypes.push(mobieChargerType);
		chargerTypes.push(gireveChargerType);
        chargerTypes.push(hubjectChargerType);
    }
    if (foundStations.includes(StationsEnum.tesla)) {
        chargerTypes.push(teslaChargerType);
        if (isEmptyObject(dataPublic)) {
            dataPublic = queryCreation(filter);
        }
    }
    if (chargerTypes.length > 0) {
        dataPublic = dataPublic
            ? { $or: [{ chargerType: { $in: chargerTypes } }, dataPublic] }
            : { chargerType: { $in: chargerTypes } };
    }

    return dataPublic;
}

function getPrivateData(filter, foundStations, userId) {
    let data = {};
    if (foundStations.includes(StationsEnum.evio) || foundStations.includes(StationsEnum.tesla)) {
        data = queryCreation(filter);
    }
    if (foundStations.includes(StationsEnum.private)) {
        data = data ? { $or: [{ createUser: userId }, data] } : { createUser: userId };
    }
    return data;
}

function getType(foundStations) {
    let type = '';
    if (
        foundStations.includes(StationsEnum.private) &&
        !foundStations.includes(StationsEnum.public) &&
        !foundStations.includes(StationsEnum.evio) &&
        !foundStations.includes(StationsEnum.tesla)
    ) {
        type = StationsEnum.evio;
    } else if (foundStations.includes(StationsEnum.public)) {
        type = process.env.StationsPublic;
    } else if (foundStations.includes(StationsEnum.evio)) {
        type = StationsEnum.evio;
    } else if (foundStations.includes(StationsEnum.tesla)) {
        type = StationsEnum.tesla;
    }
    return type;
}
function verifyStations(filter, userId) {
    const context = 'Function verifyStations';
    try {
        let foundStations = getFoundStations(filter);

        let dataPublic = getPublicData(
            filter,
            foundStations
        );
        let data = getPrivateData(filter, foundStations, userId);
        let type = getType(foundStations);

        return {
            data: data,
            dataPublic: dataPublic,
            type: type,
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw new Error(error);
    }
}

function queryCreation(filter, nonZeroCoordinatesFilter = false) {
	const context = "Function queryCreation";
	try {
		let data = { plugs: {} };
		let plugs = { $elemMatch: {} };

		//put in the plugs object
		if (filter.availableStations.length != 0) {
			//verify if the status of plugs
			var temp;
			if (filter.availableStations.length === 1 && filter.availableStations[0] == "10") {
				temp = {
					//status: filter.availableStations
					status: { $ne: "50" },
				};
			} else {
				temp = {
					status: filter.availableStations,
				};
			}
			Object.assign(plugs.$elemMatch, temp);
			Object.assign(data, temp);
		}

		//verify if the power range for the plugs
		if (filter.powerRange != undefined) {
			let temp;
			if (filter.powerRange.max != -1 && filter.powerRange.min != -1) {
				temp = {
					$and: [
						{
							power: { $lte: filter.powerRange.max },
						},
						{
							power: { $gte: filter.powerRange.min },
						},
					],
				};
			} else if (filter.powerRange.max == -1 && filter.powerRange.min != -1) {
				temp = {
					$and: [
						{
							power: { $lte: filter.powerRange.min },
						},
					],
				};
			}
			Object.assign(plugs.$elemMatch, temp);
		}

		if (filter.connectorType.length != 0) {
			//verify if the connector type of the plugs
			var temp = { $or: [] };

			filter.connectorType.forEach((connector) => {
				temp.$or.push({ connectorType: { $regex: `${connector}`, $options: "i" } });
			});

			/*
            var temp = {
                // TODO: Query with insensitive case. We need standardize all enums in the future
                connectorType: { $regex: `${filter.connectorType}`, $options: 'i' }

            };
            */
			//console.log("temp", temp);
			Object.assign(plugs.$elemMatch, temp);
		}

		//put in the data object
		if (filter.rating != undefined) {
			if (filter.rating > 0) {
				var temp = {
					rating: {
						$gt: filter.rating - 0.25,
					},
				};
			} else {
				var temp = {
					rating: {
						$gte: filter.rating,
					},
				};
			}
			Object.assign(data, temp);
		}

		if (filter.parkingType.length != 0) {
			var temp = {
				parkingType: filter.parkingType,
			};
			Object.assign(data, temp);
		}

		if (filter.vehicles.length != 0) {
			var temp = {
				vehiclesType: {
					$elemMatch: {
						vehicle: filter.vehicles,
					},
				},
			};
			Object.assign(data, temp);
		}

		data.plugs = plugs;

		if (nonZeroCoordinatesFilter) return addNonZeroCoordinatesFilter(data);
		
		return data;
	} catch (error) {
		console.error(`[${context}] Error`, error.message);
		throw new Error(error);
	}
}

function addNonZeroCoordinatesFilter(data) {
	return Object.assign(data, { "geometry.coordinates": { $ne: [0,0] } });
}

function calculatePercentage(consumption, totalBatteryCapacityEV) {
	return round((consumption / totalBatteryCapacityEV) * 100);
}

function addAdditionalTariffInfo(tariff, offset, timeZone, countryCode) {
	tariff.offset = offset;
	tariff.timeZone = timeZone;
	tariff.countryCode = countryCode;
}

function updatePlugTariff(plug, tariff, tariffData) {
    plug.tariff = plug.tariff || [];
    let index = plug.tariff.findIndex(t => t._id === tariffData.tariff._id);
	if (index >= 0) {
        plug.tariff[index] = { ...plug.tariff[index], ...tariff };
    } else {
        plug.tariff.push(tariff);
    }
}

function sumTotal(array) {
	const context = "Function sumTotal";
	try {
		return array.reduce((accumulator, object) => round(accumulator + object.total), 0);
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return 0;
	}
}

function calculateTotals(totalPrice, total_energy, totalKmToUse, evEfficiencyPerKwhPerKm) {
	let totalBykWh = total_energy > 0 ? round(totalPrice / total_energy) : 0;
	let totalByKmh =
		total_energy > 0 ? round((totalPrice / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse) : 0;
	return {
		total: totalPrice,
		totalBykWh: totalBykWh,
		totalByKmh: totalByKmh,
	};
}
function calculateActivationFee(tariffCEME) {
	if (!tariffCEME.activationFee || tariffCEME.activationFee.value <= 0) {
		return Number(process.env.AD_HOC_Activation_Fee_Wallet);
	}
	return tariffCEME.activationFee.value;
}

function getTimezone(latitude, longitude) {
	const context = "Function getTimezone";
	let timeZone = "";
	try {
		if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
			timeZone = geoTimeZone.find(latitude, longitude)[0];
		}
		return timeZone;
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return timeZone;
	}
}

function isEmptyObject(obj) {
	for (var key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			return false;
		}
	}
	return true;
}

function getDimensionsObj(dimensions) {
	// These keys are all the possible dimension types provided in each charging period in OCPI 2.1.1
	let responseObj = {
		FLAT: 0,
		ENERGY: 0,
		TIME: 0,
		PARKING_TIME: 0,
		MIN_CURRENT: 0,
		MAX_CURRENT: 0,
	};
	for (let dimension of dimensions) {
		let dimensionType = dimension.type;
		let dimensionVolume = dimension.volume;
		responseObj[dimensionType] = dimensionVolume;
	}
	return responseObj;
}

function getTitle(entry, currency = "EUR") {
	const context = "Function getTitle";
	try {
		let title = {
			flat: [],
			time: [],
			energy: [],
			parking: [],
		};
		let restrictions = entry.restrictions ? JSON.parse(JSON.stringify(entry.restrictions)) : entry.restrictions;
		adjustRestrictions(restrictions);
		let isEmpty = isEmptyObject(restrictions);
		let price = entry.componentPrice;
		let step_size = entry.componentStepSize;
		if (entry.component.type == "ENERGY") {
			if (!isEmpty) {
				createRestrictionObjects(title, "energy", restrictions, price, step_size, "kWh", currency);
			} else {
				title["energy"].push({
					restrictionType: "defaultEnergy",
					values: [
						{
							restrictionValues: {},
							price,
							step: step_size,
							uom: "kWh",
							currency,
						},
					],
				});
			}
		} else if (entry.component.type == "TIME") {
			if (!isEmpty) {
				createRestrictionObjects(title, "time", restrictions, price, step_size, "min", currency);
			} else {
				title["time"].push({
					restrictionType: "defaultTime",
					values: [
						{
							restrictionValues: {},
							price,
							step: step_size,
							uom: entry.unit,
							currency,
						},
					],
				});
			}
		} else if (entry.component.type == "FLAT") {
			if (!isEmpty) {
				createRestrictionObjects(title, "flat", restrictions, price, step_size, "UN", currency);
			} else {
				title["flat"].push({
					restrictionType: "defaultFlat",
					values: [
						{
							restrictionValues: {},
							price: price,
							step: 1,
							uom: "UN",
							currency,
						},
					],
				});
			}
		} else if (entry.component.type == "PARKING_TIME") {
			if (!isEmpty) {
				createRestrictionObjects(title, "parking", restrictions, price, step_size, "min", currency);
			} else {
				title["parking"].push({
					restrictionType: "defaultParking",
					values: [
						{
							restrictionValues: {},
							price,
							step: step_size,
							uom: entry.unit,
							currency,
						},
					],
				});
			}
		}
		return title;
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return [];
	}
}

function createRestrictionObjects(detailedTariff, componentType, restrictions, price, step, uom, currency) {
	let context = "Function createRestrictionObjects";
	try {
		let restrictionObjArray = [];
		for (let restriction in restrictions) {
			if (
				restriction.includes("time") &&
				restrictions[restriction] !== null &&
				restrictions[restriction] !== undefined
			) {
				let equalLineIndex = restrictionObjArray.findIndex((obj) => obj.restrictionType == "time");
				if (equalLineIndex > -1) {
					restriction.includes("start")
						? (restrictionObjArray[equalLineIndex].restrictionValues["start"] = restrictions[restriction])
						: (restrictionObjArray[equalLineIndex].restrictionValues["end"] = restrictions[restriction]);
				} else {
					let obj = {
						restrictionType: "time",
						restrictionUom: "h",
						restrictionValues: {},
						price,
						step,
						uom,
						currency,
					};
					restriction.includes("start")
						? (obj.restrictionValues["start"] = restrictions[restriction])
						: (obj.restrictionValues["end"] = restrictions[restriction]);

					restrictionObjArray.push(obj);
				}
			} else if (
				restriction.includes("date") &&
				restrictions[restriction] !== null &&
				restrictions[restriction] !== undefined
			) {
				let equalLineIndex = restrictionObjArray.findIndex((obj) => obj.restrictionType == "date");
				if (equalLineIndex > -1) {
					restriction.includes("start")
						? (restrictionObjArray[equalLineIndex].restrictionValues["start"] = restrictions[restriction])
						: (restrictionObjArray[equalLineIndex].restrictionValues["end"] = restrictions[restriction]);
				} else {
					let obj = {
						restrictionType: "date",
						restrictionUom: "day",
						restrictionValues: {},
						price,
						step,
						uom,
						currency,
					};
					restriction.includes("start")
						? (obj.restrictionValues["start"] = restrictions[restriction])
						: (obj.restrictionValues["end"] = restrictions[restriction]);

					restrictionObjArray.push(obj);
				}
			} else if (
				restriction.includes("kwh") &&
				restrictions[restriction] !== null &&
				restrictions[restriction] !== undefined
			) {
				let equalLineIndex = restrictionObjArray.findIndex((obj) => obj.restrictionType == "kwh");
				if (equalLineIndex > -1) {
					restriction.includes("min")
						? (restrictionObjArray[equalLineIndex].restrictionValues["start"] = restrictions[restriction])
						: (restrictionObjArray[equalLineIndex].restrictionValues["end"] = restrictions[restriction]);
				} else {
					let obj = {
						restrictionType: "kwh",
						restrictionUom: "kWh",
						restrictionValues: {},
						price,
						step,
						uom,
						currency,
					};
					restriction.includes("min")
						? (obj.restrictionValues["start"] = restrictions[restriction])
						: (obj.restrictionValues["end"] = restrictions[restriction]);

					restrictionObjArray.push(obj);
				}
			} else if (
				restriction.includes("current") &&
				restrictions[restriction] !== null &&
				restrictions[restriction] !== undefined
			) {
				let equalLineIndex = restrictionObjArray.findIndex((obj) => obj.restrictionType == "current");
				if (equalLineIndex > -1) {
					restriction.includes("min")
						? (restrictionObjArray[equalLineIndex].restrictionValues["start"] = restrictions[restriction])
						: (restrictionObjArray[equalLineIndex].restrictionValues["end"] = restrictions[restriction]);
				} else {
					let obj = {
						restrictionType: "current",
						restrictionUom: "A",
						restrictionValues: {},
						price,
						step,
						uom,
						currency,
					};
					restriction.includes("min")
						? (obj.restrictionValues["start"] = restrictions[restriction])
						: (obj.restrictionValues["end"] = restrictions[restriction]);

					restrictionObjArray.push(obj);
				}
			} else if (
				restriction.includes("power") &&
				restrictions[restriction] !== null &&
				restrictions[restriction] !== undefined
			) {
				let equalLineIndex = restrictionObjArray.findIndex((obj) => obj.restrictionType == "power");
				if (equalLineIndex > -1) {
					restriction.includes("min")
						? (restrictionObjArray[equalLineIndex].restrictionValues["start"] = restrictions[restriction])
						: (restrictionObjArray[equalLineIndex].restrictionValues["end"] = restrictions[restriction]);
				} else {
					let obj = {
						restrictionType: "power",
						restrictionUom: "kW",
						restrictionValues: {},
						price,
						step,
						uom,
						currency,
					};
					restriction.includes("min")
						? (obj.restrictionValues["start"] = restrictions[restriction])
						: (obj.restrictionValues["end"] = restrictions[restriction]);

					restrictionObjArray.push(obj);
				}
			} else if (
				restriction.includes("duration") &&
				restrictions[restriction] !== null &&
				restrictions[restriction] !== undefined
			) {
				let equalLineIndex = restrictionObjArray.findIndex((obj) => obj.restrictionType == "duration");
				if (equalLineIndex > -1) {
					restriction.includes("min")
						? (restrictionObjArray[equalLineIndex].restrictionValues["start"] = restrictions[restriction])
						: (restrictionObjArray[equalLineIndex].restrictionValues["end"] = restrictions[restriction]);
				} else {
					let obj = {
						restrictionType: "duration",
						restrictionUom: "s",
						restrictionValues: {},
						price,
						step,
						uom,
						currency,
					};
					restriction.includes("min")
						? (obj.restrictionValues["start"] = restrictions[restriction])
						: (obj.restrictionValues["end"] = restrictions[restriction]);

					restrictionObjArray.push(obj);
				}
			} else if (
				restriction.includes("day_of_week") &&
				restrictions[restriction] !== null &&
				restrictions[restriction] !== undefined
			) {
				restrictions[restriction].forEach((dayOfWeek) =>
					restrictionObjArray.push({
						restrictionType: "day",
						restrictionUom: "day",
						restrictionValues: {
							start: dayOfWeek,
							end: dayOfWeek,
						},
						price,
						step,
						uom,
						currency,
					})
				);
			}
		}

		restrictionObjArray.forEach((obj) => {
			let equalRestrictionIndex = detailedTariff[componentType].findIndex(
				(restr) => restr.restrictionType == obj.restrictionType
			);
			if (equalRestrictionIndex > -1) {
				detailedTariff[componentType][equalRestrictionIndex].values.push({
					restrictionUom: obj.restrictionUom,
					restrictionValues: obj.restrictionValues,
					price: obj.price,
					step: obj.step,
					uom: obj.uom,
					currency: obj.currency,
				});
			} else {
				detailedTariff[componentType].push({
					restrictionType: obj.restrictionType,
					values: [
						{
							restrictionUom: obj.restrictionUom,
							restrictionValues: obj.restrictionValues,
							price: obj.price,
							step: obj.step,
							uom: obj.uom,
							currency: obj.currency,
						},
					],
				});
			}
		});
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
	}
}

function defaultTitle(label) {
	return [
		{
			restrictionType: `session_simulator_${label}`,
			values: [
				{
					restrictionValues: {},
				},
			],
		},
	];
}

function removeUnnecessaryDateRestriction(array) {
	const context = "Function removeUnnecessaryDateRestriction";
	try {
		// console.log("array" , JSON.stringify(array))
		// console.log()
		const foundTime = array.find((element) => element.restrictionType === "time");
		const foundDate = array.find((element) => element.restrictionType === "date");
		const foundDay = array.find((element) => element.restrictionType === "day");
		if ((foundTime || foundDay) && foundDate) {
			let remove = array
				.filter((element) => element.restrictionType === "date")
				.every((element) =>
					isOneDay(element.values[0].restrictionValues.start, element.values[0].restrictionValues.end)
				);
			return remove ? array.filter((element) => element.restrictionType !== "date") : array;
		} else {
			return array;
		}
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return array;
	}
}
function isOneDay(start, end) {
	try {
		if (!start || !end) return false
	        let startDate = moment(start).startOf('day');
	        let endDate = moment(end).startOf('day');
	        return startDate.add(1, 'days').isSame(endDate);
		
	} catch (error) {
		console.error(`Error in isOneDay function: `, error.message);
		return false;
	}
}
function getCEMEEVIO(clientName) {
	const context = "Function getCEMEEVIO";
	return new Promise(async (resolve, reject) => {
		try {
			let proxy = process.env.HostPublicTariffs + process.env.PathGetTariffs;

			let params;

			switch (clientName) {
				case process.env.WhiteLabelGoCharge:
					params = {
						planName: "server_plan_EVIO_ad_hoc_goCharge",
					};
					break;
				case process.env.WhiteLabelHyundai:
					params = {
						planName: "server_plan_EVIO_ad_hoc_hyundai",
					};
					break;
				case process.env.WhiteLabelKLC:
					params = {
						planName: "server_plan_EVIO_ad_hoc_klc",
					};
					break;
				case process.env.WhiteLabelKinto:
					params = {
						planName: "server_plan_EVIO_ad_hoc_kinto",
					};
					break;
				default:
					params = {
						planName: "server_plan_EVIO_ad_hoc",
					};
					break;
			}

			axios
				.get(proxy, { params })
				.then((result) => {
					if (result.data) resolve(result.data);
					else resolve({});
				})
				.catch((error) => {
					console.error(`[${context}] [${proxy}] Error `, error.message);
					//reject(error);
					resolve({});
				});
		} catch (error) {
			console.error(`[${context}] Error `, error.message);
			//reject(error);
			resolve({});
		}
	});
}
function getUnroundedValue(emspEntries) {
    try {
        let cleanEmspEntries = emspEntries.filter((emsp, index, self) =>
            emsp.quantity > 0 && index === self.findIndex(t => (t.label === emsp.label && t.unitPrice === emsp.unitPrice))
        );

        return cleanEmspEntries.reduce((accumulator, object) => accumulator + (object.unitPrice * object.quantity), 0);
    } catch (error) {
        console.error(`[Function getUnroundedValue] Error `, error.message);
        return 0;
    }
}

function adjustRestrictions(restrictions) {
	const context = "Function adjustRestrictions";
	try {
		if (restrictions) {
			delete restrictions._id;
			if (restrictions["day_of_week"] && restrictions["day_of_week"].length === 0) {
				delete restrictions["day_of_week"];
			}
		}
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
	}
}

module.exports = {
	round,
	calculatePowerValue,
	calculateTimeValue,
	getChargerOffset,
	calcTotalCost,
	queryCreation,
	verifyStations,
	calculatePercentage,
	addAdditionalTariffInfo,
	updatePlugTariff,
	getTimezone,
	getCEMEEVIO,
	isEmptyObject,
	getDimensionsObj,
	sumTotal,
	defaultTitle,
	getUnroundedValue,
	getTitle,
	adjustRestrictions,
	removeUnnecessaryDateRestriction,
	getFoundStations,
	getPublicData,
	getPrivateData,
	getType,
};
