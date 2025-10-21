import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('invoice_audit_log')
export class InvoiceAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  object_type: string;

  @Column({ type: 'uuid', nullable: false })
  related_object_id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  action: string;

  @Column({ type: 'json', nullable: true })
  old_value: any;

  @Column({ type: 'json', nullable: true })
  new_value: any;

  @Column({ type: 'varchar', length: 50, nullable: false })
  triggered_by: string;

  @CreateDateColumn()
  created_at: Date;
}