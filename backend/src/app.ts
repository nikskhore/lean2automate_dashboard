import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import accountsRoutes from "./routes/accounts.routes";
import attachmentsRoutes from "./routes/attachments.routes";
import authRoutes from "./routes/auth.routes";
import budgetsRoutes from "./routes/budgets.routes";
import categoriesRoutes from "./routes/categories.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import insightsRoutes from "./routes/insights.routes";
import internalRoutes from "./routes/internal.routes";
import recurringRoutes from "./routes/recurring.routes";
import reportsRoutes from "./routes/reports.routes";
import transactionsRoutes from "./routes/transactions.routes";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/accounts", accountsRoutes);
  app.use("/api/categories", categoriesRoutes);
  app.use("/api/transactions", transactionsRoutes);
  app.use("/api/recurring", recurringRoutes);
  app.use("/api/budgets", budgetsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/insights", insightsRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/internal", internalRoutes);
  // Attachment routes use full paths (/transactions/:id/attachments, /attachments/:id/...).
  app.use("/api", attachmentsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
