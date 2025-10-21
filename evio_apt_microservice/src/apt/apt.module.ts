import { Module } from '@nestjs/common'

import LoggerService from 'src/core/services/logger'

import { AptService } from './apt.service'
import { AptController } from './apt.controller'
import { AptRepository } from './apt.repository'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Apt } from '../database/entities/apt.entity'
import { LibrariesModule } from '../libraries/libraries.module'
import { ChargersModule } from '../chargers/chargers.module'

@Module({
  imports: [TypeOrmModule.forFeature([Apt]), LibrariesModule, ChargersModule],
  controllers: [AptController],
  providers: [AptService, LoggerService, AptRepository],
  exports: [AptService, AptRepository],
})
export class AptModule {}
