const moment = require("moment");
const { isEmptyObject, adjustRestrictions, round } = require("../../utils/utils");

function obeysRestrictions(
	restrictions,
	component,
	dimensionsObj,
	sessionStartDate,
	startDate,
	endDate,
	consumedPower,
	plugPower,
	plugVoltage,
	total_charging_time,
	total_parking_time
) {
	let obeys = true;

	//Local start and end dates
	let localStartDate = moment.utc(startDate).format("YYYY-MM-DD");
	let localEndDate = moment.utc(endDate).format("YYYY-MM-DD");

	// Local Unix Time Stamps
	let endLocalUnixTimestamp = Date.parse(endDate);
	let startLocalUnixTimestamp = Date.parse(startDate);

	//Session Start Date Unix Time Stamp
	let sessionStartDateUnixTimestamp = Date.parse(sessionStartDate);

	// START_TIME_RESTRICTION
	if (
		"start_time" in restrictions &&
		restrictions["start_time"] !== null &&
		restrictions["start_time"] !== undefined
	) {
		let restrictionStartDateTime = moment
			.utc(`${restrictions["start_date"]} ${restrictions["start_time"]}`, "YYYY-MM-DD HH:mm")
			.format();
		// Restrictions Unix Time Stamp
		let startTimeUnixTimestampRestriction = Date.parse(restrictionStartDateTime);

		if ("end_time" in restrictions && restrictions["end_time"] !== null && restrictions["end_time"] !== undefined) {
			let restrictionEndDateTime = moment
				.utc(`${restrictions["start_date"]} ${restrictions["end_time"]}`, "YYYY-MM-DD HH:mm")
				.format();

			// Restrictions Unix Time Stamp
			let endTimeUnixTimestampRestriction = Date.parse(restrictionEndDateTime);

			if (endTimeUnixTimestampRestriction < startTimeUnixTimestampRestriction) {
				endTimeUnixTimestampRestriction += 24 * 3600 * 1000; //adding 24 hours
			}

			if (
				!(
					startLocalUnixTimestamp >= startTimeUnixTimestampRestriction &&
					endLocalUnixTimestamp <= endTimeUnixTimestampRestriction
				)
			) {
				obeys = false;
			}
		} else {
			if (startLocalUnixTimestamp < startTimeUnixTimestampRestriction) {
				obeys = false;
			}
		}
	}

	// START_DATE_RESTRICTION
	if (
		"start_date" in restrictions &&
		restrictions["start_date"] !== null &&
		restrictions["start_date"] !== undefined
	) {
		let restrictionStartDate = moment.utc(`${restrictions["start_date"]}`, "YYYY-MM-DD").format();
		// Restrictions Unix Time Stamp
		let startDateUnixTimestampRestriction = Date.parse(restrictionStartDate);

		// Local Start Date set to midnight
		let localMomentStartDate = moment.utc(`${localStartDate}}`, "YYYY-MM-DD").format();

		if ("end_date" in restrictions && restrictions["end_date"] !== null && restrictions["end_date"] !== undefined) {
			let restrictionEndDate = moment.utc(`${restrictions["end_date"]}`, "YYYY-MM-DD").format();

			// Restrictions Unix Time Stamp
			let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate);

			// Local End Date set to midnight
			let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format();

			// end_date -> tariff valid until this day (excluding this day)
			if (
				!(
					Date.parse(localMomentStartDate) >= startDateUnixTimestampRestriction &&
					Date.parse(localMomentEndDate) < endDateUnixTimestampRestriction
				)
			) {
				obeys = false;
			}
		} else {
			if (Date.parse(localMomentStartDate) < startDateUnixTimestampRestriction) {
				obeys = false;
			}
		}
	}

	// END_DATE_RESTRICTION
	if ("end_date" in restrictions && restrictions["end_date"] !== null && restrictions["end_date"] !== undefined) {
		let restrictionEndDate = moment.utc(`${restrictions["end_date"]}`, "YYYY-MM-DD").format();

		// Restrictions Unix Time Stamp
		let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate);

		// Local End Date set to midnight
		let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format();

		// end_date -> tariff valid until this day (excluding this day)
		if (Date.parse(localMomentEndDate) >= endDateUnixTimestampRestriction) {
			obeys = false;
		}
	}

	// MIN_KWH_RESTRICTION
	if ("min_kwh" in restrictions && restrictions["min_kwh"] !== null && restrictions["min_kwh"] !== undefined) {
		if (consumedPower <= restrictions["min_kwh"]) {
			obeys = false;
		} else {
			if (
				"max_kwh" in restrictions &&
				restrictions["max_kwh"] !== null &&
				restrictions["max_kwh"] !== undefined
			) {
				if (consumedPower > restrictions["max_kwh"]) {
					obeys = false;
				}
			}
		}
	}

	// MAX_KWH_RESTRICTION
	if ("max_kwh" in restrictions && restrictions["max_kwh"] !== null && restrictions["max_kwh"] !== undefined) {
		if (consumedPower > restrictions["max_kwh"]) {
			obeys = false;
		}
	}

	//MIN_POWER_RESTRICTION
	if ("min_power" in restrictions && restrictions["min_power"] !== null && restrictions["min_power"] !== undefined) {
		let max_current = dimensionsObj["MAX_CURRENT"];
		let min_current = dimensionsObj["MIN_CURRENT"];
		let current = Math.max(max_current, min_current);
		let power = (current * plugVoltage) / 1000 < plugPower ? (current * plugVoltage) / 1000 : plugPower;

		if (power < restrictions["min_power"]) {
			obeys = false;
		} else {
			if (
				"max_power" in restrictions &&
				restrictions["max_power"] !== null &&
				restrictions["max_power"] !== undefined
			) {
				if (power >= restrictions["max_power"]) {
					obeys = false;
				}
			}
		}
	}

	//MAX_POWER_RESTRICTION
	if ("max_power" in restrictions && restrictions["max_power"] !== null && restrictions["max_power"] !== undefined) {
		let max_current = dimensionsObj["MAX_CURRENT"];
		let min_current = dimensionsObj["MIN_CURRENT"];
		let current = Math.max(max_current, min_current);
		let power = (current * plugVoltage) / 1000 < plugPower ? (current * plugVoltage) / 1000 : plugPower;

		if (power >= restrictions["max_power"]) {
			obeys = false;
		}
	}

	//MIN_DURATION_RESTRICTION
	if (
		"min_duration" in restrictions &&
		restrictions["min_duration"] !== null &&
		restrictions["min_duration"] !== undefined
	) {
		let sessionDurationEnd = (endLocalUnixTimestamp - sessionStartDateUnixTimestamp) / 1000;
		let sessionDurationStart = (startLocalUnixTimestamp - sessionStartDateUnixTimestamp) / 1000;
		if (component.type === "PARKING_TIME") {
			sessionDurationEnd =
				(endLocalUnixTimestamp - (sessionStartDateUnixTimestamp + total_charging_time * 3600 * 1000)) / 1000;
			sessionDurationStart =
				(startLocalUnixTimestamp - (sessionStartDateUnixTimestamp + total_charging_time * 3600 * 1000)) / 1000;
		}
		if (sessionDurationEnd < restrictions["min_duration"]) {
			obeys = false;
		} else {
			if (
				"max_duration" in restrictions &&
				restrictions["max_duration"] !== null &&
				restrictions["max_duration"] !== undefined
			) {
				if (sessionDurationStart >= 0) {
					if (sessionDurationStart > restrictions["max_duration"]) {
						obeys = false;
					}
				} else {
					obeys = false;
				}
			}
		}
	}

	//MAX_DURATION_RESTRICTION
	if (
		"max_duration" in restrictions &&
		restrictions["max_duration"] !== null &&
		restrictions["max_duration"] !== undefined
	) {
		let sessionDurationEnd = (endLocalUnixTimestamp - sessionStartDateUnixTimestamp) / 1000;
		let sessionDurationStart = (startLocalUnixTimestamp - sessionStartDateUnixTimestamp) / 1000;
		if (component.type === "PARKING_TIME") {
			sessionDurationEnd =
				(endLocalUnixTimestamp - (sessionStartDateUnixTimestamp + total_charging_time * 3600 * 1000)) / 1000;
			sessionDurationStart =
				(startLocalUnixTimestamp - (sessionStartDateUnixTimestamp + total_charging_time * 3600 * 1000)) / 1000;
		}

		if (sessionDurationStart >= 0) {
			if (sessionDurationEnd > restrictions["max_duration"]) {
				obeys = false;
			}
		} else {
			obeys = false;
		}
	}

	//DAY_OF_WEEK_RESTRICTION
	// if ('day_of_week' in restrictions && restrictions['day_of_week'] !== null && restrictions['day_of_week'] !== undefined) {
	//     let dateObj = new Date(startDate)
	//     let currentWeekDay = dateObj.toLocaleString("default" , {weekday : "long"} ).toUpperCase()
	//     if ( !(restrictions["day_of_week"].includes(currentWeekDay) ) ) {
	//         obeys = false
	//     }

	// }

	return obeys;
}

