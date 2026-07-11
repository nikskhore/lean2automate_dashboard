import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Account,
  AuditLogEntry,
  Budget,
  CashFlowResponse,
  Category,
  DashboardOverview,
  InsightsResponse,
  PnlResponse,
  RecurringRule,
  Transaction,
  TransactionListResponse,
} from "@/types";

// --- Accounts -------------------------------------------------------------

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<{ accounts: Account[] }>("/accounts")).data.accounts,
  });
}

export function useAccountMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["accounts"] });

  const create = useMutation({
    mutationFn: async (body: Partial<Account>) =>
      (await api.post<{ account: Account }>("/accounts", body)).data.account,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...body }: Partial<Account> & { id: string }) =>
      (await api.patch<{ account: Account }>(`/accounts/${id}`, body)).data.account,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

// --- Categories -----------------------------------------------------------

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<{ categories: Category[] }>("/categories")).data.categories,
  });
}

export function useCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const create = useMutation({
    mutationFn: async (body: { name: string; type: string; parentCategoryId?: string | null }) =>
      (await api.post<{ category: Category }>("/categories", body)).data.category,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      (await api.patch<{ category: Category }>(`/categories/${id}`, { name })).data.category,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/categories/${id}`),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

// --- Transactions ---------------------------------------------------------

export interface TransactionFilters {
  from?: string;
  to?: string;
  type?: string;
  categoryId?: string;
  accountId?: string;
  search?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
      );
      return (await api.get<TransactionListResponse>("/transactions", { params })).data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: ["transaction", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<{ transaction: Transaction }>(`/transactions/${id}`)).data.transaction,
  });
}

export function useTransactionAudit(id: string | null) {
  return useQuery({
    queryKey: ["transaction-audit", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<{ auditLogs: AuditLogEntry[] }>(`/transactions/${id}/audit`)).data.auditLogs,
  });
}

export function useTransactionMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["pnl"] });
  };

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api.post<{ transaction: Transaction }>("/transactions", body)).data.transaction,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      (await api.patch<{ transaction: Transaction }>(`/transactions/${id}`, body)).data.transaction,
    onSuccess: (_data, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["transaction", vars.id] });
      qc.invalidateQueries({ queryKey: ["transaction-audit", vars.id] });
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

// --- Dashboard & Reports --------------------------------------------------

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardOverview>("/dashboard/overview")).data,
  });
}

export function usePnl(params: { from: string; to: string; compare: string }) {
  return useQuery({
    queryKey: ["pnl", params],
    queryFn: async () => (await api.get<PnlResponse>("/reports/pnl", { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useCashflow(params: { from: string; to: string }) {
  return useQuery({
    queryKey: ["cashflow", params],
    queryFn: async () => (await api.get<CashFlowResponse>("/reports/cashflow", { params })).data,
    placeholderData: keepPreviousData,
  });
}

export function useInsights(months = 12) {
  return useQuery({
    queryKey: ["insights", months],
    queryFn: async () => (await api.get<InsightsResponse>("/insights", { params: { months } })).data,
  });
}

// --- Recurring rules ------------------------------------------------------

export function useRecurringRules() {
  return useQuery({
    queryKey: ["recurring"],
    queryFn: async () =>
      (await api.get<{ recurringRules: RecurringRule[] }>("/recurring")).data.recurringRules,
  });
}

export function useRecurringMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["recurring"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await api.post<{ recurringRule: RecurringRule }>("/recurring", body)).data.recurringRule,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      (await api.patch<{ recurringRule: RecurringRule }>(`/recurring/${id}`, body)).data.recurringRule,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/recurring/${id}`),
    onSuccess: invalidate,
  });
  const run = useMutation({
    mutationFn: async () =>
      (await api.post<{ created: number; rulesRun: number }>("/recurring/run")).data,
    onSuccess: invalidate,
  });
  return { create, update, remove, run };
}

// --- Budgets --------------------------------------------------------------

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: async () =>
      (await api.get<{ month: string; budgets: Budget[] }>("/budgets", { params: { month } })).data,
  });
}

export function useBudgetMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["budgets"] });
  const create = useMutation({
    mutationFn: async (body: { categoryId: string; month: string; amount: string }) =>
      (await api.post<{ budget: Budget }>("/budgets", body)).data.budget,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: string }) =>
      (await api.patch<{ budget: Budget }>(`/budgets/${id}`, { amount })).data.budget,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}
