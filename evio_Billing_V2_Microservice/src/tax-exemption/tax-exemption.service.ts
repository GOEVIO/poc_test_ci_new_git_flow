import { Injectable, Logger } from '@nestjs/common';
import { TaxExemption } from '../invoice/entities/tax-exemptions.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TaxExemptionService {
    private readonly logger = new Logger(TaxExemptionService.name);

    constructor(
        @InjectRepository(TaxExemption)
        private readonly taxExemptionRepository: Repository<TaxExemption>,
    ) { }

    async findAll(): Promise<TaxExemption[]> {
        return this.taxExemptionRepository.find();
    }

    async getTaxExemptionByLanguage(language: string): Promise<{ code: string, description: string }> {
        this.logger.log(`Fetching tax exemption for language: ${language}`);
        const exemption = await this.taxExemptionRepository.findOne({
            where: { language: language }
        });
        if (exemption) {
            return { code: exemption.code, description: exemption.description };
        }
        return { code: '', description: '' };
    }
}