function roundingsValidation(component) {
	let priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule;
	if (component.price_round !== null && component.price_round !== undefined) {
		priceRoundGranularity = component.price_round.round_granularity;
		priceRoundRule = component.price_round.round_rule;
	} else {
		priceRoundGranularity = "THOUSANDTH";
		priceRoundRule = "ROUND_NEAR";
	}

	if (component.step_round !== null && component.step_round !== undefined) {
		stepRoundGranularity = component.step_round.round_granularity;
		stepRoundRule = component.step_round.round_rule;
	} else {
		stepRoundGranularity = "UNIT";
		stepRoundRule = "ROUND_UP";
	}

	return { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule };
}
function roundingGranularityRules(granularity, rule, value) {
	let roundingKeys = {
		ROUND_UP: (num, decimals) => Math.ceil(round(num * decimals, 6)) / decimals,
		ROUND_DOWN: (num, decimals) => Math.floor(round(num * decimals, 6)) / decimals,
		ROUND_NEAR: (num, decimals) => Math.round(round(num * decimals, 6)) / decimals,
	};
	if (granularity === "UNIT") {
		return roundingKeys[rule](value, 1);
	} else if (granularity === "TENTH") {
		return roundingKeys[rule](value, 10);
	} else if (granularity === "HUNDREDTH") {
		return roundingKeys[rule](value, 100);
	} else if (granularity === "THOUSANDTH") {
		return roundingKeys[rule](value, 1000);
	} else {
		return Math.round(value);
	}
}

