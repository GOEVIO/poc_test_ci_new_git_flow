import * as amqp from 'amqplib'
import { INestApplicationContext } from '@nestjs/common'
import { Connection, Channel, ConsumeMessage, Options } from 'amqplib'
import { MessageHandlerService } from './messageHandlers/messageHandler.service'
require('dotenv').config()

const QUEUE_NAME = process.env.QUEUE_NAME || ''
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10)

export async function startConsumer(
  app: INestApplicationContext
): Promise<void> {
  try {
    if (
      process.env.RABBITMQ_USER === undefined ||
      process.env.RABBITMQ_PASS === undefined ||
      process.env.RABBITMQ_HOST === undefined
    ) {
      console.error(
        'RabbitMQ connection details are not fully defined in environment variables.'
      )
      return
    }

    const connection: Connection = await amqp.connect(
      `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}:5672`
    )
    const channel: Channel = await connection.createChannel()

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'dlq_' + QUEUE_NAME,
        'x-message-ttl': 60000,
      },
    })

    await channel.assertQueue('dlq_' + QUEUE_NAME, { durable: true })
    console.log(`Waiting for messages in "${QUEUE_NAME}"`)

    const handlerService = app.get(MessageHandlerService)

    channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
      if (!msg) return

      const content = JSON.parse(msg.content.toString())
      const { method, payload } = content

      try {
        if (!method || typeof handlerService[method] !== 'function') {
          throw new Error(`Unsupported method "${method}"`)
        }

        await handlerService[method](payload || {})
        channel.ack(msg)
      } catch (err) {
        console.error('Error handling message:', err)

        const retries: number = msg.properties.headers?.['x-retries'] || 0

        const options: Options.Publish = {
          headers: { 'x-retries': retries + 1 },
          persistent: true,
        }

        if (retries < MAX_RETRIES) {
          channel.sendToQueue(QUEUE_NAME, msg.content, options)
          console.log(`Retrying (${retries + 1}/${MAX_RETRIES})`)
        } else {
          channel.sendToQueue('dlq_' + QUEUE_NAME, msg.content, {
            headers: { 'x-retries': retries },
            persistent: true,
          })
          console.log(`Moved to DLQ after ${MAX_RETRIES} attempts`)
        }

        channel.nack(msg, false, false)
      }
    })
  } catch (err) {
    console.error('Failed to start consumer:', err)
  }
}
