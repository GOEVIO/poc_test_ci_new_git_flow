import { Column, Entity, OneToOne } from 'typeorm'
import { TableNames } from 'evio-library-commons'
import { BaseEntity } from './base.entity'
import { AptTariffElements } from './apt-tariff-elements.entity'

@Entity(TableNames.APT.TariffRestrictions)
export class AptTariffRestrictions extends BaseEntity {
  @Column('text', { array: true })
  day_of_week?: string[]

  @Column('int')
  min_duration?: number

  @Column('time')
  start_time?: string

  @Column('time')
  end_time?: string

  @Column('date')
  start_date?: string

  @Column('date')
  end_date?: string

  @Column('float')
  min_kwh?: number

  @Column('float')
  max_kwh?: number

  @Column('float')
  min_current?: number

  @Column('float')
  max_current?: number

  @Column('float')
  min_power?: number

  @Column('float')
  max_power?: number

  @Column('float')
  max_duration?: number

  @Column({
    type: 'enum',
    enum: ['RESERVATION', 'RESERVATION_EXPIRES'],
    nullable: true,
  })
  reservation?: 'RESERVATION' | 'RESERVATION_EXPIRES'

  @OneToOne(() => AptTariffElements, (element) => element.restrictions)
  element?: AptTariffElements
}
