import { Module } from '@nestjs/common';
import { CustomMailerService } from './mailer.service';
import { MailerController } from './mailer.controller';

@Module({
  controllers: [MailerController],
  providers: [CustomMailerService],
  exports: [CustomMailerService],
})
export class CustomMailerModule {}
