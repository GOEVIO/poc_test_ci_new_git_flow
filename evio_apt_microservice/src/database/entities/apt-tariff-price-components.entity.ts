import { Column, Entity, ManyToOne } from 'typeorm'
import { TableNames, OcpiTariffDimenstionType } from 'evio-library-commons'
import { BaseEntity } from './base.entity'
import { AptTariffElements } from './apt-tariff-elements.entity'

@Entity(TableNames.APT.TariffPriceComponents)
export class AptTariffPriceComponents extends BaseEntity {
  @ManyToOne(() => AptTariffElements, (element) => element.price_components)
  element?: AptTariffElements

  @Column()
  type?: OcpiTariffDimenstionType

  @Column('float')
  price?: number

  @Column('float')
  vat?: number

  @Column('int')
  step_size?: number
}
