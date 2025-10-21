# evio-event-producer

`evio-event-producer` is an event producer implementation using RabbitMQ and NestJS. This service allows sending messages to a RabbitMQ exchange with specific routing keys for event-driven communication. It provides an interface to send messages with a custom payload to a specified routing key.

## Project Structure

The basic structure of the project consists of the following files:

- **`messaging.config.ts`**: Configuration file containing the RabbitMQ connection details, exchange name, and routing key.
- **`messaging.module.ts`**: NestJS module that sets up the RabbitMQ connection using `@golevelup/nestjs-rabbitmq` and provides the `MessagingService`.
- **`messaging.service.ts`**: Service that handles sending messages to the RabbitMQ exchange.
- **`index.ts`**: Main exports for initializing and sending messages from the producer.
- **`main.ts`**: Bootstraps the NestJS application context for sending messages using the `MessagingService`.

## Installation

### Requirements

- **Node.js** (v22.14 or higher)
- **RabbitMQ** running at the URL `amqp://admin:admin@localhost:5672`

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/your-organization/evio-event-producer.git
   cd evio-event-producer
   npm install
