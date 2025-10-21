import { registerAs } from '@nestjs/config'

export default registerAs('db', () => ({
  uri: process.env.DB_URI as string,
  name: process.env.DB_NAME as string,
}))
