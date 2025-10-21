import { TableNames } from 'evio-library-commons'
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ChangeChargerPlugToUnique1755862238778
  implements MigrationInterface
{
  schema = process.env.DATABASE_SCHEMA
  name = 'ChangeChargerPlugToUnique1755862238778'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${this.schema}.${TableNames.APT.Plugs} ADD CONSTRAINT "UQ_plug_chargerId" UNIQUE ("plug_id", "chargerId");`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE ${this.schema}.${TableNames.APT.Plugs} DROP CONSTRAINT IF EXISTS "UQ_plug_chargerId";
    `)
  }
}
