# Finance Tracker — Personal / Business

A full-stack finance tracking system. **One backend API** serves a web dashboard now and a React Native
app later (Phase 2). India-focused: INR default, GST-ready fields, decimal-safe money.

> **Status: Phase 1 (MVP).** Auth · Accounts · Categories · Transactions · file attachments · P&L report ·
> Excel export · web dashboard with income/expense + category charts.
> Phases 2–3 (Android app, recurring, budgets, insights, Balance Sheet, OCR) are intentionally **not** built yet.

## Stack

| Layer     | Tech |
|-----------|------|
| Backend   | Node + Express + TypeScript, Prisma, PostgreSQL (Supabase), JWT + bcrypt, ExcelJS, multer, Zod, Vitest |
| Web       | React + Vite + TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Recharts, react-hook-form |
| Storage   | Local disk behind a `StorageService` interface (swap to S3/R2 later with no caller changes) |

## Repo layout

```
backend/   Express API + Prisma schema
web/       React dashboard
```

## Prerequisites

- Node.js 20+ (tested on 24)
- A PostgreSQL database — a free [Supabase](https://supabase.com) project is the quickest (always-on), or any local/hosted Postgres

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env          # then edit .env: paste your Supabase Session-pooler URI (JWT secret is pre-filled)
npx prisma migrate dev        # creates all tables in your Postgres database
npm run seed                  # seeds a demo user + default category taxonomy
npm run dev                   # API on http://localhost:4000
```

Demo login after seeding: `demo@finance.test` / `Demo@12345`

### 2. Web dashboard

```bash
cd web
npm install
npm run dev                   # dashboard on http://localhost:5180
```

The web app reads the API base URL from `web/.env` (`VITE_API_URL`, defaults to `http://localhost:4000/api`).
The dev server port is **5180** (set in `web/vite.config.ts`) and must match `CORS_ORIGIN` in `backend/.env`.

## Money & audit guarantees

- All amounts stored as `Decimal(14,2)` (Prisma Decimal) — never JS float. Serialized as strings over the API.
- Every transaction create / update / delete writes an `AuditLog` row atomically with the mutation.
- Uploads validated (jpg/png/pdf, ≤10MB) and stored on disk outside the DB.
