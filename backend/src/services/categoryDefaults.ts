import type { Prisma, PrismaClient } from "@prisma/client";

// Default taxonomy from the spec. Seeded per-user on registration; users add custom
// categories/sub-categories on top of these.
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Water",
  "Internet/Phone",
  "Office Supplies",
  "Salaries/Wages",
  "Travel & Transport",
  "Repairs & Maintenance",
  "Marketing & Advertising",
  "Software/Subscriptions",
  "Professional Fees (legal/accounting)",
  "Insurance",
  "Taxes & Statutory Payments",
  "Bank Charges",
  "Miscellaneous",
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  "Sales Revenue",
  "Service Revenue",
  "Interest Income",
  "Refunds/Reimbursements",
  "Investment Income",
  "Other Income",
] as const;

type Db = PrismaClient | Prisma.TransactionClient;

/** Insert the default income & expense categories for a user. Safe to call once at signup. */
export async function seedDefaultCategories(db: Db, userId: string): Promise<void> {
  const rows: Prisma.CategoryCreateManyInput[] = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
      userId,
      name,
      type: "expense" as const,
      isDefault: true,
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((name) => ({
      userId,
      name,
      type: "income" as const,
      isDefault: true,
    })),
  ];
  await db.category.createMany({ data: rows, skipDuplicates: true });
}
