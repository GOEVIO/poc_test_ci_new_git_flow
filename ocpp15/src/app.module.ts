import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'
import * as config from './config'
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LogsService } from './logs/logs.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: Object.values(config),
    })
  ],
  controllers: [AppController],
  providers: [AppService, LogsService],
})
export class AppModule {}