import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDefaultCategories } from "../src/services/categoryDefaults";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@finance.test";
const DEMO_PASSWORD = "Demo@12345";

function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  // Reset any prior demo data so the seed is idempotent.
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: { name: "Demo User", email: DEMO_EMAIL, passwordHash, currencyDefault: "INR" },
  });
  await seedDefaultCategories(prisma, user.id);

  const accounts = await Promise.all([
    prisma.account.create({
      data: { userId: user.id, name: "HDFC Bank", type: "bank", openingBalance: new Prisma.Decimal(150000), currency: "INR" },
    }),
    prisma.account.create({
      data: { userId: user.id, name: "Cash", type: "cash", openingBalance: new Prisma.Decimal(10000), currency: "INR" },
    }),
    prisma.account.create({
      data: { userId: user.id, name: "Business Credit Card", type: "credit_card", openingBalance: new Prisma.Decimal(0), currency: "INR" },
    }),
  ]);
  const [hdfc, cash, card] = accounts;

  const categories = await prisma.category.findMany({ where: { userId: user.id } });
  const cat = (type: "income" | "expense", name: string) => {
    const c = categories.find((x) => x.type === type && x.name === name);
    if (!c) throw new Error(`Seed category not found: ${type} / ${name}`);
    return c.id;
  };

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1; // 1-based

  // Helper to spread entries across the last few months.
  const monthOffset = (offset: number) => {
    const dt = new Date(Date.UTC(y, m - 1 - offset, 1));
    return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1 };
  };

  const tx: Prisma.TransactionCreateManyInput[] = [];
  const add = (
    offset: number,
    day: number,
    type: "income" | "expense",
    catName: string,
    amount: number,
    accountId: string,
    extra: Partial<Prisma.TransactionCreateManyInput> = {},
  ) => {
    const { year, month } = monthOffset(offset);
    tx.push({
      userId: user.id,
      accountId,
      categoryId: cat(type, catName),
      type,
      amount: new Prisma.Decimal(amount),
      currency: "INR",
      date: d(year, month, Math.min(day, 28)),
      taxAmount: new Prisma.Decimal(extra.taxAmount ? Number(extra.taxAmount) : 0),
      ...extra,
    });
  };

  // Recurring-ish income + expenses across the last 4 months.
  for (let o = 3; o >= 0; o--) {
    add(o, 5, "income", "Sales Revenue", 180000 + o * 5000, hdfc.id, { vendorName: "ACME Retail", description: "Monthly product sales", taxAmount: new Prisma.Decimal(32400) });
    add(o, 8, "income", "Service Revenue", 60000, hdfc.id, { vendorName: "Consulting Co", description: "Consulting retainer" });
    add(o, 1, "expense", "Rent", 45000, hdfc.id, { vendorName: "Landlord", description: "Office rent" });
    add(o, 3, "expense", "Salaries/Wages", 90000, hdfc.id, { description: "Staff salaries" });
    add(o, 10, "expense", "Electricity", 6500, hdfc.id, { vendorName: "State Electricity Board" });
    add(o, 12, "expense", "Software/Subscriptions", 4999, card.id, { vendorName: "SaaS Vendor", description: "Tooling", taxAmount: new Prisma.Decimal(899) });
    add(o, 15, "expense", "Marketing & Advertising", 12000, card.id, { vendorName: "Google Ads" });
    add(o, 18, "expense", "Travel & Transport", 3500, cash.id, { description: "Client visit cab" });
    add(o, 20, "expense", "Office Supplies", 2200, cash.id, { vendorName: "Stationery Mart" });
    add(o, 22, "expense", "Internet/Phone", 1800, hdfc.id, { vendorName: "Airtel" });
  }
  add(1, 14, "income", "Interest Income", 1250, hdfc.id, { description: "Savings interest" });
  add(2, 25, "expense", "Professional Fees (legal/accounting)", 15000, hdfc.id, { vendorName: "CA Firm", vendorGstin: "27AABCU9603R1ZX", taxAmount: new Prisma.Decimal(2700) });

  // Bulk insert (few round-trips, safe for a remote DB), then create-audit rows so the trail isn't empty.
  await prisma.transaction.createMany({ data: tx });
  const createdTx = await prisma.transaction.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  await prisma.auditLog.createMany({
    data: createdTx.map((t) => ({ transactionId: t.id, changedBy: user.id, action: "create" as const })),
  });

  // eslint-disable-next-line no-console
  console.log(
    `Seeded demo user ${DEMO_EMAIL} (password: ${DEMO_PASSWORD}) with ` +
      `${accounts.length} accounts, ${categories.length} categories, ${tx.length} transactions.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
