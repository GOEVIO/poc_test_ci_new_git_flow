import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'

import { LogsService } from '@/logs/logs.service'
import { AssetsService } from './assets.service'
import { AssetsController } from './assets.controller'
import { OverviewService } from './overview/overview.service'

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 5000,
        maxRedirects: 5,
      }),
    }),
  ],
  controllers: [AssetsController],
  providers: [AssetsService, LogsService, OverviewService],
})
export class AssetsModule {}
