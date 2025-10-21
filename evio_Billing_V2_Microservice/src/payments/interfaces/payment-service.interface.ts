import { Session } from '../../sessions/interfaces/session.interface';
import { Invoice } from '../../invoice/entities/invoice.entity';
import { ITransaction } from 'evio-library-commons/src/interfaces/payments/transaction.interface';
import { IPayment } from 'evio-library-commons/src/interfaces/payments/payment.interface';

export interface IPaymentService {
  createPayment(
    sessions: Session[],
    invoice: Invoice,
    billingPeriod: string,
    userId: string,
    transactionId: string
  ): Promise<IPayment>;

  createTransaction(
    sessions: Session[],
    invoice: Invoice,
    userId: string
  ): Promise<ITransaction>;
}