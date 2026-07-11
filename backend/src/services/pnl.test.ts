import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computePnl, pctChange, previousPeriod, type PnlLineInput } from "./pnl";

const D = (n: string | number) => new Prisma.Decimal(n);

function line(categoryId: string, categoryName: string, type: "income" | "expense", amount: string): PnlLineInput {
  return { categoryId, categoryName, type, amount: D(amount) };
}

describe("computePnl", () => {
  it("aggregates by category and computes net profit with decimal precision", () => {
    const result = computePnl([
      line("c1", "Sales Revenue", "income", "180000.50"),
      line("c1", "Sales Revenue", "income", "19999.50"),
      line("c2", "Service Revenue", "income", "60000"),
      line("e1", "Rent", "expense", "45000"),
      line("e2", "Salaries/Wages", "expense", "90000.25"),
    ]);

    expect(result.totalIncome).toBe("260000.00");
    expect(result.totalExpense).toBe("135000.25");
    expect(result.netProfit).toBe("124999.75");

    // Sales Revenue is summed into a single line.
    const sales = result.income.find((c) => c.categoryId === "c1");
    expect(sales?.total).toBe("200000.00");
  });

  it("sorts each side by total descending", () => {
    const result = computePnl([
      line("e1", "Rent", "expense", "45000"),
      line("e2", "Salaries", "expense", "90000"),
      line("e3", "Misc", "expense", "500"),
    ]);
    expect(result.expenses.map((c) => c.name)).toEqual(["Salaries", "Rent", "Misc"]);
  });

  it("handles empty input", () => {
    const result = computePnl([]);
    expect(result).toMatchObject({
      totalIncome: "0.00",
      totalExpense: "0.00",
      netProfit: "0.00",
      income: [],
      expenses: [],
    });
  });

  it("avoids float rounding errors (0.1 + 0.2)", () => {
    const result = computePnl([
      line("i", "X", "income", "0.10"),
      line("i", "X", "income", "0.20"),
    ]);
    expect(result.totalIncome).toBe("0.30");
  });
});

describe("pctChange", () => {
  it("computes percentage change", () => {
    expect(pctChange("150", "100")).toBe(50);
    expect(pctChange("80", "100")).toBe(-20);
  });
  it("returns null when the base is zero", () => {
    expect(pctChange("100", "0")).toBeNull();
  });
});

describe("previousPeriod", () => {
  it("returns the immediately preceding window of equal length (full month)", () => {
    expect(previousPeriod("2026-03-01", "2026-03-31")).toEqual({ from: "2026-01-29", to: "2026-02-28" });
  });
  it("handles a 7-day window", () => {
    expect(previousPeriod("2026-01-08", "2026-01-14")).toEqual({ from: "2026-01-01", to: "2026-01-07" });
  });
});
