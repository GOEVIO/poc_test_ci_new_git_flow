import { TableNames } from 'evio-library-commons'
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddColumnsInChargeAndTariffsRestriction1754491672975
  implements MigrationInterface
{
  schema = process.env.DATABASE_SCHEMA
  name = 'AddColumnsInChargeAndTariffsRestriction1754491672975'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${this.schema}.${TableNames.APT.Chargers} ADD COLUMN IF NOT EXISTS "charger_type" VARCHAR(20);`
    )
    await queryRunner.query(
      `ALTER TABLE ${this.schema}.${TableNames.APT.TariffRestrictions} ADD COLUMN IF NOT EXISTS "reservation" VARCHAR(30);`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE ${this.schema}.${TableNames.APT.Chargers} DROP COLUMN IF EXISTS "charger_type";
    `)
    await queryRunner.query(`
        ALTER TABLE ${this.schema}.${TableNames.APT.TariffRestrictions} DROP COLUMN IF EXISTS "reservation";
    `)
  }
}
