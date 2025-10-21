import { registerAs } from '@nestjs/config'

export default registerAs('ssh', () => ({
  ca: process.env.SSH_CA as string,
  pem: process.env.SSH_PEM as string,
  key: process.env.SSH_KEY as string,
}))
