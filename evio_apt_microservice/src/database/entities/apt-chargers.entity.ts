import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm'
import { TableNames } from 'evio-library-commons'
import { BaseEntity } from './base.entity'
import { Apt } from './apt.entity'
import { AptPlugs } from './apt-charger-plugs.entity'

@Entity(TableNames.APT.Chargers)
@Unique(['hwId', 'apt'])
export class AptChargers extends BaseEntity {
  @Column()
  hwId!: string

  @Column()
  charger_type!: string

  @ManyToOne(() => Apt, (apt) => apt.chargers, {
    onDelete: 'CASCADE',
  })
  apt?: Apt

  @OneToMany(() => AptPlugs, (plug) => plug.charger)
  plugs?: AptPlugs[]
}
