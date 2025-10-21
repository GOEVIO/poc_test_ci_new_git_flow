import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.string(),
  API_PORT: z.coerce.number().default(3103),
  /*API_TITLE: z.string(),
  API_DESCRIPTION: z.string(),
  API_VERSION: z.string().default('1.0'),
  DB_URI: z.string(),
  OCPP_SERVER_URL: z.string().default('http://ocpp-j-16:3018'),*/
})

export const validateEnvs = () => {
  try {
    console.log(process.env)
    return envSchema.parse(process.env)
  } catch (error: any) {
    console.error('❌ Invalid environment variables:', error.errors)
    process.exit(1)
  }
}
