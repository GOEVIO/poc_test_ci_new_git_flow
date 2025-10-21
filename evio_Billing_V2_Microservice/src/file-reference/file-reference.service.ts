import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileReference } from './file-reference.entity';
import { FilePurpose } from '../enums/file-purpose.enum';

interface CreateFileReferenceDto {
  related_object_type: string;
  related_object_id: string;
  file_type: string;
  file_purpose: FilePurpose;
  file_url: string;
}

@Injectable()
export class FileReferenceService {
  constructor(
    @InjectRepository(FileReference)
    private fileReferenceRepository: Repository<FileReference>,
  ) {}

  async saveFileReference(data: CreateFileReferenceDto): Promise<FileReference> {
    const fileReference = this.fileReferenceRepository.create(data);
    return this.fileReferenceRepository.save(fileReference);
  }

  async findAll(): Promise<FileReference[]> {
    return this.fileReferenceRepository.find();
  }

  async findByRelatedObjectId(id: string): Promise<FileReference[] | null> {
    return this.fileReferenceRepository.find({ where: { related_object_id: id } });
  }
}
