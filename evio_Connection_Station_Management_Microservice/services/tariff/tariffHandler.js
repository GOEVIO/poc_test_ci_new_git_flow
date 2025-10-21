const moment = require("moment");
const { getDimensionsObj, isEmptyObject, round, sumTotal } = require("../../utils/utils");
const Constants  = require("../../utils/constants");
const {
	adjustRestrictions,
	obeysRestrictions,
	roundingsValidation,
	roundingGranularityRules,
	tariffIsValid,
} = require("./tariffValidations");

const { getEnergyPrice, getTimePrice, calculateOpcPrice } = require("./tariffPricing");
const { getCEMEandTar } = require("../../caching/tariffs");
const { getTariffCemeByDate, calculateCemeAndTar, pushCemeAndTarInfo } = require("./tariffCEMEAndTARHandler");

function opcTariffsPrices(
	charging_periods,
	elements,
	sessionStartDate,
	sessionStopDate,
	offset,
	power,
	voltage,
	total_energy,
	total_charging_time,
	total_parking_time,
	source
) {
	
	let FLAT_OPC_PRICE = 0;
	let TIME_OPC_PRICE = 0;
	let ENERGY_OPC_PRICE = 0;
	let PARKING_TIME_OPC_PRICE = 0;

	let timeChargingPeriods = [];
	let energyChargingPeriods = [];
	let parkingTimeChargingPeriods = [];
	let flatChargingPeriods = [];

	if (
		charging_periods !== null &&
		typeof charging_periods !== "undefined" &&
		elements !== null &&
		typeof elements !== "undefined"
	) {
		let consumedPower_kWh = 0;
		charging_periods.forEach((period, index) => {
			let periodStartDate = period.start_date_time;
			let periodEndDate =
				index == charging_periods.length - 1 ? sessionStopDate : charging_periods[index + 1].start_date_time;

			let localPeriodStartDate = moment.utc(periodStartDate).add(offset, "minutes").format();
			let localPeriodEndDate = moment.utc(periodEndDate).add(offset, "minutes").format();

			let dimensionsObj = getDimensionsObj(period.dimensions);
			consumedPower_kWh += dimensionsObj["ENERGY"];

			let [flat, energy, time, parking] = getOpcPricesByChargingPeriod(
				elements,
				dimensionsObj,
				sessionStartDate,
				localPeriodStartDate,
				localPeriodEndDate,
				power,
				voltage,
				total_charging_time,
				total_parking_time,
				consumedPower_kWh,
				FLAT_OPC_PRICE,
				TIME_OPC_PRICE,
				ENERGY_OPC_PRICE,
				PARKING_TIME_OPC_PRICE,
				source
			);

			console.log(
				"Charging period:",
				index,
				"Flat:",
				flat,
				"Energy:",
				energy,
				"Time:",
				time,
				"Parking:",
				parking
			);

			FLAT_OPC_PRICE = flat.price;
			TIME_OPC_PRICE = time.price;
			ENERGY_OPC_PRICE = energy.price;
			PARKING_TIME_OPC_PRICE = parking.price;

			timeChargingPeriods.push(time.info);
			energyChargingPeriods.push(energy.info);
			parkingTimeChargingPeriods.push(parking.info);
		});
	} else if (elements !== null && typeof elements !== "undefined") {
		let localSessionStartDate = moment.utc(sessionStartDate).add(offset, "minutes").format();
		let totalChargingSessionTime = total_charging_time + total_parking_time;
		let localSessionEndDate = moment.utc(localSessionStartDate).add(totalChargingSessionTime, "hours").format();

		let [flat, energy, time, parking] = opcFinalPrices(
			elements,
			localSessionStartDate,
			localSessionEndDate,
			total_energy,
			power,
			total_charging_time,
			total_parking_time,
			source
		);

		FLAT_OPC_PRICE = flat.price;
		TIME_OPC_PRICE = time.price;
		ENERGY_OPC_PRICE = energy.price;
		PARKING_TIME_OPC_PRICE = parking.price;

		flatChargingPeriods = flat.info;
		timeChargingPeriods = time.info;
		energyChargingPeriods = energy.info;
		parkingTimeChargingPeriods = parking.info;
	} else {
		FLAT_OPC_PRICE = 0;
		TIME_OPC_PRICE = 0;
		ENERGY_OPC_PRICE = 0;
		PARKING_TIME_OPC_PRICE = 0;
	}

	return [
		{ price: FLAT_OPC_PRICE, info: flatChargingPeriods },
		{ price: ENERGY_OPC_PRICE, info: energyChargingPeriods },
		{ price: TIME_OPC_PRICE, info: timeChargingPeriods },
		{ price: PARKING_TIME_OPC_PRICE, info: parkingTimeChargingPeriods },
	];
}

