import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const FacilitiesTypeSchema = z.object({
    locationType: z.string().min(1, 'Location type is required'),
    description: z.string().optional(),
});

export function validateFacilitiesType(req: Request, res: Response, next: NextFunction) {
    const result = FacilitiesTypeSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result.error.format());
    next();
}
