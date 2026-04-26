import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStore, setRota } from "@/lib/store";
import { generateRota, fmtShift, checkCoverage, suggestReplacement } from "@/lib/rota";
import { DAYS } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: RotaPage,
});

function RotaPage() {
  const { employees, budget, rota } = useStore();
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapEmp, setSwapEmp] = useState<string>("");
  const [swapDay, setSwapDay] = useState<string>("");

  const weekEnd = addDays(weekStart, 6);
  const weekISO = weekStart.toISOString();

  const handleGenerate = () => {
    const r = generateRota(weekISO, employees);
    setRota(r);
  };

  const totalCost = rota?.rows.reduce((s, r) => s + r.cost, 0) ?? 0;
  const totalHours = rota?.rows.reduce((s, r) => s + r.totalHours, 0) ?? 0;
  const remaining = budget.weekly - totalCost;
  const overBudget = totalCost > budget.weekly;

  const issues = useMemo(
    () => (rota ? checkCoverage(rota, employees) : []),
    [rota, employees],
  );

  const swap = useMemo(() => {
    if (!rota || !swapEmp || swapDay === "") return null;
    return suggestReplacement(rota, employees, swapEmp, parseInt(swapDay));
  }, [rota, employees, swapEmp, swapDay]);

  const exportCSV = () => {
    if (!rota) return;
    const header = [
      "Team Member",
      "Role",
      "Contracted Hours",
      ...DAYS.flatMap((d) => [`${d} Hours`, `${d} Times`]),
      "Total Hours",
      "Hourly Rate",
      "Cost",
    ];
    const rows = rota.rows.map((r) => {
      const emp = employees.find((e) => e.id === r.employeeId)!;
      const dayCells = r.days.flatMap((d) => [
        d.shift ? d.shift.hours.toString() : "",
        d.shift ? fmtShift(d.shift) : "OFF",
      ]);
      return [
        emp.name,
        emp.role,
        emp.contractedHours,
        ...dayCells,
        r.totalHours,
        emp.hourlyRate,
        r.cost.toFixed(2),
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rota-${format(weekStart, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 flex flex-col gap-6 min-h-screen">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-panel border border-border p-4 rounded-xl">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Weekly Rota
            </h1>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => setWeekStart(subWeeks(weekStart, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 font-medium">
                    <CalendarIcon className="size-4" />
                    {format(weekStart, "MMM d")} — {format(weekEnd, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={weekStart}
                    onSelect={(d) => {
                      if (d) {
                        setWeekStart(startOfWeek(d, { weekStartsOn: 1 }));
                        setPickerOpen(false);
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={!rota}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button
            onClick={handleGenerate}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow"
          >
            <Sparkles className="size-4" /> Generate Rota
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Weekly Budget" value={`£${budget.weekly.toLocaleString()}`} />
        <Kpi
          label="Scheduled Cost"
          value={`£${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          tone={overBudget ? "danger" : "success"}
          badge={overBudget ? "OVER" : "UNDER"}
        />
        <Kpi
          label="Remaining"
          value={`£${remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          tone={overBudget ? "danger" : undefined}
        />
        <Kpi label="Labour Hours" value={totalHours.toFixed(1)} />
      </div>

      {/* Main split */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Rota table */}
        <div className="flex-1 min-w-0 bg-panel border border-border rounded-xl overflow-hidden">
          {!rota ? (
            <EmptyState onGenerate={handleGenerate} />
          ) : (
            <RotaTable
              rota={rota}
              employees={employees}
              weekStart={weekStart}
              dailyBudget={budget.daily}
            />
          )}
        </div>

        {/* Side panel */}
        <aside className="w-full xl:w-[360px] flex flex-col gap-4">
          <div className="bg-panel border border-border rounded-xl p-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Coverage Anomalies
            </h2>
            {issues.length === 0 ? (
              <div className="flex items-center gap-3 text-sm text-success">
                <CheckCircle2 className="size-4" /> All shifts staffed correctly
              </div>
            ) : (
              <ul className="space-y-2">
                {issues.map((i, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border-l-2 border-destructive"
                  >
                    <AlertTriangle className="size-4 text-destructive mt-0.5" />
                    <div className="text-xs">
                      <span className="font-semibold">{DAYS[i.day]}:</span> {i.message}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-panel border border-border rounded-xl p-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
              <ArrowRightLeft className="size-3.5" /> Swap / Day-Off Checker
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground">Employee</label>
                <Select value={swapEmp} onValueChange={setSwapEmp}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} — {e.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Day</label>
                <Select value={swapDay} onValueChange={setSwapDay}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={d} value={i.toString()}>
                        {d} — {format(addDays(weekStart, i), "MMM d")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {swap && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {!swap.needed ? (
                    <div className="flex items-center gap-2 text-success text-sm">
                      <CheckCircle2 className="size-4" /> No replacement needed
                    </div>
                  ) : swap.replacements.length === 0 ? (
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertTriangle className="size-4" /> No available replacement
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">Suggested replacements:</p>
                      <ul className="space-y-1">
                        {swap.replacements.slice(0, 3).map((e) => (
                          <li
                            key={e.id}
                            className="flex justify-between items-center text-sm bg-surface border border-border rounded-md px-3 py-2"
                          >
                            <span>{e.name}</span>
                            <span className="tabular text-xs text-muted-foreground">
                              £{e.hourlyRate.toFixed(2)}/h
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p
                        className={cn(
                          "text-xs tabular",
                          swap.costDelta > 0 ? "text-destructive" : "text-success",
                        )}
                      >
                        Cost impact: {swap.costDelta > 0 ? "+" : ""}£{swap.costDelta.toFixed(2)}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  badge,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  badge?: string;
}) {
  const valueColor =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  const badgeColor =
    tone === "success"
      ? "bg-success/10 text-success border-success/30"
      : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <div className="bg-panel border border-border p-5 rounded-xl">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("text-2xl font-semibold tabular", valueColor)}>{value}</span>
        {badge && (
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-semibold", badgeColor)}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="size-5 text-primary" />
      </div>
      <h3 className="font-semibold mb-1">No rota generated yet</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Pick a week and click Generate Rota to build a schedule based on availability and budget.
      </p>
      <Button onClick={onGenerate} className="bg-primary text-primary-foreground">
        <Sparkles className="size-4" /> Generate Rota
      </Button>
    </div>
  );
}

function RotaTable({
  rota,
  employees,
  weekStart,
  dailyBudget,
}: {
  rota: ReturnType<typeof generateRota>;
  employees: ReturnType<typeof useStore>["employees"];
  weekStart: Date;
  dailyBudget: number[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th className="p-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-surface min-w-[200px]">
              Employee
            </th>
            {DAYS.map((d, i) => (
              <th
                key={d}
                className="p-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center"
              >
                {d}
                <span className="block text-[10px] opacity-50 font-normal">
                  {format(addDays(weekStart, i), "d MMM")}
                </span>
              </th>
            ))}
            <th className="p-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
              Total
            </th>
            <th className="p-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
              Cost
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rota.rows.map((row) => {
            const emp = employees.find((e) => e.id === row.employeeId)!;
            const overContract = row.totalHours > emp.contractedHours;
            return (
              <tr key={row.employeeId} className="hover:bg-white/[0.02]">
                <td className="p-3 sticky left-0 bg-panel">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-surface ring-1 ring-border flex items-center justify-center text-[10px] font-bold">
                      {emp.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{emp.name}</p>
                      <p className="text-[10px] text-muted-foreground tabular">
                        {emp.contractedHours}h • £{emp.hourlyRate.toFixed(2)} • {emp.role}
                      </p>
                    </div>
                  </div>
                </td>
                {row.days.map((d, i) => (
                  <td key={i} className="p-2 text-center">
                    {d.shift ? (
                      <div className="bg-surface border border-border p-2 rounded">
                        <p className="text-[11px] font-medium tabular">{fmtShift(d.shift)}</p>
                        <p className="text-[9px] text-muted-foreground tabular">
                          {d.shift.hours}h
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/60">OFF</span>
                    )}
                  </td>
                ))}
                <td
                  className={cn(
                    "p-3 text-right tabular text-sm font-medium",
                    overContract && "text-warning",
                  )}
                >
                  {row.totalHours.toFixed(1)}h
                </td>
                <td className="p-3 text-right tabular text-sm font-semibold">
                  £{row.cost.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-surface/60 border-t-2 border-border">
            <td className="p-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 bg-surface/60">
              Daily Cost / Budget
            </td>
            {rota.dailyCost.map((cost, i) => {
              const over = cost > dailyBudget[i];
              return (
                <td key={i} className="p-3 text-center tabular text-[11px]">
                  <div className={cn("font-semibold", over ? "text-destructive" : "text-success")}>
                    £{cost.toFixed(0)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">/ £{dailyBudget[i]}</div>
                </td>
              );
            })}
            <td className="p-3 text-right tabular text-xs text-muted-foreground">
              {rota.rows.reduce((s, r) => s + r.totalHours, 0).toFixed(1)}h
            </td>
            <td className="p-3 text-right tabular text-sm font-bold">
              £{rota.rows.reduce((s, r) => s + r.cost, 0).toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