function getOpcPricesByChargingPeriod(
	elements,
	dimensionsObj,
	sessionStartDate,
	startDate,
	endDate,
	power,
	voltage,
	total_charging_time,
	total_parking_time,
	consumedPower,
	FLAT_OPC_PRICE,
	TIME_OPC_PRICE,
	ENERGY_OPC_PRICE,
	PARKING_TIME_OPC_PRICE,
	source
) {
	/* 
		When the list of Tariff Elements contains more than one Element with the same Tariff Dimension (ENERGY/FLAT/TIME etc.), then,
		the first Tariff Element with that Dimension in the list with matching Tariff Restrictions will be used. Only one Tariff per Element type
		can be active at any point in time, but multiple Tariff Types can be active at once. IE you can have an ENERGY element and TIME
		element active at the same time, but only the first valid element of each.

		That being said, we use booleans to control wich tariffs have already matched the restrictions
	*/
	let tariffFlat = false;
	let tariffEnergy = false;
	let tariffTime = false;
	let tariffParkingTime = false;

	let tariffEnergyObj = {};
	let tariffTimeObj = {};
	let tariffParkingTimeObj = {};
	for (let tariffElement of elements) {
		let restrictions = tariffElement.restrictions;
		// A tariff it's only valid if it obeys all restrictions
		adjustRestrictions(restrictions);
		let isEmpty = isEmptyObject(restrictions);
		for (let component of tariffElement.price_components) {
			let obeys = !isEmpty
				? obeysRestrictions(
						restrictions,
						component,
						dimensionsObj,
						sessionStartDate,
						startDate,
						endDate,
						consumedPower,
						power,
						voltage,
						total_charging_time,
						total_parking_time
				  )
				: true;
			component.step_size =
				component.step_size !== null && component.step_size !== undefined ? component.step_size : 1;
			let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } =
				roundingsValidation(component);
			if (source === Constants.networks.gireve.name || source === Constants.networks.hubject.name) {
				component.price = roundingGranularityRules(priceRoundGranularity, priceRoundRule, component.price);
				component.step_size = roundingGranularityRules(
					stepRoundGranularity,
					stepRoundRule,
					component.step_size
				);
			}
			if (obeys) {
				if (component.type === "FLAT" && !tariffFlat) {
					FLAT_OPC_PRICE += dimensionsObj[component.type];
					tariffFlat = true;
				} else if (component.type === "ENERGY" && !tariffEnergy) {
					ENERGY_OPC_PRICE += getEnergyPrice(
						dimensionsObj[component.type],
						component.price,
						component.step_size
					);
					tariffEnergyObj = {
						quantity: dimensionsObj[component.type],
						cost: getEnergyPrice(dimensionsObj[component.type], component.price, component.step_size),
						component,
						restrictions: !isEmpty ? restrictions : {},
					};
					tariffEnergy = true;
				} else if (component.type === "TIME" && !tariffTime) {
					TIME_OPC_PRICE += getTimePrice(
						dimensionsObj[component.type],
						component.price,
						component.step_size,
						source
					);
					tariffTimeObj = {
						quantity: dimensionsObj[component.type],
						cost: getTimePrice(dimensionsObj[component.type], component.price, component.step_size, source),
						component,
						restrictions: !isEmpty ? restrictions : {},
					};
					tariffTime = true;
				} else if (component.type === "PARKING_TIME" && !tariffParkingTime) {
					PARKING_TIME_OPC_PRICE += getTimePrice(
						dimensionsObj[component.type],
						component.price,
						component.step_size,
						source
					);
					tariffParkingTimeObj = {
						quantity: dimensionsObj[component.type],
						cost: getTimePrice(dimensionsObj[component.type], component.price, component.step_size, source),
						component,
						restrictions: !isEmpty ? restrictions : {},
					};
					tariffParkingTime = true;
				}
			}
		}
	}
	return [
		{ price: FLAT_OPC_PRICE, info: {} },
		{ price: ENERGY_OPC_PRICE, info: tariffEnergyObj },
		{ price: TIME_OPC_PRICE, info: tariffTimeObj },
		{ price: PARKING_TIME_OPC_PRICE, info: tariffParkingTimeObj },
	];
}

