import { addDays, format } from "date-fns";
import type { Employee, Rota, RotaRow, Section, Shift } from "./types";
import { isBankHoliday, isNearBankHoliday } from "./holidays";
import {
  preferenceScore,
  preferredSections,
  isLastResort,
  deliveryRank,
  isDeliveryTeam,
  fixedShiftFor,
} from "./preferences";

// Shift templates derived from the real Deichmann rota example
export const SHIFT_PRESETS: Record<string, Shift> = {
  early:    { start: "06:15", end: "15:15", hours: 8 },
  open:     { start: "07:00", end: "16:00", hours: 8 },
  midOpen:  { start: "09:00", end: "17:30", hours: 8 },
  mid:      { start: "10:00", end: "19:00", hours: 8 },
  midClose: { start: "12:30", end: "21:30", hours: 8 },
  close:    { start: "15:00", end: "21:30", hours: 6 },
  short:    { start: "11:00", end: "17:00", hours: 6 },
  sunOpen:  { start: "10:00", end: "18:00", hours: 7.5 },
  sunClose: { start: "12:00", end: "19:00", hours: 6.5 },
};
const SHIFTS = SHIFT_PRESETS;

export const PRESET_LABELS: Record<string, string> = {
  early:    "Early (06:15–15:15)",
  open:     "Open (07:00–16:00)",
  midOpen:  "Mid-Open (09:00–17:30)",
  mid:      "Mid (10:00–19:00)",
  midClose: "Close (12:30–21:30)",
  close:    "Late (15:00–21:30)",
  short:    "Short (11:00–17:00)",
  sunOpen:  "Sun Open (10:00–18:00)",
  sunClose: "Sun Close (12:00–19:00)",
};

export function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, Math.round((mins / 60) * 4) / 4);
}

export function recomputeTotals(rota: Rota, employees: Employee[]): Rota {
  const dailyCost = Array(7).fill(0);
  const rows = rota.rows.map((r) => {
    const emp = employees.find((e) => e.id === r.employeeId)!;
    let total = 0;
    r.days.forEach((d, i) => {
      if (d.shift) {
        total += d.shift.hours;
        if (!emp.excludedFromBudget) dailyCost[i] += d.shift.hours * emp.hourlyRate;
      }
    });
    return { ...r, totalHours: total, cost: total * emp.hourlyRate };
  });
  return { ...rota, rows, dailyCost };
}

export function fmtShift(s: Shift): string {
  return `${s.start.replace(":", "")}-${s.end.replace(":", "")}`;
}

function targetHours(role: Employee["role"]): { min: number; max: number } {
  switch (role) {
    case "Manager":    return { min: 40, max: 40 };
    case "Supervisor": return { min: 40, max: 40 };
    case "Full time":  return { min: 25, max: 30 };
    case "Part time":  return { min: 8,  max: 16 };
  }
}

// ===== Demand scoring (sales-led + UK calendar) =====

export type DemandLevel = "quiet" | "normal" | "rush";

export interface DayDemand {
  level: DemandLevel;
  score: number;          // 0..1
  isBankHoliday: boolean;
  bankHolidayName: string | null;
  nearBankHoliday: boolean;
  isWeekend: boolean;
  salesBudget: number;
}

/**
 * Compute per-day demand using the 2025 sales-budget pattern + UK calendar.
 * - sales percentile within the week → base score
 * - +0.25 if Sat/Sun (peak weekend trading)
 * - +0.30 if bank holiday or in ±3 days window
 * - level: rush ≥ 0.65, quiet ≤ 0.35, else normal
 */
export function computeDemand(
  weekStart: Date,
  dailyBudget: number[],
): DayDemand[] {
  const valid = dailyBudget.filter((v) => v > 0);
  const max = valid.length ? Math.max(...valid) : 1;

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const iso = format(date, "yyyy-MM-dd");
    const sales = dailyBudget[i] || 0;
    const isWknd = i >= 5;
    const bh = isBankHoliday(iso);
    const nearBh = isNearBankHoliday(date);

    let score = max > 0 ? sales / max : 0;        // 0..1 from sales
    if (isWknd) score += 0.25;
    if (bh) score += 0.30;
    else if (nearBh) score += 0.15;
    score = Math.min(1, score);

    const level: DemandLevel = score >= 0.65 ? "rush" : score <= 0.35 ? "quiet" : "normal";
    return {
      level, score,
      isBankHoliday: !!bh,
      bankHolidayName: bh,
      nearBankHoliday: nearBh,
      isWeekend: isWknd,
      salesBudget: sales,
    };
  });
}

// Slot kinds let us flag the first Ladies 1 slot of weekdays as the
// delivery/early slot (06:15 start, before the 09:30 floor open).
type SlotKind = "delivery" | "normal";
interface Slot { section: Section; kind: SlotKind }

