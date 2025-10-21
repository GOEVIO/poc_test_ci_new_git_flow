import * as amqp from 'amqplib';
import { INestApplicationContext } from '@nestjs/common';
import { Connection, Channel, ConsumeMessage } from 'amqplib';
import { sleep } from '../helpers/sleep';
import { handleError, processMessage } from './utils/consumer.utils';

export async function startConsumer(
  app: INestApplicationContext,
  queueName: string,
  handlerServiceClass: any,
  maxRetries = 3
): Promise<void> {
  try {
    const connection: Connection = await amqp.connect(
      `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}:5672`
    );
    const channel: Channel = await connection.createChannel();

    await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'dlq_' + queueName,
        'x-message-ttl': 60000,
      },
    });

    await channel.assertQueue('dlq_' + queueName, { durable: true });
    console.log(`Waiting for messages in "${queueName}"`);

    const handlerService = app.get(handlerServiceClass);

    channel.consume(queueName, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      await sleep(Number(process.env.INITIAL_DELAY_BEFORE_PROCESSING_MS));

      const content = JSON.parse(msg.content.toString());
      const { method, payload } = content;

      try {
        await processMessage(handlerService, method, payload);
        channel.ack(msg);
      } catch (err) {
        console.error('Error handling message:', err);

        const retries: number = msg.properties.headers?.['x-retries'] || 0;
        handleError(channel, msg, retries, maxRetries, queueName);
      }
    });
  } catch (err) {
    console.error('Failed to start consumer:', err);
  }
}
