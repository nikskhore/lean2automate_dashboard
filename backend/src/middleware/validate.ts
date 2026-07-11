import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from "zod";
import { BadRequestError } from "../lib/errors";

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

function formatZodError(err: ZodError) {
  return err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

/**
 * Validates and coerces request parts against Zod schemas. Parsed values replace the
 * originals so downstream handlers get typed, defaulted data.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // req.query is a getter on newer Express; assign parsed onto a writable holder.
        const parsedQuery = schemas.query.parse(req.query);
        Object.defineProperty(req, "validatedQuery", { value: parsedQuery, writable: true });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestError("Validation failed", formatZodError(err));
      }
      throw err;
    }
  };
}

/** Retrieve the parsed query object set by `validate({ query })`. */
export function getQuery<T extends ZodTypeAny>(req: Request): ZodInfer<T> {
  return (req as unknown as { validatedQuery: ZodInfer<T> }).validatedQuery;
}
