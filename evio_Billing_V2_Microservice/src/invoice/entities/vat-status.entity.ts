import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('vat_statuses')
export class VatStatus {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 2, nullable: false })
  tab_iva: number;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string;

  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: false })
  value: number;
}