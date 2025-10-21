import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileReference } from './file-reference.entity';
import { FileReferenceService } from './file-reference.service';
import { FileReferenceController } from './file-reference.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FileReference])],
  providers: [FileReferenceService],
  exports: [FileReferenceService], 
  controllers: [FileReferenceController],
})
export class FileReferenceModule {}