function opcFinalPrices(
	tariffElements,
	startDate,
	endDate,
	consumedPower,
	plugPower,
	total_charging_time,
	total_parking_time,
	source
) {
	/* 
		This function loops all available tariffs, checks if they can apply to the corresponding charging session, and then, divide the charging session
		in charging periods with the different relevant dimensions.
	*/
	let chargingPeriodsObj = {
		FLAT: [],
		ENERGY: [],
		TIME: [],
		PARKING_TIME: [],
	};

	let consumedPower_s = total_charging_time > 0 ? round(consumedPower / round(total_charging_time * 3600, 6), 6) : 0;

	// Append all valid tariffs to an array with its corresponding dimension types, valid periods in time and consumed energy in that period
	for (let element of tariffElements) {
		let restrictions = element.restrictions;
		let priceComponents = element.price_components;
		adjustRestrictions(restrictions);
		let isEmpty = isEmptyObject(restrictions);

		let tariffObj;
		if (!isEmpty) {
			tariffObj = tariffIsValid(
				restrictions,
				priceComponents,
				startDate,
				endDate,
				total_charging_time,
				total_parking_time,
				consumedPower,
				plugPower
			);
		} else {
			tariffObj = {};
			priceComponents.forEach((component) => {
				// tariffObj[component.type] = {
				//     isValid : true ,
				//     periodConsumedPower : consumedPower , // kWh
				//     periodConsumedTime : total_charging_time*3600, // s
				//     periodConsumedParkingTime : total_parking_time*3600, // s
				//     chargingPeriods : [Date.parse(startDate) , Date.parse(endDate)], // ms
				//     component : component,
				//     restrictions : {},
				// }
				if (component.type === "PARKING_TIME") {
					tariffObj[component.type] = {
						isValid: true,
						periodConsumedPower: 0, // kWh
						periodConsumedTime: 0, // s
						periodConsumedParkingTime: total_parking_time * 3600, // s
						chargingPeriods: [
							Date.parse(startDate) + round(total_charging_time * 3600 * 1000, 0),
							Date.parse(endDate),
						], // ms
						component: component,
						restrictions: {},
					};
				} else {
					tariffObj[component.type] = {
						isValid: true,
						periodConsumedPower: 0, // kWh
						periodConsumedTime: total_charging_time * 3600, // s
						periodConsumedParkingTime: 0, // s
						chargingPeriods: [
							Date.parse(startDate),
							Date.parse(startDate) + round(total_charging_time * 3600 * 1000, 0),
						], // ms
						component: component,
						restrictions: {},
					};
				}
			});
		}
		chargingPeriodsObj = pushTariffsToChargingPeriods(tariffObj, chargingPeriodsObj);
	}
	/* 
		TODO: See how step_size should affect price calculation
	*/

	// OPC PRICE FLAT
	let [OCP_PRICE_FLAT, flatInfo] = calculateOpcPrice("FLAT", chargingPeriodsObj, consumedPower_s, source);

	// OPC PRICE ENERGY
	let [OCP_PRICE_ENERGY, energyInfo] = calculateOpcPrice("ENERGY", chargingPeriodsObj, consumedPower_s, source);

	// OPC PRICE TIME
	let [OCP_PRICE_TIME, timeInfo] = calculateOpcPrice("TIME", chargingPeriodsObj, consumedPower_s, source);

	// OPC PRICE PARKING_TIME
	let [OCP_PRICE_PARKING_TIME, parkingTimeInfo] = calculateOpcPrice(
		"PARKING_TIME",
		chargingPeriodsObj,
		consumedPower_s,
		source
	);

	return [
		{ price: OCP_PRICE_FLAT, info: flatInfo },
		{ price: OCP_PRICE_ENERGY, info: energyInfo },
		{ price: OCP_PRICE_TIME, info: timeInfo },
		{ price: OCP_PRICE_PARKING_TIME, info: parkingTimeInfo },
	];
}