function tariffIsValid(
	restrictions,
	priceComponents,
	startDate,
	endDate,
	total_charging_time,
	total_parking_time,
	consumedPower,
	plugPower
) {
	let tariffsObj = {};

	for (let component of priceComponents) {
		let isValid = true;
		//Local start and end dates
		let localStartDate = moment.utc(startDate).format("YYYY-MM-DD");
		let localEndDate = moment.utc(endDate).format("YYYY-MM-DD");

		// Local Unix Time Stamps
		let endLocalUnixTimestamp = Date.parse(endDate);
		let startLocalUnixTimestamp = Date.parse(startDate);

		//Charging periods of this tariff
		let chargingPeriods = [];

		let periodConsumedPower = 0;
		let periodConsumedTime = total_charging_time * 3600;
		let periodConsumedParkingTime = total_parking_time * 3600;
		let totalChargingTime = round(total_charging_time * 3600, 6);
		let totalParkingTime = round(total_parking_time * 3600, 6);

		if (component.type === "PARKING_TIME") {
			localStartDate = moment.utc(startLocalUnixTimestamp + totalChargingTime * 1000).format("YYYY-MM-DD");
			startLocalUnixTimestamp += totalChargingTime * 1000;
		} else {
			localEndDate = moment.utc(startLocalUnixTimestamp + totalChargingTime * 1000).format("YYYY-MM-DD");
			endLocalUnixTimestamp = startLocalUnixTimestamp + totalChargingTime * 1000;
		}

		endLocalUnixTimestamp = round(endLocalUnixTimestamp, 0);
		startLocalUnixTimestamp = round(startLocalUnixTimestamp, 0);

		// START_TIME_RESTRICTION
		if (
			"start_time" in restrictions &&
			restrictions["start_time"] !== null &&
			restrictions["start_time"] !== undefined
		) {
			let restrictionStartDateTime = moment
				.utc(`${restrictions["start_date"]} ${restrictions["start_time"]}`, "YYYY-MM-DD HH:mm")
				.format();
			// Restrictions Unix Time Stamp
			let startTimeUnixTimestampRestriction = Date.parse(restrictionStartDateTime);

			if (
				"end_time" in restrictions &&
				restrictions["end_time"] !== null &&
				restrictions["end_time"] !== undefined
			) {
				let restrictionEndDateTime = moment
					.utc(`${restrictions["start_date"]} ${restrictions["end_time"]}`, "YYYY-MM-DD HH:mm")
					.format();

				// Restrictions Unix Time Stamp
				let endTimeUnixTimestampRestriction = Date.parse(restrictionEndDateTime);

				if (endTimeUnixTimestampRestriction < startTimeUnixTimestampRestriction) {
					endTimeUnixTimestampRestriction += 24 * 3600 * 1000; //adding 24 hours
				}

				if (
					startLocalUnixTimestamp <= startTimeUnixTimestampRestriction &&
					endLocalUnixTimestamp <= startTimeUnixTimestampRestriction
				) {
					isValid = false;
				} else if (
					startLocalUnixTimestamp >= endTimeUnixTimestampRestriction &&
					endLocalUnixTimestamp >= endTimeUnixTimestampRestriction
				) {
					isValid = false;
				} else {
					if (
						startLocalUnixTimestamp <= startTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startTimeUnixTimestampRestriction, endTimeUnixTimestampRestriction]);
					} else if (
						startLocalUnixTimestamp >= startTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp <= endTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp <= startTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp > startTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startTimeUnixTimestampRestriction, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp < endTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endTimeUnixTimestampRestriction]);
					}
				}
			} else {
				// I actually think that we can't have end_time without start_time and vice versa, but I'll assume in this case that end_time is midnight of next day
				let restrictionEndDateTime = moment
					.utc(`${moment.utc(localStartDate).add(1, "days").format()}`, "YYYY-MM-DD")
					.format();

				// Restrictions Unix Time Stamp
				let endTimeUnixTimestampRestriction = Date.parse(restrictionEndDateTime);

				if (
					startLocalUnixTimestamp <= startTimeUnixTimestampRestriction &&
					endLocalUnixTimestamp <= startTimeUnixTimestampRestriction
				) {
					isValid = false;
				} else if (
					startLocalUnixTimestamp >= endTimeUnixTimestampRestriction &&
					endLocalUnixTimestamp >= endTimeUnixTimestampRestriction
				) {
					isValid = false;
				} else {
					if (
						startLocalUnixTimestamp <= startTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startTimeUnixTimestampRestriction, endTimeUnixTimestampRestriction]);
					} else if (
						startLocalUnixTimestamp >= startTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp <= endTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp <= startTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp > startTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startTimeUnixTimestampRestriction, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp < endTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endTimeUnixTimestampRestriction]);
					}
				}
			}
		}
		// END_TIME_RESTRICTION
		if ("end_time" in restrictions && restrictions["end_time"] !== null && restrictions["end_time"] !== undefined) {
			if (
				!("start_time" in restrictions) ||
				restrictions["start_time"] === null ||
				restrictions["start_time"] === undefined
			) {
				// I actually think that we can't have end_time without start_time and vice versa, but I'll assume in this case that start_time is midnight of the current day
				let restrictionStartDateTime = moment.utc(`${restrictions["start_date"]}`, "YYYY-MM-DD").format();
				// Restrictions Unix Time Stamp
				let startTimeUnixTimestampRestriction = Date.parse(restrictionStartDateTime);

				let restrictionEndDateTime = moment
					.utc(`${restrictions["start_date"]} ${restrictions["end_time"]}`, "YYYY-MM-DD HH:mm")
					.format();

				// Restrictions Unix Time Stamp
				let endTimeUnixTimestampRestriction = Date.parse(restrictionEndDateTime);

				if (endTimeUnixTimestampRestriction < endLocalUnixTimestamp) {
					endTimeUnixTimestampRestriction += 24 * 3600 * 1000; //adding 24 hours
				}

				if (
					startLocalUnixTimestamp <= startTimeUnixTimestampRestriction &&
					endLocalUnixTimestamp <= startTimeUnixTimestampRestriction
				) {
					isValid = false;
				} else if (
					startLocalUnixTimestamp >= endTimeUnixTimestampRestriction &&
					endLocalUnixTimestamp >= endTimeUnixTimestampRestriction
				) {
					isValid = false;
				} else {
					if (
						startLocalUnixTimestamp <= startTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startTimeUnixTimestampRestriction, endTimeUnixTimestampRestriction]);
					} else if (
						startLocalUnixTimestamp >= startTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp <= endTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp <= startTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp > startTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startTimeUnixTimestampRestriction, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp < endTimeUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endTimeUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endTimeUnixTimestampRestriction]);
					}
				}
			}
		}

		// START_DATE_RESTRICTION
		if (
			"start_date" in restrictions &&
			restrictions["start_date"] !== null &&
			restrictions["start_date"] !== undefined
		) {
			let restrictionStartDate = moment.utc(`${restrictions["start_date"]}`, "YYYY-MM-DD").format();
			// Restrictions Unix Time Stamp
			let startDateUnixTimestampRestriction = Date.parse(restrictionStartDate);

			// Local Start Date set to midnight
			let localMomentStartDate = moment.utc(`${localStartDate}}`, "YYYY-MM-DD").format();

			if (
				"end_date" in restrictions &&
				restrictions["end_date"] !== null &&
				restrictions["end_date"] !== undefined
			) {
				let restrictionEndDate = moment.utc(`${restrictions["end_date"]}`, "YYYY-MM-DD").format();

				// Restrictions Unix Time Stamp
				let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate);

				// Local End Date set to midnight
				let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format();

				// end_date -> tariff valid until this day (excluding this day)

				if (
					startLocalUnixTimestamp <= startDateUnixTimestampRestriction &&
					endLocalUnixTimestamp <= startDateUnixTimestampRestriction
				) {
					isValid = false;
				} else if (
					startLocalUnixTimestamp >= endDateUnixTimestampRestriction &&
					endLocalUnixTimestamp >= endDateUnixTimestampRestriction
				) {
					isValid = false;
				} else {
					if (
						startLocalUnixTimestamp <= startDateUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startDateUnixTimestampRestriction, endDateUnixTimestampRestriction]);
					} else if (
						startLocalUnixTimestamp >= startDateUnixTimestampRestriction &&
						endLocalUnixTimestamp < endDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp <= startDateUnixTimestampRestriction &&
						endLocalUnixTimestamp > startDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startDateUnixTimestampRestriction, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp < endDateUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endDateUnixTimestampRestriction]);
					}
				}
			} else {
				let restrictionEndDate = moment
					.utc(`${moment.utc(localEndDate).add(1, "days").format()}`, "YYYY-MM-DD")
					.format();

				// Restrictions Unix Time Stamp
				let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate);

				// Local End Date set to midnight
				let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format();

				// end_date -> tariff valid until this day (excluding this day)

				if (
					startLocalUnixTimestamp <= startDateUnixTimestampRestriction &&
					endLocalUnixTimestamp <= startDateUnixTimestampRestriction
				) {
					isValid = false;
				} else if (
					startLocalUnixTimestamp >= endDateUnixTimestampRestriction &&
					endLocalUnixTimestamp >= endDateUnixTimestampRestriction
				) {
					isValid = false;
				} else {
					if (
						startLocalUnixTimestamp <= startDateUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startDateUnixTimestampRestriction, endDateUnixTimestampRestriction]);
					} else if (
						startLocalUnixTimestamp >= startDateUnixTimestampRestriction &&
						endLocalUnixTimestamp < endDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp <= startDateUnixTimestampRestriction &&
						endLocalUnixTimestamp > startDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startDateUnixTimestampRestriction, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp < endDateUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endDateUnixTimestampRestriction]);
					}
				}
			}
		}

		// END_DATE_RESTRICTION
		if ("end_date" in restrictions && restrictions["end_date"] !== null && restrictions["end_date"] !== undefined) {
			if (
				!("start_date" in restrictions) ||
				restrictions["start_date"] === null ||
				restrictions["start_date"] === undefined
			) {
				let restrictionStartDate = moment.utc(`${localStartDate}`, "YYYY-MM-DD").format();
				// Restrictions Unix Time Stamp
				let startDateUnixTimestampRestriction = Date.parse(restrictionStartDate);

				// Local Start Date set to midnight
				let localMomentStartDate = moment.utc(`${localStartDate}}`, "YYYY-MM-DD").format();

				let restrictionEndDate = moment.utc(`${restrictions["end_date"]}`, "YYYY-MM-DD").format();

				// Restrictions Unix Time Stamp
				let endDateUnixTimestampRestriction = Date.parse(restrictionEndDate);

				// Local End Date set to midnight
				let localMomentEndDate = moment.utc(`${localEndDate}}`, "YYYY-MM-DD").format();

				// end_date -> tariff valid until this day (excluding this day)

				if (
					startLocalUnixTimestamp <= startDateUnixTimestampRestriction &&
					endLocalUnixTimestamp <= startDateUnixTimestampRestriction
				) {
					isValid = false;
				} else if (
					startLocalUnixTimestamp >= endDateUnixTimestampRestriction &&
					endLocalUnixTimestamp >= endDateUnixTimestampRestriction
				) {
					isValid = false;
				} else {
					if (
						startLocalUnixTimestamp <= startDateUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startDateUnixTimestampRestriction, endDateUnixTimestampRestriction]);
					} else if (
						startLocalUnixTimestamp >= startDateUnixTimestampRestriction &&
						endLocalUnixTimestamp < endDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp <= startDateUnixTimestampRestriction &&
						endLocalUnixTimestamp > startDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startDateUnixTimestampRestriction, endLocalUnixTimestamp]);
					} else if (
						startLocalUnixTimestamp < endDateUnixTimestampRestriction &&
						endLocalUnixTimestamp >= endDateUnixTimestampRestriction
					) {
						chargingPeriods.push([startLocalUnixTimestamp, endDateUnixTimestampRestriction]);
					}
				}
			}
		}
		/* 
		   In this scenario we assume the power is always the same throughout the session, so, we can extrapolate charging periods based on consumed kwh
	   */
		// MIN_KWH_RESTRICTION
		if ("min_kwh" in restrictions && restrictions["min_kwh"] !== null && restrictions["min_kwh"] !== undefined) {
			if (consumedPower < restrictions["min_kwh"]) {
				isValid = false;
			} else {
				if (
					"max_kwh" in restrictions &&
					restrictions["max_kwh"] !== null &&
					restrictions["max_kwh"] !== undefined
				) {
					if (consumedPower >= restrictions["max_kwh"]) {
						periodConsumedPower = restrictions["max_kwh"] - restrictions["min_kwh"];
						let lowerLimit = round(
							restrictions["min_kwh"] * round((totalChargingTime * 1000) / consumedPower, 6),
							0
						);
						let upperLimit = round(
							restrictions["max_kwh"] * round((totalChargingTime * 1000) / consumedPower, 6),
							0
						);
						chargingPeriods.push([
							startLocalUnixTimestamp + lowerLimit,
							startLocalUnixTimestamp + upperLimit,
						]);
					} else {
						periodConsumedPower = consumedPower - restrictions["min_kwh"];
						let lowerLimit = round(
							restrictions["min_kwh"] * round((totalChargingTime * 1000) / consumedPower, 6),
							0
						);
						let upperLimit = round(totalChargingTime * 1000, 0);
						chargingPeriods.push([
							startLocalUnixTimestamp + lowerLimit,
							startLocalUnixTimestamp + upperLimit,
						]);
					}
				} else {
					periodConsumedPower = consumedPower - restrictions["min_kwh"];
					let lowerLimit = round(
						restrictions["min_kwh"] * round((totalChargingTime * 1000) / consumedPower, 6),
						0
					);
					let upperLimit = round(totalChargingTime * 1000, 0);
					chargingPeriods.push([startLocalUnixTimestamp + lowerLimit, startLocalUnixTimestamp + upperLimit]);
				}
			}
		}

		// MAX_KWH_RESTRICTION
		if ("max_kwh" in restrictions && restrictions["max_kwh"] !== null && restrictions["max_kwh"] !== undefined) {
			if (
				!("min_kwh" in restrictions) ||
				restrictions["min_kwh"] === null ||
				restrictions["min_kwh"] === undefined
			) {
				if (consumedPower >= restrictions["max_kwh"]) {
					periodConsumedPower = restrictions["max_kwh"];
					let upperLimit = round(
						restrictions["max_kwh"] * round((totalChargingTime * 1000) / consumedPower, 6),
						0
					);
					chargingPeriods.push([startLocalUnixTimestamp, startLocalUnixTimestamp + upperLimit]);
				} else {
					periodConsumedPower = consumedPower;
					let upperLimit = round(totalChargingTime * 1000, 0);
					chargingPeriods.push([startLocalUnixTimestamp, startLocalUnixTimestamp + upperLimit]);
				}
			}
		}

		//MIN_POWER_RESTRICTION
		if (
			"min_power" in restrictions &&
			restrictions["min_power"] !== null &&
			restrictions["min_power"] !== undefined
		) {
			if (plugPower < restrictions["min_power"]) {
				isValid = false;
			} else {
				if ("max_power" in restrictions) {
					if (plugPower >= restrictions["max_power"]) {
						isValid = false;
					}
				}
			}
		}

		//MAX_POWER_RESTRICTION
		if (
			"max_power" in restrictions &&
			restrictions["max_power"] !== null &&
			restrictions["max_power"] !== undefined
		) {
			if (plugPower >= restrictions["max_power"]) {
				isValid = false;
			}
		}

		//MIN_DURATION_RESTRICTION
		if (
			"min_duration" in restrictions &&
			restrictions["min_duration"] !== null &&
			restrictions["min_duration"] !== undefined
		) {
			if (component.type === "TIME") {
				if (totalChargingTime < restrictions["min_duration"]) {
					isValid = false;
				} else {
					if (
						"max_duration" in restrictions &&
						restrictions["max_duration"] !== null &&
						restrictions["max_duration"] !== undefined
					) {
						if (totalChargingTime >= restrictions["max_duration"]) {
							periodConsumedTime = restrictions["max_duration"] - restrictions["min_duration"];
							chargingPeriods.push([
								startLocalUnixTimestamp + restrictions["min_duration"] * 1000,
								startLocalUnixTimestamp +
									restrictions["min_duration"] * 1000 +
									round(periodConsumedTime * 1000, 0),
							]);
						} else {
							periodConsumedTime = totalChargingTime - restrictions["min_duration"];
							chargingPeriods.push([
								startLocalUnixTimestamp + restrictions["min_duration"] * 1000,
								startLocalUnixTimestamp +
									restrictions["min_duration"] * 1000 +
									round(periodConsumedTime * 1000, 0),
							]);
						}
					} else {
						periodConsumedTime = totalChargingTime - restrictions["min_duration"];
						chargingPeriods.push([
							startLocalUnixTimestamp + restrictions["min_duration"] * 1000,
							startLocalUnixTimestamp +
								restrictions["min_duration"] * 1000 +
								round(periodConsumedTime * 1000, 0),
						]);
					}
				}
			} else if (component.type === "PARKING_TIME") {
				if (totalParkingTime < restrictions["min_duration"]) {
					isValid = false;
				} else {
					if (
						"max_duration" in restrictions &&
						restrictions["max_duration"] !== null &&
						restrictions["max_duration"] !== undefined
					) {
						if (totalParkingTime >= restrictions["max_duration"]) {
							periodConsumedParkingTime = restrictions["max_duration"] - restrictions["min_duration"];
							chargingPeriods.push([
								startLocalUnixTimestamp + restrictions["min_duration"] * 1000,
								startLocalUnixTimestamp +
									restrictions["min_duration"] * 1000 +
									round(periodConsumedParkingTime * 1000, 0),
							]);
						} else {
							periodConsumedParkingTime = totalParkingTime - restrictions["min_duration"];

							chargingPeriods.push([
								startLocalUnixTimestamp + restrictions["min_duration"] * 1000,
								startLocalUnixTimestamp +
									restrictions["min_duration"] * 1000 +
									round(periodConsumedParkingTime * 1000, 0),
							]);
						}
					} else {
						periodConsumedParkingTime = totalParkingTime - restrictions["min_duration"];
						chargingPeriods.push([
							startLocalUnixTimestamp + restrictions["min_duration"] * 1000,
							startLocalUnixTimestamp +
								restrictions["min_duration"] * 1000 +
								round(periodConsumedParkingTime * 1000, 0),
						]);
					}
				}
			} else if (component.type === "ENERGY") {
				if (totalChargingTime < restrictions["min_duration"]) {
					isValid = false;
				} else {
					if (
						"max_duration" in restrictions &&
						restrictions["max_duration"] !== null &&
						restrictions["max_duration"] !== undefined
					) {
						if (totalChargingTime >= restrictions["max_duration"]) {
							periodConsumedTime = restrictions["max_duration"] - restrictions["min_duration"];
							chargingPeriods.push([
								startLocalUnixTimestamp + restrictions["min_duration"] * 1000,
								startLocalUnixTimestamp +
									restrictions["min_duration"] * 1000 +
									round(periodConsumedTime * 1000, 0),
							]);
						} else {
							periodConsumedTime = totalChargingTime - restrictions["min_duration"];
							chargingPeriods.push([
								startLocalUnixTimestamp + restrictions["min_duration"] * 1000,
								startLocalUnixTimestamp +
									restrictions["min_duration"] * 1000 +
									round(periodConsumedTime * 1000, 0),
							]);
						}
					} else {
						periodConsumedTime = totalChargingTime - restrictions["min_duration"];
						chargingPeriods.push([
							startLocalUnixTimestamp + restrictions["min_duration"] * 1000,
							startLocalUnixTimestamp +
								restrictions["min_duration"] * 1000 +
								round(periodConsumedTime * 1000, 0),
						]);
					}
				}
			}
		}

		//MAX_DURATION_RESTRICTION
		if (
			"max_duration" in restrictions &&
			restrictions["max_duration"] !== null &&
			restrictions["max_duration"] !== undefined
		) {
			if (
				!("min_duration" in restrictions) ||
				restrictions["min_duration"] === null ||
				restrictions["min_duration"] === undefined
			) {
				if (component.type === "TIME") {
					if (totalChargingTime >= restrictions["max_duration"]) {
						periodConsumedTime = restrictions["max_duration"];
						chargingPeriods.push([
							startLocalUnixTimestamp,
							startLocalUnixTimestamp + round(periodConsumedTime * 1000, 0),
						]);
					} else {
						periodConsumedTime = totalChargingTime;
						chargingPeriods.push([
							startLocalUnixTimestamp,
							startLocalUnixTimestamp + round(periodConsumedTime * 1000, 0),
						]);
					}
				} else if (component.type === "PARKING_TIME") {
					if (totalParkingTime >= restrictions["max_duration"]) {
						periodConsumedParkingTime = restrictions["max_duration"];
						chargingPeriods.push([
							startLocalUnixTimestamp,
							startLocalUnixTimestamp + round(periodConsumedTime * 1000, 0),
						]);
					} else {
						periodConsumedParkingTime = totalParkingTime;
						chargingPeriods.push([
							startLocalUnixTimestamp,
							startLocalUnixTimestamp + round(periodConsumedTime * 1000, 0),
						]);
					}
				} else if (component.type === "ENERGY") {
					if (totalChargingTime >= restrictions["max_duration"]) {
						periodConsumedTime = restrictions["max_duration"];
						chargingPeriods.push([
							startLocalUnixTimestamp,
							startLocalUnixTimestamp + round(periodConsumedTime * 1000, 0),
						]);
					} else {
						periodConsumedTime = totalChargingTime;
						chargingPeriods.push([
							startLocalUnixTimestamp,
							startLocalUnixTimestamp + round(periodConsumedTime * 1000, 0),
						]);
					}
				}
			}
		}

		//DAY_OF_WEEK_RESTRICTION
		// if ('day_of_week' in restrictions && restrictions['day_of_week'] !== null && restrictions['day_of_week'] !== undefined) {
		//     let startDateObj = new Date(startLocalUnixTimestamp)
		//     let currentWeekDay = startDateObj.toLocaleString("default" , {weekday : "long"} ).toUpperCase()
		//     let endDateObj = new Date(endLocalUnixTimestamp)
		//     let endDateWeekDay = endDateObj.toLocaleString("default" , {weekday : "long"} ).toUpperCase()

		//     // Local End Date set to midnight
		//     let localMomentEndDate = moment.utc(`${localEndDate}}` , "YYYY-MM-DD").format()

		//     if ( !(restrictions["day_of_week"].includes(currentWeekDay) ) ) {
		//         if (restrictions["day_of_week"].includes(endDateWeekDay)) {
		//             chargingPeriods.push([
		//                 Date.parse(localMomentEndDate) , endLocalUnixTimestamp
		//             ])
		//         } else {.
		//             isValid = false
		//         }
		//     } else {
		//         if ( !(restrictions["day_of_week"].includes(endDateWeekDay)) ) {
		//             chargingPeriods.push([
		//                 startLocalUnixTimestamp , Date.parse(localMomentEndDate)
		//             ])
		//         } else {
		//             chargingPeriods.push([
		//                 startLocalUnixTimestamp ,endLocalUnixTimestamp
		//             ])
		//         }
		//     }

		// }

		if (chargingPeriods.length > 1) {
			[isValid, chargingPeriods] = validateChargingPeriodsArray(chargingPeriods, isValid);
		}
		chargingPeriods =
			chargingPeriods.length === 0
				? [Date.parse(startDate), Date.parse(endDate)]
				: getSmallestPeriod(chargingPeriods);

		(periodConsumedTime =
			(chargingPeriods[1] - chargingPeriods[0]) / 1000 < periodConsumedTime
				? (chargingPeriods[1] - chargingPeriods[0]) / 1000
				: periodConsumedTime),
			(periodConsumedParkingTime =
				(chargingPeriods[1] - chargingPeriods[0]) / 1000 < periodConsumedParkingTime
					? (chargingPeriods[1] - chargingPeriods[0]) / 1000
					: periodConsumedParkingTime);

		tariffsObj[component.type] = {
			isValid,
			chargingPeriods,
			periodConsumedPower,
			periodConsumedTime,
			periodConsumedParkingTime,
			component: component,
			restrictions: restrictions,
		};
	}

	return tariffsObj;
}

