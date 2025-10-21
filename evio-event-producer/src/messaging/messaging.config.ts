export const messagingConfig = {
  uri: `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}:5672`,
  exchange: process.env.RABBITMQ_MAIN_EXCHANGE,
  routingKey: 'route_key',
};