function pushTariffsToChargingPeriods(tariffObj, chargingPeriodsObj) {
	Object.entries(tariffObj).forEach(([tariffType, tariff]) => {
		if (!tariff.isValid) return;

		let chargingPeriods = chargingPeriodsObj[tariffType];
		if (chargingPeriods.length === 0) {
			chargingPeriods.push(createPeriod(tariff));
			return;
		}

		let pushPeriods = getPushPeriods(tariff.chargingPeriods, chargingPeriods);
		pushPeriods.forEach((period) => {
			chargingPeriods.push(createPeriod(tariff, period));
		});
	});

	return chargingPeriodsObj;
}

function createPeriod(tariff, period = null) {
    let {
        periodConsumedTime,
        periodConsumedParkingTime,
        periodConsumedPower,
        chargingPeriods,
        component,
        restrictions,
    } = tariff;

    if (period && period.length >= 2) {
        let periodDuration = (period[1] - period[0]) / 1000;
        periodConsumedTime = Math.min(periodDuration, periodConsumedTime);
        periodConsumedParkingTime = Math.min(periodDuration, periodConsumedParkingTime);
    }

    return {
        periodConsumedPower,
        periodConsumedTime,
        periodConsumedParkingTime,
        tariffChargingPeriod: period || chargingPeriods,
        component,
        restrictions,
    };
}

function getPushPeriods(tariffChargingPeriod, chargingPeriods) {
	let pushPeriods = [tariffChargingPeriod];

	chargingPeriods.forEach((period) => {
		const priorityPeriod = period.tariffChargingPeriod;

		pushPeriods = pushPeriods.flatMap((pushPeriod) => determineNewPeriods(pushPeriod, priorityPeriod));
	});

	return pushPeriods;
}
function determineNewPeriods(pushPeriod, priorityPeriod) {
	if (pushPeriod[0] < priorityPeriod[0] && pushPeriod[1] > priorityPeriod[1]) {
		return [
			[pushPeriod[0], priorityPeriod[0]],
			[priorityPeriod[1], pushPeriod[1]],
		];
	} else if (pushPeriod[0] < priorityPeriod[0] && pushPeriod[1] >= priorityPeriod[0]) {
		return [[pushPeriod[0], priorityPeriod[0]]];
	} else if (pushPeriod[0] <= priorityPeriod[1] && pushPeriod[1] > priorityPeriod[1]) {
		return [[priorityPeriod[1], pushPeriod[1]]];
	} else if (pushPeriod[0] >= priorityPeriod[0] && pushPeriod[1] <= priorityPeriod[1]) {
		return [];
	} else {
		return [pushPeriod];
	}
}

