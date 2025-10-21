import { TableNames } from 'evio-library-commons'
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFieldsAptOwnerIDCreateUserIdInAptStations1755531901436
  implements MigrationInterface
{
  schema = process.env.DATABASE_SCHEMA
  name = 'AddFieldsAptOwnerIDCreateUserIdInAptStations1755531901436'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${this.schema}.${TableNames.APT.Apt} ADD COLUMN IF NOT EXISTS "create_user_id" VARCHAR(255);`
    )

    await queryRunner.query(
      `ALTER TABLE ${this.schema}.${TableNames.APT.Apt} ADD COLUMN IF NOT EXISTS "apt_owner_id" VARCHAR(255);`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE ${this.schema}.${TableNames.APT.Apt} DROP COLUMN IF EXISTS "create_user_id";
    `)
    await queryRunner.query(`
        ALTER TABLE ${this.schema}.${TableNames.APT.Apt} DROP COLUMN IF EXISTS "apt_owner_id";
    `)
  }
}
