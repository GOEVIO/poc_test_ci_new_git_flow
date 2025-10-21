import { InvoiceStatusId } from '../../enums/invoice-status.enum';
import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  client_name: string;

  @Column({ type: 'varchar' }) 
  billing_type: 'AD_HOC' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY';

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  total_amount_exc_vat: number;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  total_amount_inc_vat: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  credited_amount_exc_vat: number;

  @Column({ type: 'varchar', length: 3, default: 'EUR' })
  currency: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  vat_country?: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  vat_rate?: number;

  @Column({ type: 'boolean', nullable: true })
  vies_vat?: boolean;

  @Column()
  status: InvoiceStatusId;

  @Column({ type: 'varchar', length: 100, nullable: true })
  invoice_number?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  third_party_id?: string;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at?: Date;

  @Column({ type: 'boolean', default: false })
  email_sent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  email_send_timestamp?: Date;

  @Column({ type: 'json', nullable: true })
  sessions?: any[];

  @Column({ type: 'varchar', length: 255, nullable: false })
  sessions_url: string;

  @Column({ type: 'varchar', length: 6, nullable: true })
  map_date: string;

  @Column({ type: 'int', nullable: true })
  invoice_layout_id?: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}