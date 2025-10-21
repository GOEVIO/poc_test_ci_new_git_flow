import { MigrationInterface, QueryRunner } from 'typeorm'
import { TableNames } from 'evio-library-commons'

export class AddColumnsInApt1754385311816 implements MigrationInterface {
  schema = process.env.DATABASE_SCHEMA
  name = 'AddColumnsInApt1754385311816'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${this.schema}.${TableNames.APT.Apt} ADD COLUMN IF NOT EXISTS "ip" VARCHAR(255);`
    )
    await queryRunner.query(
      `ALTER TABLE ${this.schema}.${TableNames.APT.Apt} ADD COLUMN IF NOT EXISTS "secret_key" VARCHAR(255);`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Apt} DROP COLUMN IF EXISTS "ip";
      ALTER TABLE ${this.schema}.${TableNames.APT.Apt} DROP COLUMN IF EXISTS "secret_key";
    `)
  }
}
