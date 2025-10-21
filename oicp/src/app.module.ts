import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import * as config from './config'
import { OICPModule } from './modules/oicp.module'
import { LogsService } from './logs/logs.service'
import { HttpModule } from '@nestjs/axios'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: Object.values(config),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('db.uri').replace('{database}', '') as string,
        dbName: configService.get('db.name') as string,
      }),
    }),
    HttpModule,
    OICPModule,
  ],
  providers: [LogsService],
})
export class AppModule {}