function getSmallestPeriod(chargingPeriods) {
	let intervals = chargingPeriods.map((period) => {
		return period[1] - period[0];
	});

	let minValue = Math.min(...intervals);

	return chargingPeriods[intervals.indexOf(minValue)];
}
function validateChargingPeriodsArray(chargingPeriods, isValid) {
	let intervals = chargingPeriods.map((period, index) => {
		return [index, period[1] - period[0]];
	});

	let sortedIntervals = intervals.sort(function (a, b) {
		return b[1] - a[1];
	});

	let sortedPeriods = sortedIntervals.map((array) => {
		return chargingPeriods[array[0]];
	});

	for (let index = 0; index < sortedPeriods.length; index++) {
		if (index !== sortedPeriods.length - 1) {
			let currentInterval = sortedPeriods[index];
			let nextInterval = sortedPeriods[index + 1];

			if (nextInterval[0] < currentInterval[0] && nextInterval[1] <= currentInterval[0]) {
				isValid = false;
				break;
			} else if (nextInterval[0] >= currentInterval[1] && nextInterval[1] > currentInterval[1]) {
				isValid = false;
				break;
			} else if (nextInterval[0] <= currentInterval[0] && nextInterval[1] >= currentInterval[1]) {
				sortedPeriods.splice(index + 1, 1);
				index--;
			} else if (nextInterval[0] >= currentInterval[0] && nextInterval[1] <= currentInterval[1]) {
				sortedPeriods.splice(index, 1);
				index--;
			} else if (nextInterval[0] <= currentInterval[0] && nextInterval[1] > currentInterval[0]) {
				sortedPeriods.splice(index, 1, [currentInterval[0], nextInterval[1]]);
				index--;
			} else if (nextInterval[0] < currentInterval[1] && nextInterval[1] >= currentInterval[1]) {
				sortedPeriods.splice(index, 1, [nextInterval[0], currentInterval[1]]);
				index--;
			}
		}
	}
	return [isValid, sortedPeriods];
}


