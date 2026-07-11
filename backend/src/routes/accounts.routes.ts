import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { ConflictError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { serializeAccount } from "../lib/serialize";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";

const router = Router();
router.use(requireAuth);

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => new Prisma.Decimal(v))
  .refine((d) => d.isFinite(), "Must be a valid number");

const createSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["bank", "cash", "credit_card"]),
  openingBalance: decimalString.optional(),
  currency: z.string().length(3).optional(),
});

const updateSchema = createSchema.partial();

const idParams = z.object({ id: z.string().uuid() });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const accounts = await prisma.account.findMany({
      where: { userId: getUserId(req) },
      orderBy: { createdAt: "asc" },
    });
    res.json({ accounts: accounts.map(serializeAccount) });
  }),
);

router.post(
  "/",
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const account = await prisma.account.create({
      data: {
        userId: getUserId(req),
        name: body.name,
        type: body.type,
        openingBalance: body.openingBalance ?? new Prisma.Decimal(0),
        currency: body.currency ?? env.DEFAULT_CURRENCY,
      },
    });
    res.status(201).json({ account: serializeAccount(account) });
  }),
);

async function findOwnedAccount(userId: string, id: string) {
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) throw new NotFoundError("Account not found");
  return account;
}

router.get(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const account = await findOwnedAccount(getUserId(req), req.params.id);
    res.json({ account: serializeAccount(account) });
  }),
);

router.patch(
  "/:id",
  validate({ params: idParams, body: updateSchema }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    await findOwnedAccount(userId, req.params.id);
    const body = req.body as z.infer<typeof updateSchema>;
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: {
        name: body.name,
        type: body.type,
        openingBalance: body.openingBalance,
        currency: body.currency,
      },
    });
    res.json({ account: serializeAccount(account) });
  }),
);

router.delete(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    await findOwnedAccount(userId, req.params.id);
    const txCount = await prisma.transaction.count({ where: { accountId: req.params.id } });
    if (txCount > 0) {
      throw new ConflictError(
        `Cannot delete an account with ${txCount} transaction(s). Reassign or delete them first.`,
      );
    }
    await prisma.account.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

export default router;
