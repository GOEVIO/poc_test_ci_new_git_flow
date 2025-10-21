import ChargersLib from 'evio-library-chargers'
import EvioCommons from 'evio-library-commons'

const BillingTypeForBilling = EvioCommons.Enums.SalesTariffs.BillingType.ForBilling.toString()

export type ProjectedChargingSessionType = {
  hwId: string,
  startDate: Date,
}

function toEntry(chargingSession: ProjectedChargingSessionType): [string, ProjectedChargingSessionType] {
  return [chargingSession.hwId, chargingSession]
}

/**
 * Finds chargingSessions by hwIds and builds a map that matches the hwId with the chargingSession
 */
export async function getChargingSessions(hwIds: string[]): Promise<Record<string, ProjectedChargingSessionType>> {
  if (!hwIds.length) {
    return {}
  }

  const aggregationPipeline = [
    { $match: { hwId: { $in: hwIds }, startDate: { $exists: 1 }, 'tariff.billingType': String(process.env.BillingTypeForBilling) } },
    { $sort: { startDate: -1, _id: -1 } },
    { $group: { _id: '$hwId', result: { $first: { hwId: '$hwId', startDate: '$startDate' } } } }, // group first one by hwId and project
    { $replaceRoot: { newRoot: '$result' } }, // unwrap group object to get just the document
  ]
  const chargingSessions = (await ChargersLib.aggregateChargingSessions(aggregationPipeline)) as ProjectedChargingSessionType[]
  return Object.fromEntries(chargingSessions.map(toEntry))
}
