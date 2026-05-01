import { createFileRoute } from "@tanstack/react-router";
import { Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useStore, setBudget, getBudgetForWeek } from "@/lib/store";
import { DAYS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/budget")({
  component: BudgetPage,
  head: () => ({ meta: [{ title: "Labour Budget — Rota Cockpit" }] }),
});

function BudgetPage() {
  const { budget, rota } = useStore();
  const totalDaily = budget.daily.reduce((s, n) => s + n, 0);
  const weeksInYear = 52;
  const projectedYearly = budget.weekly * weeksInYear;
  const ytdCost = rota?.rows.reduce((s, r) => s + r.cost, 0) ?? 0;

  // Preset for the currently selected rota week (sales plan)
  const preset = useMemo(() => {
    if (!rota?.weekStartISO) return null;
    return getBudgetForWeek(new Date(rota.weekStartISO));
  }, [rota?.weekStartISO]);

  const weeklyOver = preset ? budget.weekly > preset.weekly : false;
  const dailyFlags = budget.daily.map((v, i) =>
    preset && preset.daily[i] > 0 ? v > preset.daily[i] : false,
  );
  const anyDailyOver = dailyFlags.some(Boolean);

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

      {preset && (
        <div
          className={cn(
            "border rounded-xl p-4 flex items-start gap-3",
            weeklyOver || anyDailyOver
              ? "bg-destructive/10 border-destructive/40"
              : "bg-success/10 border-success/30",
          )}
        >
          {weeklyOver || anyDailyOver ? (
            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <p className="font-medium">
              Sales-plan preset · {preset.label}
            </p>
            <p className="text-muted-foreground tabular">
              Preset weekly: £{preset.weekly.toLocaleString()} · Your weekly: £
              {budget.weekly.toLocaleString()}
              {weeklyOver && (
                <span className="text-destructive ml-2">
                  (over by £{(budget.weekly - preset.weekly).toLocaleString()})
                </span>
              )}
            </p>
            {anyDailyOver && (
              <p className="text-destructive mt-1">
                Some daily allocations exceed the preset — see highlighted days below.
              </p>
            )}
          </div>
        </div>
      )}

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
            className={cn(
              "text-2xl tabular h-12 mt-1 border-border",
              weeklyOver ? "bg-destructive/10 border-destructive/50" : "bg-surface",
            )}
          />
          <p className={cn("text-xs mt-2 tabular", totalDaily === budget.weekly ? "text-success" : "text-warning")}>
            Daily sum: £{totalDaily.toLocaleString()}
            {preset && totalDaily > preset.weekly && (
              <span className="text-destructive ml-2">
                · exceeds preset £{preset.weekly.toLocaleString()}
              </span>
            )}
          </p>
          {preset && (
            <p className="text-xs text-muted-foreground mt-1 tabular">
              Preset: £{preset.weekly.toLocaleString()}
            </p>
          )}
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Daily Allocation
          </h2>
          {preset && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              vs. {preset.label} preset
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          {DAYS.map((d, i) => {
            const presetVal = preset?.daily[i] ?? 0;
            const over = dailyFlags[i];
            return (
              <div
                key={d}
                className={cn(
                  "border rounded-lg p-3",
                  over
                    ? "bg-destructive/10 border-destructive/40"
                    : "bg-surface border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{d}</p>
                  {over && <AlertTriangle className="size-3 text-destructive" />}
                </div>
                <Input
                  type="number"
                  value={budget.daily[i]}
                  onChange={(e) => {
                    const next = [...budget.daily];
                    next[i] = parseFloat(e.target.value) || 0;
                    setBudget({ ...budget, daily: next });
                  }}
                  className={cn(
                    "border-border mt-2 tabular",
                    over ? "bg-destructive/10 border-destructive/50" : "bg-background",
                  )}
                />
                {preset && (
                  <p
                    className={cn(
                      "text-[10px] mt-1 tabular",
                      over ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    Preset: £{presetVal.toLocaleString()}
                    {over && ` · +£${(budget.daily[i] - presetVal).toLocaleString()}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {!preset && (
          <p className="text-xs text-muted-foreground mt-4">
            Pick a week on the rota dashboard to compare against the sales-plan preset.
          </p>
        )}
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
