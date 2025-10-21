import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodObject } from "zod";
import { z, ZodError } from "zod";

export type ValidatedRequest<S extends ZodObject> = Request & {
    validated: z.infer<S>;
};

export const validate =
    (schema: ZodObject): RequestHandler =>
        (req: Request, res: Response, next: NextFunction): void => {
            const parsed = schema.safeParse({
                body: req.body,
                params: req.params,
                query: req.query,
            });

            if (!parsed.success) {
                const errors = parsed.error.issues.map((err) => ({
                    field: err.path.slice(1).join("."),
                    message: err.message,
                }));
                const message = errors.length > 0 ? `${errors[0].message} on field: '${errors[0].field}'` : "Invalid input";
                res.status(400).json({
                    message
                });
                return;
            }

            req.body = (parsed.data as any).body ?? req.body;
            req.params = (parsed.data as any).params ?? req.params;
            req.query = (parsed.data as any).query ?? req.query;
            (req as any).validated = parsed.data;

            next();
        };
