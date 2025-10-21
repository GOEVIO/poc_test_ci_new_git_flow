import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'FI' })
export class FI {
  @PrimaryColumn({ type: 'char', length: 25 })
  fistamp: string;

  @Column({ type: 'char', length: 25 })
  ftstamp: string;

  @Column()
  etiliquido: string;
}