// Required coverage per day, scaled by demand. Order matters — earliest
// slot per section is filled first (so delivery stays at the front).
function requiredSlots(dayIdx: number, demand: DemandLevel): Slot[] {
  const isSun = dayIdx === 6;
  const slots: Slot[] = [];
  // Delivery / early stock fill (Mon–Sat, before opening).
  if (!isSun) slots.push({ section: "Ladies 1", kind: "delivery" });
  if (!isSun) slots.push({ section: "Manager", kind: "normal" });
  slots.push({ section: "Supervisor", kind: "normal" });
  (["Ladies 1", "Ladies 2/3", "Mens", "Kids", "Tills"] as Section[])
    .forEach((s) => slots.push({ section: s, kind: "normal" }));
  if (demand === "rush") {
    (["Tills", "Ladies 2/3", "Mens"] as Section[])
      .forEach((s) => slots.push({ section: s, kind: "normal" }));
  } else if (demand === "normal") {
    slots.push({ section: "Tills", kind: "normal" });
  }
  return slots;
}

function shiftFor(
  section: Section,
  dayIdx: number,
  role: Employee["role"],
  slotIdx: number,
  kind: SlotKind,
): Shift {
  const isSun = dayIdx === 6;
  // Delivery slot → 06:15 early start, regardless of role.
  if (kind === "delivery") return SHIFTS.early;
  if (isSun) return slotIdx % 2 === 0 ? SHIFTS.sunOpen : SHIFTS.sunClose;
  if (section === "Manager") return slotIdx % 2 === 0 ? SHIFTS.open : SHIFTS.midClose;
  if (section === "Supervisor") return slotIdx % 2 === 0 ? SHIFTS.early : SHIFTS.midClose;
  if (section === "Tills") return slotIdx === 0 ? SHIFTS.midOpen : SHIFTS.open;
  if (role === "Part time") return slotIdx % 2 === 0 ? SHIFTS.short : SHIFTS.close;
  if (slotIdx % 3 === 0) return SHIFTS.midOpen;
  if (slotIdx % 3 === 1) return SHIFTS.mid;
  return SHIFTS.midClose;
}

// ===== Trim to budget =====
function trimToBudget(rows: RotaRow[], employees: Employee[], weeklyBudget: number) {
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const cost = () =>
    rows.reduce((s, r) => {
      const emp = empMap.get(r.employeeId)!;
      if (emp.excludedFromBudget) return s;
      return s + r.days.reduce((a, d) => a + (d.shift?.hours ?? 0) * emp.hourlyRate, 0);
    }, 0);

  let guard = 200;
  while (cost() > weeklyBudget && guard-- > 0) {
    type Cand = { rowIdx: number; dayIdx: number; rate: number; hours: number; role: Employee["role"] };
    const cands: Cand[] = [];
    rows.forEach((r, ri) => {
      const emp = empMap.get(r.employeeId)!;
      if (emp.role === "Manager" || emp.role === "Supervisor") return;
      if (emp.excludedFromBudget) return;
      r.days.forEach((d, di) => {
        if (!d.shift || !d.section) return;
        const sameSection = rows.filter((rr) => rr.days[di].section === d.section && rr.days[di].shift).length;
        if (sameSection <= 1) return;
        cands.push({ rowIdx: ri, dayIdx: di, rate: emp.hourlyRate, hours: d.shift.hours, role: emp.role });
      });
    });
    if (!cands.length) break;
    cands.sort((a, b) => {
      if (a.role !== b.role) return a.role === "Part time" ? -1 : 1;
      return b.rate * b.hours - a.rate * a.hours;
    });
    const c = cands[0];
    rows[c.rowIdx].days[c.dayIdx] = { shift: null, section: null };
  }
}

