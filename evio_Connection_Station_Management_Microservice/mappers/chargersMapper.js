const Constants = require('../utils/constants');
const { Days } = require('../utils/enums/enumDays');
const { Units, VoltageLevels } = require('../utils/enums/enumUnits');
const { PlugStatus, ConnectorFormats, ConnectorPowerTypes, ChargerSubStatus } = require('../utils/enums/enumPlugs');
const { round } = require('../utils/utils');
const { standardiseConnectorType } = require('../middlewares/chargers');
const SUPPORTED_SOURCES_FOR_TARIFF_CALCULATION = [Constants.networks.mobie.name, Constants.networks.gireve.name, Constants.networks.hubject.name];
const PRIVATE_ACCESS = Constants.privateAccess;

const EURO = Units.EURO;
const PLUG_SUBSTATUS_OFFLINE = PlugStatus.OFFLINE;

function mapChargerDetails(dbData, userId) {

	const charger = mapChargerSummary(dbData, userId);
	return {
		...charger,
		details: mapDetails(dbData),
	};
}

function mapChargerSummary(dbData, userId) {
	return {
		_id: dbData?._id,
		name: dbData?.name,
		chargerType: dbData?.chargerType,
		plugPrice: mapPlugPrice(dbData, userId)?.map((plug) => mapPlugs(plug, dbData)),
		latLng: mapLatLng(dbData),
		address: mapAddress(dbData),
		rating: dbData?.rating,
		wrongBehaviorStation: dbData?.wrongBehaviorStation,
	};
}

function mapChargerRankings(dbData, userId) {
	const summary = mapChargerSummary(dbData, userId);
	return {
		...summary,
		updatedAt: dbData?.updatedAt,
	};
}

function mapDetails({
	_id,
	imageContent,
	operator,
	stationIdentifier,
	model,
	manufacturer,
	infoPoints,
	availability,
	parkingType,
	vehiclesType,
	facilitiesTypes,
	POIs,
	purchaseTariff,
	network,
}) {
	const weekSchedule = purchaseTariff?.weekSchedule || [];
	const availabilityDetails = Days.reduce((acc, day, index) => {
		acc[day] = { ranges: weekSchedule[index]?.scheduleTime };
		return acc;
	}, {});

	return {
		_id,
		imageContent,
		operator,
		stationIdentifier,
		model,
		manufacturer,
		infoPoints,
		availability: {
			_id: availability?._id,
			availabilityType: availability?.availabilityType,
			...availabilityDetails,
		},
		parkingType,
		vehicleTypeList: vehiclesType,
		facilitiesTypes,
		POIs,
		network: getNetworkKey(network),
	};
}

function mapAddress({ address }) {
	const { _id, street, number, zipCode, city, country, countryCode, state, floor } = address || {};
	return {
		_id,
		street,
		number,
		zipCode,
		city,
		country,
		countryCode,
		state,
		floor,
	};
}

function shouldPushPlugWithNoTariff(charger, userId) {
	const { source, createUser, accessType } = charger;
	return (
		//If the chargers are EVIO, they don't have the attribute source but they will always have tariffs.
		(source !== undefined && !SUPPORTED_SOURCES_FOR_TARIFF_CALCULATION.includes(source)) ||
		createUser === userId ||
		accessType === PRIVATE_ACCESS
	);
}

