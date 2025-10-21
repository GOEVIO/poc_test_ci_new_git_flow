import { ProjectedCharger, ProjectedChargerPlug } from '../repository/chargers.repository'
import { InfrastructureMap } from '../repository/infrastrutures.respository'
import { ChargersByLocationsCountType } from '../repository/totalFiltersLocations.repository'
import { ChargerDtoDataType, ChargerItemPlug, ChargerDtoTotalFiltersLocation } from '../types/chargerDto'
import { ActiveInactiveFromBoolean } from '../types/activeInactive.type'

const Millis = {
  second: 1000,
  minute: 60000,
  hour: 3.6e+6,
  day: 8.64e+7,
}

function buildDuration(date?: Date): string | undefined {
  if (!date) {
    return
  }

  const millis = Date.now() - new Date(date).getTime()
  if (isNaN(millis) || millis <= 0) {
    return
  }

  const days = Math.floor(millis / Millis.day)

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }

  const seconds = Math.floor(millis / Millis.second)
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
}

function buildPlug(plug: ProjectedChargerPlug, plugIdx: number): ChargerItemPlug {
  return {
    plugId: plug.plugId,
    plugNumber: plugIdx + 1,
    qrCode: plug.qrCodeId,
    status: plug.status,
    connectorStatus: plug.subStatus,
    duration: buildDuration(plug.statusChangeDate),
  }
}

const buildDataItem = (infrastructures: InfrastructureMap) =>
  (charger: ProjectedCharger): ChargerDtoDataType => {
    const infraId = charger.infrastructure as string;
    const location = infraId && infrastructures[infraId] ? infrastructures[infraId] : '';

    return {
      chargerItem: {
        _id: charger._id,
        chargerId: charger.hwId,
        chargerName: charger.name,
        location,
        state: ActiveInactiveFromBoolean(charger.active),
        accessibility: charger.accessType,
        status: charger.status,
        chargerType: charger.chargerType,
        operationalStatus: charger.operationalStatus,
      },
      plugs: charger.plugs.map(buildPlug)
    }
  }

export function buildChargerDtoData(
  chargers: ProjectedCharger[],
  infrastructures: InfrastructureMap
): Array<ChargerDtoDataType> {
  return chargers.map(buildDataItem(infrastructures))
}

export function buildTotalFiltersLocation(
    chargersCountByLocation: ChargersByLocationsCountType[],
    infrastructures: InfrastructureMap
): Array<ChargerDtoTotalFiltersLocation> {
  const countsMap = Object.fromEntries(
      chargersCountByLocation.map((loc) => [loc._id, loc.count])
  );

  return Object.entries(infrastructures).map(([infraId, name]) => ({
    name,
    totalChargersPerLocation: Number(countsMap[infraId] ?? 0),
  }));

}