// ===== Generation =====
export function generateRota(
  weekStartISO: string,
  employees: Employee[],
  dailyBudget: number[],
  weeklyBudget?: number,
  weekStart?: Date,
): Rota {
  const wkStart = weekStart ?? new Date(weekStartISO);
  const demand = computeDemand(wkStart, dailyBudget);

  const rows: RotaRow[] = employees.map((e) => ({
    employeeId: e.id,
    days: Array.from({ length: 7 }, () => ({ shift: null, section: null })),
    totalHours: 0,
    cost: 0,
  }));
  const rowIdx = new Map(employees.map((e, i) => [e.id, i]));
  const hoursAssigned: Record<string, number> = {};
  const sectionCount: Record<string, Record<Section, number>> = {};
  employees.forEach((e) => {
    hoursAssigned[e.id] = 0;
    sectionCount[e.id] = {} as Record<Section, number>;
  });

  const assign = (empId: string, dayIdx: number, shift: Shift, section: Section) => {
    const i = rowIdx.get(empId)!;
    rows[i].days[dayIdx] = { shift, section };
    hoursAssigned[empId] += shift.hours;
    sectionCount[empId][section] = (sectionCount[empId][section] ?? 0) + 1;
  };

  const poolFor = (section: Section): Employee["role"][] => {
    if (section === "Manager") return ["Manager"];
    if (section === "Supervisor") return ["Supervisor"];
    if (section === "Tills") return ["Part time", "Full time"];
    return ["Full time", "Part time"];
  };

  for (let d = 0; d < 7; d++) {
    const slots = requiredSlots(d, demand[d].level);
    let slotIdx = 0;

    for (const section of slots) {
      const allowedRoles = poolFor(section);
      const candidates = employees
        .filter((e) => allowedRoles.includes(e.role))
        .filter((e) => e.availability[d])
        .filter((e) => rows[rowIdx.get(e.id)!].days[d].shift === null)
        .map((e) => {
          const max = targetHours(e.role).max;
          const min = targetHours(e.role).min;
          const remTo = max - hoursAssigned[e.id];
          const gap = min - hoursAssigned[e.id];
          const pref = preferenceScore(e.name, section);          // 0..1
          const repeats = sectionCount[e.id][section] ?? 0;       // discourage overload
          const isPrefSection = preferredSections(e.name).length > 0;

          // Demand-aware experience boost: rush days favour FT/Supervisors with prefs
          const expBoost =
            demand[d].level === "rush"
              ? (e.role === "Full time" || e.role === "Supervisor" ? 0.4 : 0)
              : 0;

          // Composite score (higher = better pick)
          const lastResort = isLastResort(e.name, section) ? -1.2 : 0;
          const score =
            pref * 1.5 +
            expBoost +
            lastResort +
            (gap > 0 ? gap * 0.05 : 0) +        // fairness toward minimums
            (remTo > 0 ? 0.4 : -0.6) +          // strong penalty if at cap
            (isPrefSection ? 0 : -0.2) -        // mild penalty for cross-section
            repeats * 0.35 -                    // don't overload one section
            e.hourlyRate * 0.02;                // slight cost preference
          return { e, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((x) => x.e);

      const pick = candidates[0];
      if (!pick) continue;
      assign(pick.id, d, shiftFor(section, d, pick.role, slotIdx), section);
      slotIdx++;
    }
  }

  const budgetCap = weeklyBudget ?? 4862;
  if (budgetCap > 0) trimToBudget(rows, employees, budgetCap);

  const dailyCost = Array(7).fill(0);
  rows.forEach((r) => {
    const emp = employees.find((e) => e.id === r.employeeId)!;
    let total = 0;
    r.days.forEach((d, i) => {
      if (d.shift) {
        total += d.shift.hours;
        if (!emp.excludedFromBudget) dailyCost[i] += d.shift.hours * emp.hourlyRate;
      }
    });
    r.totalHours = total;
    r.cost = total * emp.hourlyRate;
  });

  return { weekStartISO, rows, dailyCost };
}

// ===== Coverage check (demand-aware) =====
export function checkCoverage(
  rota: Rota,
  employees: Employee[],
  dailyBudget: number[],
  weekStart?: Date,
) {
  const issues: { day: number; message: string }[] = [];
  const wkStart = weekStart ?? new Date(rota.weekStartISO);
  const demand = computeDemand(wkStart, dailyBudget);

  for (let d = 0; d < 7; d++) {
    const required = requiredSlots(d, demand[d].level);
    const filled: Record<string, number> = {};
    rota.rows.forEach((r) => {
      const a = r.days[d];
      if (a.shift && a.section) filled[a.section] = (filled[a.section] ?? 0) + 1;
    });
    const need: Record<string, number> = {};
    required.forEach((s) => (need[s] = (need[s] ?? 0) + 1));
    Object.entries(need).forEach(([sec, n]) => {
      const have = filled[sec] ?? 0;
      if (have < n) issues.push({ day: d, message: `${sec}: ${have}/${n}${demand[d].level === "rush" ? " (rush)" : ""}` });
    });
    if (d === 6) {
      employees.forEach((e) => {
        const total = rota.rows.find((r) => r.employeeId === e.id)?.totalHours ?? 0;
        const t = targetHours(e.role);
        if (total < t.min && total > 0) issues.push({ day: 6, message: `${e.name} under target (${total}/${t.min}h)` });
        if (total > t.max) issues.push({ day: 6, message: `${e.name} over cap (${total}/${t.max}h)` });
      });
    }
  }
  return issues;
}

export function suggestReplacement(
  rota: Rota,
  employees: Employee[],
  dailyBudget: number[],
  employeeId: string,
  dayIdx: number,
) {
  const row = rota.rows.find((r) => r.employeeId === employeeId);
  if (!row || !row.days[dayIdx].shift) {
    return { needed: false, replacements: [] as Employee[], costDelta: 0 };
  }
  const original = employees.find((e) => e.id === employeeId)!;
  const shift = row.days[dayIdx].shift!;
  const section = row.days[dayIdx].section ?? null;

  const simulated: Rota = {
    ...rota,
    rows: rota.rows.map((r) =>
      r.employeeId === employeeId
        ? { ...r, days: r.days.map((d, i) => (i === dayIdx ? { shift: null, section: null } : d)) }
        : r,
    ),
    dailyCost: [...rota.dailyCost],
  };
  const issues = checkCoverage(simulated, employees, dailyBudget).filter((x) => x.day === dayIdx);

  if (issues.length === 0) {
    return { needed: false, replacements: [] as Employee[], costDelta: -shift.hours * original.hourlyRate };
  }

  const allowedRoles =
    section === "Manager" ? ["Manager"]
    : section === "Supervisor" ? ["Supervisor"]
    : ["Full time", "Part time"];

  const candidates = employees
    .filter((e) =>
      e.id !== employeeId &&
      allowedRoles.includes(e.role) &&
      e.availability[dayIdx] &&
      !rota.rows.find((r) => r.employeeId === e.id)?.days[dayIdx].shift,
    )
    .sort((a, b) => {
      const pa = section ? preferenceScore(a.name, section) : 0;
      const pb = section ? preferenceScore(b.name, section) : 0;
      if (pa !== pb) return pb - pa;
      return a.hourlyRate - b.hourlyRate;
    });

  const costDelta = candidates.length
    ? (candidates[0].hourlyRate - original.hourlyRate) * shift.hours
    : 0;
  return { needed: true, replacements: candidates, costDelta };
}

export interface RebalanceSuggestion {
  status: "ok" | "warning" | "over";
  message: string;
  trim?: { employeeId: string; employeeName: string; dayIdx: number; saving: number };
}

export function suggestRebalance(
  rota: Rota,
  employees: Employee[],
  dailyBudget: number[],
  weeklyBudget: number,
): RebalanceSuggestion {
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const totalCost = rota.rows.reduce((s, r) => {
    const emp = empMap.get(r.employeeId);
    if (!emp || emp.excludedFromBudget) return s;
    return s + r.cost;
  }, 0);
  const overWeekly = totalCost > weeklyBudget;
  const overDayIdx = rota.dailyCost.findIndex((c, i) => c > dailyBudget[i] && dailyBudget[i] > 0);

  if (!overWeekly && overDayIdx === -1) {
    const pct = weeklyBudget > 0 ? (totalCost / weeklyBudget) * 100 : 0;
    return { status: "ok", message: `Within budget (${pct.toFixed(1)}% of weekly).` };
  }

  const targetDay = overDayIdx;
  type Cand = { rowIdx: number; dayIdx: number; saving: number; emp: Employee; section: Section | null };
  const cands: Cand[] = [];
  rota.rows.forEach((r, ri) => {
    const emp = empMap.get(r.employeeId)!;
    if (emp.role === "Manager" || emp.role === "Supervisor") return;
    if (emp.excludedFromBudget) return;
    r.days.forEach((d, di) => {
      if (!d.shift || !d.section) return;
      if (targetDay !== -1 && di !== targetDay) return;
      const sameSection = rota.rows.filter((rr) => rr.days[di].section === d.section && rr.days[di].shift).length;
      if (sameSection <= 1) return;
      cands.push({ rowIdx: ri, dayIdx: di, saving: d.shift.hours * emp.hourlyRate, emp, section: d.section });
    });
  });
  cands.sort((a, b) => {
    if (a.emp.role !== b.emp.role) return a.emp.role === "Part time" ? -1 : 1;
    return b.saving - a.saving;
  });

  const top = cands[0];
  const overBy = overWeekly ? totalCost - weeklyBudget : (rota.dailyCost[targetDay] - dailyBudget[targetDay]);
  const where = overWeekly ? "weekly budget" : `${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][targetDay]} budget`;
  const base = `Over ${where} by £${overBy.toFixed(0)}.`;
  if (!top) return { status: "over", message: `${base} No safe trim available — review coverage.` };
  return {
    status: "over",
    message: `${base} Suggest dropping ${top.emp.name}'s ${top.section} shift to save £${top.saving.toFixed(2)}.`,
    trim: { employeeId: top.emp.id, employeeName: top.emp.name, dayIdx: top.dayIdx, saving: top.saving },
  };
}
