import { format, parseISO } from "date-fns";

/** Format a decimal-string amount as currency. Amounts are strings from the API. */
export function formatMoney(amount: string | number, currency = "INR"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Compact currency, e.g. ₹1.2L / ₹3.4Cr — used on chart axes. */
export function formatMoneyCompact(amount: string | number, currency = "INR"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

/** ISO date (YYYY-MM-DD) → "07 Jul 2026". */
export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd MMM yyyy");
  } catch {
    return iso;
  }
}

/** "2026-07" → "Jul 26" for chart month labels. */
export function formatMonthShort(ym: string): string {
  const [y, m] = ym.split("-");
  try {
    return format(new Date(Number(y), Number(m) - 1, 1), "MMM yy");
  } catch {
    return ym;
  }
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function firstOfMonthISO(): string {
  const now = new Date();
  return format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
}
