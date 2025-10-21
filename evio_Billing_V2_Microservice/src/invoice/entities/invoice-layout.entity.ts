import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('invoice_layouts')
export class InvoiceLayout {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ name: 'printtypeid', type: 'varchar' })
  printtypeid: string;

  @Column({ name: 'doctype', type: 'varchar', length: 50 })
  doctype: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  client_name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  type: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  language: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  payment_type: string;

  @Column({ type: 'int', nullable: true })
  doc_type: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  linked_credit_note_id: string;
}