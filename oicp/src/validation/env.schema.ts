import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.string(),
  API_PORT: z.coerce.number().default(3102),
  SSH_CA: z.string().base64(),
  SSH_PEM: z.string().base64(),
  SSH_KEY: z.string().base64(),
  API_TITLE: z.string().default('OICP'),
  API_DESCRIPTION: z.string().default('OICP Service'),
  API_VERSION: z.string().default('1.0'),
  DB_URI: z.string(),
  CHARGING_PLATFORM_URL: z.string().url(),
  HUBJECT_API_URL: z.string().url(),
})

export const validateEnvs = () => {
  try {
    return envSchema.parse(process.env)
  } catch (error: any) {
    console.error('❌ Invalid environment variables:', error.errors)
    process.exit(1)
  }
}
