import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import * as config from './config'
import { ChargersModule } from './v2/chargers/chargers.module'
import { LogsService } from './logs/logs.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: Object.values(config),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('db.uri') as string,
        dbName: configService.get('db.name') as string,
      }),
    }),
    ChargersModule,
  ],
  providers: [LogsService],
})
export class AppModule {}
