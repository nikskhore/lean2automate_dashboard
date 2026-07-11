import { ArrowUpDown, History, Paperclip, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { AuditTrailDialog } from "@/components/AuditTrailDialog";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { TransactionForm } from "@/components/TransactionForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  useAccounts,
  useCategories,
  useTransactionMutations,
  useTransactions,
  type TransactionFilters,
} from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { Transaction } from "@/types";

const emptyFilters: TransactionFilters = {
  sort: "date",
  order: "desc",
  page: 1,
  limit: 25,
};

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>(emptyFilters);
  const { data, isLoading, isFetching } = useTransactions(filters);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { remove } = useTransactionMutations();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [toDelete, setToDelete] = useState<Transaction | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  function patchFilters(p: Partial<TransactionFilters>) {
    setFilters((f) => ({ ...f, ...p, page: p.page ?? 1 }));
  }

  function toggleSort(col: "date" | "amount") {
    setFilters((f) => ({
      ...f,
      sort: col,
      order: f.sort === col && f.order === "desc" ? "asc" : "desc",
      page: 1,
    }));
  }

  async function onDelete() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast("Transaction deleted", "success");
      setToDelete(null);
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  const pagination = data?.pagination;

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="All income and expenses. Filter, sort, import, and attach receipts."
        action={
          <>
            <Button variant="outline" onClick={() => setCsvOpen(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <Input
            placeholder="Search vendor / notes"
            className="lg:col-span-2"
            value={filters.search ?? ""}
            onChange={(e) => patchFilters({ search: e.target.value })}
          />
          <Select value={filters.type ?? ""} onChange={(e) => patchFilters({ type: e.target.value || undefined })}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </Select>
          <Select value={filters.accountId ?? ""} onChange={(e) => patchFilters({ accountId: e.target.value || undefined })}>
            <option value="">All accounts</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={filters.from ?? ""} onChange={(e) => patchFilters({ from: e.target.value || undefined })} title="From date" />
          <Input type="date" value={filters.to ?? ""} onChange={(e) => patchFilters({ to: e.target.value || undefined })} title="To date" />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">
                  <button className="flex items-center gap-1" onClick={() => toggleSort("date")}>
                    Date <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3 text-right">
                  <button className="ml-auto flex items-center gap-1" onClick={() => toggleSort("amount")}>
                    Amount <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : data && data.transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No transactions match these filters.
                  </td>
                </tr>
              ) : (
                data?.transactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.category?.name}</span>
                        {t.attachments && t.attachments.length > 0 && (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.account?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.vendorName ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          t.type === "income" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {t.type === "income" ? "+" : "−"}
                        {formatMoney(t.amount, t.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAuditId(t.id)} aria-label="Audit trail">
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditing(t);
                            setFormOpen(true);
                          }}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setToDelete(t)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              {isFetching && <Spinner className="ml-2 inline h-3 w-3" />}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => patchFilters({ page: pagination.page - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => patchFilters({ page: pagination.page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {accounts && categories && (
        <TransactionForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          transaction={editing}
          accounts={accounts}
          categories={categories}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={onDelete}
        title="Delete transaction"
        message="This will be recorded in the audit log. Continue?"
        loading={remove.isPending}
      />
      <AuditTrailDialog transactionId={auditId} onClose={() => setAuditId(null)} />
      <CsvImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
    </div>
  );
}
