import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('invoice_billing')
export class InvoiceBilling {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ type: 'int', nullable: true })
  payment_conditions_id: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vat_number: string;

  @Column({ type: 'varchar', length: 5 })
  client_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  street: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  purchase_order: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  number: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  floor: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  zip_code: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  country_code: string;

  @CreateDateColumn()
  created_at: Date;
}