function mapPlugPrice(charger, userId) {
	const plugs = charger?.plugs;

	if (!plugs) return [];

	if (!Array.isArray(plugs)) plugs = [plugs];
	if (shouldPushPlugWithNoTariff(charger, userId)) {
		return [plugs[0]];
	}

	return plugs.reduce((plugPrice, plug) => {
		if (!plug.tariff || plug.tariff.length === 0) {
			plug.tariff = plug.tariffId?.map((tariffId) => ({ tariffId })) || [];
		}

		plug.tariff.forEach((tariffUnit) => {
			const existingPlug = plugPrice.find(
				(plugPriceItem) =>
					plugPriceItem.tariff?.tariffId === tariffUnit?.tariffId &&
					plugPriceItem.connectorType === plug.connectorType &&
					plugPriceItem.power === plug.power
			);

			if (!existingPlug && tariffUnit?.detail?.total)  {
				plugPrice.push({ ...plug, tariff: tariffUnit });
			}
		});

		return plugPrice;
	}, []);
}
function mapPlugs(plug, dbData) {
    // Deep clone the plug object to prevent unintended mutations
    const plugClone = JSON.parse(JSON.stringify(plug));

    return {
        _id: `${plugClone?.tariff?._id}${plugClone?.connectorType}${plugClone?.power}`,
        connectorType: standardiseConnectorType(plugClone?.connectorType),
        status: plugClone?.status,
        power: plugClone?.power,
        tension: plugClone?.voltage,
        current: plugClone?.amperage,
        currentType: plugClone?.currentType,
        connectionType: plugClone?.connectionType,
        connectorPowerType: getTranslationKey(plugClone?.connectorPowerType, ConnectorPowerTypes),
        connectorFormat: getTranslationKey(plugClone?.connectorFormat, ConnectorFormats),
        totalPrice: getTotalPrice(plugClone),
        priceBy100Km: getTotalPriceBy100Km(plugClone),
        priceByKwh: getTotalPriceBykWh(plugClone),
        moreKm: plugClone?.tariff?.detail?.total?.totalKm,
        moreKwh: Math.ceil(plugClone?.tariff?.detail?.total?.totalEnergy),
        morePercentage: getTotalPercentage(plugClone),
        plugUnit: dbData.plugs
            .filter((plugUnit) =>
                plugUnit.power === plugClone.power &&
                plugUnit.connectorType === plugClone.connectorType
            )
            .map((plugUnit) => mapPlugUnit(plugUnit, dbData)),
        chargerName: dbData?.name,
        tariffData: mapTariffData(plugClone, dbData),
        tariffPrice: mapTariffPrice(plugClone),
    };
}

function mapLatLng(charger) {
	return {
		latitude: charger?.geometry?.coordinates[1],
		longitude: charger?.geometry?.coordinates[0],
	};
}

function mapPlugUnit(unit, dbData) {

	const result = {
		_id: unit?._id || dbData._id,
		chargerId: unit?.chargerId || dbData._id,
		chargerType: dbData?.chargerType,
		hwId: unit?.hwId || dbData.hwId,
		plugId: unit?.plugId || dbData.plugId,
		statusTime: unit?.statusTime || dbData.statusTime,
		canBeNotified:
			unit.subStatus !== ChargerSubStatus.AVAILABLE
				? unit?.canBeNotified || dbData.canBeNotified
				: undefined,
		createdUser: unit?.createdUser || dbData.createdUser,
		fees: {
			IVA: unit?.fees?.IVA || dbData.fees?.IVA,
			IEC: unit?.fees?.IEC || dbData.fees?.IEC,
		},
		subStatus: dbData.status !== PLUG_SUBSTATUS_OFFLINE ? normalizePlugSubStatus(unit?.subStatus) : undefined,
		capabilities: unit?.capabilities,
	};

	return result;
}

function normalizePlugSubStatus(subStatus) {
	const normalized = subStatus?.toUpperCase();

	const statusMap = {
		AVAILABLE: "AVAILABLE",
		CHARGING: "CHARGING",
		SUSPENDEDEV: "CHARGING",
		SUSPENDEDEVSE: "CHARGING",
		FINISHING: "CHARGING",
		OCCUPIED: "CHARGING",
		RESERVED: "RESERVED",
		UNAVAILABLE: "UNAVAILABLE",
		FAULTED: "UNAVAILABLE",
		UNKNOWN: "UNAVAILABLE",
	};

	return statusMap[normalized] || "CHARGING";
}

