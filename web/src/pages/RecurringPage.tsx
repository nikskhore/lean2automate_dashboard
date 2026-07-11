import { CalendarClock, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CategorySelect } from "@/components/CategorySelect";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  useAccounts,
  useCategories,
  useRecurringMutations,
  useRecurringRules,
} from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import type { FlowType, RecurringFrequency, RecurringRule } from "@/types";

export function RecurringPage() {
  const { data: rules, isLoading } = useRecurringRules();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { create, update, remove, run } = useRecurringMutations();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [toDelete, setToDelete] = useState<RecurringRule | null>(null);

  const [type, setType] = useState<FlowType>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [nextRunDate, setNextRunDate] = useState(todayISO());
  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!formOpen) return;
    if (editing) {
      setType(editing.type);
      setAmount(editing.amount);
      setAccountId(editing.accountId);
      setCategoryId(editing.categoryId);
      setFrequency(editing.frequency);
      setDayOfMonth(String(editing.dayOfMonth ?? 1));
      setNextRunDate(editing.nextRunDate);
      setVendorName(editing.vendorName ?? "");
      setDescription(editing.description ?? "");
    } else {
      setType("expense");
      setAmount("");
      setAccountId(accounts?.[0]?.id ?? "");
      setCategoryId("");
      setFrequency("monthly");
      setDayOfMonth("1");
      setNextRunDate(todayISO());
      setVendorName("");
      setDescription("");
    }
  }, [formOpen, editing, accounts]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !categoryId) {
      toast("Account and category are required", "error");
      return;
    }
    const body = {
      type,
      amount,
      accountId,
      categoryId,
      frequency,
      dayOfMonth: frequency === "weekly" ? null : Number(dayOfMonth),
      nextRunDate,
      vendorName: vendorName || null,
      description: description || null,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...body });
      else await create.mutateAsync(body);
      toast(editing ? "Rule updated" : "Recurring rule created", "success");
      setFormOpen(false);
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  async function onRunNow() {
    try {
      const r = await run.mutateAsync();
      toast(
        r.created > 0 ? `Generated ${r.created} transaction(s)` : "Nothing due right now",
        r.created > 0 ? "success" : "info",
      );
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  async function toggleActive(rule: RecurringRule) {
    try {
      await update.mutateAsync({ id: rule.id, isActive: !rule.isActive });
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader
        title="Recurring"
        description="Templates that auto-generate transactions (rent, salaries, subscriptions)."
        action={
          <>
            <Button variant="outline" onClick={onRunNow} loading={run.isPending}>
              <Play className="h-4 w-4" /> Run due now
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Add rule
            </Button>
          </>
        }
      />

      {rules && rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No recurring rules yet. Add rent, salaries, or subscriptions to auto-generate them.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rules?.map((r) => (
            <Card key={r.id} className={r.isActive ? "" : "opacity-60"}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {r.category?.name}
                      <Badge variant={r.type === "income" ? "success" : "muted"}>{r.frequency}</Badge>
                      {!r.isActive && <Badge variant="muted">paused</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.account?.name} · next run {formatDate(r.nextRunDate)}
                      {r.vendorName ? ` · ${r.vendorName}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-semibold tabular-nums ${r.type === "income" ? "text-success" : "text-destructive"}`}>
                    {r.type === "income" ? "+" : "−"}{formatMoney(r.amount, r.currency)}
                  </span>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(r)} aria-label={r.isActive ? "Pause" : "Resume"}>
                      {r.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setFormOpen(true); }} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setToDelete(r)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit rule" : "New recurring rule"} className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setType("expense"); setCategoryId(""); }} className={`rounded-md border px-3 py-2 text-sm font-medium ${type === "expense" ? "border-destructive bg-destructive/10 text-destructive" : "border-input text-muted-foreground"}`}>Expense</button>
            <button type="button" onClick={() => { setType("income"); setCategoryId(""); }} className={`rounded-md border px-3 py-2 text-sm font-medium ${type === "income" ? "border-success bg-success/10 text-success" : "border-input text-muted-foreground"}`}>Income</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="r-amount">Amount</Label>
              <Input id="r-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-account">Account</Label>
              <Select id="r-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                <option value="" disabled>Select account</option>
                {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-category">Category</Label>
            {categories && <CategorySelect id="r-category" categories={categories} type={type} value={categoryId} onChange={setCategoryId} />}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="r-freq">Frequency</Label>
              <Select id="r-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </div>
            {frequency !== "weekly" && (
              <div className="space-y-2">
                <Label htmlFor="r-day">Day of month</Label>
                <Input id="r-day" type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="r-next">Next run</Label>
              <Input id="r-next" type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="r-vendor">Vendor</Label>
              <Input id="r-vendor" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-desc">Description</Label>
              <Input id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending || update.isPending}>{editing ? "Save" : "Create"}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try { await remove.mutateAsync(toDelete.id); toast("Rule deleted", "success"); setToDelete(null); }
          catch (err) { toast(apiErrorMessage(err), "error"); }
        }}
        title="Delete recurring rule"
        message="Existing generated transactions are kept. Continue?"
        loading={remove.isPending}
      />
    </div>
  );
}
