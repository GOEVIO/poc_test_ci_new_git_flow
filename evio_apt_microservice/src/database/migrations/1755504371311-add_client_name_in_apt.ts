import { TableNames } from 'evio-library-commons'
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddClientNameInApt1755504371311 implements MigrationInterface {
  schema = process.env.DATABASE_SCHEMA
  name = 'AddClientNameInApt1754385311816'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${this.schema}.${TableNames.APT.Apt} ADD COLUMN IF NOT EXISTS "client_name" VARCHAR(20) DEFAULT 'EVIO';`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE ${this.schema}.${TableNames.APT.Apt} DROP COLUMN IF EXISTS "client_name";
      `)
  }
}
