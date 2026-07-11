import { Prisma } from "@prisma/client";
import type { AuditAction } from "@prisma/client";

type Db = Prisma.TransactionClient;

// Transaction fields that are tracked in the audit trail.
export const AUDITED_FIELDS = [
  "accountId",
  "categoryId",
  "type",
  "amount",
  "currency",
  "date",
  "description",
  "vendorName",
  "vendorGstin",
  "taxAmount",
  "paymentMethod",
  "isRecurring",
] as const;

export type AuditedField = (typeof AUDITED_FIELDS)[number];

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/** Normalize a field value to a stable string for storage/comparison. */
export function normalizeAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value.toFixed(2);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/**
 * Pure diff: returns one FieldChange per audited field whose normalized value changed.
 * `before`/`after` are partial records keyed by audited field name.
 */
export function diffTransactionFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of AUDITED_FIELDS) {
    if (!(field in after)) continue; // field not part of this update
    const oldValue = normalizeAuditValue(before[field]);
    const newValue = normalizeAuditValue(after[field]);
    if (oldValue !== newValue) {
      changes.push({ field, oldValue, newValue });
    }
  }
  return changes;
}

/** Write audit rows inside an existing Prisma transaction. */
export async function writeAuditLogs(
  db: Db,
  params: {
    transactionId: string | null;
    changedBy: string;
    action: AuditAction;
    changes?: FieldChange[];
  },
): Promise<void> {
  const { transactionId, changedBy, action, changes } = params;

  if (action === "update" && changes && changes.length > 0) {
    await db.auditLog.createMany({
      data: changes.map((c) => ({
        transactionId,
        changedBy,
        action,
        fieldChanged: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
      })),
    });
    return;
  }

  // create / delete (or a no-op update) get a single summary row.
  await db.auditLog.create({
    data: { transactionId, changedBy, action },
  });
}
