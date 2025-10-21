import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InvoiceModule } from './invoice/invoice.module';
import { SessionModule } from './sessions/session.module';
import { BillingModule } from './billing/billing.module';
import { MessageHandlersModule } from './events/messageHandlers/messageHandlers.module';
import { CustomMailerModule } from './notification/mailer.module';
import { RetryModule } from './retry/retry.module';
import { CreditNoteModule } from './credit-note/credit-note.module';
import constants from './utils/constants'; 
import { FT } from './credit-note/entities/FT.entity';
import { FI } from './credit-note/entities/FI.entity';
import { ExternalAPIInvoiceModule } from './external-api/invoice/invoice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    // Postgres
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: constants.database.postgres.host,
      port: Number(constants.database.postgres.port),
      username: constants.database.postgres.user,
      password: constants.database.postgres.password,
      database: constants.database.postgres.name,
      schema: constants.database.postgres.schema,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
    }),
    // SQL Server
    TypeOrmModule.forRoot({
      name: 'sqlserver',
      type: 'mssql',
      host: constants.database.sqlserver.host,
      port: Number(constants.database.sqlserver.port),
      username: constants.database.sqlserver.user,
      password: constants.database.sqlserver.password,
      database: constants.database.sqlserver.name,
      entities: [FT, FI],
      synchronize: false,
      options: { encrypt: false },
    }),
    InvoiceModule,
    SessionModule,
    BillingModule,
    CustomMailerModule,
    CreditNoteModule,
    RetryModule,
    MessageHandlersModule,
    RetryModule,
    ExternalAPIInvoiceModule
  ],
})
export class AppModule { }
