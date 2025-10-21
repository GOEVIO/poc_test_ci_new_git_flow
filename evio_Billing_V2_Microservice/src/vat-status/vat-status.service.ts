import { Injectable, Logger } from '@nestjs/common';
import { Session } from '../sessions/interfaces/session.interface';
import { VatStatus } from '../invoice/entities/vat-status.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class VatStatusService {
    private readonly logger = new Logger(VatStatusService.name);
    constructor(
        @InjectRepository(VatStatus)
        private readonly vatStatusRepository: Repository<VatStatus>,
    ) { }

    /**
     * Resolves VAT country from session data.
     * @param sessions Array of Session
     * @returns VAT country code as string
     * @throws Error if VAT country is invalid or undefined
     */
    resolveVatCountry(sessions: Session[]): string {
        if (!sessions || sessions.length === 0) {
            throw new Error('No sessions provided');
        }
        const vatCountry = sessions[0].fees?.countryCode;
        if (!vatCountry) {
            this.logger.error(`VAT country is undefined in session fees for session ID: ${sessions[0]._id}`);
            throw new Error(`Invalid VAT country: ${vatCountry}`);
        }
        return vatCountry;
    }

    /**
     * Finds VAT status for a session and country.
     * @param vatStatusRepository Repository for VatStatus
     * @param session Session object
     * @param vatCountry VAT country code
     * @returns VatStatus object or throws error if not found
     */
    async getVatStatus(
        session: Session,
        vatCountry: string
    ): Promise<VatStatus> {
        const vatStatus = await this.vatStatusRepository.findOne({
            where: {
                value: session.fees?.IVA,
                country: vatCountry,
            },
        });

        if (!vatStatus) {
            this.logger.error(`VAT status not found for country: ${vatCountry} and IVA: ${session.fees?.IVA} to session ID: ${session._id}`);
            throw new Error(`VAT status not found for country: ${vatCountry}`);
        }

        return vatStatus;
    }
}