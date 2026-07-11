import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { serializeAttachment } from "../lib/serialize";
import { getUserId, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { validate } from "../middleware/validate";
import { storage } from "../services/storage";
import { ALLOWED_MIME, receiptUpload } from "../services/upload";

// NOTE: this router is mounted at the broad `/api` prefix (its paths are absolute:
// /transactions/:id/attachments, /attachments/:id/...). So `requireAuth` is applied
// per-route rather than router-wide — otherwise unmatched /api/* paths would 401
// instead of falling through to the 404 handler.
const router = Router();

const txIdParams = z.object({ id: z.string().uuid() });
const attIdParams = z.object({ id: z.string().uuid() });

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

// POST /api/transactions/:id/attachments
router.post(
  "/transactions/:id/attachments",
  requireAuth,
  validate({ params: txIdParams }),
  receiptUpload.single("file"),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    if (!req.file) throw new BadRequestError("File is required (form field 'file')");

    const transaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!transaction) throw new NotFoundError("Transaction not found");

    const fileType = ALLOWED_MIME[req.file.mimetype];
    const stored = await storage.put({
      userId,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      buffer: req.file.buffer,
    });

    const attachment = await prisma.attachment.create({
      data: {
        transactionId: transaction.id,
        storageKey: stored.key,
        fileName: req.file.originalname,
        fileType,
        fileSize: req.file.size,
      },
    });

    res.status(201).json({ attachment: serializeAttachment(attachment) });
  }),
);

async function findOwnedAttachment(userId: string, id: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id, transaction: { userId } },
  });
  if (!attachment) throw new NotFoundError("Attachment not found");
  return attachment;
}

// GET /api/attachments/:id/download
router.get(
  "/attachments/:id/download",
  requireAuth,
  validate({ params: attIdParams }),
  asyncHandler(async (req, res) => {
    const attachment = await findOwnedAttachment(getUserId(req), req.params.id);
    const ext = path.extname(attachment.fileName).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";

    let stream;
    try {
      stream = await storage.getStream(attachment.storageKey);
    } catch {
      throw new NotFoundError("File is missing from storage");
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
    );
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  }),
);

// DELETE /api/attachments/:id
router.delete(
  "/attachments/:id",
  requireAuth,
  validate({ params: attIdParams }),
  asyncHandler(async (req, res) => {
    const attachment = await findOwnedAttachment(getUserId(req), req.params.id);
    await prisma.attachment.delete({ where: { id: attachment.id } });
    // Best-effort removal of the underlying file; DB row is already gone.
    await storage.delete(attachment.storageKey).catch(() => undefined);
    res.status(204).send();
  }),
);

export default router;
