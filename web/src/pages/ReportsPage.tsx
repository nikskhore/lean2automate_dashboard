import { Download } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { usePnl } from "@/hooks/queries";
import { api, apiErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { PnlCategoryTotal } from "@/types";

function firstOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}
function firstOfMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function quarterStart() {
  const n = new Date();
  const q = Math.floor(n.getMonth() / 3) * 3;
  return `${n.getFullYear()}-${String(q + 1).padStart(2, "0")}-01`;
}

export function ReportsPage() {
  const { toast } = useToast();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [compare, setCompare] = useState(true);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isFetching } = usePnl({ from, to, compare: compare ? "previous" : "none" });

  async function onExport() {
    setExporting(true);
    try {
      const res = await api.get("/reports/pnl/export", {
        params: { from, to },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-report-all-${from}_to_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Excel report downloaded", "success");
    } catch (err) {
      toast(apiErrorMessage(err, "Export failed"), "error");
    } finally {
      setExporting(false);
    }
  }

  const preset = (label: string, f: string, t: string) => (
    <Button
      variant={from === f && to === t ? "default" : "outline"}
      size="sm"
      onClick={() => {
        setFrom(f);
        setTo(t);
      }}
    >
      {label}
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        description="Income and expenses by category, with net profit for the period."
        action={
          <Button onClick={onExport} loading={exporting}>
            <Download className="h-4 w-4" /> Export to Excel
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {preset("This month", firstOfMonth(), today())}
            {preset("This quarter", quarterStart(), today())}
            {preset("This year", firstOfYear(), today())}
          </div>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            Compare to previous period
          </label>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Total Income" value={data.totalIncome} accent="success" change={data.comparison?.change.totalIncome} />
            <SummaryCard label="Total Expenses" value={data.totalExpense} accent="destructive" change={data.comparison?.change.totalExpense} invertChange />
            <SummaryCard
              label="Net Profit / Loss"
              value={data.netProfit}
              accent={Number(data.netProfit) >= 0 ? "success" : "destructive"}
              change={data.comparison?.change.netProfit}
            />
          </div>

          {isFetching && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="h-3 w-3" /> Updating…
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <StatementSection title="Income" rows={data.income} total={data.totalIncome} accent="success" />
            <StatementSection title="Expenses" rows={data.expenses} total={data.totalExpense} accent="destructive" />
          </div>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <span className="text-lg font-semibold">Net Profit / (Loss)</span>
              <span
                className={`text-2xl font-bold tabular-nums ${
                  Number(data.netProfit) >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {formatMoney(data.netProfit)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  change,
  invertChange,
}: {
  label: string;
  value: string;
  accent: "success" | "destructive";
  change?: number | null;
  invertChange?: boolean;
}) {
  const color = accent === "success" ? "text-success" : "text-destructive";
  // For expenses, a decrease is "good" — invert the sentiment coloring of the delta.
  const good = change == null ? false : invertChange ? change < 0 : change > 0;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{formatMoney(value)}</div>
        {change != null && (
          <div className={`mt-1 text-xs ${good ? "text-success" : "text-destructive"}`}>
            {change > 0 ? "▲" : "▼"} {Math.abs(change)}% vs previous period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatementSection({
  title,
  rows,
  total,
  accent,
}: {
  title: string;
  rows: PnlCategoryTotal[];
  total: string;
  accent: "success" | "destructive";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No {title.toLowerCase()} in this period.</p>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.categoryId} className="flex items-center justify-between py-2 text-sm">
                <span>{r.name}</span>
                <span className="tabular-nums">{formatMoney(r.total)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t pt-3 font-semibold">
          <span>Total {title}</span>
          <span className={`tabular-nums ${accent === "success" ? "text-success" : "text-destructive"}`}>
            {formatMoney(total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
