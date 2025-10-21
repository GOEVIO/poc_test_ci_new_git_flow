import { z } from "zod";
import {
  OcpiTariffDimenstionType,
  DaysOfWeek,
  SalesTariffs,
  OcpiTariffType,
} from "evio-library-commons";
import { isValidObjectId } from "mongoose";

const RestrictionsZ = z
  .object({
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    end_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    min_kwh: z.coerce.number().min(0).optional(),
    max_kwh: z.coerce.number().min(0).optional(),
    min_current: z.coerce.number().optional(),
    max_current: z.coerce.number().optional(),
    min_power: z.coerce.number().optional(),
    max_power: z.coerce.number().optional(),
    min_duration: z.coerce.number().int().min(0).optional(),
    max_duration: z.coerce.number().int().min(0).optional(),
    day_of_week: z.array(z.enum(DaysOfWeek)).optional(),
    reservation: z.string().optional(),
  })
  .refine(
    (r) =>
      r.min_kwh === undefined ||
      r.max_kwh === undefined ||
      r.min_kwh <= r.max_kwh,
    {
      message: "min_kwh must be ≤ max_kwh",
      path: ["min_kwh"],
    }
  )
  .refine(
    (r) =>
      r.min_current === undefined ||
      r.max_current === undefined ||
      r.min_current <= r.max_current,
    {
      message: "min_current must be ≤ max_current",
      path: ["min_current"],
    }
  )
  .refine(
    (r) =>
      r.min_power === undefined ||
      r.max_power === undefined ||
      r.min_power <= r.max_power,
    {
      message: "min_power must be ≤ max_power",
      path: ["min_power"],
    }
  )
  .refine(
    (r) =>
      r.min_duration === undefined ||
      r.max_duration === undefined ||
      r.min_duration <= r.max_duration,
    {
      message: "min_duration must be ≤ max_duration",
      path: ["min_duration"],
    }
  );

export const CreateSalesTariffBodyZ = z
  .object({
    name: z.string().trim().min(1, { message: "Name is required" }),
    billingType: z.enum(SalesTariffs.BillingType),
    min_price: z.coerce.number().min(0).optional(),
    max_price: z.coerce.number().min(0).optional(),
    type: z.enum(OcpiTariffType),
    currency: z.string().regex(/^[A-Z]{3}$/),
    elements: z
      .array(
        z.object({
          price_components: z
            .array(
              z.object({
                type: z.enum(OcpiTariffDimenstionType),
                price: z.coerce.number().min(0),
                vat: z.coerce.number().min(0),
                step_size: z.coerce.number().int().min(1).default(1),
                price_round: z
                  .object({
                    round_granularity: z.string().default("THOUSANDTH"),
                    round_rule: z.string().default("ROUND_NEAR"),
                  })
                  .optional(),
                step_round: z
                  .object({
                    round_granularity: z.string().default("UNIT"),
                    round_rule: z.string().default("ROUND_UP"),
                  })
                  .optional(),
              })
            )
            .min(1),
          restrictions: RestrictionsZ.optional(),
        })
      )
      .min(1),
  })
  .strict();

export const CreateSalesTariffSchema = z.object({
  body: CreateSalesTariffBodyZ,
});

export type CreateSalesTariffBody = z.infer<typeof CreateSalesTariffBodyZ>;
export type CreateSalesTariffParsed = z.infer<typeof CreateSalesTariffBodyZ>;

export const ObjectIdZ = z.coerce
  .string()
  .trim()
  .regex(/^[0-9a-f]{24}$/i, "_id must be a 24-char hex string")
  .refine((v) => isValidObjectId(v), { message: "Invalid ObjectId" });

export const UpdateSalesTariffBodyZ = CreateSalesTariffBodyZ.extend({
  _id: ObjectIdZ,
}).strict();

export const UpdateSalesTariffParamsZ = z
  .object({
    _id: ObjectIdZ,
  })
  .strict();

export const UpdateSalesTariffSchema = z
  .object({
    params: UpdateSalesTariffParamsZ,
    body: UpdateSalesTariffBodyZ,
  })
  .superRefine((data, ctx) => {
    if (data.params._id !== data.body._id) {
      ctx.addIssue({
        code: "custom",
        message: "Route parameter _id must match body._id",
        path: ["body", "_id"],
      });
    }
  });

export type UpdateSalesTariffBody = z.infer<typeof UpdateSalesTariffBodyZ>;
export type UpdateSalesTariffParams = z.infer<typeof UpdateSalesTariffParamsZ>;
export type UpdateSalesTariffParsed = z.infer<typeof UpdateSalesTariffSchema>;

export const DeleteSalesTariffSchema = z.object({
  params: UpdateSalesTariffParamsZ,
});
