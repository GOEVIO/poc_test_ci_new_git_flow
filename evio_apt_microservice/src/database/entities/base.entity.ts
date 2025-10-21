import { UUID } from 'crypto'
import {
  CreateDateColumn,
  Generated,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  @Generated('uuid')
  id?: UUID

  @CreateDateColumn()
  created_at?: Date | string

  @UpdateDateColumn()
  updated_at?: Date | string
}
