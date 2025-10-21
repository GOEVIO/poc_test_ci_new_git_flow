import { FilePurpose } from '../enums/file-purpose.enum';
import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('file_references')
export class FileReference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  related_object_type: string;

  @Column({ type: 'uuid', nullable: false })
  related_object_id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  file_type: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  file_purpose: FilePurpose;

  @Column({ type: 'varchar', length: 255, nullable: false })
  file_url: string;

  @CreateDateColumn()
  created_at: Date;
}