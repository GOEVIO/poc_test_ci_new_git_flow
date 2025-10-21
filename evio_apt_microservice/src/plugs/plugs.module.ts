import { Module } from '@nestjs/common'
import { PlugsService } from './plugs.service'
import { AptPlugs } from '../database/entities/apt-charger-plugs.entity'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AptPlugsRepository } from './plugs.repository'
import { LibrariesModule } from '../libraries/libraries.module'

@Module({
  imports: [TypeOrmModule.forFeature([AptPlugs]), LibrariesModule],
  providers: [PlugsService, AptPlugsRepository],
  exports: [PlugsService, AptPlugsRepository],
})
export class PlugsModule {}
