import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('invoice_communication')
export class InvoiceCommunication {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  email: string;

  @Column({ type: 'varchar', length: 5 })
  language: string;

  @Column({ type: 'varchar', length: 5 })
  client_type: string;

  @CreateDateColumn()
  created_at: Date;
}
