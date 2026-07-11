import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeInsights, type MonthAgg } from "./insights";

const m = (month: string, income: string, expense: string): MonthAgg => ({
  month,
  income: new Prisma.Decimal(income),
  expense: new Prisma.Decimal(expense),
});

describe("computeInsights", () => {
  it("computes net and expense-to-income ratio per month", () => {
    const r = computeInsights([m("2026-05", "100000", "60000"), m("2026-06", "120000", "72000")]);
    expect(r.monthly[0]).toMatchObject({ net: "40000.00", expenseToIncomeRatio: 60 });
    expect(r.monthly[1]).toMatchObject({ net: "48000.00", expenseToIncomeRatio: 60 });
  });

  it("computes month-over-month growth on the last two months", () => {
    const r = computeInsights([m("2026-05", "100000", "50000"), m("2026-06", "150000", "40000")]);
    expect(r.momGrowth.income).toBe(50); // 100k -> 150k
    expect(r.momGrowth.expense).toBe(-20); // 50k -> 40k
  });

  it("ratio is null when income is zero; growth null with a single month", () => {
    const r = computeInsights([m("2026-06", "0", "5000")]);
    expect(r.monthly[0].expenseToIncomeRatio).toBeNull();
    expect(r.momGrowth).toEqual({ income: null, expense: null, net: null });
  });
});
