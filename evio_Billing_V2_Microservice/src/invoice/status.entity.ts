import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('statuses')
export class Status {
  @PrimaryGeneratedColumn()
  code: number;

  @Column({ type: 'varchar', length: 50, nullable: false })
  description: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  object_type: string;
}