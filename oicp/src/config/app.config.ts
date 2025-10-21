import { registerAs } from '@nestjs/config'

export default registerAs('app', () => ({
  title: process.env.API_TITLE as string,
  description: process.env.API_DESCRIPTION as string,
  version: process.env.API_VERSION as string,
  port: Number(process.env.API_PORT),
}))
