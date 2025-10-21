import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm'
import { TableNames, DeviceTypes } from 'evio-library-commons'
import { BaseEntity } from './base.entity'
import { AptTariffElements } from './apt-tariff-elements.entity'
import { AptPlugs } from './apt-charger-plugs.entity'

@Entity(TableNames.APT.TariffsDetails)
export class AptTariffsDetails extends BaseEntity {
  @Column()
  tariff_owner!: string

  @OneToMany(
    () => AptTariffElements,
    (element: AptTariffElements) => element.detail,
    { onDelete: 'CASCADE' }
  )
  elements?: AptTariffElements[]

  @OneToOne(() => AptPlugs, (plug) => plug.tariffs_detail, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plug_id' })
  plug?: AptPlugs

  @Column()
  plug_id?: string

  @Column({
    type: 'enum',
    enum: DeviceTypes,
    default: DeviceTypes.APT,
  })
  auth_type?: DeviceTypes
}
