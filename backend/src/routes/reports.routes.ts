import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { getQuery, validate } from "../middleware/validate";
import { buildPnlWorkbook } from "../services/excel";
import { computePnl, pctChange, previousPeriod, type PnlLineInput } from "../services/pnl";

const router = Router();
router.use(requireAuth);

// Default window: first day of the current month → today (UTC).
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

const pnlQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compare: z.enum(["previous", "none"]).default("none"),
});

async function fetchLineItems(userId: string, from: string, to: string): Promise<PnlLineInput[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) },
    },
    select: { categoryId: true, type: true, amount: true, category: { select: { name: true } } },
  });
  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.category.name,
    type: r.type,
    amount: r.amount,
  }));
}

function resolveRange(q: { from?: string; to?: string }): { from: string; to: string } {
  const def = defaultRange();
  return { from: q.from ?? def.from, to: q.to ?? def.to };
}

// GET /api/reports/pnl
router.get(
  "/pnl",
  validate({ query: pnlQuery }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const q = getQuery<typeof pnlQuery>(req);
    const { from, to } = resolveRange(q);

    const pnl = computePnl(await fetchLineItems(userId, from, to));

    let comparison: unknown = undefined;
    if (q.compare === "previous") {
      const prev = previousPeriod(from, to);
      const prevPnl = computePnl(await fetchLineItems(userId, prev.from, prev.to));
      comparison = {
        period: prev,
        totalIncome: prevPnl.totalIncome,
        totalExpense: prevPnl.totalExpense,
        netProfit: prevPnl.netProfit,
        change: {
          totalIncome: pctChange(pnl.totalIncome, prevPnl.totalIncome),
          totalExpense: pctChange(pnl.totalExpense, prevPnl.totalExpense),
          netProfit: pctChange(pnl.netProfit, prevPnl.netProfit),
        },
      };
    }

    res.json({ period: { from, to }, ...pnl, comparison });
  }),
);

// GET /api/reports/cashflow?from&to  -> inflows/outflows + running balance per account
router.get(
  "/cashflow",
  validate({ query: pnlQuery }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const q = getQuery<typeof pnlQuery>(req);
    const { from, to } = resolveRange(q);
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);

    const [accounts, periodTx, balanceAgg] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: fromDate, lte: toDate } },
        select: { accountId: true, type: true, amount: true, date: true },
      }),
      // All transactions up to `to` give each account's balance as of the period end.
      prisma.transaction.groupBy({
        by: ["accountId", "type"],
        where: { userId, date: { lte: toDate } },
        _sum: { amount: true },
      }),
    ]);

    // Balance as of `to` per account = opening + income(<=to) - expense(<=to).
    const sumByAccountType = new Map<string, Prisma.Decimal>();
    for (const g of balanceAgg) {
      sumByAccountType.set(`${g.accountId}:${g.type}`, g._sum.amount ?? new Prisma.Decimal(0));
    }

    // Period inflow/outflow per account.
    const periodByAccount = new Map<string, { inflow: Prisma.Decimal; outflow: Prisma.Decimal }>();
    const monthly = new Map<string, { inflow: Prisma.Decimal; outflow: Prisma.Decimal }>();
    for (const t of periodTx) {
      const p = periodByAccount.get(t.accountId) ?? { inflow: new Prisma.Decimal(0), outflow: new Prisma.Decimal(0) };
      const mKey = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, "0")}`;
      const m = monthly.get(mKey) ?? { inflow: new Prisma.Decimal(0), outflow: new Prisma.Decimal(0) };
      if (t.type === "income") {
        p.inflow = p.inflow.plus(t.amount);
        m.inflow = m.inflow.plus(t.amount);
      } else {
        p.outflow = p.outflow.plus(t.amount);
        m.outflow = m.outflow.plus(t.amount);
      }
      periodByAccount.set(t.accountId, p);
      monthly.set(mKey, m);
    }

    let totalInflow = new Prisma.Decimal(0);
    let totalOutflow = new Prisma.Decimal(0);
    const accountRows = accounts.map((a) => {
      const p = periodByAccount.get(a.id) ?? { inflow: new Prisma.Decimal(0), outflow: new Prisma.Decimal(0) };
      const income = sumByAccountType.get(`${a.id}:income`) ?? new Prisma.Decimal(0);
      const expense = sumByAccountType.get(`${a.id}:expense`) ?? new Prisma.Decimal(0);
      const balance = a.openingBalance.plus(income).minus(expense);
      totalInflow = totalInflow.plus(p.inflow);
      totalOutflow = totalOutflow.plus(p.outflow);
      return {
        accountId: a.id,
        name: a.name,
        type: a.type,
        openingBalance: a.openingBalance.toFixed(2),
        inflow: p.inflow.toFixed(2),
        outflow: p.outflow.toFixed(2),
        net: p.inflow.minus(p.outflow).toFixed(2),
        balance: balance.toFixed(2),
      };
    });

    const monthlySeries = [...monthly.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, inflow: v.inflow.toFixed(2), outflow: v.outflow.toFixed(2) }));

    res.json({
      period: { from, to },
      accounts: accountRows,
      totalInflow: totalInflow.toFixed(2),
      totalOutflow: totalOutflow.toFixed(2),
      netCashFlow: totalInflow.minus(totalOutflow).toFixed(2),
      monthly: monthlySeries,
    });
  }),
);

// GET /api/reports/pnl/export  -> .xlsx download
router.get(
  "/pnl/export",
  validate({ query: pnlQuery }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const q = getQuery<typeof pnlQuery>(req);
    const { from, to } = resolveRange(q);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) },
      },
      include: { account: true, category: true },
      orderBy: { date: "asc" },
    });

    const pnl = computePnl(
      transactions.map((t) => ({
        categoryId: t.categoryId,
        categoryName: t.category.name,
        type: t.type,
        amount: t.amount as Prisma.Decimal,
      })),
    );

    const wb = buildPnlWorkbook({
      currency: user.currencyDefault,
      from,
      to,
      transactions,
      pnl,
      generatedBy: user.email,
    });

    const filename = `finance-report-all-${from}_to_${to}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  }),
);

export default router;
