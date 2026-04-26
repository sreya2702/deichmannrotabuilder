import type { Employee, Rota, RotaRow, Section, Shift } from "./types";

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

/** Compute hours between two HH:mm strings (handles same-day only). */
export function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, Math.round((mins / 60) * 4) / 4); // round to 0.25h
}

/** Recalculate totals + dailyCost on a Rota in place-style (returns new). */
export function recomputeTotals(rota: Rota, employees: Employee[]): Rota {
  const dailyCost = Array(7).fill(0);
  const rows = rota.rows.map((r) => {
    const emp = employees.find((e) => e.id === r.employeeId)!;
    let total = 0;
    r.days.forEach((d, i) => {
      if (d.shift) {
        total += d.shift.hours;
        dailyCost[i] += d.shift.hours * emp.hourlyRate;
      }
    });
    return { ...r, totalHours: total, cost: total * emp.hourlyRate };
  });
  return { ...rota, rows, dailyCost };
}


export function fmtShift(s: Shift): string {
  const a = s.start.replace(":", "");
  const b = s.end.replace(":", "");
  return `${a}-${b}`;
}

// Per-role weekly hour targets
function targetHours(role: Employee["role"]): { min: number; max: number } {
  switch (role) {
    case "Manager":    return { min: 40, max: 40 };
    case "Supervisor": return { min: 40, max: 40 };
    case "Full time":  return { min: 25, max: 30 };
    case "Part time":  return { min: 8,  max: 16 };
  }
}

// Required sections per day. Sunday: no Manager. Rush adds extra Tills (morning).
function requiredSections(dayIdx: number, isRush: boolean): Section[] {
  const isSun = dayIdx === 6;
  const base: Section[] = isSun
    ? ["Supervisor", "Ladies 1", "Ladies 2/3", "Mens", "Kids", "Tills"]
    : ["Manager", "Supervisor", "Ladies 1", "Ladies 2/3", "Mens", "Kids", "Tills"];
  if (isRush) base.push("Tills"); // extra till in rush
  return base;
}

// Pick a shift based on section + day + employee role
function shiftFor(section: Section, dayIdx: number, role: Employee["role"], slotIdx: number): Shift {
  const isSun = dayIdx === 6;
  if (isSun) return slotIdx % 2 === 0 ? SHIFTS.sunOpen : SHIFTS.sunClose;

  if (section === "Manager") return slotIdx % 2 === 0 ? SHIFTS.open : SHIFTS.midClose;
  if (section === "Supervisor") {
    // Supervisor handles close, can also do early
    return slotIdx % 2 === 0 ? SHIFTS.early : SHIFTS.midClose;
  }
  if (section === "Tills") {
    // Tills extra in rush = morning
    return slotIdx === 0 ? SHIFTS.midOpen : SHIFTS.open;
  }
  // Floor sections
  if (role === "Part time") return slotIdx % 2 === 0 ? SHIFTS.short : SHIFTS.close;
  if (slotIdx % 3 === 0) return SHIFTS.midOpen;
  if (slotIdx % 3 === 1) return SHIFTS.mid;
  return SHIFTS.midClose;
}

// Determine rush days from this week's daily budgets. A day is rush if its
// budget is >= average + 15%, OR it's a weekend (Sat=5, Sun=6).
function detectRush(dailyBudget: number[]): boolean[] {
  const valid = dailyBudget.filter((v) => v > 0);
  const avg = valid.length ? valid.reduce((s, n) => s + n, 0) / valid.length : 0;
  const threshold = avg * 1.15;
  return dailyBudget.map((v, i) => i >= 5 || v >= threshold);
}

interface AssignState {
  hoursAssigned: Record<string, number>;
}

/**
 * Trim hours from the rota to fit within the weekly budget.
 * Strategy: while over budget, find the most expensive *non-essential* shift
 * (Part time first, then Full time, never Manager/Supervisor in their core
 * single-coverage slots) and remove it. Stops when within budget or no
 * further trims possible without breaking coverage.
 */
