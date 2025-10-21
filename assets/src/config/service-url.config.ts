import { registerAs } from '@nestjs/config'

export default registerAs('serviceUrl', () => ({
  identity: process.env.IDENTITY_SERVER_URL ?? 'http://identity:3003',
}))
