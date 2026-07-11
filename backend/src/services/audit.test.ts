import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { diffTransactionFields, normalizeAuditValue } from "./audit";

describe("normalizeAuditValue", () => {
  it("formats decimals to 2 places", () => {
    expect(normalizeAuditValue(new Prisma.Decimal("100"))).toBe("100.00");
  });
  it("formats dates to YYYY-MM-DD", () => {
    expect(normalizeAuditValue(new Date("2026-07-07T00:00:00Z"))).toBe("2026-07-07");
  });
  it("stringifies booleans and passes through null", () => {
    expect(normalizeAuditValue(true)).toBe("true");
    expect(normalizeAuditValue(null)).toBeNull();
    expect(normalizeAuditValue(undefined)).toBeNull();
  });
});

describe("diffTransactionFields", () => {
  const before = {
    accountId: "a1",
    categoryId: "c1",
    type: "expense",
    amount: new Prisma.Decimal("100.00"),
    date: new Date("2026-07-01T00:00:00Z"),
    description: "old",
  };

  it("emits one change per modified audited field", () => {
    const changes = diffTransactionFields(before, {
      amount: new Prisma.Decimal("250.50"),
      description: "new",
    });
    expect(changes).toEqual([
      { field: "amount", oldValue: "100.00", newValue: "250.50" },
      { field: "description", oldValue: "old", newValue: "new" },
    ]);
  });

  it("ignores fields not present in the update", () => {
    const changes = diffTransactionFields(before, { amount: new Prisma.Decimal("100.00") });
    expect(changes).toEqual([]); // same normalized value → no change
  });

  it("detects a decimal change even when numerically equal string differs", () => {
    const changes = diffTransactionFields(before, { amount: new Prisma.Decimal("100.5") });
    expect(changes).toEqual([{ field: "amount", oldValue: "100.00", newValue: "100.50" }]);
  });
});
