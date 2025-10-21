import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  Unique,
} from 'typeorm'
import { TableNames } from 'evio-library-commons'
import { BaseEntity } from './base.entity'
import { AptTariffsDetails } from './apt-tariff-details.entity'
import { AptChargers } from './apt-chargers.entity'

@Entity(TableNames.APT.Plugs)
@Unique(['plug_id', 'chargerId'])
export class AptPlugs extends BaseEntity {
  @Column({ unique: true })
  plug_id!: string

  @ManyToOne(() => AptChargers, (charger) => charger.plugs)
  @JoinColumn({ name: 'chargerId' })
  charger?: AptChargers

  @Column({ name: 'chargerId' })
  chargerId?: string

  @OneToOne(() => AptTariffsDetails, (tariffs) => tariffs.plug, {
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  tariffs_detail?: AptTariffsDetails
}
