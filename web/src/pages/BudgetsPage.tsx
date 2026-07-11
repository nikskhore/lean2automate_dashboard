import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useBudgetMutations, useBudgets, useCategories } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Budget } from "@/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data, isLoading } = useBudgets(month);
  const { data: categories } = useCategories();
  const { create, update, remove } = useBudgetMutations();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [toDelete, setToDelete] = useState<Budget | null>(null);

  // Expense categories (parents + children) available to budget.
  const expenseCats = (categories ?? [])
    .filter((c) => c.type === "expense")
    .flatMap((c) => [c, ...(c.children ?? [])]);

  function openCreate() {
    setEditing(null);
    setCategoryId("");
    setAmount("");
    setFormOpen(true);
  }
  function openEdit(b: Budget) {
    setEditing(b);
    setCategoryId(b.categoryId);
    setAmount(b.amount);
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) await update.mutateAsync({ id: editing.id, amount });
      else await create.mutateAsync({ categoryId, month, amount });
      toast(editing ? "Budget updated" : "Budget set", "success");
      setFormOpen(false);
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Set a monthly cap per category and track spending against it."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Set budget
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="budget-month" className="text-sm text-muted-foreground">Month</Label>
        <Input
          id="budget-month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
      </div>

      {data && data.budgets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No budgets set for this month.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data?.budgets.map((b) => {
            const progress = b.progress ?? 0;
            const over = progress > 100;
            const near = progress > 80 && progress <= 100;
            return (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium">
                      {b.category?.name}
                      {over && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> Over budget
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setToDelete(b)} aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between text-sm">
                    <span className="tabular-nums text-muted-foreground">
                      {formatMoney(b.spent ?? "0")} of {formatMoney(b.amount)}
                    </span>
                    <span className={cn("font-medium tabular-nums", over ? "text-destructive" : near ? "text-foreground" : "text-success")}>
                      {progress}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", over ? "bg-destructive" : near ? "bg-foreground/70" : "bg-success")}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit budget" : "Set a budget"}>
        <form onSubmit={onSubmit} className="space-y-4">
          {!editing && (
            <div className="space-y-2">
              <Label htmlFor="b-cat">Category</Label>
              <Select id="b-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                <option value="" disabled>Select a category</option>
                {expenseCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.parentCategoryId ? `— ${c.name}` : c.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="b-amount">Monthly budget ({month})</Label>
            <Input id="b-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending || update.isPending}>{editing ? "Save" : "Set budget"}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try { await remove.mutateAsync(toDelete.id); toast("Budget deleted", "success"); setToDelete(null); }
          catch (err) { toast(apiErrorMessage(err), "error"); }
        }}
        title="Delete budget"
        message={`Remove the budget for "${toDelete?.category?.name}"?`}
        loading={remove.isPending}
      />
    </div>
  );
}
