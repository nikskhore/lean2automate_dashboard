import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../lib/errors";
import { verifyToken } from "../lib/jwt";

// Augment Express Request with the authenticated user id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

/** Convenience accessor that guarantees a user id (call only inside requireAuth routes). */
export function getUserId(req: Request): string {
  if (!req.userId) throw new UnauthorizedError();
  return req.userId;
}
