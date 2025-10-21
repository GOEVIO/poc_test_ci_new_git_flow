import { Column, Entity, OneToMany, Unique } from 'typeorm'
import { TableNames } from 'evio-library-commons'
import { BaseEntity } from './base.entity'
import { AptChargers } from './apt-chargers.entity'

@Entity(TableNames.APT.Apt)
@Unique(['serial_number'])
export class Apt extends BaseEntity {
  @Column()
  brand!: string

  @Column()
  model!: string

  @Column()
  financial_provider!: string

  @Column()
  firmware_version!: string

  @Column()
  android_application_version!: string

  @Column()
  has_sim_card!: boolean

  @Column()
  number_of_chargers?: number

  @OneToMany(() => AptChargers, (charger) => charger.apt, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  chargers?: AptChargers[]

  @Column({ type: 'text' })
  networks_available!: string[]

  @Column({ default: 'AD_HOC' })
  tariff_type!: string

  @Column()
  description_of_the_agreement?: string

  @Column({ unique: true })
  serial_number!: string

  @Column()
  user_id!: string

  @Column({ nullable: true })
  ip?: string

  @Column({ nullable: true })
  secret_key?: string

  @Column({ default: 'EVIO' })
  client_name!: string

  @Column()
  create_user_id!: string

  @Column()
  apt_owner_id!: string
}
