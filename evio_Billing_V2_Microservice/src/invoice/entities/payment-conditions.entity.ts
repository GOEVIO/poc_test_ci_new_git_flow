import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('payment_conditions')
export class PaymentConditions {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_condition_id: string;
}