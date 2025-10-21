import { InvoiceExecutionStatus } from '../../enums/invoice-execution-status.enum';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('invoice_executions')
export class InvoiceExecution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  period: string; 

  @Column({ type: 'enum', enum: InvoiceExecutionStatus })
  status: InvoiceExecutionStatus;

  @CreateDateColumn()
  started_at: Date;

  @Column({ nullable: true })
  finished_at: Date;

  @Column({ nullable: true })
  error_message: string;
}