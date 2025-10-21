import { registerAs } from '@nestjs/config'

export default registerAs('app', () => ({
  port: process.env.API_PORT as string,
  title: process.env.API_TITLE as string,
  description: process.env.API_DESCRIPTION as string,
  version: process.env.API_VERSION as string,
  ocpp16: {
    host: String(process.env.OCPP_16_URL),
  },
}))
