import { Prisma } from "@prisma/client";

export interface PnlLineInput {
  categoryId: string;
  categoryName: string;
  type: "income" | "expense";
  amount: Prisma.Decimal;
}

export interface PnlCategoryTotal {
  categoryId: string;
  name: string;
  total: string; // decimal string
}

export interface PnlResult {
  income: PnlCategoryTotal[];
  expenses: PnlCategoryTotal[];
  totalIncome: string;
  totalExpense: string;
  netProfit: string;
}

/**
 * Pure P&L aggregation. Sums line items per category using Decimal (never float),
 * sorts each side by total desc, and computes net profit = income − expense.
 */
export function computePnl(lines: PnlLineInput[]): PnlResult {
  const incomeMap = new Map<string, { name: string; total: Prisma.Decimal }>();
  const expenseMap = new Map<string, { name: string; total: Prisma.Decimal }>();

  for (const line of lines) {
    const target = line.type === "income" ? incomeMap : expenseMap;
    const existing = target.get(line.categoryId);
    if (existing) {
      existing.total = existing.total.plus(line.amount);
    } else {
      target.set(line.categoryId, { name: line.categoryName, total: line.amount });
    }
  }

  const toSorted = (map: Map<string, { name: string; total: Prisma.Decimal }>): PnlCategoryTotal[] =>
    [...map.entries()]
      .map(([categoryId, v]) => ({ categoryId, name: v.name, total: v.total }))
      .sort((a, b) => b.total.comparedTo(a.total))
      .map((c) => ({ categoryId: c.categoryId, name: c.name, total: c.total.toFixed(2) }));

  const sum = (map: Map<string, { name: string; total: Prisma.Decimal }>): Prisma.Decimal =>
    [...map.values()].reduce((acc, v) => acc.plus(v.total), new Prisma.Decimal(0));

  const totalIncome = sum(incomeMap);
  const totalExpense = sum(expenseMap);

  return {
    income: toSorted(incomeMap),
    expenses: toSorted(expenseMap),
    totalIncome: totalIncome.toFixed(2),
    totalExpense: totalExpense.toFixed(2),
    netProfit: totalIncome.minus(totalExpense).toFixed(2),
  };
}

/** Percentage change from previous → current, as a rounded string (or null if base is 0). */
export function pctChange(current: string, previous: string): number | null {
  const prev = new Prisma.Decimal(previous);
  if (prev.isZero()) return null;
  return new Prisma.Decimal(current).minus(prev).dividedBy(prev).times(100).toDecimalPlaces(1).toNumber();
}

/**
 * Given an inclusive [from, to] window (YYYY-MM-DD), return the immediately preceding
 * window of equal length. Dates are handled in UTC.
 */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const msPerDay = 24 * 60 * 60 * 1000;
  const lengthDays = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
  const prevEnd = new Date(start.getTime() - msPerDay);
  const prevStart = new Date(prevEnd.getTime() - (lengthDays - 1) * msPerDay);
  return {
    from: prevStart.toISOString().slice(0, 10),
    to: prevEnd.toISOString().slice(0, 10),
  };
}
