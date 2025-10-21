require("dotenv-safe").load();
const moment = require("moment");
const {
	opcTariffsPrices,
	adjustCpoEnergyArray,
	adjustCpoTimeArray,
	getAcpDifference,
	getFinalValues,
} = require("./tariffHandler");
const {
	getTimezone,
	getChargerOffset,
	round,
	sumTotal,
	defaultTitle,
	getUnroundedValue,
	getTitle,
	removeUnnecessaryDateRestriction
} = require("../../utils/utils");
const { createTariffElementsAccordingToRestriction, validateVoltageLevel } = require("./tariffValidations");
const { getTariffCemeByDate, calculateCemeAndTar, pushCemeAndTarInfo } = require("./tariffCEMEAndTARHandler");
const { getCEMEandTar, getTariffCEMEbyPlan } = require("../../caching/tariffs");
const { getFees } = require("../../caching/fees");
const { findOnePlatform } = require("../../caching/platforms");
const { getDefaultOPCTariff } = require("../../caching/defaultTariff");
const  Constants  = require("../../utils/constants");
const { TariffsService } = require("evio-library-ocpi");

 function calculateMobieOpcTariffs(data, walletFound) {
	const context = "Function calculateMobieOpcTariffs";
	try {
		let {
			elements = [],
			planId,
			sessionStartDate,
			sessionStopDate,
			offset = 0,
			power,
			voltage,
			total_energy,
			total_charging_time,
			total_parking_time,
			countryCode,
			timeZone,
			source,
			latitude,
			longitude,
			voltageLevel = "BTN",
			address,
			clientName,
			evEfficiency = 171,
			tariffCEME, tariffTAR, TAR_Schedule,
			fees,
			foundPlatform
		} = data;

		const totalKmToUse = 100;
		const ROUND_DECIMALS = 6;
		const ROUND_TO_INT = 0;
		const evEfficiencyPerKwhPerKm = evEfficiency / 1000; //Change from watts to kW
		if (elements.length > 0) {
			elements = createTariffElementsAccordingToRestriction(elements, sessionStartDate, sessionStopDate);
		}

		if (
			(countryCode !== null && countryCode !== undefined) ||
			(latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined)
		) {
			offset = getChargerOffset(timeZone, countryCode, latitude, longitude);
		}

		voltageLevel = validateVoltageLevel(voltageLevel);

		total_charging_time = round(total_charging_time, 6);
		total_energy = round(round(total_energy, 6), 0);

		let [flat, energy, time, parking] = opcTariffsPrices(
			null,
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
		);
		let [OCP_PRICE_FLAT, OCP_PRICE_ENERGY, OCP_PRICE_TIME, OCP_PRICE_PARKING_TIME] = [
			flat.price,
			energy.price,
			time.price,
			parking.price,
		];

		let OPC_Price = OCP_PRICE_FLAT + OCP_PRICE_ENERGY + OCP_PRICE_TIME + OCP_PRICE_PARKING_TIME;

		let opc = { flat, energy, time, parking, price: OPC_Price };

		timeZone = timeZone ? timeZone : getTimezone(latitude, longitude);
		let localSessionStartDate = moment.utc(sessionStartDate).add(offset, "minutes").format();
		let localSessionStopDate = moment.utc(sessionStopDate).add(offset, "minutes").format();

		let tariffArray = getTariffCemeByDate(tariffCEME, localSessionStartDate);
		tariffCEME.tariff = tariffArray;

		let { ceme, tar } = calculateCemeAndTar(
			TAR_Schedule,
			tariffCEME,
			tariffTAR,
			total_charging_time,
			total_energy,
			localSessionStartDate,
			localSessionStopDate,
			voltageLevel
		);


		let iec = { price: fees.IEC * total_energy };

		let activationFee = Number(tariffCEME.activationFeeAdHoc && tariffCEME.activationFeeAdHoc.value > 0
			? tariffCEME.activationFeeAdHoc.value
			: Constants.adHocActivationFeeCard);

		let emsp = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
		let cpo = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
		let vat = {
			total: 0,
			totalBykWh: 0,
			percentage: fees.IVA * 100,
			totalByKmh: 0,
		};
		let total = { total: 0, totalBykWh: 0, totalKm: 0, totalByTime: 0, totalByKmh: 0 };
		if (energy.info) energy.info = adjustCpoEnergyArray(energy.info, total_energy);
        if (time.info) time.info = adjustCpoTimeArray(time.info, round(total_charging_time * 3600, 0));
		pushOpcInfo(cpo.entries, flat.info, "cpoFlat");
		pushOpcInfo(cpo.entries, energy.info, "cpoEnergy");
		pushOpcInfo(cpo.entries, time.info, "cpoTime");

		let totalPriceCpo = sumTotal(cpo.entries);
		let totalBykWhCpo = total_energy > 0 ? round(totalPriceCpo / total_energy) : 0;

		let totalByKmhCpo =
			total_energy > 0 ? round((totalPriceCpo / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse) : 0;
		cpo.total = totalPriceCpo;
		cpo.totalBykWh = totalBykWhCpo;
		cpo.totalByKmh = totalByKmhCpo;


		let mobieDiscount;
		let dateNow = new Date();
		if (dateNow < new Date("2024-01-01T00:00:00.000Z")) {
			mobieDiscount = Number(
				foundPlatform
					? foundPlatform.discount
						? foundPlatform.discount
						: Constants.networks.mobie.grant
					: Constants.networks.mobie.grant
			);
		} else if(dateNow < new Date("2025-01-01T00:00:00.000Z")) {
			mobieDiscount = Number(
				foundPlatform
					? foundPlatform.discount
						? foundPlatform.discount
						: Constants.networks.mobie.grantNew
					: Constants.networks.mobie.grantNew
			);

		} else {
			mobieDiscount = Number(
				foundPlatform
					? foundPlatform.discount
						? foundPlatform.discount
						: 0
					: 0
			);
		}
	
		mobieDiscount = total_charging_time * 60 >= 2 ? mobieDiscount : 0;
		let activationEntry = {
			label: "activationFee",
			unit: "UN",
			unitPrice: activationFee,
			quantity: 1,
			total: round(activationFee, 2),
			group: "activation",
			title: defaultTitle("activationFee"),
		};
		let mobieDiscountEntry = {
			label: "mobieDiscount",
			unit: "UN",
			unitPrice: mobieDiscount,
			quantity: 1,
			total: round(mobieDiscount, 2),
			group: "activation",
			title: defaultTitle("mobieDiscount"),
		};

		let totalActivationWithDiscount = round(activationEntry.total + mobieDiscountEntry.total, 2);
		let totalUnitPriceActivationWithDiscount = round(activationEntry.unitPrice + mobieDiscountEntry.unitPrice, 4);

		let activationWithDiscountEntry = {
			label: "activationFeeWithDiscount",
			unit: "UN",
			unitPrice: totalUnitPriceActivationWithDiscount,
			quantity: 1,
			total: totalActivationWithDiscount,
			title: defaultTitle("activationFeeWithDiscount"),
			collapsable: true,
			collapseGroup: "activation",
		};

		emsp.entries.push(activationWithDiscountEntry);
		emsp.entries.push(activationEntry);
		emsp.entries.push(mobieDiscountEntry);

		let emspEntries = [];
		ceme.info = adjustCemeTarEnergyArray(ceme.info, total_energy);
		tar.info = adjustCemeTarEnergyArray(tar.info, total_energy);
		pushCemeAndTarInfo(emspEntries, ceme.info, "ceme", "energy");
		pushCemeAndTarInfo(emspEntries, tar.info, "tar", "energy");

		let iecEntry = {
			label: "iec",
			unit: "kWh",
			unitPrice: fees.IEC,
			quantity: total_energy,
			total: round(iec.price),
			group: "energy",
			title: defaultTitle("iec"),
		};
		emspEntries.push(iecEntry);
		let unroundedValue;
		if (clientName === process.env.WhiteLabelSC) {
			unroundedValue = getUnroundedValue(emspEntries);
			unroundedValue = unroundedValue / total_energy;
		}
		let groupEnergyTotal = sumTotal(emspEntries.filter((elem) => elem.group === "energy"));
		let groupEnergyUnitPrice =
			total_energy > 0
				? clientName === process.env.WhiteLabelSC
					? round(unroundedValue, 4)
					: round(groupEnergyTotal / total_energy, 2)
				: 0;
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
		emsp.entries.push(energyEntry);
		emsp.entries.push(...emspEntries);

		let totalPriceEmsp = sumTotal(emsp.entries.filter((elem) => elem.collapsable));

		let totalBykWhEmsp = total_energy > 0 ? round(totalPriceEmsp / total_energy) : 0;

		let totalByKmhEmsp =
			total_energy > 0 ? round((totalPriceEmsp / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse) : 0;

		emsp.total = totalPriceEmsp;
		emsp.totalBykWh = totalBykWhEmsp;
		emsp.totalByKmh = totalByKmhEmsp;

		let totalUnitPriceVat = round(totalPriceEmsp + totalPriceCpo);
		let totalPriceVat = round(totalUnitPriceVat * fees.IVA);

		vat.total = totalPriceVat;
		vat.totalBykWh = total_energy > 0 ? round(totalPriceVat / total_energy) : 0;
		vat.totalByKmh =
			total_energy > 0 ? round((totalPriceVat / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse) : 0;

		let totalPrice = round(totalPriceEmsp + totalPriceCpo + totalPriceVat);
		let totalPriceBykWh = total_energy > 0 ? round(totalPrice / total_energy) : 0;
		let totalPriceByKmh =
			total_energy > 0 ? round((totalPrice / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse) : 0;
		let totalKmGivenEnergy = total_energy > 0 ? round(total_energy / evEfficiencyPerKwhPerKm) : 0;
		total.total = totalPrice;
		total.totalBykWh = totalPriceBykWh;
		total.totalByTime = total_charging_time > 0 ? round(totalPrice / (total_charging_time * 60)) : 0;
		total.totalByKmh = totalPriceByKmh;
		total.totalKm = totalKmGivenEnergy;
		total.totalEnergy = total_energy;

		let { opcPrice, cemePrice, feesPrice, total_incl_vat } = getFinalValues(totalPriceCpo, emsp, fees);

		if (walletFound) {
			let walletAmount = walletFound.amount.value;
			if (walletAmount >= total_incl_vat + 1) {
				activationFee = tariffCEME.activationFee
					? tariffCEME.activationFee.value > 0
						? tariffCEME.activationFee.value
						: Number(process.env.AD_HOC_Activation_Fee_Wallet)
					: Number(process.env.AD_HOC_Activation_Fee_Wallet);

				const activationEntryIndex = emsp.entries.findIndex((object) => object.label === "activationFee");
				const activationWithDiscountEntryIndex = emsp.entries.findIndex(
					(object) => object.label === "activationFeeWithDiscount"
				);

				if (activationEntryIndex >= 0 && activationWithDiscountEntryIndex >= 0) {
					emsp.entries[activationEntryIndex].unitPrice = activationFee;
					emsp.entries[activationEntryIndex].total = round(activationFee);

					totalActivationWithDiscount = round(round(activationFee) + mobieDiscountEntry.total, 2);
					totalUnitPriceActivationWithDiscount = round(activationFee + mobieDiscountEntry.unitPrice, 4);

					emsp.entries[activationWithDiscountEntryIndex].unitPrice = totalUnitPriceActivationWithDiscount;
					emsp.entries[activationWithDiscountEntryIndex].total = totalActivationWithDiscount;
					totalBykWhEmsp = total_energy > 0 ? round(totalPriceEmsp / total_energy) : 0;
					totalByKmhEmsp =
						total_energy > 0
							? round((totalPriceEmsp / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse)
							: 0;
					emsp.total = totalPriceEmsp;
					emsp.totalBykWh = totalBykWhEmsp;
					emsp.totalByKmh = totalByKmhEmsp;

					totalUnitPriceVat = round(totalPriceEmsp + totalPriceCpo);
					totalPriceVat = round(totalUnitPriceVat * fees.IVA);

					vat.total = totalPriceVat;
					vat.totalBykWh = total_energy > 0 ? round(totalPriceVat / total_energy) : 0;
					vat.totalByKmh =
						total_energy > 0
							? round((totalPriceVat / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse)
							: 0;

					let final = getFinalValues(totalPriceCpo, emsp, fees);
					opcPrice = final.opcPrice;
					cemePrice = final.cemePrice;
					feesPrice = final.feesPrice;
					total_incl_vat = final.total_incl_vat;

					totalPrice = round(totalPriceEmsp + totalPriceCpo + totalPriceVat);
					totalPriceBykWh = total_energy > 0 ? round(totalPrice / total_energy) : 0;
					totalPriceByKmh =
						total_energy > 0
							? round((totalPrice / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse)
							: 0;

					total.total = totalPrice;
					total.totalBykWh = totalPriceBykWh;
					total.totalByTime = total_charging_time > 0 ? round(totalPrice / (total_charging_time * 60)) : 0;
					total.totalByKmh = totalPriceByKmh;
				}
			}
		}
		let acpDifference;
		/* TODO: restore once this is to be deployed for ACP
			if (clientName === process.env.WhiteLabelACP) {
				acpDifference = await getAcpDifference(
					tariffCEME,
					emsp.entries,
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
				);
			}
	*/

		return {
			opc: opcPrice,
			ceme: cemePrice,
			fees: feesPrice,
			total: total_incl_vat,
			detail: { emsp, cpo, vat, total, acpDifference },
		};
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		throw error;
	}
}

//TODO: This and the calculation of OpcTariffs have a lot of logic in common, when we have
//time we should refactor this to avoid code duplication
function calculateRoamingOpcTariffs(data) {
	const context = "Function calculateRoamingOpcTariffs";
	try {
		let {
			elements = [],
			roamingPlanId,
			sessionStartDate,
			sessionStopDate,
			offset = 0,
			power,
			voltage,
			total_energy,
			total_charging_time,
			total_parking_time,
			charging_periods,
			countryCode,
			timeZone,
			partyId,
			source,
			evseGroup,
			currency = "EUR",
			latitude,
			longitude,
			evEfficiency = 171,
			fees,
			foundPlatform,
			defaultTariff,
			roamingTariff,
			tariffs = []
		} = data;
		const totalKmToUse = 100;
		const SECONDS_IN_HOUR = 3600;
		const MINUTES_IN_HOUR = 60;
		const ROUND_DECIMALS = 6;
		const ROUND_TO_INT = 0;
		const evEfficiencyPerKwhPerKm = evEfficiency / 1000; //Change from watts to kW
		if (countryCode || (latitude && longitude)) {
			offset = getChargerOffset(timeZone, countryCode, latitude, longitude);
		}

		if (Array.isArray(elements) && elements.length > 0) {
			elements = createTariffElementsAccordingToRestriction(elements, sessionStartDate, sessionStopDate);
		} else {
			if (Array.isArray(tariffs) && tariffs.length > 0) {
				const localSessionStartDate = moment.utc(sessionStartDate).add(offset, 'minutes').format();
				const matchingTariff = TariffsService.findMatchingTariff(tariffs , localSessionStartDate);
				elements = createTariffElementsAccordingToRestriction(
					matchingTariff.elements,
					sessionStartDate,
					sessionStopDate
				);
			} else {
				let tariffOPC = typeof defaultTariff === 'string' ? JSON.parse(defaultTariff) : defaultTariff;
				elements = tariffOPC.elements
					? createTariffElementsAccordingToRestriction(tariffOPC.elements, sessionStartDate, sessionStopDate)
					: [];
				currency = tariffOPC.currency || currency;
			}
		}


		// ======================= CPO TARIFFS ======================= //

		total_charging_time = round(total_charging_time, ROUND_DECIMALS);
		total_energy = round(round(total_energy, ROUND_DECIMALS), ROUND_TO_INT);
		let totalTimeConsumedSeconds = round(total_charging_time * SECONDS_IN_HOUR, ROUND_TO_INT);
		let totalTimeConsumedMinutes = round(total_charging_time * MINUTES_IN_HOUR, ROUND_DECIMALS);

		let cpo = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
		let emsp = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
		let priceComponent = {
			entries: [],
			total: 0,
			totalBykWh: 0,
			totalByKmh: 0,
		};
		let vat = {
			total: 0,
			totalBykWh: 0,
			percentage: fees.IVA * 100,
			totalByKmh: 0,
		};
		let total = { total: 0, totalBykWh: 0, totalByTime: 0, totalByKmh: 0, totalKm:0, totalEnergy:0 };

		let [flat, energy, time, parking] = opcTariffsPrices(
			null,
			elements,
			sessionStartDate,
			sessionStopDate,
			0,
			power,
			voltage,
			total_energy,
			total_charging_time,
			total_parking_time,
			source
		);

		let [OCP_PRICE_FLAT, OCP_PRICE_ENERGY, OCP_PRICE_TIME, OCP_PRICE_PARKING_TIME] = [
			flat.price,
			energy.price,
			time.price,
			parking.price,
		];

		energy.info = adjustCpoEnergyArray(energy.info, total_energy);
		time.info = adjustCpoTimeArray(time.info, totalTimeConsumedSeconds);
		pushOpcInfo(cpo.entries, flat.info, "cpoFlat");
		pushOpcInfo(cpo.entries, energy.info, "cpoEnergy");
		pushOpcInfo(cpo.entries, time.info, "cpoTime");

		let totalPriceCpo = sumTotal(cpo.entries);
		let totalBykWhCpo = total_energy > 0 ? round(totalPriceCpo / total_energy) : 0;
		let totalByKmhCpo =
			total_energy > 0 ? round((totalPriceCpo / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse) : 0;

		cpo.total = totalPriceCpo;
		cpo.totalBykWh = totalBykWhCpo;
		cpo.totalByKmh = totalByKmhCpo;

		// ======================= EMSP TARIFFS ======================= //
		//TODO: We should get the roamingTariff by the id and not by the source. We'll probably have many Roaming cemes to a specific network
		
		let tariffArray = getTariffCemeByDate(roamingTariff, sessionStartDate);
		roamingTariff.tariff = tariffArray;
		let CEME_FLAT = roamingTariff.tariff.find((tariff) => tariff.type === "flat");
		let CEME_POWER = roamingTariff.tariff.find((tariff) => tariff.type === "energy");
		let CEME_TIME = roamingTariff.tariff.find((tariff) => tariff.type === "time");
		let CEME_PERCENTAGE = roamingTariff.tariff.find((tariff) => tariff.type === "percentage");

		const CEME_Price_FLAT = CEME_FLAT?.price || 0;
		const CEME_Price_POWER = CEME_POWER?.price || 0;
		const CEME_Price_TIME = CEME_TIME?.price || 0;
		const evioPercentage = CEME_PERCENTAGE?.price || 0;

		// for Hubject
		let CEME_START_PERCENTAGE = roamingTariff.tariff.find((tariff) => tariff.type === "start_percentage");
		let CEME_ENERGY_PERCENTAGE = roamingTariff.tariff.find((tariff) => tariff.type === "energy_percentage");
		let CEME_TIME_PERCENTAGE = roamingTariff.tariff.find((tariff) => tariff.type === "time_percentage");
		let CEME_Price_Start_Percentage = CEME_START_PERCENTAGE ? CEME_START_PERCENTAGE.price : 0;
		let CEME_Price_Energy_Percentage = CEME_ENERGY_PERCENTAGE ? CEME_ENERGY_PERCENTAGE.price : 0;
		let CEME_Price_Time_Percentage = CEME_TIME_PERCENTAGE ? CEME_TIME_PERCENTAGE.price : 0;

		let chargingSessionTime = total_charging_time;
		if (CEME_TIME) {
			switch (true) {
				case CEME_TIME.uom.includes("min"):
					chargingSessionTime = totalTimeConsumedMinutes;
					break;
				case CEME_TIME.uom.includes("h"):
					chargingSessionTime = total_charging_time;
					break;
				case CEME_TIME.uom.includes("s"):
					chargingSessionTime = totalTimeConsumedSeconds;
					break;
			}
		}
		let hubFee;
		if (source === process.env.GirevePlatformCode)
			hubFee = foundPlatform
				? foundPlatform.hubFee
					? foundPlatform.hubFee
					: Number(process.env.GireveCommission)
				: Number(process.env.GireveCommission);
		else if (source === process.env.HubjectPlatformCode)
			hubFee = foundPlatform
				? foundPlatform.hubFee
					? foundPlatform.hubFee
					: Number(process.env.HubjectCommission)
				: Number(process.env.HubjectCommission);

		hubFee = total_energy * 1000 <= Number(process.env.MinimumEnergyToBillingGireve) ? 0 : hubFee;

		let emspFlatCost = round(CEME_Price_FLAT) + round(hubFee);

		let emspEnergyCost = round(round(CEME_Price_POWER) * round(total_energy));

		let emspTimeCost = round(round(CEME_Price_TIME) * round(chargingSessionTime));

		let percentageFlatCost = round(
			round(evioPercentage) * round(OCP_PRICE_FLAT, 4) +
				round(CEME_Price_Start_Percentage) * round(OCP_PRICE_FLAT, 4)
		);
		let percentageEnergyCost = round(
			round(evioPercentage) * round(OCP_PRICE_ENERGY, 4) +
				round(CEME_Price_Energy_Percentage) * round(OCP_PRICE_ENERGY, 4)
		);
		let percentageTimeCost = round(
			round(evioPercentage) * round(OCP_PRICE_TIME, 4) +
				round(CEME_Price_Time_Percentage) * round(OCP_PRICE_TIME, 4)
		);

		let finalEmspFlatCost = round(emspFlatCost + percentageFlatCost);
		let finalEmspEnergyCost = round(emspEnergyCost + percentageEnergyCost);
		let finalEmspTimeCost = round(emspTimeCost + percentageTimeCost);

		let flatEntry = createProviderEntry(
			1,
			"UN",
			finalEmspFlatCost,
			finalEmspFlatCost,
			finalEmspFlatCost,
			1,
			{ type: "FLAT" },
			null,
			source
		);
		let energyEntry = createProviderEntry(
			total_energy,
			"kWh",
			finalEmspEnergyCost,
			finalEmspEnergyCost,
			total_energy > 0 ? round(finalEmspEnergyCost / total_energy, 4) : 0,
			1,
			{ type: "ENERGY" },
			null,
			source
		);
		let timeEntry = createProviderEntry(
			totalTimeConsumedSeconds,
			"s",
			finalEmspTimeCost,
			finalEmspTimeCost,
			totalTimeConsumedMinutes > 0 ? round(finalEmspTimeCost / totalTimeConsumedMinutes, 4) : 0,
			1,
			{ type: "TIME" },
			null,
			source
		);
		if (finalEmspFlatCost) pushProviderInfo(emsp.entries, flatEntry, "defaultFlat", currency);
		if (finalEmspEnergyCost) pushProviderInfo(emsp.entries, energyEntry, "defaultEnergy", currency);
		if (finalEmspTimeCost) pushProviderInfo(emsp.entries, timeEntry, "defaultTime", currency);

		let totalPriceProvider = sumTotal(emsp.entries);
		let totalBykWhProvider = total_energy > 0 ? round(totalPriceProvider / total_energy) : 0;
		let totalByKmhProvider =
			total_energy > 0
				? round((totalPriceProvider / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse)
				: 0;

		emsp.total = totalPriceProvider;
		emsp.totalBykWh = totalBykWhProvider;
		emsp.totalByKmh = totalByKmhProvider;

		let priceComponentCpoEntries = addEmspPercentagePriceToCpo(
			cpo.entries,
			evioPercentage,
			CEME_Price_Start_Percentage,
			CEME_Price_Energy_Percentage,
			CEME_Price_Time_Percentage
		);

		let emspFlatEntry = createProviderEntry(
			1,
			"UN",
			emspFlatCost,
			emspFlatCost,
			emspFlatCost,
			1,
			{ type: "FLAT" },
			null,
			source
		);
		let emspEnergyEntry = createProviderEntry(
			total_energy,
			"kWh",
			emspEnergyCost,
			emspEnergyCost,
			total_energy > 0 ? round(emspEnergyCost / total_energy, 4) : 0,
			1,
			{ type: "ENERGY" },
			null,
			source
		);
		let emspTimeEntry = createProviderEntry(
			totalTimeConsumedSeconds,
			"s",
			emspTimeCost,
			emspTimeCost,
			totalTimeConsumedMinutes > 0 ? round(emspTimeCost / totalTimeConsumedMinutes, 4) : 0,
			1,
			{ type: "TIME" },
			null,
			source
		);

		priceComponentCpoEntries = emspFlatCost
			? addEmspTariffsToCpo(priceComponentCpoEntries, emspFlatEntry, "defaultFlat", currency)
			: priceComponentCpoEntries;
		priceComponentCpoEntries = emspEnergyCost
			? addEmspTariffsToCpo(priceComponentCpoEntries, emspEnergyEntry, "defaultEnergy", currency)
			: priceComponentCpoEntries;
		priceComponentCpoEntries = emspTimeCost
			? addEmspTariffsToCpo(priceComponentCpoEntries, emspTimeEntry, "defaultTime", currency)
			: priceComponentCpoEntries;

		priceComponent.entries = priceComponentCpoEntries;
		let totalPricePriceComponent = sumTotal(priceComponent.entries);
		let totalBykWhPriceComponent = total_energy > 0 ? round(totalPricePriceComponent / total_energy) : 0;
		let totalByKmhPriceComponent =
			total_energy > 0
				? round((totalPricePriceComponent / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse)
				: 0;

		priceComponent.total = totalPricePriceComponent;
		priceComponent.totalBykWh = totalBykWhPriceComponent;
		priceComponent.totalByKmh = totalByKmhPriceComponent;

		let totalEntries = [...priceComponent.entries];
		let totalFlatSum = sumTotal(totalEntries.filter((elem) => elem.label.includes("Flat")));
		let totalEnergySum = sumTotal(totalEntries.filter((elem) => elem.label.includes("Energy")));
		let totalTimeSum = sumTotal(totalEntries.filter((elem) => elem.label.includes("Time")));

		let totalUnitPriceVat = round(totalPricePriceComponent);
		let totalPriceVat = round(totalUnitPriceVat * fees.IVA);

		vat.total = totalPriceVat;
		vat.totalBykWh = total_energy > 0 ? round(totalPriceVat / total_energy) : 0;
		vat.totalByKmh =
			total_energy > 0 ? round((totalPriceVat / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse) : 0;

		let totalPrice = round(totalUnitPriceVat + totalPriceVat);
		let totalPriceBykWh = total_energy > 0 ? round(totalPrice / total_energy) : 0;
		let totalPriceByKmh =
			total_energy > 0 ? round((totalPrice / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse) : 0;

		total.total = round(totalUnitPriceVat + totalPriceVat);
		total.totalBykWh = totalPriceBykWh;
		total.totalByTime = total_charging_time > 0 ? round(totalPrice / (total_charging_time * 60)) : 0;
		total.totalByKmh = totalPriceByKmh;
		let totalKmGivenEnergy = total_energy > 0 ? round(total_energy / evEfficiencyPerKwhPerKm) : 0;
		total.totalKm = totalKmGivenEnergy;
		total.totalEnergy = total_energy;
		flat.price = totalFlatSum;
		energy.price = totalEnergySum;
		time.price = totalTimeSum;

		let energyLabelValue = energy.price > 0 && total_energy > 0 ? energy.price / total_energy : 0;
		let energyLabelUom = `kWh`;

		let timeLabelValue = time.price > 0 && total_charging_time > 0 ? time.price / (total_charging_time * 60) : 0;
		let timeLabelUom = `min`;

		let parkingTimeLabelValue =
			parking.price > 0 && total_parking_time > 0 ? parking.price / (total_parking_time * 60) : 0;
		let parkingTimeLabelUom = `min`;

		/* 
            It's always relevant to keep all decimal places and round it up in the end, but for this purpose,
            I think we can show up to 3 decimals in each dimension e round up to 2 in the final cost (unless mobile rounds it all up)
        */

		flat.label = { value: 1, uom: "un" };
		energy.label = {
			value: Number(energyLabelValue.toFixed(4)),
			uom: energyLabelUom,
		};
		time.label = {
			value: Number(timeLabelValue.toFixed(4)),
			uom: timeLabelUom,
		};
		parking.label = {
			value: Number(parkingTimeLabelValue.toFixed(4)),
			uom: parkingTimeLabelUom,
		};

		flat.price = Number(flat.price.toFixed(3));
		energy.price = Number(energy.price.toFixed(3));
		time.price = Number(time.price.toFixed(3));
		parking.price = Number(parking.price.toFixed(3));

		let total_exc_vat = flat.price + energy.price + time.price + parking.price;
		let total_incl_vat = round(total_exc_vat) + round(total_exc_vat * fees.IVA);
		let total_cost = {
			excl_vat: round(total_exc_vat),
			incl_vat: round(total_incl_vat),
		};

		vat.value = round(total_exc_vat * fees.IVA);
		vat.percentage = fees.IVA * 100;
		return {
			flat,
			energy,
			time,
			parking,
			total_cost,
			currency,
			vat,
			detail: { priceComponent, vat, total },
		};
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		throw error.message;
	}
}

function calculateEvioPrices(data, walletFound) {
  let {
    sessionStartDate,
    sessionStopDate,
    power,
    voltage,
    total_energy,
    total_charging_time,
    total_parking_time,
    countryCode,
    timeZone,
    source,
    latitude,
    longitude,
    evEfficiency = 171,
    fees,
    tariff,
  } = data;
  const elements = tariff?.elements || [];

  const totalKmToUse = 100;
  const ROUND_DECIMALS = 6;
  const ROUND_TO_INT = 0;
  const evEfficiencyPerKwhPerKm = evEfficiency / 1000; 

  total_charging_time = round(total_charging_time, ROUND_DECIMALS);
  total_energy = round(round(total_energy, ROUND_DECIMALS), ROUND_TO_INT);

  const [flat, energy, time, parking] = TariffsService.calculateCpoPrices(
    elements,
    sessionStartDate,
    sessionStopDate,
    timeZone,
    countryCode,
    power,
    voltage,
    total_energy,
    total_charging_time,
    total_parking_time,
    source,
    latitude,
    longitude
  );

  const cpo = calculateCpoDetails(
    flat.info,
    energy.info,
    time.info,
    total_energy,
    totalKmToUse,
    evEfficiencyPerKwhPerKm
  );
  const vat = calculateVatDetails(
    cpo.total,
    total_energy,
    totalKmToUse,
    evEfficiencyPerKwhPerKm,
    fees
  );
  const total = calculateTotalDetails(
    cpo.total + vat.total,
    total_energy,
    total_charging_time,
    totalKmToUse,
    evEfficiencyPerKwhPerKm
  );

  return {
    total,
    vat,
    detail: { priceComponent: cpo, vat, total },
  };
}

function calculateTeslaPrices(data, walletFound) {
	console.log("calculateTeslaPrices"); //TBD with Ricardo if it should be migrated or not since it's not relevant.
	return null;
}

function pushOpcInfo(cpo, info, label) {
	const context = "Function pushOpcInfo";
	try {
		if (!info) return;
		for (let entry of info) {
			let title = getTitle(entry);
			cpo.push({
				label: label,
				unit: entry.unit,
				unitPrice: entry.componentPrice,
				quantity: entry.quantity,
				total: entry.totalPrice >= 0 ? entry.totalPrice : entry.cost,
				title: [
					...removeUnnecessaryDateRestriction(title.flat),
					...removeUnnecessaryDateRestriction(title.energy),
					...removeUnnecessaryDateRestriction(title.time),
					...removeUnnecessaryDateRestriction(title.parking),
				],
			});
		}
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
	}
}

function adjustCemeTarEnergyArray(info, totalEnergy) {
	try {
		let totalCalculatedEnergy = 0;
		let roundedQuantitiesArray = info.map((element, index) => {
			let consumedEnergykWh = round(element.consumedEnergykWh, 0);
			totalCalculatedEnergy += consumedEnergykWh;
			let totalPrice = round(element.tariff.price * consumedEnergykWh, 2);
			return {
				...element,
				consumedEnergykWh,
				totalPrice,
			};
		});
		roundedQuantitiesArray[0].consumedEnergykWh += totalEnergy - totalCalculatedEnergy;
		return roundedQuantitiesArray.map((element, index) => {
			let consumedEnergykWh = round(element.consumedEnergykWh, 0);
			let totalPrice = round(element.tariff.price * consumedEnergykWh, 2);
			return {
				...element,
				consumedEnergykWh,
				totalPrice,
			};
		});
	} catch (error) {
		console.error("Error in adjustCemeTarEnergyArray:", error.message);
		return [];
	}
}

function createProviderEntry(
	quantity,
	unit,
	cost,
	totalPrice,
	componentPrice,
	componentStepSize,
	component,
	restrictions,
	source
) {
	const context = "Function createProviderEntry";
	try {
		return {
			quantity,
			unit,
			cost,
			totalPrice,
			componentPrice,
			componentStepSize,
			component,
			restrictions,
			source,
		};
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return {};
	}
}

function pushProviderInfo(provider, entry, label, currency) {
	const context = "Function pushProviderInfo";
	try {
		let title = getTitle(entry, currency);
		provider.push({
			label: label,
			unit: entry.unit,
			unitPrice: entry.componentPrice,
			quantity: entry.quantity,
			total: entry.totalPrice >= 0 ? entry.totalPrice : entry.cost,
			title: [...title.flat, ...title.energy, ...title.time, ...title.parking],
		});
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
	}
}

function addEmspPercentagePriceToCpo(
	cpoEntries,
	evioPercentage,
	cemeStartPercentage,
	cemePriceEnergyPercentage,
	cemePriceTimePercentage
) {
	const context = "Function addEmspPercentagePriceToCpo";
	try {
		let entries = [];
		for (let element of cpoEntries) {
			if (element.label.includes("Flat")) {
				let total = round(
					element.total + element.total * evioPercentage + element.total * cemeStartPercentage
				);
				let unitPrice = total;
				let title = element.title.map((title) => {
					return {
						...title,
						values: title.values.map((value) => {
							return { ...value, price: unitPrice };
						}),
					};
				});
				if (total) {
					entries.push({ ...element, total, unitPrice, title });
				}
			} else if (element.label.includes("Energy")) {
				let unitPrice =
					element.quantity > 0
						? round(
								element.unitPrice +
									element.unitPrice * evioPercentage +
									element.unitPrice * cemePriceEnergyPercentage,
								4
						  )
						: 0;
				let total = round(element.quantity * unitPrice);

				let title = element.title.map((title) => {
					return {
						...title,
						values: title.values.map((value) => {
							return { ...value, price: unitPrice };
						}),
					};
				});
				if (total) {
					entries.push({ ...element, total, unitPrice, title });
				}
			} else if (element.label.includes("Time")) {
				let unitPrice =
					element.quantity > 0
						? round(
								element.unitPrice +
									element.unitPrice * evioPercentage +
									element.unitPrice * cemePriceTimePercentage,
								4
						  )
						: 0;
				let total = round((element.quantity / 60) * unitPrice);
				let title = element.title.map((title) => {
					return {
						...title,
						values: title.values.map((value) => {
							return { ...value, price: unitPrice };
						}),
					};
				});
				if (total) {
					entries.push({ ...element, total, unitPrice, title });
				}
			} else {
				entries.push(element);
			}
		}
		return entries;
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return cpoEntries;
	}
}

function addEmspTariffsToCpo(cpoEntries, entry, label, currency) {
	const context = "Function addEmspTariffsToCpo";
	try {
		if (entry.totalPrice > 0) {
			let defaultEntryIndex = cpoEntries.findIndex((obj) =>
				obj.title.find((title) => title.restrictionType === label)
			);
			if (defaultEntryIndex > -1) {
				if (cpoEntries[defaultEntryIndex].label.includes("Flat")) {
					let total = round(cpoEntries[defaultEntryIndex].total + entry.totalPrice);
					let unitPrice = total;
					let title = cpoEntries[defaultEntryIndex].title.map((title) => {
						return {
							...title,
							values: title.values.map((value) => {
								return { ...value, price: unitPrice };
							}),
						};
					});
					cpoEntries[defaultEntryIndex] = { ...cpoEntries[defaultEntryIndex], total, unitPrice, title };
				} else if (cpoEntries[defaultEntryIndex].label.includes("Energy")) {
					let total = round(cpoEntries[defaultEntryIndex].total + entry.totalPrice);
					let unitPrice = round(total / cpoEntries[defaultEntryIndex].quantity, 4);
					let title = cpoEntries[defaultEntryIndex].title.map((title) => {
						return {
							...title,
							values: title.values.map((value) => {
								return { ...value, price: unitPrice };
							}),
						};
					});
					cpoEntries[defaultEntryIndex] = { ...cpoEntries[defaultEntryIndex], total, unitPrice, title };
				} else if (cpoEntries[defaultEntryIndex].label.includes("Time")) {
					let total = round(cpoEntries[defaultEntryIndex].total + entry.totalPrice);
					let unitPrice = round(total / (cpoEntries[defaultEntryIndex].quantity / 60), 4);
					let title = cpoEntries[defaultEntryIndex].title.map((title) => {
						return {
							...title,
							values: title.values.map((value) => {
								return { ...value, price: unitPrice };
							}),
						};
					});
					cpoEntries[defaultEntryIndex] = { ...cpoEntries[defaultEntryIndex], total, unitPrice, title };
				}
			} else {
				pushProviderInfo(cpoEntries, entry, label, currency);
			}
		}
		return cpoEntries;
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return cpoEntries;
	}
}

function calculateCpoDetails(
  flatInfo,
  energyInfo,
  timeInfo,
  total_energy,
  totalKmToUse,
  evEfficiencyPerKwhPerKm
) {
  const cpo = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };

  pushOpcInfo(cpo.entries, flatInfo, "cpoFlat");
  pushOpcInfo(cpo.entries, energyInfo, "cpoEnergy");
  pushOpcInfo(cpo.entries, timeInfo, "cpoTime");

  const totalPriceCpo = sumTotal(cpo.entries);
  const totalBykWhCpo =
    total_energy > 0 ? round(totalPriceCpo / total_energy) : 0;

  const totalByKmhCpo =
    total_energy > 0
      ? round(
          (totalPriceCpo / (total_energy / evEfficiencyPerKwhPerKm)) *
            totalKmToUse
        )
      : 0;
  cpo.total = totalPriceCpo;
  cpo.totalBykWh = totalBykWhCpo;
  cpo.totalByKmh = totalByKmhCpo;

  return cpo;
}

function calculateVatDetails(
  total,
  total_energy,
  totalKmToUse,
  evEfficiencyPerKwhPerKm,
  fees
) {
  const vat = {
    total: 0,
    totalBykWh: 0,
    percentage: fees.IVA * 100,
    totalByKmh: 0,
  };

  const totalUnitPriceVat = round(total);
  const totalPriceVat = round(totalUnitPriceVat * fees.IVA);

  vat.total = totalPriceVat;
  vat.totalBykWh = total_energy > 0 ? round(totalPriceVat / total_energy) : 0;
  vat.totalByKmh =
    total_energy > 0
      ? round(
          (totalPriceVat / (total_energy / evEfficiencyPerKwhPerKm)) *
            totalKmToUse
        )
      : 0;

  return vat;
}

function calculateTotalDetails(
  totalInclVat,
  total_energy,
  total_charging_time,
  totalKmToUse,
  evEfficiencyPerKwhPerKm
) {
  const total = {
    total: 0,
    totalBykWh: 0,
    totalKm: 0,
    totalByTime: 0,
    totalByKmh: 0,
  };

  const totalPrice = round(totalInclVat);
  const totalPriceBykWh =
    total_energy > 0 ? round(totalPrice / total_energy) : 0;
  const totalPriceByKmh =
    total_energy > 0
      ? round(
          (totalPrice / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse
        )
      : 0;
  const totalKmGivenEnergy =
    total_energy > 0 ? round(total_energy / evEfficiencyPerKwhPerKm) : 0;
  total.total = totalPrice;
  total.totalBykWh = totalPriceBykWh;
  total.totalByTime =
    total_charging_time > 0
      ? round(totalPrice / (total_charging_time * 60))
      : 0;
  total.totalByKmh = totalPriceByKmh;
  total.totalKm = totalKmGivenEnergy;
  total.totalEnergy = total_energy;

  return total;
}

module.exports = {
	calculateMobieOpcTariffs,
	calculateRoamingOpcTariffs,
	calculateEvioPrices,
	calculateTeslaPrices,
};
