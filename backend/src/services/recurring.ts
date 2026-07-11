import type { RecurringFrequency } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { writeAuditLogs } from "./audit";

/** Midnight-UTC "today" (recurring dates are calendar dates). */
export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Pure: given the current run date, return the next occurrence (strictly after it).
 * `dayOfMonth` anchors the day for monthly/yearly (clamped to the target month length,
 * so Jan-31 monthly lands on Feb-28/29).
 */
export function computeNextRunDate(
  current: Date,
  frequency: RecurringFrequency,
  dayOfMonth: number | null,
): Date {
  const y = current.getUTCFullYear();
  const m = current.getUTCMonth();
  const d = current.getUTCDate();

  if (frequency === "weekly") {
    return new Date(Date.UTC(y, m, d + 7));
  }
  if (frequency === "monthly") {
    const totalMonth = m + 1;
    const year2 = y + Math.floor(totalMonth / 12);
    const month2 = totalMonth % 12;
    const target = dayOfMonth ?? d;
    return new Date(Date.UTC(year2, month2, Math.min(target, daysInMonth(year2, month2))));
  }
  // yearly
  const target = dayOfMonth ?? d;
  return new Date(Date.UTC(y + 1, m, Math.min(target, daysInMonth(y + 1, m))));
}

/**
 * Materialize every active rule whose nextRunDate <= asOf into real transactions
 * (catching up multiple missed periods), advancing nextRunDate. Each generated
 * transaction gets a create-audit row. Returns how many transactions were created.
 */
export async function materializeDueRules(opts: {
  userId?: string;
  asOf?: Date;
} = {}): Promise<{ created: number; rulesRun: number }> {
  const asOf = opts.asOf ?? startOfTodayUtc();
  const rules = await prisma.recurringRule.findMany({
    where: {
      isActive: true,
      nextRunDate: { lte: asOf },
      ...(opts.userId ? { userId: opts.userId } : {}),
    },
  });

  let created = 0;
  for (const rule of rules) {
    let next = rule.nextRunDate;
    let guard = 0;
    while (next <= asOf && guard < 120) {
      const runDate = next;
      await prisma.$transaction(async (tx) => {
        const t = await tx.transaction.create({
          data: {
            userId: rule.userId,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            type: rule.type,
            amount: rule.amount,
            currency: rule.currency,
            date: runDate,
            vendorName: rule.vendorName,
            description: rule.description,
            taxAmount: rule.taxAmount,
            paymentMethod: rule.paymentMethod,
            isRecurring: true,
            recurringRuleId: rule.id,
          },
        });
        await writeAuditLogs(tx, { transactionId: t.id, changedBy: rule.userId, action: "create" });
      });
      created += 1;
      next = computeNextRunDate(next, rule.frequency, rule.dayOfMonth);
      guard += 1;
    }
    if (next.getTime() !== rule.nextRunDate.getTime()) {
      await prisma.recurringRule.update({ where: { id: rule.id }, data: { nextRunDate: next } });
    }
  }

  return { created, rulesRun: rules.length };
}
