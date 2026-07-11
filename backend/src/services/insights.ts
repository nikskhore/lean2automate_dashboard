import { Prisma } from "@prisma/client";
import { pctChange } from "./pnl";

export interface MonthAgg {
  month: string; // YYYY-MM
  income: Prisma.Decimal;
  expense: Prisma.Decimal;
}

export interface InsightsMonth {
  month: string;
  income: string;
  expense: string;
  net: string;
  expenseToIncomeRatio: number | null; // percent; null when income is 0
}

export interface InsightsResult {
  monthly: InsightsMonth[];
  momGrowth: {
    income: number | null;
    expense: number | null;
    net: number | null;
  };
}

/**
 * Pure: enrich an ordered monthly income/expense series with net, expense-to-income
 * ratio, and month-over-month growth (last month vs the one before).
 */
export function computeInsights(monthly: MonthAgg[]): InsightsResult {
  const rows: InsightsMonth[] = monthly.map((m) => {
    const net = m.income.minus(m.expense);
    const ratio = m.income.isZero()
      ? null
      : m.expense.dividedBy(m.income).times(100).toDecimalPlaces(1).toNumber();
    return {
      month: m.month,
      income: m.income.toFixed(2),
      expense: m.expense.toFixed(2),
      net: net.toFixed(2),
      expenseToIncomeRatio: ratio,
    };
  });

  const n = rows.length;
  const momGrowth =
    n >= 2
      ? {
          income: pctChange(rows[n - 1].income, rows[n - 2].income),
          expense: pctChange(rows[n - 1].expense, rows[n - 2].expense),
          net: pctChange(rows[n - 1].net, rows[n - 2].net),
        }
      : { income: null, expense: null, net: null };

  return { monthly: rows, momGrowth };
}
