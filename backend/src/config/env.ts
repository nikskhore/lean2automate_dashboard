import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  DEFAULT_CURRENCY: z.string().default("INR"),
  // S3-compatible storage (Cloudflare R2 / Supabase Storage) — required when STORAGE_DRIVER=s3.
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  // Optional: enables the internal /api/internal/run-recurring endpoint for a cloud cron.
  CRON_SECRET: z.string().optional(),
  // Set false to disable the in-process daily scheduler (e.g. when a cloud cron drives it).
  ENABLE_CRON: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message rather than crashing deep inside a request.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`\n[config] Invalid environment variables:\n${issues}\n`);
  throw new Error("Invalid environment configuration. Check backend/.env against .env.example.");
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
  maxUploadBytes: parsed.data.MAX_UPLOAD_MB * 1024 * 1024,
};

export type Env = typeof env;
