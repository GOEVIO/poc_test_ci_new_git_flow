import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const ParkingTypeSchema = z.object({
    parkingType: z.string().min(1, 'Parking type is required'),
    description: z.string().min(1, 'Description is required'),
});

export function validateParkingType(req: Request, res: Response, next: NextFunction) {
    const result = ParkingTypeSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result.error.format());
    next();
}
