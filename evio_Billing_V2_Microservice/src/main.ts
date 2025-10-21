require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { startCreditNoteConsumer } from './events/credit-note-consumer';
import { startInvoiceConsumer } from './events/invoice-consumer';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3007);
  console.log('✅ App is running on port', process.env.PORT ?? 3007);
  await Promise.all([
    startCreditNoteConsumer(app),
    startInvoiceConsumer(app)
  ]);
}
bootstrap();
