import { Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm'
import { TableNames } from 'evio-library-commons'
import { BaseEntity } from './base.entity'
import { AptTariffRestrictions } from './apt-tariff-restrictions.entity'
import { AptTariffPriceComponents } from './apt-tariff-price-components.entity'
import { AptTariffsDetails } from './apt-tariff-details.entity'

@Entity(TableNames.APT.TariffElements)
export class AptTariffElements extends BaseEntity {
  @ManyToOne(() => AptTariffsDetails, (detail) => detail.elements)
  detail?: AptTariffsDetails

  @OneToOne(() => AptTariffRestrictions, (restriction) => restriction.element, {
    cascade: true,
  })
  @JoinColumn()
  restrictions?: AptTariffRestrictions

  @OneToMany(() => AptTariffPriceComponents, (pc) => pc.element, {
    cascade: true,
  })
  price_components?: AptTariffPriceComponents[]
}