function createTariffElementsAccordingToRestriction(elements, sessionStartDate, sessionStopDate) {
	/*
		Basically, with the current implementation, in the opcTariffsPrices function, a tariff element can only be used in one period of time,
		but in reality, if the element has a restriction start_time and end_time and the total charging time is bigger than 24 hours - (end_time - start_time),
		it can happen that the tariff element is used twice. It's not common, but it can happen in real life, especially if the gap between end_time and start_time
		is too big. Let's say for example, start_time = 06:00 and end_time = 23:00. If the user starts at 22:58 and ends on 06:10 or so, it happens. 

		That being said, to solve this issue, with the tariffs that have time restrictions and no date restrictions, I'm creating mutliple equal versions of that element 
		but add them date restrictions from start of session to the end of session
	*/
	let momentStartDate = moment(sessionStartDate).utc();
	let momentStopDate = moment(sessionStopDate).utc();
	let daysDiff = momentStopDate.diff(momentStartDate, "days");
	let addElements = daysDiff + 2;
	elements = separateWeekDaysRestriction(JSON.parse(JSON.stringify(elements)), sessionStartDate, daysDiff);
	let elementIndex = 0;
	let elementsToPush = [];
	for (let tariffElement of elements) {
		let restrictions = tariffElement.restrictions;
		adjustRestrictions(restrictions);
		let isEmpty = isEmptyObject(restrictions);

		if (!isEmpty) {
			if (
				(("start_time" in restrictions &&
					restrictions["start_time"] !== null &&
					restrictions["start_time"] !== undefined) ||
					("end_time" in restrictions &&
						restrictions["end_time"] !== null &&
						restrictions["end_time"] !== undefined)) &&
				!(
					"start_date" in restrictions &&
					restrictions["start_date"] !== null &&
					restrictions["start_date"] !== undefined
				) &&
				!(
					"end_date" in restrictions &&
					restrictions["end_date"] !== null &&
					restrictions["end_date"] !== undefined
				) &&
				!(
					"day_of_week" in restrictions &&
					restrictions["day_of_week"] !== null &&
					restrictions["day_of_week"] !== undefined
				)
			) {
				let firstDate = moment.utc(sessionStartDate).format("YYYY-MM-DD");
				let alteredComponents = {
					index: elementIndex,
					elements: [],
				};
				for (let pushIndex = 0; pushIndex < addElements; pushIndex++) {
					let startHour = restrictions["start_time"]
						? parseInt(restrictions["start_time"].slice(0, 2))
						: null;
					let endHour = restrictions["end_time"] ? parseInt(restrictions["end_time"].slice(0, 2)) : null;

					let currentDay = moment
						.utc(firstDate, "YYYY-MM-DD")
						.add(24 * pushIndex, "hours")
						.format();
					let nextDay = moment.utc(currentDay).add(24, "hours").format();
					let nextDayMidnight = moment.utc(nextDay).startOf("day");
					let nextNextDay = moment.utc(nextDay).add(24, "hours").format();

					if (startHour && endHour && endHour !== 0 && startHour > endHour) {
						if (pushIndex === 0) {
							let previousDay = moment.utc(firstDate, "YYYY-MM-DD").add(-24, "hours").format();
							let currentDayMidnight = moment().utc(firstDate, "HH:mm").startOf("day");
							let firstElement = {
								restrictions: {
									...restrictions,
									end_time: currentDayMidnight.format("HH:mm"),
									start_date: moment.utc(previousDay).format("YYYY-MM-DD"),
									end_date: firstDate,
								},
								price_components: elements[elementIndex].price_components,
							};

							let secondElement = {
								restrictions: {
									...restrictions,
									start_time: currentDayMidnight.format("HH:mm"),
									start_date: moment.utc(currentDay).format("YYYY-MM-DD"),
									end_date: moment.utc(nextDay).format("YYYY-MM-DD"),
								},
								price_components: elements[elementIndex].price_components,
							};
							// elements.splice(elementIndex, 1, firstElement , secondElement)
							alteredComponents.elements.push(firstElement, secondElement);
						}

						let firstElement = {
							restrictions: {
								...restrictions,
								end_time: nextDayMidnight.format("HH:mm"),
								start_date: moment.utc(currentDay).format("YYYY-MM-DD"),
								end_date: moment.utc(nextDay).format("YYYY-MM-DD"),
							},
							price_components: elements[elementIndex].price_components,
						};

						let secondElement = {
							restrictions: {
								...restrictions,
								start_time: nextDayMidnight.format("HH:mm"),
								start_date: moment.utc(nextDay).format("YYYY-MM-DD"),
								end_date: moment.utc(nextNextDay).format("YYYY-MM-DD"),
							},
							price_components: elements[elementIndex].price_components,
						};

						// elements.splice(elementIndex + pushedItems + pushIndex , 0, firstElement , secondElement)
						alteredComponents.elements.push(firstElement, secondElement);
					} else {
						if (pushIndex === 0) {
							let previousDay = moment.utc(firstDate, "YYYY-MM-DD").add(-24, "hours").format();
							let newElement = {
								restrictions: {
									...restrictions,
									start_date: moment.utc(previousDay).format("YYYY-MM-DD"),
									end_date: firstDate,
								},
								price_components: elements[elementIndex].price_components,
							};
							alteredComponents.elements.push(newElement);
							// elements.splice(elementIndex, 1, newElement)
						}

						// let currentDay = moment.utc(firstDate, 'YYYY-MM-DD').add(24 * pushIndex, 'hours').format()
						// let nextDay = moment.utc(currentDay).add(24, 'hours').format()
						let newElement = {
							restrictions: {
								...restrictions,
								start_date: moment.utc(currentDay).format("YYYY-MM-DD"),
								end_date: moment.utc(nextDay).format("YYYY-MM-DD"),
							},
							price_components: elements[elementIndex].price_components,
						};
						alteredComponents.elements.push(newElement);
						// elements.splice(elementIndex + pushIndex + 1, 0, newElement)
					}
				}
				elementsToPush.push(alteredComponents);
			}
		}
		elementIndex++;
	}

	let addIndex = 0;
	for (let elem of elementsToPush) {
		let index = elem.index + addIndex;
		elements.splice(index, 1, ...elem.elements);
		addIndex += elem.elements.length - 1;
	}

	return elements;
}

