import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('excel_templates')
export class ExcelTemplate {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 50, nullable: false })
  template_name: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: false })
  version: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  description: string;

  @Column({ type: 'boolean', nullable: false })
  is_active: string;

  @Column({ type: 'json', nullable: false })
  template_json: string;

  @Column({ type: 'varchar', length: 10, nullable: false })
  language: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}