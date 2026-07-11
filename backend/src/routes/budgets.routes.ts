import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { serializeBudget } from "../lib/serialize";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { getQuery, validate } from "../middleware/validate";

const router = Router();
router.use(requireAuth);

const amount = z
  .union([z.string(), z.number()])
  .transform((v) => new Prisma.Decimal(v))
  .refine((d) => d.isFinite() && d.gt(0), "Amount must be greater than 0");

const monthString = z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM");

const listQuery = z.object({ month: monthString.optional() });

const createSchema = z.object({
  categoryId: z.string().uuid(),
  month: monthString,
  amount,
});

const updateSchema = z.object({ amount });
const idParams = z.object({ id: z.string().uuid() });

function monthToPeriod(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}
function monthRange(period: Date): { start: Date; end: Date } {
  const start = period;
  const end = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 0)); // last day
  return { start, end };
}

// GET /api/budgets?month=YYYY-MM  — budgets with spent/remaining/progress for the period.
router.get(
  "/",
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const q = getQuery<typeof listQuery>(req);
    const now = new Date();
    const month = q.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const period = monthToPeriod(month);
    const { start, end } = monthRange(period);

    const [budgets, categories, tx] = await Promise.all([
      prisma.budget.findMany({ where: { userId, periodMonth: period }, include: { category: true } }),
      prisma.category.findMany({ where: { userId }, select: { id: true, parentCategoryId: true } }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: start, lte: end } },
        select: { categoryId: true, amount: true },
      }),
    ]);

    // Map parent -> [child ids] so a budget on a parent counts its sub-categories too.
    const childrenOf = new Map<string, string[]>();
    for (const c of categories) {
      if (c.parentCategoryId) {
        const arr = childrenOf.get(c.parentCategoryId) ?? [];
        arr.push(c.id);
        childrenOf.set(c.parentCategoryId, arr);
      }
    }
    const spentByCat = new Map<string, Prisma.Decimal>();
    for (const t of tx) {
      spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? new Prisma.Decimal(0)).plus(t.amount));
    }

    const result = budgets.map((b) => {
      const ids = [b.categoryId, ...(childrenOf.get(b.categoryId) ?? [])];
      const spent = ids.reduce((acc, id) => acc.plus(spentByCat.get(id) ?? 0), new Prisma.Decimal(0));
      const remaining = b.amount.minus(spent);
      const progress = b.amount.isZero() ? 0 : spent.dividedBy(b.amount).times(100).toDecimalPlaces(1).toNumber();
      return serializeBudget(b, {
        spent: spent.toFixed(2),
        remaining: remaining.toFixed(2),
        progress,
      });
    });

    res.json({ month, budgets: result });
  }),
);

router.post(
  "/",
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const b = req.body as z.infer<typeof createSchema>;
    const category = await prisma.category.findFirst({ where: { id: b.categoryId, userId } });
    if (!category) throw new NotFoundError("Category not found");

    const budget = await prisma.budget.create({
      data: { userId, categoryId: b.categoryId, periodMonth: monthToPeriod(b.month), amount: b.amount },
      include: { category: true },
    });
    res.status(201).json({ budget: serializeBudget(budget) });
  }),
);

router.patch(
  "/:id",
  validate({ params: idParams, body: updateSchema }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const existing = await prisma.budget.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) throw new NotFoundError("Budget not found");
    const budget = await prisma.budget.update({
      where: { id: req.params.id },
      data: { amount: (req.body as z.infer<typeof updateSchema>).amount },
      include: { category: true },
    });
    res.json({ budget: serializeBudget(budget) });
  }),
);

router.delete(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const existing = await prisma.budget.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) throw new NotFoundError("Budget not found");
    await prisma.budget.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

export default router;