function adjustCpoEnergyArray(info, totalEnergy) {
	const context = "Function adjustCpoEnergyArray";
	try {
		let totalCalculatedEnergy = 0;
		let roundedQuantitiesArray = info.map((element) => {
			let quantity = round(element.quantity, 0);
			totalCalculatedEnergy += quantity;
			let totalPrice = getEnergyPrice(quantity, element.componentPrice, element.componentStepSize);
			return {
				...element,
				quantity,
				totalPrice: round(totalPrice, 2),
			};
		});
		let withoutRestrinctionIndex = roundedQuantitiesArray.findIndex((element) => {
			let restrictions = element.restrictions
				? JSON.parse(JSON.stringify(element.restrictions))
				: element.restrictions;
			adjustRestrictions(restrictions);
			return isEmptyObject(restrictions);
		});
		if (Math.abs(totalEnergy - totalCalculatedEnergy) <= roundedQuantitiesArray.length) {
			if (withoutRestrinctionIndex > -1) {
				roundedQuantitiesArray[withoutRestrinctionIndex].quantity += totalEnergy - totalCalculatedEnergy;
			} else {
				let withoutMaxRestrictions = roundedQuantitiesArray.findIndex(
					(element) =>
						(element.restrictions.max_duration === null ||
							element.restrictions.max_duration === undefined) &&
						(element.restrictions.max_kwh === null || element.restrictions.max_kwh === undefined)
				);
				if (withoutMaxRestrictions > -1) {
					roundedQuantitiesArray[withoutMaxRestrictions].quantity += totalEnergy - totalCalculatedEnergy;
				} else {
					if (roundedQuantitiesArray.length > 0) {
						roundedQuantitiesArray[0].quantity += totalEnergy - totalCalculatedEnergy;
					}
				}
			}
		}
		return roundedQuantitiesArray.map((element) => {
			let quantity = round(element.quantity, 0);
			let totalPrice = getEnergyPrice(quantity, element.componentPrice, element.componentStepSize);
			return {
				...element,
				quantity,
				totalPrice: round(totalPrice, 2),
			};
		});
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		[];
	}
}

function adjustCpoTimeArray(info, totalTime) {
	const context = "Function adjustTimeEnergyArray";
	try {
		let totalCalculatedTime = 0;
		let roundedQuantitiesArray = info.map((element) => {
			let quantity = round(element.quantity, 0);
			totalCalculatedTime += quantity;
			let totalPrice = getTimePrice(
				quantity / 3600,
				element.componentPrice,
				element.componentStepSize,
				element.source
			);
			return {
				...element,
				quantity,
				totalPrice: round(totalPrice, 2),
			};
		});
		let withoutRestrinctionIndex = roundedQuantitiesArray.findIndex((element) => {
			let restrictions = element.restrictions
				? JSON.parse(JSON.stringify(element.restrictions))
				: element.restrictions;
			adjustRestrictions(restrictions);
			return isEmptyObject(restrictions);
		});
		if (Math.abs(totalTime - totalCalculatedTime) <= roundedQuantitiesArray.length) {
			if (withoutRestrinctionIndex > -1) {
				roundedQuantitiesArray[withoutRestrinctionIndex].quantity += totalTime - totalCalculatedTime;
			} else {
				let withoutMaxRestrictions = roundedQuantitiesArray.findIndex(
					(element) =>
						(element.restrictions.max_duration === null ||
							element.restrictions.max_duration === undefined) &&
						(element.restrictions.max_kwh === null || element.restrictions.max_kwh === undefined)
				);
				if (withoutMaxRestrictions > -1) {
					roundedQuantitiesArray[withoutMaxRestrictions].quantity += totalTime - totalCalculatedTime;
				} else {
					if (roundedQuantitiesArray.length > 0) {
						roundedQuantitiesArray[0].quantity += totalTime - totalCalculatedTime;
					}
				}
			}
		}
		return roundedQuantitiesArray.map((element) => {
			let quantity = round(element.quantity, 0);
			let totalPrice = getTimePrice(
				quantity / 3600,
				element.componentPrice,
				element.componentStepSize,
				element.source
			);
			return {
				...element,
				componentPrice:
					element.source === Constants.networks.gireve.name|| element.source === Constants.networks.hubject.name
						? round(element.componentPrice / 60, 4)
						: element.componentPrice,
				quantity,
				totalPrice: round(totalPrice, 2),
			};
		});
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		[];
	}
}

