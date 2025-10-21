import 'dotenv/config';
import { startConsumer } from './consumer';

async function bootstrap() {
  try {
    await startConsumer();
  } catch (err) {
    console.error('Fatal error starting consumer:', err);
    process.exit(1);
  }
}

bootstrap();
