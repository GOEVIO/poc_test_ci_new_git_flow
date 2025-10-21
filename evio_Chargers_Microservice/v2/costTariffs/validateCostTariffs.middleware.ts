import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const WeekScheduleSchema = z.object({
    weekDay: z.string().min(1, 'Weekday is required'),
    scheduleTime: z.array(z.object({
        value: z.number().min(0, 'Value must be non-negative'),
        startTime: z.string().min(1, 'Start time is required'),
        stopTime: z.string().min(1, 'Stop time is required')
    }))
});

const CostTariffSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    tariffType: z.string().min(1, 'Tariff type is required'),
    userId: z.string().min(1, 'User ID is required'),
    weekSchedule: z.array(WeekScheduleSchema),
    purchaseTariffId: z.string().min(1, 'Purchase Tariff ID is required')
});

export function validateCostTariffs(req: Request, res: Response, next: NextFunction) {
    const result = CostTariffSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result.error.format());
    next();
}