function trimToBudget(
  rows: RotaRow[],
  employees: Employee[],
  weeklyBudget: number,
): { rows: RotaRow[]; trimmed: number } {
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const cost = () =>
    rows.reduce((s, r) => {
      const rate = empMap.get(r.employeeId)!.hourlyRate;
      return s + r.days.reduce((a, d) => a + (d.shift?.hours ?? 0) * rate, 0);
    }, 0);

  let trimmed = 0;
  let guard = 200;
  while (cost() > weeklyBudget && guard-- > 0) {
    // Build candidate list of removable shifts (PT > FT, never Mgr/Sup, never single-coverage of a section)
    type Cand = { rowIdx: number; dayIdx: number; rate: number; hours: number; role: Employee["role"] };
    const cands: Cand[] = [];
    rows.forEach((r, ri) => {
      const emp = empMap.get(r.employeeId)!;
      if (emp.role === "Manager" || emp.role === "Supervisor") return;
      r.days.forEach((d, di) => {
        if (!d.shift || !d.section) return;
        // Don't strip a section that this employee is the only one covering on that day
        const sameSection = rows.filter(
          (rr) => rr.days[di].section === d.section && rr.days[di].shift,
        ).length;
        if (sameSection <= 1) return;
        cands.push({ rowIdx: ri, dayIdx: di, rate: emp.hourlyRate, hours: d.shift.hours, role: emp.role });
      });
    });
    if (cands.length === 0) break;
    // Prefer Part time, then highest cost-per-shift
    cands.sort((a, b) => {
      if (a.role !== b.role) return a.role === "Part time" ? -1 : 1;
      return b.rate * b.hours - a.rate * a.hours;
    });
    const c = cands[0];
    rows[c.rowIdx].days[c.dayIdx] = { shift: null, section: null };
    trimmed++;
  }
  return { rows, trimmed };
}

export function generateRota(
  weekStartISO: string,
  employees: Employee[],
  dailyBudget: number[],
  weeklyBudget?: number,
): Rota {
  const rows: RotaRow[] = employees.map((e) => ({
    employeeId: e.id,
    days: Array.from({ length: 7 }, () => ({ shift: null, section: null })),
    totalHours: 0,
    cost: 0,
  }));
  const rowIdx = new Map(employees.map((e, i) => [e.id, i]));
  const state: AssignState = { hoursAssigned: {} };
  employees.forEach((e) => (state.hoursAssigned[e.id] = 0));

  const rush = detectRush(dailyBudget);

  const assign = (empId: string, dayIdx: number, shift: Shift, section: Section) => {
    const i = rowIdx.get(empId)!;
    rows[i].days[dayIdx] = { shift, section };
    state.hoursAssigned[empId] += shift.hours;
  };

  // Eligibility: matches role pool for a section
  const poolFor = (section: Section): Employee["role"][] => {
    if (section === "Manager") return ["Manager"];
    if (section === "Supervisor") return ["Supervisor"];
    if (section === "Tills") return ["Part time", "Full time"];
    return ["Full time", "Part time"]; // floor sections
  };

  for (let d = 0; d < 7; d++) {
    const sections = requiredSections(d, rush[d]);
    let slotIdx = 0;

    for (const section of sections) {
      const allowedRoles = poolFor(section);
      const candidates = employees
        .filter((e) => allowedRoles.includes(e.role))
        .filter((e) => e.availability[d])
        .filter((e) => rows[rowIdx.get(e.id)!].days[d].shift === null) // not yet assigned today
        .sort((a, b) => {
          // 1) under their max → preferred
          const maxA = targetHours(a.role).max;
          const maxB = targetHours(b.role).max;
          const remA = maxA - state.hoursAssigned[a.id];
          const remB = maxB - state.hoursAssigned[b.id];
          const aUnder = remA > 0;
          const bUnder = remB > 0;
          if (aUnder !== bUnder) return aUnder ? -1 : 1;
          // 2) those further from their MIN target first (fairness)
          const minA = targetHours(a.role).min;
          const minB = targetHours(b.role).min;
          const gapA = minA - state.hoursAssigned[a.id];
          const gapB = minB - state.hoursAssigned[b.id];
          if (gapA !== gapB) return gapB - gapA;
          // 3) cheapest
          return a.hourlyRate - b.hourlyRate;
        });

      const pick = candidates[0];
      if (!pick) continue; // leave gap → coverage check will flag it
      assign(pick.id, d, shiftFor(section, d, pick.role, slotIdx), section);
      slotIdx++;
    }
  }

  // Budget-aware trim: if a weekly budget cap was supplied, drop the most
  // expensive non-essential PT/FT shifts until we fit under it.
  const budgetCap = weeklyBudget ?? dailyBudget.reduce((s, n) => s + n, 0) * 0.12; // default 12% labour cost
  if (budgetCap > 0) trimToBudget(rows, employees, budgetCap);

  // Totals
  const dailyCost = Array(7).fill(0);
  rows.forEach((r) => {
    const emp = employees.find((e) => e.id === r.employeeId)!;
    let total = 0;
    r.days.forEach((d, i) => {
      if (d.shift) {
        total += d.shift.hours;
        dailyCost[i] += d.shift.hours * emp.hourlyRate;
      }
    });
    r.totalHours = total;
    r.cost = total * emp.hourlyRate;
  });

  return { weekStartISO, rows, dailyCost };
}

