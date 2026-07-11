import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { getQuery, validate } from "../middleware/validate";
import { computeInsights, type MonthAgg } from "../services/insights";

const router = Router();
router.use(requireAuth);

const query = z.object({ months: z.coerce.number().int().min(3).max(36).default(12) });

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// GET /api/insights?months=12
router.get(
  "/",
  validate({ query }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { months } = getQuery<typeof query>(req);
    const now = new Date();
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

    const tx = await prisma.transaction.findMany({
      where: { userId, date: { gte: windowStart } },
      select: { type: true, amount: true, date: true, categoryId: true, category: { select: { name: true } } },
    });

    // Ordered month buckets.
    const buckets = new Map<string, MonthAgg>();
    for (let i = 0; i < months; i++) {
      const d = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1));
      buckets.set(monthKey(d), { month: monthKey(d), income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) });
    }

    const expenseByCat = new Map<string, { name: string; total: Prisma.Decimal }>();
    for (const t of tx) {
      const b = buckets.get(monthKey(t.date));
      if (b) {
        if (t.type === "income") b.income = b.income.plus(t.amount);
        else b.expense = b.expense.plus(t.amount);
      }
      if (t.type === "expense") {
        const e = expenseByCat.get(t.categoryId);
        if (e) e.total = e.total.plus(t.amount);
        else expenseByCat.set(t.categoryId, { name: t.category.name, total: t.amount });
      }
    }

    const insights = computeInsights([...buckets.values()]);

    const topExpenseCategories = [...expenseByCat.entries()]
      .map(([categoryId, v]) => ({ categoryId, name: v.name, total: v.total }))
      .sort((a, b) => b.total.comparedTo(a.total))
      .slice(0, 5)
      .map((c) => ({ categoryId: c.categoryId, name: c.name, total: c.total.toFixed(2) }));

    res.json({ ...insights, topExpenseCategories });
  }),
);

export default router;
