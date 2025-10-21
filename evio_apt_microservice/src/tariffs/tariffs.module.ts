import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import {
  AptTariffElements,
  AptTariffPriceComponents,
  AptTariffRestrictions,
  AptTariffsDetails,
} from '../database/entities'
import { PlugsModule } from '../plugs/plugs.module'
import { TariffsRepository } from './tariffs.repository'
import { TariffsService } from './tariffs.service'
import { TariffsController } from './tariffs.controller'

const tariffsEntities = [
  AptTariffElements,
  AptTariffPriceComponents,
  AptTariffRestrictions,
  AptTariffsDetails,
]

@Module({
  imports: [TypeOrmModule.forFeature(tariffsEntities), PlugsModule],
  controllers: [TariffsController],
  providers: [TariffsService, TariffsRepository],
})
export class TariffsModule {}
