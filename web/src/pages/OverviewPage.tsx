import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { ExpensePieChart } from "@/components/charts/ExpensePieChart";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useDashboard } from "@/hooks/queries";
import { formatDate, formatMoney } from "@/lib/format";

export function OverviewPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) return <FullPageSpinner />;

  const net = Number(data.netIncomeThisMonth);

  return (
    <div>
      <PageHeader title="Overview" description="Your finances this month at a glance." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Net income (this month)"
          value={formatMoney(data.netIncomeThisMonth)}
          icon={Wallet}
          accent={net >= 0 ? "success" : "destructive"}
        />
        <StatTile
          label="Income (this month)"
          value={formatMoney(data.totalIncomeThisMonth)}
          icon={ArrowUpRight}
          accent="success"
        />
        <StatTile
          label="Expenses (this month)"
          value={formatMoney(data.totalExpenseThisMonth)}
          icon={ArrowDownRight}
          accent="destructive"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Income vs Expense</CardTitle>
            <p className="text-sm text-muted-foreground">Last 12 months</p>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={data.incomeVsExpenseMonthly} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Expense breakdown</CardTitle>
            <p className="text-sm text-muted-foreground">This month, by category</p>
          </CardHeader>
          <CardContent>
            <ExpensePieChart data={data.expenseByCategory} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent transactions</CardTitle>
          <Link to="/transactions" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentTransactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet.{" "}
              <Link to="/transactions" className="text-primary hover:underline">
                Add your first one
              </Link>
              .
            </p>
          ) : (
            <div className="divide-y">
              {data.recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{t.category?.name}</span>
                      <Badge variant={t.type === "income" ? "success" : "muted"}>{t.account?.name}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(t.date)}
                      {t.vendorName ? ` · ${t.vendorName}` : ""}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      t.type === "income" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {t.type === "income" ? "+" : "−"}
                    {formatMoney(t.amount, t.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
