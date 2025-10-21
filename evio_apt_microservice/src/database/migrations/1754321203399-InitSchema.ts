import { MigrationInterface, QueryRunner } from 'typeorm'
import { TableNames } from 'evio-library-commons'

export class InitSchema1754321203399 implements MigrationInterface {
  name = 'InitSchema1754321203399'
  schema = process.env.DATABASE_SCHEMA

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
    `)
    await queryRunner.query(`
      CREATE TABLE ${this.schema}.${TableNames.APT.TariffRestrictions} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "day_of_week" text array,
        "min_duration" integer,
        "start_time" TIME,
        "end_time" TIME,
        "start_date" date,
        "end_date" date,
        "min_kwh" double precision,
        "max_kwh" double precision,
        "min_current" double precision,
        "max_current" double precision,
        "min_power" double precision,
        "max_power" double precision,
        "max_duration" double precision,
        CONSTRAINT "PK_3d14959758518fcce401f46e325" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      CREATE TABLE ${this.schema}.${TableNames.APT.TariffPriceComponents} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "type" character varying,
        "price" double precision,
        "vat" double precision,
        "step_size" integer,
        "elementId" uuid,
        CONSTRAINT "PK_391559a0915cfac9340fce16c8c" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      CREATE TABLE ${this.schema}.${TableNames.APT.TariffElements} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "detailId" uuid,
        "restrictionsId" uuid,
        CONSTRAINT "REL_34ca94b64eda68f5c53d89c5d8" UNIQUE ("restrictionsId"),
        CONSTRAINT "PK_5edc8ce73e96357aa35dd249ca8" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      CREATE TABLE ${this.schema}.${TableNames.APT.TariffsDetails} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "tariff_owner" character varying,
        CONSTRAINT "PK_265a5ad590a3e27415eb9f89dcd" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      CREATE TABLE ${this.schema}.${TableNames.APT.Plugs} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "plug_id" character varying,
        "chargerId" uuid,
        "tariffsDetailId" uuid,
        CONSTRAINT "REL_40432c57a9a3f5563e14c3d2aa" UNIQUE ("tariffsDetailId"),
        CONSTRAINT "PK_6f49c00dc5edcb0d62bf28085d3" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      CREATE TABLE ${this.schema}.${TableNames.APT.Chargers} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "hwId" character varying,
        "aptId" uuid,
        CONSTRAINT "UQ_caf62db9a719216984b19a08a35" UNIQUE ("hwId", "aptId"),
        CONSTRAINT "PK_be1f8162393415a389d03c4cf77" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      CREATE TABLE ${this.schema}.${TableNames.APT.Apt} (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "brand" character varying,
        "model" character varying,
        "financial_provider" character varying,
        "firmware_version" character varying,
        "android_application_version" character varying,
        "has_sim_card" boolean,
        "number_of_chargers" integer,
        "networks_available" text,
        "tariff_type" character varying DEFAULT 'AD_HOC',
        "description_of_the_agreement" character varying,
        "serial_number" character varying,
        "user_id" character varying,
        CONSTRAINT "UQ_fd1ca4fee0cb5712218db6d32e0" UNIQUE ("serial_number"),
        CONSTRAINT "PK_84258c469e582fcc25aa693c3f6" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffPriceComponents}
        ADD CONSTRAINT "FK_306c75dbf552ee8e9f817676297"
        FOREIGN KEY ("elementId") REFERENCES ${this.schema}.${TableNames.APT.TariffElements}("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffElements}
        ADD CONSTRAINT "FK_54afd32a9b8ce9b35eeb39e60e6"
        FOREIGN KEY ("detailId") REFERENCES ${this.schema}.${TableNames.APT.TariffsDetails}("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffElements}
        ADD CONSTRAINT "FK_34ca94b64eda68f5c53d89c5d87"
        FOREIGN KEY ("restrictionsId") REFERENCES ${this.schema}.${TableNames.APT.TariffRestrictions}("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Plugs}
        ADD CONSTRAINT "FK_8dbe67b10ffb0360405661be3e6"
        FOREIGN KEY ("chargerId") REFERENCES ${this.schema}.${TableNames.APT.Chargers}("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Plugs}
        ADD CONSTRAINT "FK_40432c57a9a3f5563e14c3d2aad"
        FOREIGN KEY ("tariffsDetailId") REFERENCES ${this.schema}.${TableNames.APT.TariffsDetails}("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Chargers}
        ADD CONSTRAINT "FK_ab00ea850b4691c42479766c638"
        FOREIGN KEY ("aptId") REFERENCES ${this.schema}.${TableNames.APT.Apt}("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Chargers} DROP CONSTRAINT "FK_ab00ea850b4691c42479766c638"
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Plugs} DROP CONSTRAINT "FK_40432c57a9a3f5563e14c3d2aad"
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.Plugs} DROP CONSTRAINT "FK_8dbe67b10ffb0360405661be3e6"
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffElements} DROP CONSTRAINT "FK_34ca94b64eda68f5c53d89c5d87"
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffElements} DROP CONSTRAINT "FK_54afd32a9b8ce9b35eeb39e60e6"
    `)
    await queryRunner.query(`
      ALTER TABLE ${this.schema}.${TableNames.APT.TariffPriceComponents} DROP CONSTRAINT "FK_306c75dbf552ee8e9f817676297"
    `)
    await queryRunner.query(`
      DROP TABLE ${this.schema}.${TableNames.APT.Apt}
    `)
    await queryRunner.query(`
      DROP TABLE ${this.schema}.${TableNames.APT.Chargers}
    `)
    await queryRunner.query(`
      DROP TABLE ${this.schema}.${TableNames.APT.Plugs}
    `)
    await queryRunner.query(`
      DROP TABLE ${this.schema}.${TableNames.APT.TariffsDetails}
    `)
    await queryRunner.query(`
      DROP TABLE ${this.schema}.${TableNames.APT.TariffElements}
    `)
    await queryRunner.query(`
      DROP TABLE ${this.schema}.${TableNames.APT.TariffPriceComponents}
    `)
    await queryRunner.query(`
      DROP TABLE ${this.schema}.${TableNames.APT.TariffRestrictions}
    `)
  }
}
