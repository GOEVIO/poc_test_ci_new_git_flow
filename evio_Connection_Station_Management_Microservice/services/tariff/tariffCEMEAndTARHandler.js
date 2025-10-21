const moment = require("moment");
const { round, defaultTitle } = require("../../utils/utils");

function getTariffCemeByDate(cemeTariff, startDate) {
	let context = "Function getTariffCemeByDate";
	try {
		if (cemeTariff.tariffsHistory && cemeTariff.tariffsHistory.length > 0) {
			const tariffFound = cemeTariff.tariffsHistory.find(
				(obj) => startDate >= obj.startDate && startDate <= obj.stopDate
			);
			if (tariffFound) return tariffFound.tariff;
		}
		return cemeTariff.tariff;
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return cemeTariff.tariff;
	}
}

function calculateCemeAndTar(
	TAR_Schedule,
	tariffCEME,
	tariffTAR,
	total_charging_time,
	total_energy,
	sessionStartDate,
	sessionStopDate,
	voltageLevel
) {
	const context = "Function calculateCemeAndTar";
	try {
		let ceme = {
			flat: {
				price: 0,
			},
			time: {
				price: 0,
			},
			energy: {
				price: 0,
			},
			price: 0,
			info: [],
			tariff: tariffCEME,
		};

		let tar = {
			price: 0,
			info: [],
			tariff: tariffTAR,
		};
		if (TAR_Schedule) {
			let schedules = TAR_Schedule.schedules;
			let schedulesWithoutRestrictions = schedules.every(
				(schedule) => schedule.weekDays === "all" && schedule.season === "all"
			);
			if (schedulesWithoutRestrictions) {
				let firstIntervals = schedules.map((schedule) => {
					return getIntervals(
						schedule,
						total_charging_time,
						total_energy,
						sessionStartDate,
						sessionStopDate,
						voltageLevel,
						ceme,
						tar
					);
				});
				dailyIntervals(
					firstIntervals,
					total_charging_time,
					total_energy,
					sessionStartDate,
					sessionStopDate,
					voltageLevel,
					ceme,
					tar
				);

			}
		}
		delete ceme.tariff;
		delete tar.tariff;
		return { ceme, tar };
		
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return {
			ceme: {
				price: 0,
				info: [],
			},
			tar: {
				price: 0,
				info: [],
			},
		};
	}
}

function pushCemeAndTarInfo(emsp, info, label, group) {
	const context = "Function pushCemeAndTarInfo";
	try {
		for (let entry of info) {
			let equalPeriod = emsp.findIndex(
				(elem) =>
					elem.unitPrice === entry.tariff.price &&
					elem.tariffType === entry.tariff.tariffType &&
					elem.label == label
			);
			if (equalPeriod > -1) {
				emsp[equalPeriod].quantity = round(emsp[equalPeriod].quantity + entry.consumedEnergykWh, 0);
				emsp[equalPeriod].total = round(emsp[equalPeriod].total + entry.totalPrice, 2);
			} else {
				emsp.push({
					label: label,
					unit: "kWh",
					unitPrice: entry.tariff.price,
					quantity: entry.consumedEnergykWh,
					total: entry.totalPrice,
					tariffType: entry.tariff.tariffType,
					title: defaultTitle(label),
					group: group,
				});
			}
		}
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
	}
}
function getIntervals(
	schedule,
	total_charging_time,
	total_energy,
	sessionStartDate,
	sessionStopDate,
	voltageLevel,
	ceme,
	tar
) {
	const context = "Function getIntervals";
	try {
		/*
			Get timestamp intervals for each scheduleCEME
		*/
		// Start
		let scheduleStartHours = parseInt(schedule.startTime.slice(0, 2));
		let scheduleStartMinutes = parseInt(schedule.startTime.slice(3));

		let momentObjStart = moment(sessionStartDate).utc();
		momentObjStart.set({ hour: scheduleStartHours, minute: scheduleStartMinutes, second: 0, millisecond: 0 });
		let startDateString = momentObjStart.toISOString();
		let startDateTimestamp = Date.parse(startDateString);

		// End

		let scheduleEndHours = parseInt(schedule.endTime.slice(0, 2));
		let scheduleEndMinutes = parseInt(schedule.endTime.slice(3));

		let momentObjEnd = moment(sessionStartDate).utc();
		momentObjEnd.set({ hour: scheduleEndHours, minute: scheduleEndMinutes, second: 0, millisecond: 0 });
		let endDateString = momentObjEnd.toISOString();
		let endDateTimestamp = Date.parse(endDateString);

		let sessionStartDateTimestamp = Date.parse(sessionStartDate);
		let sessionStopDateTimestamp = Date.parse(sessionStopDate);

		let totalChargingTimeMinutes = round(total_charging_time * 60, 6);
		let consumedEnergyPerMinute =
			totalChargingTimeMinutes > 0 ? round(total_energy / totalChargingTimeMinutes, 6) : 0;

		let { periodInMinutes, periodConsumedEnergy, startPeriod, endPeriod } = getPeriodTimeAndEnergy(
			sessionStartDateTimestamp,
			startDateTimestamp,
			sessionStopDateTimestamp,
			endDateTimestamp,
			consumedEnergyPerMinute
		);

		// CEME
		calculateCEME(
			schedule.tariffType,
			periodConsumedEnergy,
			periodInMinutes,
			ceme,
			startPeriod,
			endPeriod,
			voltageLevel
		);

		// TAR
		calculateTAR(
			schedule.tariffType,
			periodConsumedEnergy,
			periodInMinutes,
			voltageLevel,
			tar,
			startPeriod,
			endPeriod
		);

		return {
			start: startDateTimestamp,
			stop: endDateTimestamp,
			tariffType: schedule.tariffType,
		};
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return null;
	}
}

