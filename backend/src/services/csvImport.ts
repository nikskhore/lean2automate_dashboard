import { Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import multer from "multer";
import { env } from "../config/env";
import { BadRequestError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { writeAuditLogs } from "./audit";

// In-memory upload (parsed immediately, never written to disk).
export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.toLowerCase().endsWith(".csv");
    if (!ok) {
      cb(new BadRequestError("Only .csv files are accepted"));
      return;
    }
    cb(null, true);
  },
});

export interface ImportResult {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

/**
 * Expected CSV headers (case-insensitive): date, type, amount, category, account,
 * and optional: description, vendor_name, vendor_gstin, tax_amount, payment_method, currency.
 * Category and account are matched by name for the user.
 */
export async function importTransactionsCsv(userId: string, buffer: Buffer): Promise<ImportResult> {
  let records: Record<string, string>[];
  try {
    records = parse(buffer, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    throw new BadRequestError("Could not parse CSV file");
  }

  if (records.length === 0) throw new BadRequestError("CSV file has no data rows");

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
  ]);
  const accountByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
  const categoryByKey = new Map(categories.map((c) => [`${c.type}:${c.name.toLowerCase()}`, c]));

  const errors: { row: number; message: string }[] = [];
  const valid: Prisma.TransactionCreateManyInput[] = [];

  records.forEach((rec, idx) => {
    const rowNum = idx + 2; // +1 header, +1 for 1-based
    const push = (message: string) => errors.push({ row: rowNum, message });

    const dateRaw = (rec.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return push(`Invalid or missing date "${dateRaw}" (use YYYY-MM-DD)`);

    const type = (rec.type ?? "").trim().toLowerCase();
    if (type !== "income" && type !== "expense") return push(`Type must be income or expense, got "${rec.type}"`);

    let amountDec: Prisma.Decimal;
    try {
      amountDec = new Prisma.Decimal((rec.amount ?? "").replace(/[, ]/g, ""));
      if (!amountDec.isFinite() || amountDec.lte(0)) throw new Error();
    } catch {
      return push(`Invalid amount "${rec.amount}"`);
    }

    const account = accountByName.get((rec.account ?? "").trim().toLowerCase());
    if (!account) return push(`Unknown account "${rec.account}"`);

    const category = categoryByKey.get(`${type}:${(rec.category ?? "").trim().toLowerCase()}`);
    if (!category) return push(`Unknown ${type} category "${rec.category}"`);

    let taxDec = new Prisma.Decimal(0);
    if (rec.tax_amount) {
      try {
        taxDec = new Prisma.Decimal(rec.tax_amount.replace(/[, ]/g, ""));
        if (!taxDec.isFinite() || taxDec.lt(0)) throw new Error();
      } catch {
        return push(`Invalid tax_amount "${rec.tax_amount}"`);
      }
    }

    valid.push({
      userId,
      accountId: account.id,
      categoryId: category.id,
      type,
      amount: amountDec,
      currency: (rec.currency || account.currency || env.DEFAULT_CURRENCY).toUpperCase().slice(0, 3),
      date: new Date(`${dateRaw}T00:00:00.000Z`),
      description: rec.description || null,
      vendorName: rec.vendor_name || null,
      vendorGstin: rec.vendor_gstin || null,
      taxAmount: taxDec,
      paymentMethod: rec.payment_method || null,
    });
  });

  if (valid.length === 0) {
    return { imported: 0, failed: errors.length, errors };
  }

  // Insert valid rows and their create-audit logs atomically.
  await prisma.$transaction(async (tx) => {
    for (const row of valid) {
      const created = await tx.transaction.create({ data: row });
      await writeAuditLogs(tx, { transactionId: created.id, changedBy: userId, action: "create" });
    }
  });

  return { imported: valid.length, failed: errors.length, errors };
}
