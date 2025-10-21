import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as https from 'https'

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const caBase64 = configService.get<string>('ssh.ca') as string
        const certBase64 = configService.get<string>('ssh.pem') as string
        const keyBase64 = configService.get<string>('ssh.key') as string
        return {
          baseURL: configService.get<string>('serviceUrl.hubject') as string,
          timeout: 60000,
          maxRedirects: 5,
          httpsAgent: new https.Agent({
            ca: Buffer.from(caBase64, 'base64').toString('utf-8'),
            cert: Buffer.from(certBase64, 'base64').toString('utf-8'),
            key: Buffer.from(keyBase64, 'base64').toString('utf-8'),
            maxVersion: 'TLSv1.3',
            minVersion: 'TLSv1.3',
          }),
        }
      },
    }),
  ],
  exports: [HttpModule],
})
export class SshHttpModule {}
