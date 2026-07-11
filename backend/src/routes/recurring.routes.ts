import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { serializeRecurringRule } from "../lib/serialize";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { materializeDueRules } from "../services/recurring";

const router = Router();
router.use(requireAuth);

const amount = z
  .union([z.string(), z.number()])
  .transform((v) => new Prisma.Decimal(v))
  .refine((d) => d.isFinite(), "Must be a valid number");

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

const createSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: amount.refine((d) => d.gt(0), "Amount must be greater than 0"),
  currency: z.string().length(3).optional(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid(),
  vendorName: z.string().max(200).nullish(),
  description: z.string().max(1000).nullish(),
  taxAmount: amount.refine((d) => d.gte(0), "Tax cannot be negative").optional(),
  paymentMethod: z.string().max(50).nullish(),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  dayOfMonth: z.coerce.number().int().min(1).max(31).nullish(),
  nextRunDate: dateString,
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();
const idParams = z.object({ id: z.string().uuid() });

async function assertOwnedRefs(
  userId: string,
  refs: { accountId?: string; categoryId?: string; type?: "income" | "expense" },
) {
  if (refs.accountId) {
    const a = await prisma.account.findFirst({ where: { id: refs.accountId, userId } });
    if (!a) throw new NotFoundError("Account not found");
  }
  if (refs.categoryId) {
    const c = await prisma.category.findFirst({ where: { id: refs.categoryId, userId } });
    if (!c) throw new NotFoundError("Category not found");
    if (refs.type && c.type !== refs.type) {
      throw new BadRequestError(`Category is ${c.type} but rule type is ${refs.type}`);
    }
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rules = await prisma.recurringRule.findMany({
      where: { userId: getUserId(req) },
      include: { account: true, category: true },
      orderBy: [{ isActive: "desc" }, { nextRunDate: "asc" }],
    });
    res.json({ recurringRules: rules.map(serializeRecurringRule) });
  }),
);

router.post(
  "/",
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const b = req.body as z.infer<typeof createSchema>;
    await assertOwnedRefs(userId, b);
    const rule = await prisma.recurringRule.create({
      data: {
        userId,
        type: b.type,
        amount: b.amount,
        currency: b.currency ?? env.DEFAULT_CURRENCY,
        accountId: b.accountId,
        categoryId: b.categoryId,
        vendorName: b.vendorName ?? null,
        description: b.description ?? null,
        taxAmount: b.taxAmount ?? new Prisma.Decimal(0),
        paymentMethod: b.paymentMethod ?? null,
        frequency: b.frequency,
        dayOfMonth: b.dayOfMonth ?? null,
        nextRunDate: b.nextRunDate,
        isActive: b.isActive ?? true,
      },
      include: { account: true, category: true },
    });
    res.status(201).json({ recurringRule: serializeRecurringRule(rule) });
  }),
);

async function findOwned(userId: string, id: string) {
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!rule) throw new NotFoundError("Recurring rule not found");
  return rule;
}

router.get(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await findOwned(getUserId(req), req.params.id);
    const rule = await prisma.recurringRule.findUnique({
      where: { id: req.params.id },
      include: { account: true, category: true },
    });
    res.json({ recurringRule: serializeRecurringRule(rule!) });
  }),
);

router.patch(
  "/:id",
  validate({ params: idParams, body: updateSchema }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const existing = await findOwned(userId, req.params.id);
    const b = req.body as z.infer<typeof updateSchema>;
    await assertOwnedRefs(userId, {
      accountId: b.accountId,
      categoryId: b.categoryId,
      type: b.type ?? existing.type,
    });
    const rule = await prisma.recurringRule.update({
      where: { id: req.params.id },
      data: b as Prisma.RecurringRuleUpdateInput,
      include: { account: true, category: true },
    });
    res.json({ recurringRule: serializeRecurringRule(rule) });
  }),
);

router.delete(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await findOwned(getUserId(req), req.params.id);
    await prisma.recurringRule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// Materialize the current user's due rules into transactions ("run due now").
router.post(
  "/run",
  asyncHandler(async (req, res) => {
    const result = await materializeDueRules({ userId: getUserId(req) });
    res.json(result);
  }),
);

export default router;
