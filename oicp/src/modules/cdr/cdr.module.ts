import { Module } from '@nestjs/common'
import { ReceiverInterceptor } from '@/interceptors/receiver.interceptor'
import { SshHttpModule } from '../ssh/ssh.module'
import { EvseModule } from '../evse/evse.module'
import { ReceiveCdrService } from './services/receive-cdr.service'
import { GetCdrService } from './services/get-cdr.service'
import { LogsService } from '@/logs/logs.service'
import { CdrController } from './cdr.controller'
import { PlainHttpModule } from '../http/plain-http.module';

@Module({
  imports: [SshHttpModule, EvseModule, PlainHttpModule],
  controllers: [CdrController],
  providers: [ReceiveCdrService, LogsService, ReceiverInterceptor, GetCdrService],
  exports: [ReceiveCdrService],
})
export class CdrModule {}
