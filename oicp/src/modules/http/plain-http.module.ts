import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { HttpConstants } from '@/constants';
@Module({
  imports: [HttpModule], 
  providers: [
    {
      provide: HttpConstants.PLAIN_HTTP,
      useExisting: HttpService, 
    },
  ],
  exports: [HttpConstants.PLAIN_HTTP,],
})
export class PlainHttpModule {}
