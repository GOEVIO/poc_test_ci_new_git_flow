import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const AssetTypeSchema = z.object({
    vehicleType: z.string().min(1, 'Vehicle type is required'),
    description: z.string().optional(),
});

export function validateAssetType(req: Request, res: Response, next: NextFunction) {
    const result = AssetTypeSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result.error.format());
    next();
}
