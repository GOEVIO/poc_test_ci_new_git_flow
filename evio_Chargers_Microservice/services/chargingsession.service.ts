import { TariffsService } from 'evio-library-ocpi'
import { findPrivateCharger } from 'evio-library-chargers'
import { round } from '../utils/round'
import { addDuration } from '../utils/date'
import {
  ICostDetails,
  IPrice,
  IChargingSession,
} from '../interfaces/chargingsession.interface'
import { ICharger, IPlug } from '../interfaces/charger.interface'

export async function calculateSessionValues(
  chargingSessionFound: IChargingSession,
  chargingSession: IChargingSession,
): Promise<{ totalPrice: IPrice; costDetails: ICostDetails }> {
  const { timeZone, tariff, startDate, hwId, network, plugId, fees } =
    chargingSessionFound
  const { timeCharged, totalPower, stopDate } = chargingSession
  const vat = fees.IVA

  const { charger, plug } = await getChargerAndPlug(hwId, plugId)

  const [longitude, latitude] = charger.geometry.coordinates
  const start = startDate.toISOString()
  const end = new Date(stopDate ?? addDuration(startDate, timeCharged)).toISOString()

  const energyInKwh = totalPower / 1000
  const durationInHours = timeCharged / 3600

  const [flat, energy, time, parking] = TariffsService.calculateCpoPrices(
    tariff.elements,
    start,
    end,
    timeZone,
    charger.address.countryCode,
    plug.power,
    plug.voltage,
    energyInKwh,
    durationInHours,
    0,
    network,
    latitude,
    longitude,
  )

  const flatPrice = round(flat.price)
  const energyPrice = round(energy.price)
  const timePrice = round(time.price)
  const parkingPrice = round(parking.price)

  const costDetails = buildCostDetails(
    flatPrice,
    energyPrice,
    timePrice,
    parkingPrice,
    timeCharged,
    totalPower,
  )

  const totalExclVat = round(flatPrice + energyPrice + timePrice + parkingPrice)
  const totalInclVat = round(totalExclVat * (1 + vat))

  const totalPrice = { excl_vat: totalExclVat, incl_vat: totalInclVat }

  console.log(
    `Final prices for session ${chargingSessionFound._id} with vat ${vat}`,
    JSON.stringify({
      flatPrice,
      energyPrice,
      timePrice,
      parkingPrice,
      totalPrice,
      costDetails,
    }),
  )

  return { totalPrice, costDetails }
}

async function getChargerAndPlug(
  hwId: string,
  plugId: string,
): Promise<{ charger: ICharger; plug: IPlug }> {
  const charger: ICharger = await findPrivateCharger({ hwId, active: true }, {
    geometry: 1,
    address: 1,
    'plugs.power': 1,
    'plugs.voltage': 1,
    'plugs.plugId': 1,
  })

  const plug = charger.plugs?.find((p) => p.plugId === plugId) as IPlug

  return { charger, plug }
}

export function buildCostDetails(
  flatPrice: number,
  energyPrice: number,
  timePrice: number,
  parkingPrice: number,
  timeCharged: number,
  totalPower: number,
): ICostDetails {
  return {
    activationFee: flatPrice,
    parkingDuringCharging: 0,
    parkingAmount: parkingPrice,
    timeCharged: timeCharged,
    totalTime: timeCharged,
    totalPower: totalPower,
    costDuringCharge: round(energyPrice + timePrice),
  }
}
