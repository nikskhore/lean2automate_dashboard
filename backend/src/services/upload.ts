import multer from "multer";
import { env } from "../config/env";
import { BadRequestError } from "../lib/errors";

// Allowed receipt/invoice types → canonical FileType + extension.
export const ALLOWED_MIME: Record<string, "image" | "pdf"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "application/pdf": "pdf",
};

// In-memory buffer so the StorageService decides where bytes land (disk now, S3 later).
export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      cb(new BadRequestError("Only JPG, PNG, or PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});
