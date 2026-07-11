import { Banknote, CreditCard, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { useAccountMutations, useAccounts } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Account, AccountType } from "@/types";

const TYPE_META: Record<AccountType, { label: string; icon: typeof Landmark }> = {
  bank: { label: "Bank", icon: Landmark },
  cash: { label: "Cash", icon: Banknote },
  credit_card: { label: "Credit Card", icon: CreditCard },
};

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const { create, update, remove } = useAccountMutations();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [currency, setCurrency] = useState("INR");

  function openCreate() {
    setEditing(null);
    setName("");
    setType("bank");
    setOpeningBalance("0");
    setCurrency("INR");
    setFormOpen(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setName(a.name);
    setType(a.type);
    setOpeningBalance(a.openingBalance);
    setCurrency(a.currency);
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { name, type, openingBalance, currency };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...body });
        toast("Account updated", "success");
      } else {
        await create.mutateAsync(body);
        toast("Account created", "success");
      }
      setFormOpen(false);
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  async function onDelete() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast("Account deleted", "success");
      setToDelete(null);
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Bank, cash, and credit card balances tracked separately."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add account
          </Button>
        }
      />

      {accounts && accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No accounts yet. Add your first bank, cash, or credit card account.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts?.map((a) => {
            const meta = TYPE_META[a.type];
            const Icon = meta.icon;
            return (
              <Card key={a.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold">{a.name}</div>
                        <Badge variant="muted">{meta.label}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(a)} aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground">Opening balance</div>
                    <div className="text-xl font-bold tabular-nums">
                      {formatMoney(a.openingBalance, a.currency)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit account" : "Add account"}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acc-name">Name</Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-type">Type</Label>
            <Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="acc-balance">Opening balance</Label>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-currency">Currency</Label>
              <Input
                id="acc-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {editing ? "Save changes" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={onDelete}
        title="Delete account"
        message={`Delete "${toDelete?.name}"? This cannot be undone.`}
        loading={remove.isPending}
      />
    </div>
  );
}
