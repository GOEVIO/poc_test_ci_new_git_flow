import { TableNames } from 'evio-library-commons'
import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateRelationsTariffsPlugs1755957934147
  implements MigrationInterface
{
  name = 'CreateRelationsTariffsPlugs1755957934147'
  schema = process.env.DATABASE_SCHEMA

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffsDetails}
      ADD COLUMN "plug_id" uuid
    `)

    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffsDetails}
      ADD CONSTRAINT "FK_tariffdetails_plug"
      FOREIGN KEY ("plug_id") REFERENCES ${this.schema}.${TableNames.APT.Plugs}(id)
      ON DELETE CASCADE
    `)

    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Plugs}
      DROP CONSTRAINT IF EXISTS "FK_40432c57a9a3f5563e14c3d2aad"
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Plugs}
      ADD CONSTRAINT "FK_40432c57a9a3f5563e14c3d2aad"
      FOREIGN KEY ("tariffsDetailId") REFERENCES ${this.schema}.${TableNames.APT.TariffsDetails}(id)
      ON DELETE SET NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Plugs}
      DROP CONSTRAINT IF EXISTS "FK_40432c57a9a3f5563e14c3d2aad"
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffsDetails}
      DROP CONSTRAINT IF EXISTS "FK_tariffdetails_plug"
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffsDetails}
      DROP COLUMN "plug_id"
    `)

    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Plugs}
        ADD CONSTRAINT "FK_40432c57a9a3f5563e14c3d2aad"
        FOREIGN KEY ("tariffsDetailId") REFERENCES ${this.schema}.${TableNames.APT.TariffsDetails}("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `)
  }
}
