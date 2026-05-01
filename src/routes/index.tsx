import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStore, setRota, getBudgetForWeek, setBudget, getBudget } from "@/lib/store";
import { generateRota, fmtShift, checkCoverage, suggestReplacement, recomputeTotals, suggestRebalance } from "@/lib/rota";
import { DAYS, type Section, type Shift } from "@/lib/types";
import { ShiftEditor, type ShiftEditorState } from "@/components/ShiftEditor";

export const Route = createFileRoute("/")({
  component: RotaPage,
});

function RotaPage() {
  const { employees, rota } = useStore();
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(2026, 0, 5), { weekStartsOn: 1 }), // default to Mon Jan 5 2026 (in plan)
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapEmp, setSwapEmp] = useState<string>("");
  const [swapDay, setSwapDay] = useState<string>("");
  const [editor, setEditor] = useState<ShiftEditorState | null>(null);

  const openEditor = (state: ShiftEditorState) => setEditor(state);
  const closeEditor = () => setEditor(null);

  const writeShift = (employeeId: string, dayIdx: number, shift: Shift | null, section: Section | null) => {
    if (!rota) return;
    const next = {
      ...rota,
      rows: rota.rows.map((r) =>
        r.employeeId === employeeId
          ? {
              ...r,
              days: r.days.map((d, i) => (i === dayIdx ? { shift, section } : d)),
            }
          : r,
      ),
    };
    setRota(recomputeTotals(next, employees));
  };

  const handleEditorSave = (next: { shift: Shift; section: Section }) => {
    if (!editor) return;
    writeShift(editor.employeeId, editor.dayIdx, next.shift, next.section);
    closeEditor();
  };

  const handleEditorRemove = () => {
    if (!editor) return;
    writeShift(editor.employeeId, editor.dayIdx, null, null);
    closeEditor();
  };

  const weekEnd = addDays(weekStart, 6);
  const weekISO = weekStart.toISOString();

  // Auto-load this week's budget from the 26-week sales plan
  const planWeek = useMemo(() => getBudgetForWeek(weekStart), [weekStart]);
  const dailyBudget = planWeek.inPlan ? planWeek.daily : getBudget().daily;
  const weeklyBudget = planWeek.inPlan ? planWeek.weekly : getBudget().weekly;

  // Persist the loaded budget so the Budget page reflects it
  useEffect(() => {
    if (planWeek.inPlan) {
      const cur = getBudget();
      setBudget({ ...cur, weekly: planWeek.weekly, daily: planWeek.daily });
    }
  }, [planWeek.inPlan, planWeek.weekly, planWeek.daily.join(",")]);

  const handleGenerate = () => {
    const r = generateRota(weekISO, employees, dailyBudget, weeklyBudget);
    setRota(r);
  };

  const totalCost = rota?.rows.reduce((s, r) => s + r.cost, 0) ?? 0;
  const totalHours = rota?.rows.reduce((s, r) => s + r.totalHours, 0) ?? 0;
  const remaining = weeklyBudget - totalCost;
  const overBudget = totalCost > weeklyBudget;
  const weeklyPct = weeklyBudget > 0 ? (totalCost / weeklyBudget) * 100 : 0;

  const issues = useMemo(
    () => (rota ? checkCoverage(rota, employees, dailyBudget) : []),
    [rota, employees, dailyBudget],
  );

  const rebalance = useMemo(
    () => (rota ? suggestRebalance(rota, employees, dailyBudget, weeklyBudget) : null),
    [rota, employees, dailyBudget, weeklyBudget],
  );

  const applyTrim = () => {
    if (!rota || !rebalance?.trim) return;
    writeShift(rebalance.trim.employeeId, rebalance.trim.dayIdx, null, null);
  };

  const swap = useMemo(() => {
    if (!rota || !swapEmp || swapDay === "") return null;
    return suggestReplacement(rota, employees, dailyBudget, swapEmp, parseInt(swapDay));
  }, [rota, employees, dailyBudget, swapEmp, swapDay]);

  const exportCSV = () => {
    if (!rota) return;
    const header = [
      "Team Member",
      "Role",
      "Contracted Hours",
      ...DAYS.flatMap((d) => [`${d} Hours`, `${d} Times`, `${d} Section`]),
      "Total Hours",
      "Hourly Rate",
      "Cost",
    ];
    const rows = rota.rows.map((r) => {
      const emp = employees.find((e) => e.id === r.employeeId)!;
      const dayCells = r.days.flatMap((d) => [
        d.shift ? d.shift.hours.toString() : "",
        d.shift ? fmtShift(d.shift) : "OFF",
        d.section ?? "",
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
              Weekly Rota — {planWeek.label}
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
        <Kpi
          label="Labour Budget (Weekly)"
          value={`£${weeklyBudget.toLocaleString()}`}
        />
        <Kpi
          label="Scheduled Cost"
          value={`£${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          tone={overBudget ? "danger" : "success"}
          badge={rota ? (overBudget ? "OVER" : "UNDER") : undefined}
        />
        <Kpi
          label="Remaining"
          value={`£${remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          tone={overBudget ? "danger" : undefined}
        />
        <Kpi
          label={planWeek.inPlan ? "Sales Target (Weekly)" : "Labour Hours"}
          value={planWeek.inPlan ? `£${planWeek.weeklySales.toLocaleString()}` : totalHours.toFixed(1)}
        />
      </div>
      {planWeek.inPlan && (
        <p className="text-[11px] text-muted-foreground -mt-3 px-1 tabular">
          Labour cap £{weeklyBudget.toLocaleString()}/wk ({((weeklyBudget / planWeek.weeklySales) * 100).toFixed(1)}% of £{planWeek.weeklySales.toLocaleString()} sales target). Daily caps split proportional to sales.
        </p>
      )}

      {/* Live Budget Bar */}
      {rota && (
        <div className="bg-panel border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Live Budget Tracker
            </h2>
            <span
              className={cn(
                "text-xs font-semibold tabular px-2 py-0.5 rounded border",
                overBudget
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : weeklyPct > 90
                    ? "bg-warning/10 text-warning border-warning/30"
                    : "bg-success/10 text-success border-success/30",
              )}
            >
              {weeklyPct.toFixed(1)}% of weekly
            </span>
          </div>
          {/* Weekly progress bar */}
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Weekly £{totalCost.toFixed(0)} / £{weeklyBudget.toLocaleString()}</span>
            <span className={cn("tabular font-medium", overBudget ? "text-destructive" : "text-success")}>
              {overBudget ? `+£${Math.abs(remaining).toFixed(0)} over` : `£${remaining.toFixed(0)} left`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface overflow-hidden border border-border">
            <div
              className={cn(
                "h-full transition-all",
                overBudget ? "bg-destructive" : weeklyPct > 90 ? "bg-warning" : "bg-success",
              )}
              style={{ width: `${Math.min(100, weeklyPct)}%` }}
            />
          </div>
          {/* Daily mini bars */}
          <div className="grid grid-cols-7 gap-2 mt-4">
            {DAYS.map((d, i) => {
              const cost = rota.dailyCost[i];
              const budget = dailyBudget[i] || 0;
              const pct = budget > 0 ? (cost / budget) * 100 : 0;
              const dayOver = cost > budget && budget > 0;
              return (
                <div key={d} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground font-medium">{d}</span>
                    <span
                      className={cn(
                        "tabular font-semibold",
                        dayOver ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {budget > 0 ? `${pct.toFixed(0)}%` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden border border-border">
                    <div
                      className={cn(
                        "h-full",
                        dayOver ? "bg-destructive" : pct > 90 ? "bg-warning" : "bg-success",
                      )}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-muted-foreground tabular text-center">
                    £{cost.toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


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
              dailyBudget={dailyBudget}
              onCellClick={openEditor}
            />
          )}
        </div>

        <ShiftEditor
          open={!!editor}
          initial={editor}
          onClose={closeEditor}
          onSave={handleEditorSave}
          onRemove={handleEditorRemove}
        />

        {/* Side panel */}
        <aside className="w-full xl:w-[360px] flex flex-col gap-4">
          {rebalance && (
            <div
              className={cn(
                "border rounded-xl p-5",
                rebalance.status === "ok"
                  ? "bg-success/5 border-success/30"
                  : "bg-destructive/5 border-destructive/30",
              )}
            >
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
                <Sparkles className="size-3.5" /> Auto-Rebalance
              </h2>
              <div className="flex items-start gap-2">
                {rebalance.status === "ok" ? (
                  <CheckCircle2 className="size-4 text-success mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                )}
                <p className="text-xs leading-relaxed">{rebalance.message}</p>
              </div>
              {rebalance.trim && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={applyTrim}
                >
                  Apply suggested trim (−£{rebalance.trim.saving.toFixed(2)})
                </Button>
              )}
            </div>
          )}
          <div className="bg-panel border border-border rounded-xl p-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Coverage Anomalies
            </h2>
            {issues.length === 0 ? (
              <div className="flex items-center gap-3 text-sm text-success">
                <CheckCircle2 className="size-4" /> All sections covered, hours within bands
              </div>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {issues.map((i, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border-l-2 border-destructive"
                  >
                    <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
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
        Pick a week and click Generate Rota to build a schedule based on availability, sections and budget.
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
  onCellClick,
}: {
  rota: ReturnType<typeof generateRota>;
  employees: ReturnType<typeof useStore>["employees"];
  weekStart: Date;
  dailyBudget: number[];
  onCellClick: (state: ShiftEditorState) => void;
}) {
  // Mark rush days (top-bracket budget or weekend) for visual cue
  const valid = dailyBudget.filter((v) => v > 0);
  const avg = valid.length ? valid.reduce((s, n) => s + n, 0) / valid.length : 0;
  const rush = dailyBudget.map((v, i) => i >= 5 || v >= avg * 1.15);

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
                className="p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center min-w-[110px]"
              >
                <div className="flex items-center justify-center gap-1">
                  {d}
                  {rush[i] && <Flame className="size-3 text-warning" />}
                </div>
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
                        £{emp.hourlyRate.toFixed(2)} • {emp.role}
                      </p>
                    </div>
                  </div>
                </td>
                {row.days.map((d, i) => {
                  const open = () =>
                    onCellClick({
                      employeeId: row.employeeId,
                      employeeName: emp.name,
                      dayIdx: i,
                      dayLabel: `${DAYS[i]} ${format(addDays(weekStart, i), "d MMM")}`,
                      shift: d.shift,
                      section: d.section ?? null,
                    });
                  return (
                    <td key={i} className="p-2 text-center">
                      {d.shift ? (
                        <button
                          type="button"
                          onClick={open}
                          className="w-full bg-surface border border-border p-2 rounded transition hover:border-primary hover:bg-primary/5 cursor-pointer"
                        >
                          <p className="text-[11px] font-medium tabular">{fmtShift(d.shift)}</p>
                          <p className="text-[9px] text-muted-foreground tabular">{d.shift.hours}h</p>
                          {d.section && (
                            <p className="text-[9px] mt-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 truncate">
                              {d.section}
                            </p>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={open}
                          className="w-full text-[11px] text-muted-foreground/60 hover:text-primary py-3 rounded border border-dashed border-transparent hover:border-primary/40 transition"
                        >
                          OFF
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="p-3 text-right tabular text-sm font-medium">
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
                  <div className="text-[9px] text-muted-foreground">
                    / £{dailyBudget[i].toLocaleString()}
                  </div>
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
