import {
  BillingPeriods,
  ChargerNetworks,
  ChargerTypes,
  ClientNames,
  OcpiSessionStatus,
  PaymentStatusSessions,
} from 'evio-library-commons'
import {
  getTimezone
} from './timezone'

export function parseChargingSession(
  evseId: string,
  sessionId: string,
  uid: string,
  user,
  contract,
  charger: any = {},
  tokenType,
  opcTariff,
  fees: any = {},
  operatorId: string,
  evInfo: any,
) {
  try {
    const internationalContractId =
      contract.contractIdInternationalNetwork[0]?.tokens[0]?.contract_id

    const plug = charger?.plugs?.find((plug) => plug.evse_id === evseId)
    const connector_id = plug?.plugId
    const plugPower = plug?.power
    const plugVoltage = plug?.voltage
    return {
      chargerType: ChargerTypes.Hubject,
      source: ChargerNetworks.Hubject,
      location_id: charger.hwId,
      kwh: 0,
      auth_method: 'WHITELIST',
      createdWay: "AUTHORIZE_START",
      token_uid: uid,
      token_type: tokenType,
      status: OcpiSessionStatus.SessionStatusToStart,
      roamingTransactionID: sessionId,
      id: sessionId,
      last_updated: new Date().toISOString(),
      cdrId: '-1',
      address: charger.address,
      paymentStatus: PaymentStatusSessions.Unpaid,
      transactionId: sessionId,
      userId: user._id,
      evId: contract.evId ?? '-1',
      total_cost: {
        excl_vat: 0,
        incl_vat: 0,
      },
      tariffOPC: opcTariff,
      fees,
      cdr_token: {
        uid: uid,
        type: tokenType,
        contract_id: internationalContractId || contract.id,
      },
      connector_id,
      plugPower,
      plugVoltage,
      country_code: charger.countryCode,
      evse_uid: evseId,
      party_id: charger.partyId || operatorId,
      chargeOwnerId: charger.partyId || operatorId,
      start_date_time: new Date().toISOString(),
      operator: charger.operator,
      roamingCO2: undefined,
      paymentType: BillingPeriods.Adhoc,
      clientName: ClientNames.EVIO,
      billingPeriod: undefined,
      userIdWillPay: user._id || 'Unknown',
      userIdToBilling: user._id || 'Unknown',
      paymentMethod: 'Unknown',
      paymentMethodId: '-1',
      walletAmount: -1,
      reservedAmount: -1,
      confirmationAmount: -1,
      plafondId: undefined,
      viesVAT: undefined,
      adyenReference: '-1',
      createdAt : new Date(),
      timeZone: charger.geometry ? getTimezone(charger.geometry.coordinates[1], charger.geometry.coordinates[0]) : '',
      acceptKMs: evInfo?.evDetails?.acceptKMs ?? false,
      updateKMs: evInfo?.evDetails?.updateKMs ?? false,
      timeCharged: 0,
      ...evInfo
    }
  } catch (error) {
    console.log(`Error parsing charging session ${sessionId}`, error)
    throw new Error(`Error parsing charging session ${sessionId}`)
  }
}
