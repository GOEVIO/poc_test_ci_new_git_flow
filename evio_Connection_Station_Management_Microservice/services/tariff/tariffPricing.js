
const { round } = require("../../utils/utils");
const { roundingGranularityRules, roundingsValidation } = require("./tariffValidations");
const Constants = require("../../utils/constants");
function getEnergyPrice(chargingEnergy, unitEnergyPrice, step_size) {
	/* 
		ACCORDING TO OCPI DOCUMENTATION:

		chargingEnergy(total_energy) comes in kWh 
		unitEnergyPrice comes in €/kWh 
		step_size comes in Wh 
		
	*/

	let step_size_kWh = round(step_size / 1000, 6);

	//TODO: Due to roundings along the calculations, I had to round it again when we have relevant step_size. We should keep an eye on this.
	if (step_size_kWh >= 0.002) {
		chargingEnergy = round(chargingEnergy, 2);
	}

	return Math.ceil(chargingEnergy / step_size_kWh) * unitEnergyPrice * step_size_kWh;
}

function getTimePrice(chargingTime, unitTimePrice, step_size, source) {
	/* 
		ACCORDING TO OCPI DOCUMENTATION:

		chargingTime(total_time) comes in hours 
		unitTimePrice comes in €/h 
		step_size comes in seconds 

	*/
	let chargingTimeMinutes = chargingTime * 60;
	// let unitTimePriceMinutes = unitTimePrice / 60
	//TODO I'll change the unitPrice to €/min to be consistent with MobiE
	let unitTimePriceMinutes = unitTimePrice;
	if (source === Constants.networks.gireve.name || source === Constants.networks.hubject.name) {
		unitTimePriceMinutes = unitTimePrice / 60;
	}

	let step_size_minutes = round(step_size / 60, 6);

	//TODO: Due to roundings along the calculations, I had to round it again when we have relevant step_size. We should keep an eye on this.
	if (step_size_minutes >= 0.03) {
		chargingTimeMinutes = round(chargingTimeMinutes, 2);
	}

	return Math.ceil(chargingTimeMinutes / step_size_minutes) * unitTimePriceMinutes * step_size_minutes;
}


function calculateOpcPrice(type, chargingPeriodsObj, consumedPower_s, source) {
	let dimensionArray = chargingPeriodsObj[type];
	let price = 0;
	let chargingPeriodsInfo = [];
	if (dimensionArray.length > 0) {
		if (type === "FLAT") {
			// price = dimensionArray[0].component.price
			dimensionArray.forEach((element) => {
				price += element.component.price;
				chargingPeriodsInfo.push({
					quantity: 1,
					unit: "UN",
					cost: element.component.price,
					componentPrice: element.component.price,
					componentStepSize: element.component.step_size,
					component: element.component,
					restrictions: element.restrictions,
					source,
				});
			});
		} else if (type === "ENERGY") {
			dimensionArray.forEach((element) => {
				element.component.step_size =
					element.component.step_size !== null && element.component.step_size !== undefined
						? element.component.step_size
						: 1;
				let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } =
					roundingsValidation(element.component);
				if (source === Constants.networks.gireve.name || source === Constants.networks.hubject.name) {
					element.component.price = roundingGranularityRules(
						priceRoundGranularity,
						priceRoundRule,
						element.component.price
					);
					element.component.step_size = roundingGranularityRules(
						stepRoundGranularity,
						stepRoundRule,
						element.component.step_size
					);
				}
				if (element.periodConsumedPower !== 0) {
					//TODO : I was rounding 6 digits and not 2. Due to step size I needed to reduce this value. Can't remember why it was used 6 in the first place.
					price += getEnergyPrice(
						round(element.periodConsumedPower, 6),
						element.component.price,
						element.component.step_size
					);
					chargingPeriodsInfo.push({
						quantity: round(element.periodConsumedPower , 6),
						unit : "kWh",
						cost: getEnergyPrice(round(element.periodConsumedPower , 6), element.component.price, element.component.step_size),
						componentPrice : element.component.price,
						componentStepSize : element.component.step_size,
						component: element.component,
						restrictions: element.restrictions,
						source,
					});
				} else {
					let periodConsumedPower = round(
						(consumedPower_s * (element.tariffChargingPeriod[1] - element.tariffChargingPeriod[0])) / 1000,
						6
					);
					price += getEnergyPrice(periodConsumedPower, element.component.price, element.component.step_size);
					chargingPeriodsInfo.push({
						quantity: periodConsumedPower,
						unit: "kWh",
						cost: getEnergyPrice(periodConsumedPower, element.component.price, element.component.step_size),
						componentPrice: element.component.price,
						componentStepSize: element.component.step_size,
						component: element.component,
						restrictions: element.restrictions,
						source,
					});
				}
			});
		} else if (type === "TIME") {
			dimensionArray.forEach((element) => {
				element.component.step_size =
					element.component.step_size !== null && element.component.step_size !== undefined
						? element.component.step_size
						: 1;
				let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } =
					roundingsValidation(element.component);
				if (source === Constants.networks.gireve.name || source === Constants.networks.hubject.name) {
					element.component.price = roundingGranularityRules(
						priceRoundGranularity,
						priceRoundRule,
						element.component.price
					);
					element.component.step_size = roundingGranularityRules(
						stepRoundGranularity,
						stepRoundRule,
						element.component.step_size
					);
				}
				price += getTimePrice(
					element.periodConsumedTime / 3600,
					element.component.price,
					element.component.step_size,
					source
				);
				chargingPeriodsInfo.push({
					quantity: element.periodConsumedTime,
					unit: "s",
					cost: getTimePrice(
						element.periodConsumedTime / 3600,
						element.component.price,
						element.component.step_size,
						source
					),
					componentPrice: element.component.price,
					componentStepSize: element.component.step_size,
					component: element.component,
					restrictions: element.restrictions,
					source,
				});
			});
		} else if (type === "PARKING_TIME") {
			dimensionArray.forEach((element) => {
				element.component.step_size =
					element.component.step_size !== null && element.component.step_size !== undefined
						? element.component.step_size
						: 1;
				let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } =
					roundingsValidation(element.component);
				if (source === Constants.networks.gireve.name || source === Constants.networks.hubject.name) {
					element.component.price = roundingGranularityRules(
						priceRoundGranularity,
						priceRoundRule,
						element.component.price
					);
					element.component.step_size = roundingGranularityRules(
						stepRoundGranularity,
						stepRoundRule,
						element.component.step_size
					);
				}
				price += getTimePrice(
					element.periodConsumedParkingTime / 3600,
					element.component.price,
					element.component.step_size,
					source
				);
				chargingPeriodsInfo.push({
					quantity: element.periodConsumedParkingTime,
					unit: "s",
					cost: getTimePrice(
						element.periodConsumedParkingTime / 3600,
						element.component.price,
						element.component.step_size,
						source
					),
					componentPrice: element.component.price,
					componentStepSize: element.component.step_size,
					component: element.component,
					restrictions: element.restrictions,
					source,
				});
			});
		}
	}

	return [price, chargingPeriodsInfo];
}

module.exports = {
    getEnergyPrice,
    getTimePrice,
    calculateOpcPrice
};