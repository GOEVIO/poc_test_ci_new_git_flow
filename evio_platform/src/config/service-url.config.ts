import { registerAs } from '@nestjs/config'

export default registerAs('serviceUrl', () => ({
  ocpp: process.env.OCPP_SERVER_URL ?? 'http://ocpp-j-16:3018',
  chargers: process.env.CHARGERS_SERVICE_URL ?? 'http://evio-chargers:3002',
}))
