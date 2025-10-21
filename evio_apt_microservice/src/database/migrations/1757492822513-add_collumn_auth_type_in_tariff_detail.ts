import { MigrationInterface, QueryRunner } from 'typeorm'
import { TableNames, DeviceTypes } from 'evio-library-commons'

export class AddCollumnAuthTypeInTariffDetail1757492822513
  implements MigrationInterface
{
  name = 'AddCollumnAuthTypeInTariffDetail1757492822513'
  schema = process.env.DATABASE_SCHEMA

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE TYPE ${this.schema}."AuthTypes_enum" AS ENUM(${Object.values(
          DeviceTypes
        )
          .map((v) => `'${v}'`)
          .join(', ')})    
    `)
    await queryRunner.query(`
        ALTER TABLE ${this.schema}.${TableNames.APT.TariffsDetails}
        ADD COLUMN "auth_type" ${this.schema}."AuthTypes_enum" DEFAULT '${DeviceTypes.APT}'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE ${this.schema}.${TableNames.APT.TariffsDetails}
        DROP COLUMN "auth_type"
    `)
    await queryRunner.query(`
        DROP TYPE ${this.schema}."AuthTypes_enum"
    `)
  }
}
