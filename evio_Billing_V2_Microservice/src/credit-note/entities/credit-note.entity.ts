import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('credit_notes')
export class CreditNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  invoice_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  credit_note_number: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  third_party_id: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: false })
  total_amount: number;

  @Column({ type: 'varchar', length: 6, nullable: false })
  reason: string;

  @Column({ type: 'varchar', length: 30, nullable: false })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at?: Date;

  @Column({ type: 'boolean', default: false })
  email_sent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  email_send_timestamp?: Date;

  @Column({ type: 'varchar', length: 255, nullable: false })
  raised_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}