import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import PaymentsLibrary from 'evio-library-payments';
import { IPayment } from 'evio-library-commons/src/interfaces/payments/payment.interface';
import { Session } from '../sessions/interfaces/session.interface';
import { Invoice } from '../invoice/entities/invoice.entity';
import { IPaymentService } from './interfaces/payment-service.interface';
import { ITransaction } from 'evio-library-commons/src/interfaces/payments/transaction.interface';

@Injectable()
export class PaymentService implements IPaymentService {

    private readonly logger = new Logger(PaymentService.name);

    /**
     * Creates a payment using evio-library-payments.
     * @param sessions Array of sessions
     * @param invoice Invoice object
     * @param billingPeriod Billing period string
     * @param userId User ID
     * @param transactionId Transaction ID
     * @returns Result of payment creation
     */
    async createPayment(
        sessions: Session[],
        invoice: Invoice,
        billingPeriod: string,
        userId: string,
        transactionId: string
    ): Promise<IPayment> {
        const context = 'createPayment';
        try {
            this.logger.log(`[${context}] Creating payment for invoice ${invoice.id} and user ${userId}`);
            const paymentData: IPayment = {
                amount: { value: invoice.total_amount_inc_vat },
                invoiceId: invoice.id,
                paymentType: billingPeriod,
                userId: userId,
                listOfSessionsMonthly: sessions.map(s => ({
                    sessionId: s._id,
                    chargerType: s.chargerType
                })),
                totalPrice: {
                    incl_vat: invoice.total_amount_inc_vat,
                    excl_vat: invoice.total_amount_exc_vat
                },
                paymentMethod: 'transfer',
                status: '90',
                transactionId: transactionId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await PaymentsLibrary.createPayment(paymentData);
            this.logger.log(`[${context}] Payment created successfully: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            this.logger.error(`[${context}] Error creating payment: ${error.message}`, error.stack);
            throw new BadRequestException('Failed to create payment');
        }
    }

    async createTransaction(sessions: Session[], invoice: Invoice, userId: string): Promise<ITransaction> {
        const context = 'createTransaction';
        try {
            this.logger.log(`[${context}] Creating transaction for invoice ${invoice.id} and user ${userId}`);
            const transactionData: ITransaction = {
                amount: { value: invoice.total_amount_inc_vat },
                clientName: invoice.client_name,
                userId: userId,
                listOfSessionsMonthly: sessions.map(s => ({
                    sessionId: s._id,
                    chargerType: s.chargerType
                })),
                totalPrice: {
                    incl_vat: invoice.total_amount_inc_vat,
                    excl_vat: invoice.total_amount_exc_vat
                },
                status: '90',
                createdAt: new Date(),
                updatedAt: new Date(),
                transactionType: 'debit'
            };

            const result = await PaymentsLibrary.createTransaction(transactionData);
            this.logger.log(` [${context}] Transaction created successfully: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            this.logger.error(`[${context}] Error creating transaction: ${error.message}`, error.stack);
            throw new BadRequestException('Failed to create transaction');
        }
    }
}