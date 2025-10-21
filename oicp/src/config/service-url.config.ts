import { registerAs } from '@nestjs/config'

export default registerAs('serviceUrl', () => ({
  hubject: process.env.HUBJECT_API_URL as string,
  ocpp: process.env.CHARGING_PLATFORM_URL as string,
  payments: process.env.PAYMENTS_SERVICE_URL as string,
  paymentsV2: process.env.PAYMENTS_V2_SERVICE_URL as string || 'http://payments-v2:6002',
  billing: process.env.BILLING_SERVICE_URL as string,
}))
