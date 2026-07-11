import { useQueryClient } from "@tanstack/react-query";
import { FileText, ImageIcon, Paperclip, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CategorySelect } from "@/components/CategorySelect";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useTransactionMutations } from "@/hooks/queries";
import { apiErrorMessage, api } from "@/lib/api";
import { openAttachment, uploadAttachment, validateUploadFile } from "@/lib/attachments";
import { todayISO } from "@/lib/format";
import type { Account, Attachment, Category, FlowType, Transaction } from "@/types";

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "UPI", "Credit Card", "Debit Card", "Cheque", "Other"];

interface Props {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
}

export function TransactionForm({ open, onClose, transaction, accounts, categories }: Props) {
  const { create, update } = useTransactionMutations();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<FlowType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorGstin, setVendorGstin] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Reset form each time it opens.
  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount);
      setDate(transaction.date);
      setAccountId(transaction.accountId);
      setCategoryId(transaction.categoryId);
      setVendorName(transaction.vendorName ?? "");
      setVendorGstin(transaction.vendorGstin ?? "");
      setTaxAmount(transaction.taxAmount === "0.00" ? "" : transaction.taxAmount);
      setPaymentMethod(transaction.paymentMethod ?? "");
      setDescription(transaction.description ?? "");
      setExisting(transaction.attachments ?? []);
    } else {
      setType("expense");
      setAmount("");
      setDate(todayISO());
      setAccountId(accounts[0]?.id ?? "");
      setCategoryId("");
      setVendorName("");
      setVendorGstin("");
      setTaxAmount("");
      setPaymentMethod("");
      setDescription("");
      setExisting([]);
    }
    setPendingFiles([]);
  }, [open, transaction, accounts]);

  // Clear category when switching type so an income category isn't kept on an expense.
  function onTypeChange(next: FlowType) {
    setType(next);
    const current = categories.find((c) => c.id === categoryId) ??
      categories.flatMap((c) => c.children ?? []).find((c) => c.id === categoryId);
    if (current && current.type !== next) setCategoryId("");
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const accepted: File[] = [];
    for (const f of Array.from(files)) {
      const err = validateUploadFile(f);
      if (err) toast(err, "error");
      else accepted.push(f);
    }
    setPendingFiles((prev) => [...prev, ...accepted]);
  }

  async function removeExisting(att: Attachment) {
    try {
      await api.delete(`/attachments/${att.id}`);
      setExisting((prev) => prev.filter((a) => a.id !== att.id));
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !categoryId) {
      toast("Account and category are required", "error");
      return;
    }
    const body = {
      type,
      amount,
      date,
      accountId,
      categoryId,
      vendorName: vendorName || null,
      vendorGstin: vendorGstin || null,
      taxAmount: taxAmount || "0",
      paymentMethod: paymentMethod || null,
      description: description || null,
    };
    try {
      setUploading(true);
      const saved = transaction
        ? await update.mutateAsync({ id: transaction.id, ...body })
        : await create.mutateAsync(body);

      // Upload any newly attached files to the saved transaction.
      for (const file of pendingFiles) {
        await uploadAttachment(saved.id, file);
      }
      if (pendingFiles.length > 0 || transaction) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["transaction", saved.id] });
      }
      toast(transaction ? "Transaction updated" : "Transaction added", "success");
      onClose();
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={transaction ? "Edit transaction" : "Add transaction"}
      className="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onTypeChange("expense")}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              type === "expense"
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-input text-muted-foreground"
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => onTypeChange("income")}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              type === "income"
                ? "border-success bg-success/10 text-success"
                : "border-input text-muted-foreground"
            }`}
          >
            Income
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="tx-amount">Amount</Label>
            <Input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-date">Date</Label>
            <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="tx-account">Account</Label>
            <Select id="tx-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              <option value="" disabled>
                Select an account
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-category">Category</Label>
            <CategorySelect
              id="tx-category"
              categories={categories}
              type={type}
              value={categoryId}
              onChange={setCategoryId}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="tx-vendor">Vendor</Label>
            <Input id="tx-vendor" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-payment">Payment method</Label>
            <Select id="tx-payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">—</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="tx-gstin">Vendor GSTIN</Label>
            <Input
              id="tx-gstin"
              value={vendorGstin}
              onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
              placeholder="Optional"
              maxLength={15}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-tax">Tax amount (GST)</Label>
            <Input id="tx-tax" type="number" step="0.01" min="0" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tx-desc">Description</Label>
          <Textarea id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional notes" />
        </div>

        {/* Attachments */}
        <div className="space-y-2">
          <Label>Receipt / invoice</Label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input py-6 text-sm text-muted-foreground hover:bg-accent/40"
          >
            <Upload className="h-5 w-5" />
            <span>Drag & drop or click to upload (JPG, PNG, PDF · max 10MB)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {existing.map((att) => (
            <div key={att.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <button type="button" onClick={() => openAttachment(att)} className="flex items-center gap-2 text-primary hover:underline">
                {att.fileType === "pdf" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                {att.fileName}
              </button>
              <button type="button" onClick={() => removeExisting(att)} aria-label="Remove attachment">
                <X className="h-4 w-4 text-destructive" />
              </button>
            </div>
          ))}
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> {f.name}
                <span className="text-xs text-muted-foreground">({(f.size / 1024).toFixed(0)} KB)</span>
              </span>
              <button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove file">
                <X className="h-4 w-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={uploading || create.isPending || update.isPending}>
            {transaction ? "Save changes" : "Add transaction"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