function mapGroup(group) {
	return {
		_id: group?._id,
		name: group?.name,
		listOfUsers: group?.listOfUsers?.map((user) => ({
			_id: user?._id,
			name: user?.name,
			mobile: user?.mobile,
			imageContent: user?.imageContent,
			userId: user?.userId,
			admin: user?.admin,
		})),
		imageContent: group?.imageContent,
		createUser: group?.createUser,
		groupId: group?.groupId,
	};
}

function mapFleet(fleet) {
	return {
		fleetId: fleet?.fleetId,
		fleetName: fleet?.fleetName,
	};
}

function mapTariffData(plug, charger) {
	const tariff = plug?.tariff;
	return {
		_id: tariff?._id, //Only needed for EVIO
		offset: tariff?.offset,
		timeZone: tariff?.timeZone ? tariff.timeZone[0] : undefined,
		partyId: charger?.partyId,
		source: charger?.source || Constants.networks.evio.name,
		countryCode: tariff?.countryCode,
		latLng: mapLatLng(charger),
		evseGroup: plug?.evseGroup,
		voltageLevel: {
			value: charger?.voltageLevel,
			translationKey: getVoltageTranslationKey(charger?.voltageLevel)
		},
		tariff: mapTariff(tariff),
		serviceCost: mapServiceCost(plug),
		accessType: plug?.accessType || charger.accessType,
		listOfGroups: plug?.listOfGroups?.map(mapGroup) || charger.listOfGroups?.map(mapGroup),
		listOfFleets: plug?.listOfFleets?.map(mapFleet) || charger.listOfFleets?.map(mapFleet),
	};
}

function mapTariff(tariff) {
	return {
		_id: tariff?._id,
		groupName: tariff?.groupName,
		groupId: tariff?.groupId,
		fleetName: tariff?.fleetName,
		fleetId: tariff?.fleetId,
		imageContent: tariff?.imageContent,
		tariffId: tariff?.tariffId,
		tariffType: tariff?.tariffType,
		name: tariff?.name,
		tariff: mapTariffAmounts(tariff),
		billingType: tariff?.billingType,

	};
}

function mapTariffAmounts(tariff) {
	if (!tariff) return {};
	return {
		_id: tariff?._id,
		activationFee: tariff?.tariff?.activationFee,
		bookingAmount: mapAmount(tariff?.tariff?.bookingAmount),
		chargingAmount: mapAmount(tariff?.tariff?.chargingAmount),
		parkingAmount: mapAmount(tariff?.tariff?.parkingAmount),
		parkingDuringChargingAmount: mapAmount(tariff?.tariff?.parkingDuringChargingAmount),
		evioCommission: mapEvioCommission(tariff?.tariff?.evioCommission), //TBR
	};
}

function mapAmount(amount) {
	return {
		uom: amount?.uom,
		value: amount?.value,
	};
}

function mapEvioCommission(evioCommission) {
	return {
		minAmount: mapAmount(evioCommission?.minAmount),
		transaction: mapAmount(evioCommission?.transaction),
	};
}

function mapServiceCost(plug) {
	if (!plug?.serviceCost) return {};
	return {
		initialCost: plug?.serviceCost?.initialCost,
		costByTime: plug?.serviceCost?.costByTime?.map((item) => ({
			minTime: item.minTime,
			maxTime: item.maxTime,
			cost: item.cost,
			uom: item.uom,
			description: item.description,
		})),
		costByPower: {
			cost: plug?.serviceCost?.costByPower?.cost,
			uom: plug?.serviceCost?.costByPower?.uom,
		},
		elements: mapElements(plug?.serviceCost?.elements),
		detailedTariff: mapDetailedTariff(plug?.tariff),
		currency: plug?.serviceCost?.currency ?? EURO,
	};
}

function mapDetailedTariff(tariff) {
	return {
		flat: tariff?.flat,
		time: tariff?.time,
		energy: tariff?.energy,
		parking: tariff?.parking,
	};
}

