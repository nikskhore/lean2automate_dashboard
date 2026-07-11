import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { serializeAuditLog, serializeTransaction } from "../lib/serialize";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { getQuery, validate } from "../middleware/validate";
import { diffTransactionFields, writeAuditLogs } from "../services/audit";
import { importTransactionsCsv, csvUpload } from "../services/csvImport";

const router = Router();
router.use(requireAuth);

// --- Shared schema pieces -------------------------------------------------

const amount = z
  .union([z.string(), z.number()])
  .transform((v) => new Prisma.Decimal(v))
  .refine((d) => d.isFinite(), "Must be a valid number");

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

const createSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid(),
  type: z.enum(["income", "expense"]),
  amount: amount.refine((d) => d.gt(0), "Amount must be greater than 0"),
  currency: z.string().length(3).optional(),
  date: dateString,
  description: z.string().max(1000).nullish(),
  vendorName: z.string().max(200).nullish(),
  vendorGstin: z.string().max(20).nullish(),
  taxAmount: amount.refine((d) => d.gte(0), "Tax cannot be negative").optional(),
  paymentMethod: z.string().max(50).nullish(),
  isRecurring: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

const idParams = z.object({ id: z.string().uuid() });

const listQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(["income", "expense"]).optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(["date", "amount", "createdAt"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// --- Ownership validation -------------------------------------------------

async function assertOwnedRefs(
  userId: string,
  refs: { accountId?: string; categoryId?: string; type?: "income" | "expense" },
) {
  if (refs.accountId) {
    const account = await prisma.account.findFirst({ where: { id: refs.accountId, userId } });
    if (!account) throw new NotFoundError("Account not found");
  }
  if (refs.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: refs.categoryId, userId } });
    if (!category) throw new NotFoundError("Category not found");
    if (refs.type && category.type !== refs.type) {
      throw new BadRequestError(
        `Category "${category.name}" is an ${category.type} category but transaction type is ${refs.type}`,
      );
    }
  }
}

// --- List -----------------------------------------------------------------

router.get(
  "/",
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const q = getQuery<typeof listQuery>(req);

    const where: Prisma.TransactionWhereInput = { userId };
    if (q.from || q.to) {
      where.date = {};
      if (q.from) where.date.gte = new Date(`${q.from}T00:00:00.000Z`);
      if (q.to) where.date.lte = new Date(`${q.to}T00:00:00.000Z`);
    }
    if (q.type) where.type = q.type;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.accountId) where.accountId = q.accountId;
    if (q.search) {
      // Postgres is case-sensitive by default; `mode: "insensitive"` gives ILIKE behavior.
      where.OR = [
        { description: { contains: q.search, mode: "insensitive" } },
        { vendorName: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: { account: true, category: true, attachments: true },
        orderBy: [{ [q.sort]: q.order }, { id: "desc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);

    res.json({
      transactions: transactions.map(serializeTransaction),
      pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
    });
  }),
);

// --- Create ---------------------------------------------------------------

router.post(
  "/",
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = req.body as z.infer<typeof createSchema>;
    await assertOwnedRefs(userId, body);

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId,
          accountId: body.accountId,
          categoryId: body.categoryId,
          type: body.type,
          amount: body.amount,
          currency: body.currency ?? env.DEFAULT_CURRENCY,
          date: body.date,
          description: body.description ?? null,
          vendorName: body.vendorName ?? null,
          vendorGstin: body.vendorGstin ?? null,
          taxAmount: body.taxAmount ?? new Prisma.Decimal(0),
          paymentMethod: body.paymentMethod ?? null,
          isRecurring: body.isRecurring ?? false,
        },
        include: { account: true, category: true, attachments: true },
      });
      await writeAuditLogs(tx, { transactionId: created.id, changedBy: userId, action: "create" });
      return created;
    });

    res.status(201).json({ transaction: serializeTransaction(transaction) });
  }),
);

// --- Detail ---------------------------------------------------------------

async function findOwnedTransaction(userId: string, id: string) {
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId },
    include: { account: true, category: true, attachments: true },
  });
  if (!transaction) throw new NotFoundError("Transaction not found");
  return transaction;
}

router.get(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const transaction = await findOwnedTransaction(getUserId(req), req.params.id);
    res.json({ transaction: serializeTransaction(transaction) });
  }),
);

router.get(
  "/:id/audit",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    await findOwnedTransaction(getUserId(req), req.params.id);
    const logs = await prisma.auditLog.findMany({
      where: { transactionId: req.params.id },
      orderBy: { changedAt: "desc" },
    });
    res.json({ auditLogs: logs.map(serializeAuditLog) });
  }),
);

// --- Update ---------------------------------------------------------------

router.patch(
  "/:id",
  validate({ params: idParams, body: updateSchema }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const existing = await findOwnedTransaction(userId, req.params.id);
    const body = req.body as z.infer<typeof updateSchema>;

    await assertOwnedRefs(userId, {
      accountId: body.accountId,
      categoryId: body.categoryId,
      // For type/category consistency, use the incoming type or the existing one.
      type: body.type ?? existing.type,
    });

    // Build the "after" set from only the fields provided in this request.
    const after: Record<string, unknown> = {};
    for (const key of Object.keys(body) as (keyof typeof body)[]) {
      after[key] = body[key];
    }

    const changes = diffTransactionFields(existing as Record<string, unknown>, after);

    const transaction = await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id: req.params.id },
        data: after as Prisma.TransactionUpdateInput,
        include: { account: true, category: true, attachments: true },
      });
      if (changes.length > 0) {
        await writeAuditLogs(tx, {
          transactionId: updated.id,
          changedBy: userId,
          action: "update",
          changes,
        });
      }
      return updated;
    });

    res.json({ transaction: serializeTransaction(transaction), changedFields: changes.length });
  }),
);

// --- Delete ---------------------------------------------------------------

router.delete(
  "/:id",
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    await findOwnedTransaction(userId, req.params.id);

    await prisma.$transaction(async (tx) => {
      // Record the delete before removing the row (transactionId is set null on delete).
      await writeAuditLogs(tx, {
        transactionId: req.params.id,
        changedBy: userId,
        action: "delete",
      });
      await tx.transaction.delete({ where: { id: req.params.id } });
    });

    res.status(204).send();
  }),
);

// --- CSV bulk import ------------------------------------------------------

router.post(
  "/import",
  csvUpload.single("file"),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    if (!req.file) throw new BadRequestError("CSV file is required (form field 'file')");
    const result = await importTransactionsCsv(userId, req.file.buffer);
    res.status(result.imported > 0 ? 201 : 400).json(result);
  }),
);

export default router;
