import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'FT' })
export class FT {
  @PrimaryColumn({ type: 'char', length: 25 })
  ftstamp: string;

  @Column()
  pnome: string;
}