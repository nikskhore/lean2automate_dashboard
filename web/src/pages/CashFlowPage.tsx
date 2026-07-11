import { useState } from "react";
import { InflowOutflowChart } from "@/components/charts/InflowOutflowChart";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useCashflow } from "@/hooks/queries";
import { formatMoney } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";

function firstOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
}

export function CashFlowPage() {
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(today());
  const { data, isLoading } = useCashflow({ from, to });

  const preset = (label: string, f: string, t: string) => (
    <Button variant={from === f && to === t ? "default" : "outline"} size="sm" onClick={() => { setFrom(f); setTo(t); }}>
      {label}
    </Button>
  );

  return (
    <div>
      <PageHeader title="Cash Flow" description="Inflows, outflows, and current balance per account." />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="cf-from">From</Label>
            <Input id="cf-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-to">To</Label>
            <Input id="cf-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {preset("This month", firstOfMonth(), today())}
            {preset("This year", firstOfYear(), today())}
          </div>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Total inflow" value={formatMoney(data.totalInflow)} icon={ArrowUpRight} accent="success" />
            <StatTile label="Total outflow" value={formatMoney(data.totalOutflow)} icon={ArrowDownRight} accent="destructive" />
            <StatTile label="Net cash flow" value={formatMoney(data.netCashFlow)} icon={Wallet} accent={Number(data.netCashFlow) >= 0 ? "success" : "destructive"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inflow vs Outflow</CardTitle>
              <p className="text-sm text-muted-foreground">By month, over the selected period</p>
            </CardHeader>
            <CardContent>
              <InflowOutflowChart data={data.monthly} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2 text-right">Opening</th>
                      <th className="px-3 py-2 text-right">Inflow</th>
                      <th className="px-3 py-2 text-right">Outflow</th>
                      <th className="px-3 py-2 text-right">Balance now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts.map((a) => (
                      <tr key={a.accountId} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{a.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatMoney(a.openingBalance)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-success">{formatMoney(a.inflow)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-destructive">{formatMoney(a.outflow)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(a.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
