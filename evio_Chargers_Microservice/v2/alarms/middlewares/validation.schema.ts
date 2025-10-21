import { z } from 'zod'

export const AlarmSchema = z.object({
    title: z.object({
        code: z.string().min(1),
        message: z.string().min(1)
    }),
    description: z.object({
        code: z.string().min(1),
        message: z.string().min(1)
    }),
    timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid datetime format',
    }),
    type: z.enum(['error', 'warning', 'info']),
    status: z.enum(['read', 'unread']),
    userId: z.string().min(1),
    hwId: z.string().min(1),
    plugId: z.string().min(1),
    data: z.record(z.string(), z.any())
})

export type AlarmDto = z.infer<typeof AlarmSchema>
