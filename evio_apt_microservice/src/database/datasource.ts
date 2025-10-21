import { resolve } from 'path'
import { DataSource } from 'typeorm'
import * as dotenv from 'dotenv'
import { DBNames } from 'evio-library-commons'

dotenv.config()

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: DBNames.APT,
  schema: process.env.DATABASE_SCHEMA,
  entities: [resolve(__dirname, 'entities', '*.{ts,js}')],
  migrations: [resolve(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: true,
  migrationsRun: true,
})
