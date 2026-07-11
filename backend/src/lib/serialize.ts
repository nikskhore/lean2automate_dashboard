import { Prisma } from "@prisma/client";
import type {
  Account,
  Attachment,
  AuditLog,
  Budget,
  Category,
  RecurringRule,
  Transaction,
  User,
} from "@prisma/client";

// --- Primitive helpers ---------------------------------------------------

export function decimalToString(value: Prisma.Decimal | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toFixed(2);
}

/** Format a Date (or ISO string) as calendar date `YYYY-MM-DD` in UTC. */
export function dateOnly(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

// --- Entity serializers --------------------------------------------------

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    currencyDefault: user.currencyDefault,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeAccount(account: Account) {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    openingBalance: decimalToString(account.openingBalance)!,
    currency: account.currency,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

type CategoryWithChildren = Category & { children?: Category[] };

export function serializeCategory(category: CategoryWithChildren): Record<string, unknown> {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    parentCategoryId: category.parentCategoryId,
    isDefault: category.isDefault,
    createdAt: category.createdAt.toISOString(),
    ...(category.children
      ? { children: category.children.map((c) => serializeCategory(c)) }
      : {}),
  };
}

export function serializeAttachment(a: Attachment) {
  return {
    id: a.id,
    transactionId: a.transactionId,
    fileName: a.fileName,
    fileType: a.fileType,
    fileSize: a.fileSize,
    uploadedAt: a.uploadedAt.toISOString(),
    downloadUrl: `/api/attachments/${a.id}/download`,
  };
}

type TransactionWithRelations = Transaction & {
  account?: Account | null;
  category?: Category | null;
  attachments?: Attachment[];
};

export function serializeTransaction(t: TransactionWithRelations) {
  return {
    id: t.id,
    accountId: t.accountId,
    categoryId: t.categoryId,
    type: t.type,
    amount: decimalToString(t.amount)!,
    currency: t.currency,
    date: dateOnly(t.date),
    description: t.description,
    vendorName: t.vendorName,
    vendorGstin: t.vendorGstin,
    taxAmount: decimalToString(t.taxAmount)!,
    paymentMethod: t.paymentMethod,
    isRecurring: t.isRecurring,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    account: t.account ? serializeAccount(t.account) : undefined,
    category: t.category ? serializeCategory(t.category) : undefined,
    attachments: t.attachments ? t.attachments.map(serializeAttachment) : undefined,
  };
}

type RecurringRuleWithRefs = RecurringRule & { account?: Account | null; category?: Category | null };

export function serializeRecurringRule(r: RecurringRuleWithRefs) {
  return {
    id: r.id,
    type: r.type,
    amount: decimalToString(r.amount)!,
    currency: r.currency,
    accountId: r.accountId,
    categoryId: r.categoryId,
    vendorName: r.vendorName,
    description: r.description,
    taxAmount: decimalToString(r.taxAmount)!,
    paymentMethod: r.paymentMethod,
    frequency: r.frequency,
    dayOfMonth: r.dayOfMonth,
    nextRunDate: dateOnly(r.nextRunDate),
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    account: r.account ? serializeAccount(r.account) : undefined,
    category: r.category ? serializeCategory(r.category) : undefined,
  };
}

type BudgetWithCategory = Budget & { category?: Category | null };

export function serializeBudget(b: BudgetWithCategory, computed?: { spent: string; remaining: string; progress: number }) {
  return {
    id: b.id,
    categoryId: b.categoryId,
    periodMonth: dateOnly(b.periodMonth),
    amount: decimalToString(b.amount)!,
    category: b.category ? serializeCategory(b.category) : undefined,
    ...(computed ?? {}),
  };
}

export function serializeAuditLog(log: AuditLog) {
  return {
    id: log.id,
    transactionId: log.transactionId,
    changedBy: log.changedBy,
    action: log.action,
    fieldChanged: log.fieldChanged,
    oldValue: log.oldValue,
    newValue: log.newValue,
    changedAt: log.changedAt.toISOString(),
  };
}
