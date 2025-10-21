import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tax_exemptions')
export class TaxExemption {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 10 })
    code: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ length: 5 })
    language: string;
}