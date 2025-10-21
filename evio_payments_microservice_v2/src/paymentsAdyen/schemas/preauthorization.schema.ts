import { z } from 'zod'

export const PreAuthorizationRequestSchema = z.object({
    currency: z.string(),
    amount: z.number(),
    userId: z.string()
});



export const PreAuthorizationSchema = z.object({
    _id: z.string(),
    transactionId: z.string(),
    initialAmount: z.number(),
    amount: z.object({
        currency: z.string(),
        value: z.number()
    }).optional().nullable(),
    paymentMethodId: z.string().optional().nullable(),
    adyenReference: z.string(),
    userId: z.string(),
    success: z.boolean(),
    active: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string().optional().nullable(),
    adyenPspReferenceUpdated: z.array(z.string()).optional().nullable(),
    blobPreAuthorization: z.string().optional().nullable(),
    sessionId: z.string().optional().nullable()
});

// Now add this object into an array
export const PreAuthorizationSchemaArray = z.array(PreAuthorizationSchema)