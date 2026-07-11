import { Router } from "express";
import { env } from "../config/env";
import { UnauthorizedError } from "../lib/errors";
import { asyncHandler } from "../middleware/asyncHandler";
import { materializeDueRules } from "../services/recurring";

const router = Router();

// POST /api/internal/run-recurring — materializes ALL users' due recurring rules.
// Protected by the X-Cron-Secret header; intended for a scheduled trigger (e.g. Cloudflare Cron).
router.post(
  "/run-recurring",
  asyncHandler(async (req, res) => {
    if (!env.CRON_SECRET) {
      throw new UnauthorizedError("Cron endpoint disabled (no CRON_SECRET configured)");
    }
    if (req.header("x-cron-secret") !== env.CRON_SECRET) {
      throw new UnauthorizedError("Invalid cron secret");
    }
    const result = await materializeDueRules();
    res.json({ ok: true, ...result });
  }),
);

export default router;
