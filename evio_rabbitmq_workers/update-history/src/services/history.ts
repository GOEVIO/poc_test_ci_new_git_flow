import axios from 'axios';
import timeZoneMoment from 'moment-timezone';
import { findOneConfigs } from 'evio-library-statistics';
import {
  DEFAULT_EFFICIENCY,
  DEFAULT_OVERCOST,
  DEFAULT_CONVERSION_EFFICIENCY,
  HOST_OCPI,
  PATH_PRICE_SIMULATION,
  EVIO_NETWORK,
  DEFAULT_USABLE_BATTERY_CAPACITY,
  DEFAULT_INTERNAL_CHARGER_POWER,
} from './../constants';
import * as Sentry from '@sentry/node';

export interface IEfficiencyAndOvercost {
  efficiency: number | null;
  overcost: number | null;
}

export async function calculateEfficiencyAndOvercost(
  session,
  charger,
  contract,
): Promise<IEfficiencyAndOvercost> {
  const context = `[Service History: function calculateEfficiencyAndOvercost]`;
  try {
    const conversionEfficiency = await getConversionEfficiencyFromConfigs();
    let efficiency: number | null = DEFAULT_EFFICIENCY;
    let overcost: number | null = DEFAULT_OVERCOST;
    const energy = session?.totalPower / 1000;
    const time = session?.timeCharged / 60;
    const totalCost =
      session?.totalPrice?.incl_vat ?? session?.total_cost?.incl_vat;
    const plug = charger?.plugs?.find((plug) => plug.plugId == session?.plugId);
    const plugPower = plug?.power;

    console.log(
      `${context} time: ${time}, energy: ${energy}, plugPower: ${plugPower}, conversionEfficiency: ${conversionEfficiency}`,
    );

    if (time > 0 && energy && plugPower > 0 && conversionEfficiency > 0)
      efficiency =
        (energy / time / ((plugPower * conversionEfficiency) / 60)) * 100;

    if (totalCost > 0 && plugPower) {
      const optimisedPrice = await optimisedPriceSimulation(
        session,
        charger,
        contract,
        plug,
        energy / plugPower,
      );

      console.log(
        `${context} totalCost: ${totalCost}, optimisedPrice: ${optimisedPrice}`,
      );
      if (optimisedPrice > 0 && totalCost > 0)
        overcost = ((totalCost - optimisedPrice) / optimisedPrice) * 100;
    }

    return { efficiency, overcost };
  } catch (error) {
    Sentry.captureException(error);
    console.error(`${context}: Error: ${error}`);
    return { efficiency: DEFAULT_EFFICIENCY, overcost: DEFAULT_OVERCOST };
  }
}

async function getConversionEfficiencyFromConfigs() {
  const context = `[Service History: function getConversionEfficiencyFromConfigs]`;
  try {
    const configs = await findOneConfigs({});
    return configs?.conversionEfficiency ?? DEFAULT_CONVERSION_EFFICIENCY;
  } catch (error) {
    Sentry.captureException(error);
    console.error(`${context}: Error: ${error}`);
    return DEFAULT_CONVERSION_EFFICIENCY;
  }
}

async function optimisedPriceSimulation(
  session,
  charger,
  contract,
  plug,
  time,
) {
  let body = prepareDataForPriceSimulation(
    session.startDate,
    session.stopDate,
    getChargerOffset(charger.timeZone),
    plug,
    time,
    charger?.countryCode,
    charger,
    charger?.source ?? EVIO_NETWORK,
    session?.tariff,
    charger?.timeZone,
    session?.tariff?.planId,
    contract?.tariffRoaming?.find((tariffRoaming) => tariffRoaming?.planId),
    session.ev?.evInfo?.useableBatteryCapacity ||
      DEFAULT_USABLE_BATTERY_CAPACITY,
    session.ev?.evInfo?.maxFastChargingPower ||
      session.ev?.evInfo?.internalChargerPower ||
      DEFAULT_INTERNAL_CHARGER_POWER,
  );

  const context = `[Service History: function optimisedPriceSimulation]`;
  const host = HOST_OCPI + PATH_PRICE_SIMULATION;
  try {
    const prices = await axios.post(host, body);
    return prices?.data?.detail?.total?.total;
  } catch (error) {
    Sentry.captureException(error);
    console.error(`${context}: Error: ${error}`);
    return DEFAULT_OVERCOST;
  }
}

function prepareDataForPriceSimulation(
  sessionStartDate,
  sessionStopDate,
  offset,
  plug,
  timeCharger,
  countryCode,
  chargerFound,
  source,
  tariff,
  timeZone,
  planId,
  roamingPlanId,
  totalBatteryCapacityEV,
  chargingCapacityEV,
) {
  return {
    sessionStartDate,
    sessionStopDate,
    offset,
    power: plug.power,
    voltage: plug.voltage,
    total_energy:
      (plug?.power >= chargingCapacityEV
        ? chargingCapacityEV
        : Math.min(plug.power, totalBatteryCapacityEV)) * timeCharger,
    total_charging_time: timeCharger,
    total_parking_time: 0,
    countryCode,
    partyId: chargerFound.partyId,
    source: source,
    evseGroup: plug.evseGroup,
    longitude: chargerFound.geometry.coordinates[0],
    latitude: chargerFound.geometry.coordinates[1],
    tariff: tariff,
    address: chargerFound.address,
    timeZone: timeZone,
    voltageLevel: chargerFound.voltageLevel,
    planId: planId,
    roamingPlanId: roamingPlanId,
    elements: plug.serviceCost?.elements,
    tariffs: plug.serviceCost?.tariffs,
  };
}

function getChargerOffset(timeZone) {
  let offset = 0;
  try {
    if (Array.isArray(timeZone)) {
      offset = timeZoneMoment.tz(timeZone[0]).utcOffset();
    } else if (timeZone) {
      offset = timeZoneMoment.tz(timeZone).utcOffset();
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[function getChargerOffset]: Error: ${error}`);
  }
  return offset;
}
