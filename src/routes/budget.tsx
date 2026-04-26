import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useStore, setBudget } from "@/lib/store";
import { DAYS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/budget")({
  component: BudgetPage,
  head: () => ({ meta: [{ title: "Yearly Budget — Rota Cockpit" }] }),
});

function BudgetPage() {
  const { budget, rota } = useStore();
  const totalDaily = budget.daily.reduce((s, n) => s + n, 0);
  const weeksInYear = 52;
  const projectedYearly = budget.weekly * weeksInYear;
  const ytdCost = rota?.rows.reduce((s, r) => s + r.cost, 0) ?? 0;

  return (
    <div className="p-6 flex flex-col gap-6 min-h-screen">
      <header className="bg-panel border border-border rounded-xl p-5 flex items-center gap-3">
        <div className="size-10 rounded-md bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
          <Wallet className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Yearly Budget</h1>
          <p className="text-sm text-muted-foreground">
            26-week sales plan auto-loads when you pick a week on the rota. You can still override values here.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BudgetCard label="Yearly Budget">
          <Input
            type="number"
            value={budget.yearly}
            onChange={(e) => setBudget({ ...budget, yearly: parseFloat(e.target.value) || 0 })}
            className="text-2xl tabular bg-surface border-border h-12 mt-1"
          />
          <p className="text-xs text-muted-foreground mt-2 tabular">
            Projected from weekly: £{projectedYearly.toLocaleString()}
          </p>
        </BudgetCard>
        <BudgetCard label="Weekly Budget">
          <Input
            type="number"
            value={budget.weekly}
            onChange={(e) => setBudget({ ...budget, weekly: parseFloat(e.target.value) || 0 })}
            className="text-2xl tabular bg-surface border-border h-12 mt-1"
          />
          <p className={cn("text-xs mt-2 tabular", totalDaily === budget.weekly ? "text-success" : "text-warning")}>
            Daily sum: £{totalDaily.toLocaleString()}
          </p>
        </BudgetCard>
        <BudgetCard label="Current Week Cost">
          <p className="text-3xl font-semibold tabular mt-2">
            £{ytdCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p
            className={cn(
              "text-xs mt-2 tabular",
              ytdCost > budget.weekly ? "text-destructive" : "text-success",
            )}
          >
            {ytdCost > budget.weekly ? "Over" : "Under"} by £
            {Math.abs(budget.weekly - ytdCost).toFixed(2)}
          </p>
        </BudgetCard>
      </div>

      <div className="bg-panel border border-border rounded-xl p-5">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
          Daily Allocation
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          {DAYS.map((d, i) => (
            <div key={d} className="bg-surface border border-border rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{d}</p>
              <Input
                type="number"
                value={budget.daily[i]}
                onChange={(e) => {
                  const next = [...budget.daily];
                  next[i] = parseFloat(e.target.value) || 0;
                  setBudget({ ...budget, daily: next });
                }}
                className="bg-background border-border mt-2 tabular"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BudgetCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel border border-border rounded-xl p-5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
