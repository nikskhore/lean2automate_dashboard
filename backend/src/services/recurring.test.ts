import { describe, expect, it } from "vitest";
import { computeNextRunDate } from "./recurring";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("computeNextRunDate", () => {
  it("weekly adds 7 days", () => {
    expect(iso(computeNextRunDate(D("2026-07-01"), "weekly", null))).toBe("2026-07-08");
    expect(iso(computeNextRunDate(D("2026-12-29"), "weekly", null))).toBe("2027-01-05");
  });

  it("monthly advances one month on the anchor day", () => {
    expect(iso(computeNextRunDate(D("2026-01-15"), "monthly", 15))).toBe("2026-02-15");
    expect(iso(computeNextRunDate(D("2026-12-10"), "monthly", 10))).toBe("2027-01-10");
  });

  it("monthly clamps the day to the target month length (Jan 31 -> Feb 28)", () => {
    expect(iso(computeNextRunDate(D("2026-01-31"), "monthly", 31))).toBe("2026-02-28");
    // 2028 is a leap year -> Feb 29
    expect(iso(computeNextRunDate(D("2028-01-31"), "monthly", 31))).toBe("2028-02-29");
  });

  it("yearly advances one year, clamping Feb 29 -> Feb 28 on non-leap years", () => {
    expect(iso(computeNextRunDate(D("2026-06-01"), "yearly", null))).toBe("2027-06-01");
    expect(iso(computeNextRunDate(D("2028-02-29"), "yearly", null))).toBe("2029-02-28");
  });
});