export function checkCoverage(
  rota: Rota,
  employees: Employee[],
  dailyBudget: number[],
) {
  const issues: { day: number; message: string }[] = [];
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const rush = detectRush(dailyBudget);

  for (let d = 0; d < 7; d++) {
    const required = requiredSections(d, rush[d]);
    // Count per section
    const filled: Record<string, number> = {};
    rota.rows.forEach((r) => {
      const a = r.days[d];
      if (a.shift && a.section) {
        filled[a.section] = (filled[a.section] ?? 0) + 1;
      }
    });
    const need: Record<string, number> = {};
    required.forEach((s) => (need[s] = (need[s] ?? 0) + 1));
    Object.entries(need).forEach(([sec, n]) => {
      const have = filled[sec] ?? 0;
      if (have < n) {
        issues.push({ day: d, message: `${sec}: ${have}/${n}` });
      }
    });

    // Hour band warnings (weekly, only flagged once on Sun)
    if (d === 6) {
      employees.forEach((e) => {
        const total = rota.rows.find((r) => r.employeeId === e.id)?.totalHours ?? 0;
        const t = targetHours(e.role);
        if (total < t.min && total > 0) {
          issues.push({ day: 6, message: `${e.name} under target (${total}/${t.min}h)` });
        }
        if (total > t.max) {
          issues.push({ day: 6, message: `${e.name} over cap (${total}/${t.max}h)` });
        }
      });
    }
    void empMap;
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

  // Simulate removal
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
    return {
      needed: false,
      replacements: [] as Employee[],
      costDelta: -shift.hours * original.hourlyRate,
    };
  }

  // Eligible replacements: same section pool, available, not already on shift this day
  const allowedRoles =
    section === "Manager" ? ["Manager"]
    : section === "Supervisor" ? ["Supervisor"]
    : ["Full time", "Part time"];

  const candidates = employees
    .filter(
      (e) =>
        e.id !== employeeId &&
        allowedRoles.includes(e.role) &&
        e.availability[dayIdx] &&
        !rota.rows.find((r) => r.employeeId === e.id)?.days[dayIdx].shift,
    )
    .sort((a, b) => a.hourlyRate - b.hourlyRate);

  const costDelta = candidates.length
    ? (candidates[0].hourlyRate - original.hourlyRate) * shift.hours
    : 0;
  return { needed: true, replacements: candidates, costDelta };
}

/**
 * After a manual edit, look at where the rota stands vs daily/weekly budget
 * and suggest a single concrete trim if over budget.
 */
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
  const totalCost = rota.rows.reduce((s, r) => s + r.cost, 0);
  const overWeekly = totalCost > weeklyBudget;
  const overDayIdx = rota.dailyCost.findIndex((c, i) => c > dailyBudget[i] && dailyBudget[i] > 0);

  if (!overWeekly && overDayIdx === -1) {
    const pct = weeklyBudget > 0 ? (totalCost / weeklyBudget) * 100 : 0;
    return { status: "ok", message: `Within budget (${pct.toFixed(1)}% of weekly).` };
  }

  // Find best candidate to trim — PT first, highest cost shift on the offending day if any.
  const targetDay = overDayIdx;
  type Cand = { rowIdx: number; dayIdx: number; saving: number; emp: Employee; section: Section | null };
  const cands: Cand[] = [];
  rota.rows.forEach((r, ri) => {
    const emp = empMap.get(r.employeeId)!;
    if (emp.role === "Manager" || emp.role === "Supervisor") return;
    r.days.forEach((d, di) => {
      if (!d.shift || !d.section) return;
      if (targetDay !== -1 && di !== targetDay) return;
      const sameSection = rota.rows.filter(
        (rr) => rr.days[di].section === d.section && rr.days[di].shift,
      ).length;
      if (sameSection <= 1) return;
      cands.push({
        rowIdx: ri,
        dayIdx: di,
        saving: d.shift.hours * emp.hourlyRate,
        emp,
        section: d.section,
      });
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
