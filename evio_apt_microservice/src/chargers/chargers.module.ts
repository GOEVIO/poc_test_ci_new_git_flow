import { Module } from '@nestjs/common'
import { ChargersService } from './services/common/charger.service'
import LoggerService from 'src/core/services/logger'
import { AptChargers } from '../database/entities/apt-chargers.entity'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AptChargerRepository } from './charger.repository'
import { LibrariesModule } from '../libraries/libraries.module'
import { ChargerController } from './charger.controller'
import { PlugsModule } from '../plugs/plugs.module'
import { BusinessChargerService } from './services/business/business-charger.service'
import { AptChargerService } from './services/business/apt/apt-charger.service'
import { QRCodeChargerService } from './services/business/qr_code/qr_code-charger.service'
import { APTChargerParamsDto } from './services/business/apt/apt-charger-params.dto'
import { QRCodeChargerParamsDto } from './services/business/qr_code/qr_code-charger-params.dto'

const services = [
  ChargersService,
  BusinessChargerService,
  AptChargerService,
  QRCodeChargerService,
]

@Module({
  imports: [
    TypeOrmModule.forFeature([AptChargers]),
    LibrariesModule,
    PlugsModule,
  ],
  providers: [
    ...services,
    AptChargerRepository,
    LoggerService,
    // needed to inject in APTChargerParamsDto and QRCodeChargerParamsDto
    APTChargerParamsDto,
    QRCodeChargerParamsDto,
  ],
  exports: [...services, AptChargerRepository],
  controllers: [ChargerController],
})
export class ChargersModule {}