function dailyIntervals(
	firstIntervals,
	total_charging_time,
	total_energy,
	sessionStartDate,
	sessionStopDate,
	voltageLevel,
	ceme,
	tar
) {
	// We add one day just to be sure to cover all charging time period
	let multiplier = Math.ceil(total_charging_time / 24) + 1;
	let hoursInDay = 24;
	for (let i = 1; i <= multiplier; i++) {
		let millisecondsToAdd = i * hoursInDay * 3600 * 1000;
		calculateOtherIntervals(
			firstIntervals,
			millisecondsToAdd,
			total_charging_time,
			total_energy,
			sessionStartDate,
			sessionStopDate,
			voltageLevel,
			ceme,
			tar
		);
	}
	ceme.price = ceme.flat.price + ceme.time.price + ceme.energy.price;
}

function getPeriodTimeAndEnergy(
	sessionStartDateTimestamp,
	startDateTimestamp,
	sessionStopDateTimestamp,
	endDateTimestamp,
	consumedEnergyPerMinute
) {
	try {
		let periodInMinutes = 0;
		let periodConsumedEnergy = 0;
		let startPeriod = new Date(startDateTimestamp).toISOString();
		let endPeriod = new Date(endDateTimestamp).toISOString();
		if (sessionStartDateTimestamp <= startDateTimestamp && sessionStopDateTimestamp >= endDateTimestamp) {
			periodInMinutes = (endDateTimestamp - startDateTimestamp) / (1000 * 60);
			periodConsumedEnergy = round(consumedEnergyPerMinute * periodInMinutes, 4);
			startPeriod = new Date(startDateTimestamp).toISOString();
			endPeriod = new Date(endDateTimestamp).toISOString();
		} else if (sessionStartDateTimestamp >= startDateTimestamp && sessionStopDateTimestamp <= endDateTimestamp) {
			periodInMinutes = (sessionStopDateTimestamp - sessionStartDateTimestamp) / (1000 * 60);
			periodConsumedEnergy = round(consumedEnergyPerMinute * periodInMinutes, 4);
			startPeriod = new Date(sessionStartDateTimestamp).toISOString();
			endPeriod = new Date(sessionStopDateTimestamp).toISOString();
		} else if (sessionStartDateTimestamp <= startDateTimestamp && sessionStopDateTimestamp > startDateTimestamp) {
			periodInMinutes = (sessionStopDateTimestamp - startDateTimestamp) / (1000 * 60);
			periodConsumedEnergy = round(consumedEnergyPerMinute * periodInMinutes, 4);
			startPeriod = new Date(startDateTimestamp).toISOString();
			endPeriod = new Date(sessionStopDateTimestamp).toISOString();
		} else if (sessionStartDateTimestamp < endDateTimestamp && sessionStopDateTimestamp >= endDateTimestamp) {
			periodInMinutes = (endDateTimestamp - sessionStartDateTimestamp) / (1000 * 60);
			periodConsumedEnergy = round(consumedEnergyPerMinute * periodInMinutes, 4);
			startPeriod = new Date(sessionStartDateTimestamp).toISOString();
			endPeriod = new Date(endDateTimestamp).toISOString();
		}
		return { periodInMinutes, periodConsumedEnergy, startPeriod, endPeriod };
	} catch (error) {
		return {
			periodInMinutes: 0,
			periodConsumedEnergy: 0,
			startPeriod: new Date(startDateTimestamp).toISOString(),
			endPeriod: new Date(endDateTimestamp).toISOString(),
		};
	}
}
function calculateCEME(tariffType, periodConsumedEnergy, periodInMinutes, ceme, startPeriod, endPeriod, voltageLevel) {
	const context = "Function calculateCEME";
	try {
		// let CEME_FLAT = ceme.tariff.tariff.find(elem => ( elem.tariffType === tariffType && elem.uom.includes(process.env.flatDimension) ) )
		let CEME_POWER = ceme.tariff.tariff.find(
			(elem) =>
				elem.tariffType === tariffType &&
				elem.uom.includes(process.env.powerDimension) &&
				elem.voltageLevel === voltageLevel
		);
		let CEME_TIME = ceme.tariff.tariff.find(
			(elem) =>
				elem.tariffType === tariffType &&
				elem.uom.includes(process.env.timeDimension) &&
				elem.voltageLevel === voltageLevel
		);

		// let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
		let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0;
		let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0;

		// let flatPrice = CEME_Price_FLAT
		let energyPrice = round(CEME_Price_POWER * periodConsumedEnergy, 6);
		let timePrice = round(CEME_Price_TIME * periodInMinutes, 6);

		let cemePrice = /*flatPrice + */ energyPrice + timePrice;
		if (periodConsumedEnergy > 0 || periodInMinutes > 0) {
			//Add prices
			// ceme.price += cemePrice
			// ceme.flat.price += flatPrice
			ceme.energy.price += energyPrice;
			ceme.time.price += timePrice;

			//Push details
			ceme.info.push({
				startPeriod,
				endPeriod,
				// flatPrice,
				energyPrice,
				timePrice,
				totalPrice: cemePrice,
				consumedEnergykWh: periodConsumedEnergy,
				consumedTimeMinutes: periodInMinutes,
				tariff: ceme.tariff.tariff.find(
					(element) => element.tariffType === tariffType && element.voltageLevel === voltageLevel
				),
			});
		}
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
	}
}
function calculateTAR(tariffType, periodConsumedEnergy, periodInMinutes, voltageLevel, tar, startPeriod, endPeriod) {
	const context = "Function calculateTAR";
	try {
		let tarTariff = tar.tariff.tariff.find(
			(element) => element.voltageLevel === voltageLevel && element.tariffType === tariffType
		);
		let tarPrice = round(tarTariff.price * periodConsumedEnergy, 6);
		if (periodConsumedEnergy > 0 || periodInMinutes > 0) {
			tar.price += tarPrice;
			tar.info.push({
				startPeriod,
				endPeriod,
				totalPrice: tarPrice,
				consumedEnergykWh: periodConsumedEnergy,
				consumedTimeMinutes: periodInMinutes,
				tariff: tarTariff,
			});
		}
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
	}
}

