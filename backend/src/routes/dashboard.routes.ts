import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { serializeTransaction } from "../lib/serialize";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();
router.use(requireAuth);

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// GET /api/dashboard/overview
router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const now = new Date();

    // 12-month window: first day of the month, 11 months back.
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [rangeTx, recent] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: windowStart } },
        select: { type: true, amount: true, date: true, categoryId: true, category: { select: { name: true } } },
      }),
      prisma.transaction.findMany({
        where: { userId },
        include: { account: true, category: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 8,
      }),
    ]);

    // Build 12 empty month buckets in order.
    const buckets = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal }>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1));
      buckets.set(monthKey(d), { income: new Prisma.Decimal(0), expense: new Prisma.Decimal(0) });
    }

    const expenseByCategory = new Map<string, { name: string; total: Prisma.Decimal }>();
    let monthIncome = new Prisma.Decimal(0);
    let monthExpense = new Prisma.Decimal(0);

    for (const t of rangeTx) {
      const bucket = buckets.get(monthKey(t.date));
      if (bucket) {
        if (t.type === "income") bucket.income = bucket.income.plus(t.amount);
        else bucket.expense = bucket.expense.plus(t.amount);
      }
      // Current-month tallies + expense pie.
      if (t.date >= monthStart) {
        if (t.type === "income") monthIncome = monthIncome.plus(t.amount);
        else {
          monthExpense = monthExpense.plus(t.amount);
          const e = expenseByCategory.get(t.categoryId);
          if (e) e.total = e.total.plus(t.amount);
          else expenseByCategory.set(t.categoryId, { name: t.category.name, total: t.amount });
        }
      }
    }

    const incomeVsExpenseMonthly = [...buckets.entries()].map(([month, v]) => ({
      month,
      income: v.income.toFixed(2),
      expense: v.expense.toFixed(2),
    }));

    const expensePie = [...expenseByCategory.entries()]
      .map(([categoryId, v]) => ({ categoryId, name: v.name, total: v.total }))
      .sort((a, b) => b.total.comparedTo(a.total))
      .map((c) => ({ categoryId: c.categoryId, name: c.name, total: c.total.toFixed(2) }));

    res.json({
      netIncomeThisMonth: monthIncome.minus(monthExpense).toFixed(2),
      totalIncomeThisMonth: monthIncome.toFixed(2),
      totalExpenseThisMonth: monthExpense.toFixed(2),
      incomeVsExpenseMonthly,
      expenseByCategory: expensePie,
      recentTransactions: recent.map(serializeTransaction),
    });
  }),
);

export default router;
