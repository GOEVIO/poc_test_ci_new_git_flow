import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('retry_tasks')
export class RetryTask {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({ type: 'varchar', length: 50, nullable: false })
    related_object_type: string;

    @Column({ type: 'uuid', nullable: false })
    related_object_id: string;

    @Column({ type: 'varchar', length: 50, nullable: false })
    operation: string;

    @Column({ type: 'varchar', length: 30, nullable: false })
    status: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    failure_reason: string;

    @Column({ type: 'int', default: 0 })
    retry_count: number;

    @Column({ type: 'int', default: 3 })
    max_retries_allowed: number;

    @Column({ type: 'timestamp', nullable: true })
    next_retry_schedule_at: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}