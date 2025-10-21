import { jest } from '@jest/globals'

import { ChargerMock } from './chargers.mock';
import { MockQueryProjectAsyncFunction } from './mock-functions.t'

export const SalesTariffMock = {
  _id: ChargerMock.plugs[0].tariff?.[0]?.tariffId,
  billingType: String(process.env.BillingTypeForBilling)
}

export default {
  findSalesTariffs: <MockQueryProjectAsyncFunction>jest.fn(),
}
