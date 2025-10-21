import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { MessagingModule } from './messaging/messaging.module';
import { MessagingService } from './messaging/messaging.service';
import { INestApplicationContext } from '@nestjs/common';


let app: INestApplicationContext;
let messagingService: MessagingService;

export async function initProducer() {
  if (!app) {
    app = await NestFactory.createApplicationContext(MessagingModule);
    messagingService = app.get(MessagingService);
  }
}

export async function sendMessage(payload: any, routingKey: string) {
  if (!messagingService) {
    await initProducer();
  }
  await messagingService.sendMessage(payload, routingKey);
}