function mapRestrictions(restrictions) {
	return {
		start_date: restrictions?.start_date,
		end_date: restrictions?.end_date,
		start_time: restrictions?.start_time,
		end_time: restrictions?.end_time,
		min_kwh: restrictions?.min_kwh,
		max_kwh: restrictions?.max_kwh,
		min_current: restrictions?.min_current,
		max_current: restrictions?.max_current,
		min_power: restrictions?.min_power,
		max_power: restrictions?.max_power,
		min_duration: restrictions?.min_duration,
		max_duration: restrictions?.max_duration,
		day_of_week: restrictions?.day_of_week,
		reservation: restrictions?.reservation,
	};
}

function mapPriceComponents(priceComponents) {
	return (
		priceComponents?.map((component) => ({
			type: component?.type,
			price: component?.price,
			step_size: component?.step_size,
			vat: component?.vat,
			_id: component?._id,
			price_round: {
				round_granularity: component?.price_round?.round_granularity,
				round_rule: component?.price_round?.round_rule,
			},
			step_round: {
				round_granularity: component?.step_round?.round_granularity,
				round_rule: component?.step_round?.round_rule,
			},
		})) ?? []
	);
}

function mapElements(elements) {
	const mappedElements =
		elements?.map((element) => ({
			price_components: mapPriceComponents(element?.price_components),
			restrictions: mapRestrictions(element?.restrictions),
			reservation: element?.reservation,
		})) ?? [];

	return mappedElements;
}

function mapChargerSupport(charger) {
	return {
		_id: charger?._id,
		infoPoints: charger?.infoPoints,
		operator: charger?.operator,
		operatorContact: charger?.operatorContact,
		operatorEmail: charger?.operatorEmail,
		name: charger?.name,
		address: mapAddress(charger),
		network: getNetworkKey(charger?.network),
		stationIdentifier: charger?.stationIdentifier,
		unlockPlugs: charger?.unlockPlugs?.map((plug) => ({
			_id: plug?._id,
			chargerId: plug?.chargerId,
			hwId: plug?.hwId,
			plugId: plug?.plugId,
			subStatus: plug?.subStatus,
			statusTime: plug?.statusTime,
			chargerType: plug?.chargerType,
			canBeNotified: plug?.canBeNotified,
			accessType: plug?.accessType,
			createdUser: plug?.createdUser,
			listOfGroups: plug?.listOfGroups?.map(mapGroup),
			listOfFleets: plug?.listOfFleets?.map(mapFleet),
			fees: {
				IVA: plug?.fees?.IVA,
				IEC: plug?.fees?.IEC,
			},
		})),
	};
}