function separateWeekDaysRestriction(elements, sessionStartDate, daysDiff) {
	daysDiff = daysDiff === 0 ? 1 : daysDiff;
	let weeks = Math.ceil(daysDiff / 7) + 1;
	let elementIndex = 0;
	for (let tariffElement of elements) {
		let restrictions = tariffElement.restrictions;
		adjustRestrictions(restrictions);
		let isEmpty = isEmptyObject(restrictions);

		let dayOfWeekObj = {
			SUNDAY: 0,
			MONDAY: 1,
			TUESDAY: 2,
			WEDNESDAY: 3,
			THURSDAY: 4,
			FRIDAY: 5,
			SATURDAY: 6,
		};
		if (!isEmpty) {
			if (
				"day_of_week" in restrictions &&
				restrictions["day_of_week"] !== null &&
				restrictions["day_of_week"] !== undefined &&
				restrictions["day_of_week"].length > 1
			) {
				// console.log("entras 1" , tariffElement)
				let weekDays = 0;
				let daysOfWeek = 0;
				for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
					for (let pushIndex = 0; pushIndex < restrictions["day_of_week"].length; pushIndex++) {
						let weekDayStartDay = new Date(sessionStartDate).getDay();
						let restrictionDayStart = dayOfWeekObj[restrictions["day_of_week"][pushIndex]];
						let diffDays = restrictionDayStart - weekDayStartDay + weekDays;
						let startDate = moment.utc(sessionStartDate).add(diffDays, "days").format("YYYY-MM-DD");
						let endDate = moment.utc(startDate).add(24, "hours").format("YYYY-MM-DD");
						let newElement = {
							restrictions: {
								...restrictions,
								day_of_week: [restrictions["day_of_week"][pushIndex]],
								start_date: startDate,
								end_date: endDate,
							},
							price_components: elements[elementIndex].price_components,
						};
						elements.splice(elementIndex + daysOfWeek + pushIndex + 1, 0, newElement);
					}
					weekDays += 7;
					daysOfWeek += restrictions["day_of_week"].length;
				}
				elements.splice(elementIndex, 1);
			} else if (
				"day_of_week" in restrictions &&
				restrictions["day_of_week"] !== null &&
				restrictions["day_of_week"] !== undefined &&
				!(
					"start_date" in restrictions &&
					restrictions["start_date"] !== null &&
					restrictions["start_date"] !== undefined
				) &&
				!(
					"end_date" in restrictions &&
					restrictions["end_date"] !== null &&
					restrictions["end_date"] !== undefined
				) &&
				restrictions["day_of_week"].length == 1
			) {
				// console.log("entras 2" , tariffElement)
				let weekDays = 0;
				let daysOfWeek = 0;
				for (let weekIndex = 0; weekIndex < weeks; weekIndex++) {
					for (let pushIndex = 0; pushIndex < restrictions["day_of_week"].length; pushIndex++) {
						let weekDayStartDay = new Date(sessionStartDate).getDay();
						let restrictionDayStart = dayOfWeekObj[restrictions["day_of_week"][pushIndex]];
						let diffDays = restrictionDayStart - weekDayStartDay + weekDays;
						let startDate = moment.utc(sessionStartDate).add(diffDays, "days").format("YYYY-MM-DD");
						let endDate = moment.utc(startDate).add(24, "hours").format("YYYY-MM-DD");
						let newElement = {
							restrictions: {
								...restrictions,
								day_of_week: [restrictions["day_of_week"][pushIndex]],
								start_date: startDate,
								end_date: endDate,
							},
							price_components: elements[elementIndex].price_components,
						};
						elements.splice(elementIndex + daysOfWeek + pushIndex + 1, 0, newElement);
					}
					weekDays += 7;
					daysOfWeek += restrictions["day_of_week"].length;
				}
				elements.splice(elementIndex, 1);
			}
		}
		elementIndex++;
	}

	return elements;
}

function validateVoltageLevel(voltageLevel) {
    const existingVoltageLevels = ["BTN", "BTE", "MT"];
    return existingVoltageLevels.includes(voltageLevel) ? voltageLevel : "BTN";
}


module.exports = {
    adjustRestrictions,
    obeysRestrictions,
    roundingsValidation,
    roundingGranularityRules,
    tariffIsValid,
    createTariffElementsAccordingToRestriction,
    validateVoltageLevel
};