import {
  InternalChargerInterface,
  PublicChargerInterface,
} from 'evio-library-commons'
import {
  ChargerItemDto,
  ChargerItemPlugsDto,
  ChargerPlugsDto,
} from '../../chargers/dtos/get-charger-tariffs.dto'
import { formatTariffs } from './format-tariffs'
import { IChargerPreAuthorizationValueReturns } from 'evio-library-configs'

export const formatChargerTariff = (
  charger: InternalChargerInterface.Charger | PublicChargerInterface.Charger,
  isPublicNetWork: boolean,
  preAuthorizationData: IChargerPreAuthorizationValueReturns[]
): ChargerItemPlugsDto | null => {
  if (!charger) return null

  const defaultPreAuthValue = preAuthorizationData.find(
    (item) => item.hwId === 'DEFAULT'
  )

  const chargerPreAuthValue = preAuthorizationData.find(
    (item) => item.hwId === charger.hwId
  )

  const state = isPublicNetWork
    ? charger.operationalStatus === 'APPROVED'
    : charger?.operationalStatus &&
      ['APPROVED', 'WAITINGAPROVAL'].includes(charger?.operationalStatus)

  const chargerData: ChargerItemDto = {
    _id: charger.id,
    accessibility: isPublicNetWork
      ? 'Public'
      : (charger as InternalChargerInterface.Charger)?.accessType || '',
    chargerId: charger.hwId,
    chargerName: charger.name || charger.hwId || '',
    state: state ? 'Active' : 'Inactive',
    operationalStatus: charger.operationalStatus || '',
    status: charger.status || '',
    chargerType: charger.chargerType || '',
    voltageLevel: charger.voltageLevel || '',
    address: charger.address || {},
    geometry: charger.originalCoordinates ||
      charger.geometry || { type: 'Point', coordinates: [] },
  }

  if (!charger.plugs || charger.plugs.length === 0) {
    return {
      chargerItem: chargerData,
      plugs: [] as ChargerPlugsDto[],
    }
  }

  const plugs: ChargerPlugsDto[] = charger.plugs.map(
    (plug: any, index: number) => {
      const preauthorisation = chargerPreAuthValue?.plugs?.length
        ? chargerPreAuthValue?.plugs.find((item) => item.plugId === plug.plugId)
            ?.preAuthorizationValue ||
          defaultPreAuthValue?.plugs?.[0]?.preAuthorizationValue ||
          40
        : defaultPreAuthValue?.plugs?.[0]?.preAuthorizationValue || 40

      const plugData: ChargerPlugsDto = {
        status: plug.status || '',
        plugId: plug.plugId || '',
        plugNumber: index + 1,
        connectorStatus: plug.subStatus || '',
        amperage: plug.amperage || 0,
        voltage: plug.voltage || 0,
        power: plug.power || 0,
        connectorPowerType:
          'connectorPowerType' in plug ? plug.connectorPowerType || '' : '',
        connectorType: plug.connectorType || '',
        preauthorisation,
      }

      const tariffs = formatTariffs(plug, isPublicNetWork)

      if (tariffs?.tariff) {
        plugData.tariffs = tariffs.tariff
        plugData.tariffId = tariffs.tariffId
      }

      return plugData
    }
  )

  return {
    chargerItem: chargerData,
    plugs,
  }
}
