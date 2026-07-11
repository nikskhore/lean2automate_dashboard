import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, apiErrorMessage } from "@/lib/api";

interface ImportResult {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export function CsvImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<ImportResult>("/transactions/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      if (data.imported > 0) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["pnl"] });
        toast(`Imported ${data.imported} transaction(s)`, "success");
      } else {
        toast("No rows imported — check the errors below", "error");
      }
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Import transactions from CSV">
      <div className="space-y-4">
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Required columns:</p>
          <code className="mt-1 block">date, type, amount, category, account</code>
          <p className="mt-2 font-medium text-foreground">Optional:</p>
          <code className="mt-1 block">description, vendor_name, vendor_gstin, tax_amount, payment_method, currency</code>
          <p className="mt-2">
            <code>date</code> = YYYY-MM-DD · <code>type</code> = income/expense · category &amp; account matched by name.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button onClick={() => fileRef.current?.click()} loading={busy} className="w-full">
          Choose CSV file
        </Button>

        {result && (
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-semibold text-success">{result.imported} imported</span>
              {result.failed > 0 && (
                <span className="ml-2 font-semibold text-destructive">{result.failed} failed</span>
              )}
            </p>
            {result.errors.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-xs text-muted-foreground">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
