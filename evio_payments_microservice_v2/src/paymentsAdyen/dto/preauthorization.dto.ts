import { PreAuthorizationRequestSchema } from "../schemas/preauthorization.schema";

export interface IPreAuthorizationRequest {
    currency: string;
    amount: number;
    userId: string;
}

export class PreAuthorizationRequest {
    currency: string;
    amount: number;
    userId: string; 
    
    constructor(body: IPreAuthorizationRequest) {
        this.currency = body.currency;
        this.amount = body.amount;
        this.userId = body.userId;
    }

    static verify(request: IPreAuthorizationRequest) {
        try {
            PreAuthorizationRequestSchema.parse(request);
            return;
        } catch (error) {
            throw {
                status: 400,
                error: {
                    message: `Invalid request, missing field: ${error.issues[0].path}`,
                },
                code: 'server_invalid_request',
                origin: error
            }
        }
    }
}

export interface IPreAuthorizationResponse {
    transactionId: string;
    initialAmount: number;
    amount: Amount;
    paymentMethodId: string;
    adyenReference: string;
    userId: string;
    success: boolean;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    adyenPspReferenceUpdated: string[];
    blobPreAuthorization: string;
    status: {
        value: string;
        code: string;
    },
    nextUpdate: string;
    sessionId: string;
    paymentInfo?: {
        paymentId: string;
        amountThatWasPaid: number;
        paidAt: string;
    }
    refusalReason?: string;
    refusalReasonCode?: number;
    refusalStatusCode?: number;
    originError?: any;
    owner: string;
    metadata?: any;
}

export interface Amount {
    currency: string;
    value: number;
}

export class PreAuthorizationResponse {
    transactionId: string;
    initialAmount: number;
    amount: Amount;
    paymentMethodId: string;
    adyenReference: string;
    userId: string;
    success: boolean;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    adyenPspReferenceUpdated: string[];
    blobPreAuthorization: string;
    status: {
        value: string;
        code: string;
    }
    sessionId: string;
    paymentInfo: {
        paymentId: string;
        amountThatWasPaid: number;
        paidAt: string;
    }
    refusalReason: string;
    refusalReasonCode: number;
    refusalStatusCode: number;
    originError: any;
    owner: string

    constructor(body: IPreAuthorizationResponse) {
        this.transactionId = body.transactionId;
        this.initialAmount = body.initialAmount;
        this.amount = body.amount;
        this.paymentMethodId = body.paymentMethodId;
        this.adyenReference = body.adyenReference;
        this.userId = body.userId;
        this.success = body.success;
        this.active = body.active;
        this.createdAt = new Date().toISOString();
        this.updatedAt = body.updatedAt;
        this.adyenPspReferenceUpdated = body.adyenPspReferenceUpdated;
        this.blobPreAuthorization = body.blobPreAuthorization;
        this.status = body.status;
        this.sessionId = body.sessionId;
        this.paymentInfo = body.paymentInfo;
        this.refusalReason = body.refusalReason;
        this.refusalReasonCode = body.refusalReasonCode;
        this.refusalStatusCode = body.refusalStatusCode;
        this.originError = body.originError;
        this.owner = body.owner;
    }
}

export const statusPreAuthorization =  {
    CREATED: {
        value: 'created',
        code: 'unpaid'
    },
    CREATEDFAILD: {
        value: 'created',
        code: 'faild'
    },
    PAID: {
        value: 'updated',
        code: 'paid'    
    },
    CANCELLED: {
        value: 'cancelled',
        code: 'unpaid'
    },
    UPDATED: {
        value: 'updated',
        code: 'unpaid'
    },
    COMPLETEDFAIL: {
        value: 'completed',
        code: 'unpaid'
    }
}