function calculateOtherIntervals  (firstIntervals, millisecondsToAdd, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar) {
    const context = "Function calculateOtherIntervals"
    try {
        for (let interval of firstIntervals) {

            // Start 
            let startDateTimestamp = interval.start + millisecondsToAdd

            // End 
            let endDateTimestamp = interval.stop + millisecondsToAdd

            let sessionStartDateTimestamp = Date.parse(sessionStartDate)
            let sessionStopDateTimestamp = Date.parse(sessionStopDate)

            let totalChargingTimeMinutes = round(total_charging_time * 60, 6)
            let consumedEnergyPerMinute = round(total_energy / totalChargingTimeMinutes, 6)

            let { periodInMinutes, periodConsumedEnergy, startPeriod, endPeriod } = getPeriodTimeAndEnergy(sessionStartDateTimestamp, startDateTimestamp, sessionStopDateTimestamp, endDateTimestamp, consumedEnergyPerMinute)

            // CEME 
            calculateCEME(interval.tariffType, periodConsumedEnergy, periodInMinutes, ceme, startPeriod, endPeriod, voltageLevel)

            // TAR
            calculateTAR(interval.tariffType, periodConsumedEnergy, periodInMinutes, voltageLevel, tar, startPeriod, endPeriod)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}
module.exports = {
	getTariffCemeByDate,
	calculateCemeAndTar,
	pushCemeAndTarInfo,
};
