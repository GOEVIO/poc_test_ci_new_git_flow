import { TableNames } from 'evio-library-commons'
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterTariffsRestrictionsColumnToArray1755946965997
  implements MigrationInterface
{
  schema = process.env.DATABASE_SCHEMA
  name = 'AlterTariffsRestrictionsColumnToArray1755946965997'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffRestrictions}
      DROP COLUMN "reservation"
    `)

    await queryRunner.query(`
      CREATE TYPE ${this.schema}."apt_tariff_restrictions_reservation_enum" AS ENUM ('RESERVATION', 'RESERVATION_EXPIRES')
    `)

    await queryRunner.query(`
      ALTER TABLE ${this.schema}."apt_tariff_restrictions"
      ADD COLUMN "reservation" ${this.schema}."apt_tariff_restrictions_reservation_enum" NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffRestrictions}
      DROP COLUMN "reservation"
    `)

    await queryRunner.query(`
      DROP TYPE ${this.schema}."apt_tariff_restrictions_reservation_enum"
    `)

    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffRestrictions}
      ADD COLUMN "reservation" character varying
    `)
  }
}
