import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceExecution } from '../entities/invoice-execution.entity';
import { InvoiceExecutionStatus } from '../../enums/invoice-execution-status.enum';

@Injectable()
export class InvoiceExecutionService {
  constructor(
    @InjectRepository(InvoiceExecution)
    private readonly repo: Repository<InvoiceExecution>
  ) {}

  async startExecution(period: string): Promise<InvoiceExecution> {
    const inProgress = await this.repo.findOne({ where: { period, status: InvoiceExecutionStatus.IN_PROGRESS } });
    if (inProgress) throw new Error('Already an execution in progress for this period');

    const execution = this.repo.create({ period, status: InvoiceExecutionStatus.IN_PROGRESS });
    return this.repo.save(execution);
  }

  async isExecutionInProgress(period: string): Promise<boolean> {
    const exec = await this.repo.findOne({ where: { period, status: InvoiceExecutionStatus.IN_PROGRESS } });
    return !!exec;
  }

  async finishExecution(id: number, status: InvoiceExecutionStatus, errorMessage?: string): Promise<void> {
    await this.repo.update(id, {
      status,
      finished_at: new Date(),
      error_message: errorMessage ?? undefined,
    });
  }
}