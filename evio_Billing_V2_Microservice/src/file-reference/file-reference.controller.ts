import { Controller, Post, Body, Get } from '@nestjs/common';
import { FileReferenceService } from './file-reference.service';
import { FilePurpose } from '../enums/file-purpose.enum';

@Controller('file-reference')
export class FileReferenceController {
  constructor(private readonly fileReferenceService: FileReferenceService) {}

  @Post()
  async saveFileReference(
    @Body() body: {
      related_object_type: string;
      related_object_id: string;
      file_type: string;
      file_purpose: FilePurpose;
      file_url: string;
    },
  ) {
    return this.fileReferenceService.saveFileReference(body);
  }

  @Get()
  async getAllFileReferences() {
    return this.fileReferenceService.findAll();
  }
}