async function getAcpDifference(
	originalCEME,
	originalEmspEntries,
	timeZone,
	source,
	offset,
	sessionStartDate,
	sessionStopDate,
	total_charging_time,
	total_energy,
	voltageLevel,
	fees,
	totalPriceCpo,
	total_incl_vat
) {
	const context = "Function getAcpDifference";
	try {
		let oldPlanName = originalCEME.planName;
		let isPartner = oldPlanName === process.env.acpPartnerPlanName;

		let tariffCEME, tariffTAR, TAR_Schedule;

		if (isPartner) {
			({ tariffCEME, tariffTAR, TAR_Schedule } = await getCEMEandTar(null, timeZone, source, "EVIO_ad_hoc_acp"));
		} else {
			({ tariffCEME, tariffTAR, TAR_Schedule } = await getCEMEandTar(
				null,
				timeZone,
				source,
				"EVIO_ad_hoc_acp_discount"
			));
		}

		let localSessionStartDate = moment.utc(sessionStartDate).add(offset, "minutes").format();
		let localSessionStopDate = moment.utc(sessionStopDate).add(offset, "minutes").format();

		let tariffArray = getTariffCemeByDate(tariffCEME, localSessionStartDate);
		tariffCEME.tariff = tariffArray;

		let { ceme } = calculateCemeAndTar(
			TAR_Schedule,
			tariffCEME,
			tariffTAR,
			total_charging_time,
			total_energy,
			localSessionStartDate,
			localSessionStopDate,
			voltageLevel
		);

		let emspEntries = [];
		ceme.info = adjustCemeTarEnergyArray(ceme.info, total_energy);
		pushCemeAndTarInfo(emspEntries, ceme.info, "ceme", "energy");

		let emspToChange = JSON.parse(JSON.stringify(originalEmspEntries));
		emspToChange = emspToChange.filter((elem) => elem.label !== "ceme");
		emspToChange = [...emspToChange, ...emspEntries];

		let groupEnergyTotal = sumTotal(emspToChange.filter((elem) => elem.group === "energy"));
		let groupEnergyUnitPrice = total_energy > 0 ? round(groupEnergyTotal / total_energy, 2) : 0;
		let energyEntry = {
			label: "cemeTarIec",
			unit: "kWh",
			unitPrice: groupEnergyUnitPrice,
			quantity: total_energy,
			total: groupEnergyTotal,
			title: defaultTitle("cemeTarIec"),
			collapsable: true,
			collapseGroup: "energy",
		};


		let cemeTarIecIndex = emspToChange.findIndex((elem) => elem.label === "cemeTarIec");



		emspToChange[cemeTarIecIndex] = energyEntry;


		let final = getFinalValues(totalPriceCpo, { entries: emspToChange }, fees);
		let difference = round(Math.abs(total_incl_vat - final.total_incl_vat));

		return {
			label: isPartner ? "acpDifference_Partner" : "acpDifference_NotPartner",
			difference,
		};
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return undefined;
	}
}
function getFinalValues(totalPriceCpo, emsp, fees) {
	const context = "Function getFinalValues";
	try {
		let opcPrice = round(totalPriceCpo);
		let totalCemePrice = sumTotal(
			emsp.entries.filter((elem) => elem.label === "ceme" || elem.label === "activationFeeWithDiscount")
		);
		let cemePrice = round(totalCemePrice);
		let totalTarPrice = sumTotal(emsp.entries.filter((elem) => elem.label === "tar"));
		let tarPrice = round(totalTarPrice);
		let totalIecPrice = sumTotal(emsp.entries.filter((elem) => elem.label === "iec"));
		let iecPrice = round(totalIecPrice);
		let total_exc_vat = round(opcPrice + cemePrice + tarPrice + iecPrice);
		let vatPrice = round(total_exc_vat * fees.IVA);
		let feesPrice = round(tarPrice + iecPrice + vatPrice);
		let total_incl_vat = round(total_exc_vat + vatPrice);

		return {
			opcPrice,
			totalCemePrice,
			cemePrice,
			totalTarPrice,
			tarPrice,
			totalIecPrice,
			iecPrice,
			total_exc_vat,
			vatPrice,
			feesPrice,
			total_incl_vat,
		};
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return {
			opcPrice: 0,
			totalCemePrice: 0,
			cemePrice: 0,
			totalTarPrice: 0,
			tarPrice: 0,
			totalIecPrice: 0,
			iecPrice: 0,
			total_exc_vat: 0,
			vatPrice: 0,
			feesPrice: 0,
			total_incl_vat: 0,
		};
	}
}

module.exports = {
	opcTariffsPrices,
	adjustCpoEnergyArray,
	adjustCpoTimeArray,
	getAcpDifference,
	getFinalValues,
};
