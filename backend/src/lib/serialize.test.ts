import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { dateOnly, decimalToString } from "./serialize";

describe("decimalToString", () => {
  it("always renders 2 decimal places", () => {
    expect(decimalToString(new Prisma.Decimal("100"))).toBe("100.00");
    expect(decimalToString(new Prisma.Decimal("100.5"))).toBe("100.50");
    expect(decimalToString(new Prisma.Decimal("100.499"))).toBe("100.50");
  });
  it("returns null for nullish input", () => {
    expect(decimalToString(null)).toBeNull();
    expect(decimalToString(undefined)).toBeNull();
  });
});

describe("dateOnly", () => {
  it("extracts the calendar date in UTC", () => {
    expect(dateOnly(new Date("2026-07-07T00:00:00Z"))).toBe("2026-07-07");
    expect(dateOnly("2026-12-31T18:30:00Z")).toBe("2026-12-31");
  });
});
