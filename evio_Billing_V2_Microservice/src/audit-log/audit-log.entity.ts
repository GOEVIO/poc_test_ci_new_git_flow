import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('invoice_audit_log')
@Index('idx_invoice_audit_related_object', ['objectType', 'relatedObjectId'])
@Index('idx_invoice_audit_action', ['action'])
export class AuditLog {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'object_type', type: 'varchar', length: 50 })
  objectType: string;

  @Column({ name: 'related_object_id', type: 'uuid' })
  relatedObjectId: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ name: 'old_value', type: 'json', nullable: true })
  oldValue: any | null;

  @Column({ name: 'new_value', type: 'json', nullable: true })
  newValue: any | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'triggered_by', type: 'varchar', length: 50, default: 'system' })
  triggeredBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
