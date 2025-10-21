export interface ISession {
  id: string;
  userId: string;
  start: Date;
  end: Date;
  energy: number;
  cost: number;
}

export interface ISessionGroup {
  sessions: ISession[];
}

export interface SessionFilters {
    invoiceId: string | null;
    invoiceStatus: boolean;
    userIdToBillingInfo: { $exists: boolean; $ne: null };
    billingPeriod: string;
    userIdToBilling?: string;
}
