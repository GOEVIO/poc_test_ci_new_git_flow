import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

/** {@link https://poupaenergia.pt/en/faq/o-que-e-o-cpe/} */
const CPE_REGEX = /^[A-Z]{2}(0001|0002)\d{12}[A-Z]{2}$/

const BaseSchema = z.object({
  name: z.string().min(1),
  CPE: z.string().regex(CPE_REGEX).optional().nullable().or(z.literal('')),
  additionalInformation: z.string().optional().nullable(),
  address: z.object({
    street: z.string().min(1),
    number: z.string().min(1),
    floor: z.string().optional().nullable(),
    zipCode: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
    countryCode: z.string().min(1),
  }),
  geometry: z.object({
    type: z.literal("Point").default("Point"),
    coordinates: z.tuple([z.number(), z.number()])
  })
})

export const LocationsV2DtoCreateSchema = BaseSchema.extend({
  imageContent: z.string().min(1)
})

export const LocationsV2DtoUpdateSchema = BaseSchema.extend({
  imageContent: z.string().optional().nullable().or(z.literal(''))
})

export type LocationsV2Dto = z.infer<typeof LocationsV2DtoCreateSchema>

export function validateLocationsV2Middleware(
    req: Request, res: Response, next: NextFunction
) {
  const schema = req.method === 'POST'
      ? LocationsV2DtoCreateSchema
      : LocationsV2DtoUpdateSchema;

  const wrapper = schema.safeParse(req.body)

  if (!wrapper.success) {
    console.error('Malformed body', wrapper.error.format())
    return res.status(400).send({ message: 'Malformed body', cause: wrapper.error.format() })
  }

  return next()
}