function mapTariffPrice(plug) {
	if (!plug.tariff?.detail) return {};

	const { priceComponent, emsp, cpo, total, vat } = plug.tariff.detail;
	let tariffPrice = { priceComponent, emsp, cpo, total, vat, taxes: { entries: [], total: 0, totalByKmh: 0, totalBykWh: 0 } };
	let emspEntriesToKeep = [];
	let totalEmsp = 0;
	total.totalEnergy = total.totalEnergy > 0 ? total.totalEnergy : 0;
	total.totalKm = total.totalKm > 0 ? total.totalKm : 0;

	//If the chargers are not MobiE, they don't have tar or iec and therefore we don't need to map them in the
	//taxes object, we just need our VAT.
	if (!emsp?.entries) {
		tariffPrice.taxes.total = tariffPrice.vat.total;
		tariffPrice.taxes.totalBykWh = round(tariffPrice.vat.total / total.totalEnergy);
		tariffPrice.taxes.totalByKmh = round((tariffPrice.vat.total / total.totalKm) * 100);
		return tariffPrice;

	}

	for (let entry of emsp.entries) {

		switch (entry.label) {
			case 'tar':
			case 'iec':
				entry.collapsableGroup = 'taxes';
				entry.collapsable = entry.label === 'tar';
				tariffPrice.taxes.entries.push(entry);
				break;
			case 'ceme':
				entry.collapsable = true;
				totalEmsp += round(entry.total);
				emspEntriesToKeep.push(entry);
				break;
			case 'activationFeeWithDiscount':
				emspEntriesToKeep.push(entry);
				//We don't need to add this to the total because we have Activation fee and mobie discount together later on,
				// on the default case.
			case 'cemeTarIec':
				// Do not add "cemeTarIec"
				break;
			default:
				emspEntriesToKeep.push(entry);
				totalEmsp += round(entry.total);
		}
	}

	tariffPrice.emsp.total = round(totalEmsp, 2);
	tariffPrice.emsp.totalBykWh = totalEmsp / total.totalEnergy;
	//The name of this field is "totalByKmh" but it actually is used as cost per 100km
	tariffPrice.emsp.totalByKmh = (totalEmsp / total.totalKm) * 100;

	tariffPrice.taxes.total = round(tariffPrice.taxes.entries.reduce((acc, entry) => acc + entry.total, 0) + vat.total, 2);
	tariffPrice.taxes.totalBykWh = total.totalEnergy > 0 ? round(tariffPrice.taxes.total / total.totalEnergy, 2) : 0;
	tariffPrice.taxes.totalByKmh = total.totalKm > 0 ? round(tariffPrice.taxes.total / total.totalKm *100, 2): 0;

	tariffPrice.emsp.entries = emspEntriesToKeep;

	return tariffPrice;
}




function getNetworkKey(networkName) {
	const network = Object.values(Constants.networks).find(network => network.name === networkName);
	return network ? network.key : Constants.networks.others.key;
}

function getTranslationKey(plugProperty, mappingObject) {
	for (let key in mappingObject) {
		if (mappingObject[key].key === plugProperty) {
			return mappingObject[key].translationKey;
		}
	}
	return undefined;
}

function getTotalPrice(plug) {
	return {
		currency: plug?.serviceCost?.currency ?? EURO,
		value: plug?.tariff?.detail?.total?.total,
	};
}

function getTotalPriceBy100Km(plug) {
    //TODO: extract this logic into a function with a clear name
	const totalPricePer100Km = plug?.tariff?.detail?.total?.totalKm > 0 ? (plug?.tariff?.detail?.total?.total / plug?.tariff?.detail?.total?.totalKm) * 100 : 0;

	return {
		currency: plug?.serviceCost?.currency ?? EURO,
		value: round(totalPricePer100Km, 2),
	};
}

function getTotalPriceBykWh(plug) {
	const totalPricePerkWh = plug?.tariff?.detail?.total?.totalEnergy > 0 ? plug?.tariff?.detail?.total?.total / plug?.tariff?.detail?.total?.totalEnergy : 0;
	return {
		currency: plug?.serviceCost?.currency ?? EURO,
		value: round(totalPricePerkWh, 2),
	};
}

function getTotalPercentage(plug) {
	const MAX_PERCENTAGE = 100;
	const totalPercentage = plug?.tariff?.detail?.total?.totalPercentage;
	return totalPercentage > MAX_PERCENTAGE ? MAX_PERCENTAGE : totalPercentage;
}


function getVoltageTranslationKey(voltageLevel) {
	const level = Object.values(VoltageLevels).find(level => level.name === voltageLevel);
	return level ? level.translationKey : undefined;
}

module.exports = {
	mapChargerDetails,
	mapChargerSummary,
	mapChargerSupport,
	mapChargerRankings,
	mapFleet,
	mapGroup,
	mapLatLng,
	mapServiceCost,
	mapTariffAmounts,
	mapTariff,
	mapTariffData,
	getNetworkKey,
	getTranslationKey,
	getTotalPrice,
	getTotalPriceBy100Km,
	getTotalPriceBykWh,
	getTotalPercentage,
	mapTariffPrice
};
