import { Module } from '@nestjs/common';
import { MessageHandlerService } from './messageHandler.service';
import { SessionModule } from '../../sessions/session.module';
import { RetryModule } from '../../retry/retry.module';
import { CreditNoteModule } from '../../credit-note/credit-note.module';

@Module({
  imports: [SessionModule, RetryModule, CreditNoteModule], 
  providers: [MessageHandlerService],
  exports: [MessageHandlerService],
})
export class MessageHandlersModule {}
