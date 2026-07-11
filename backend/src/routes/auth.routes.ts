import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { ConflictError, NotFoundError, UnauthorizedError } from "../lib/errors";
import { signToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { serializeUser } from "../lib/serialize";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { seedDefaultCategories } from "../services/categoryDefaults";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  currencyDefault: z.string().length(3).optional(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

router.post(
  "/register",
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { name, email, password, currencyDefault } = req.body as z.infer<typeof registerSchema>;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError("An account with this email already exists");

    const passwordHash = await bcrypt.hash(password, 10);

    // Create the user and seed default categories atomically.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          currencyDefault: currencyDefault ?? env.DEFAULT_CURRENCY,
        },
      });
      await seedDefaultCategories(tx, created.id);
      return created;
    });

    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({ token, user: serializeUser(user) });
  }),
);

router.post(
  "/login",
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedError("Invalid email or password");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError("Invalid email or password");

    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: serializeUser(user) });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: getUserId(req) } });
    if (!user) throw new NotFoundError("User not found");
    res.json({ user: serializeUser(user) });
  }),
);

export default router;
