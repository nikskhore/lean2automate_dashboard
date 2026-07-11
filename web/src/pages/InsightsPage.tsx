import { TrendingDown, TrendingUp } from "lucide-react";
import { HorizontalCategoryBar } from "@/components/charts/HorizontalCategoryBar";
import { LineTrendChart } from "@/components/charts/LineTrendChart";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useInsights } from "@/hooks/queries";
import { FLOW_COLORS, useIsDark } from "@/lib/chartTheme";
import { cn } from "@/lib/utils";

function GrowthTile({ label, value, invert }: { label: string; value: number | null; invert?: boolean }) {
  const good = value == null ? null : invert ? value < 0 : value > 0;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        {value == null ? (
          <div className="mt-1 text-2xl font-bold text-muted-foreground">—</div>
        ) : (
          <div className={cn("mt-1 flex items-center gap-1 text-2xl font-bold tabular-nums", good ? "text-success" : "text-destructive")}>
            {value >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            {value > 0 ? "+" : ""}{value}%
          </div>
        )}
        <div className="mt-1 text-xs text-muted-foreground">month over month</div>
      </CardContent>
    </Card>
  );
}

export function InsightsPage() {
  const { data, isLoading } = useInsights(12);
  const dark = useIsDark();
  const flow = dark ? FLOW_COLORS.dark : FLOW_COLORS.light;
  const blue = dark ? "#3987e5" : "#2a78d6";

  if (isLoading || !data) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader title="Insights" description="Trends over the last 12 months." />

      <div className="grid gap-4 sm:grid-cols-3">
        <GrowthTile label="Income growth" value={data.momGrowth.income} />
        <GrowthTile label="Expense growth" value={data.momGrowth.expense} invert />
        <GrowthTile label="Net profit growth" value={data.momGrowth.net} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income vs Expense trend</CardTitle>
          </CardHeader>
          <CardContent>
            <LineTrendChart
              data={data.monthly}
              series={[
                { key: "income", label: "Income", color: flow.income },
                { key: "expense", label: "Expense", color: flow.expense },
              ]}
              valueKind="money"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense-to-income ratio</CardTitle>
            <p className="text-sm text-muted-foreground">Lower is healthier · below 100% means you're profitable</p>
          </CardHeader>
          <CardContent>
            <LineTrendChart
              data={data.monthly.map((m) => ({ month: m.month, ratio: m.expenseToIncomeRatio }))}
              series={[{ key: "ratio", label: "Expense/Income", color: blue }]}
              valueKind="percent"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Top 5 expense categories</CardTitle>
          <p className="text-sm text-muted-foreground">Across the last 12 months</p>
        </CardHeader>
        <CardContent>
          <HorizontalCategoryBar data={data.topExpenseCategories} />
        </CardContent>
      </Card>
    </div>
  );
}
