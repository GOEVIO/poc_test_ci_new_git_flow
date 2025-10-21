import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const ChargerSchema = z.object({
    vendor: z.string().min(1, 'Vendor is required'),
    model: z.string().min(1, 'Model is required'),
    name: z.string().min(1, 'Name is required'),
    hwId: z.string().optional(),
    infrastructure: z.string().min(1, 'Infrastructure is required'),
    hasInfrastructure: z.boolean(),
    address: z.object({
        street: z.string().min(1, 'Street is required'),
        number: z.string().min(1, 'Number is required'),
        zipCode: z.string().min(1, 'ZipCode is required'),
        city: z.string().min(1, 'City is required'),
        state: z.string().min(1, 'State is required'),
        country: z.string().min(1, 'Country is required'),
        countryCode: z.string().min(1, 'CountryCode is required'),
    }),
    geometry: z.object({
        coordinates: z.tuple([z.number(), z.number()]),
    }),
    offlineNotification: z.boolean(),
    offlineEmailNotification: z.string().optional(),
    parkingType: z.string().min(1, 'ParkingType is required'),
    facilitiesTypes: z.array(z.object({ facility: z.string().min(1) })),
    CPE: z.string().optional(),
});

export function validateChargerMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const result = ChargerSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).send({
            message: 'Validation failed',
            errors: result.error.format(),
        });
    }

    next();
}
