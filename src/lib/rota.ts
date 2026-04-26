import type { Employee, Rota, RotaRow, Shift } from "./types";

const SHIFT_TEMPLATES: Shift[] = [
  { start: "07:00", end: "16:00", hours: 9 },
  { start: "09:00", end: "17:30", hours: 8.5 },
  { start: "10:00", end: "18:00", hours: 8 },
  { start: "12:30", end: "21:30", hours: 9 },
  { start: "16:00", end: "21:30", hours: 5.5 },
];
const SHORT_SHIFT: Shift = { start: "10:00", end: "16:00", hours: 6 };

export function fmtShift(s: Shift): string {
  const a = s.start.replace(":", "");
  const b = s.end.replace(":", "");
  return `${a}-${b}`;
}

interface Requirement {
  managers: number; // min managers
  supervisors: number;
  general: number; // min general staff
}

function dailyRequirement(dayIdx: number): Requirement {
  // Sun has no Manager required
  const isSun = dayIdx === 6;
  const isWeekend = dayIdx >= 5;
  return {
    managers: isSun ? 0 : 1,
    supervisors: 1,
    general: isWeekend ? 4 : 3,
  };
}

interface WorkState {
  hoursAssigned: Record<string, number>;
}

function pickShift(dayIdx: number, employee: Employee, slot: "open" | "close" | "mid"): Shift {
  // Map: managers/supervisors prefer mid/open, evening => close
  if (slot === "open") return SHIFT_TEMPLATES[1]; // 09:00-17:30
  if (slot === "close") return SHIFT_TEMPLATES[3]; // 12:30-21:30
  if (employee.contractedHours <= 20) return SHORT_SHIFT;
  return SHIFT_TEMPLATES[2]; // 10:00-18:00
}

export function generateRota(weekStartISO: string, employees: Employee[]): Rota {
  const rows: RotaRow[] = employees.map((e) => ({
    employeeId: e.id,
    days: Array.from({ length: 7 }, () => ({ shift: null })),
    totalHours: 0,
    cost: 0,
  }));
  const state: WorkState = { hoursAssigned: {} };
  employees.forEach((e) => (state.hoursAssigned[e.id] = 0));

  // helper to assign
  const assign = (empIdx: number, dayIdx: number, shift: Shift) => {
    rows[empIdx].days[dayIdx] = { shift };
    state.hoursAssigned[employees[empIdx].id] += shift.hours;
  };

  // For each day, fill required roles using cheapest-first that still has available contracted hours left.
  for (let d = 0; d < 7; d++) {
    const req = dailyRequirement(d);

    const candidates = (predicate: (e: Employee) => boolean) =>
      employees
        .map((e, i) => ({ e, i }))
        .filter(({ e, i }) => predicate(e) && e.availability[d] && rows[i].days[d].shift === null)
        .sort((a, b) => {
          // prefer those with remaining contracted hours; then cheapest
          const remA = a.e.contractedHours - state.hoursAssigned[a.e.id];
          const remB = b.e.contractedHours - state.hoursAssigned[b.e.id];
          if ((remA > 0) !== (remB > 0)) return remA > 0 ? -1 : 1;
          return a.e.hourlyRate - b.e.hourlyRate;
        });

    // managers - prefer open slot
    let needed = req.managers;
    for (const { e, i } of candidates((x) => x.role === "Manager")) {
      if (needed <= 0) break;
      assign(i, d, pickShift(d, e, "open"));
      needed--;
    }
    // supervisors - cover close
    needed = req.supervisors;
    for (const { e, i } of candidates((x) => x.role === "Supervisor")) {
      if (needed <= 0) break;
      const slot = i % 2 === 0 ? "close" : "open";
      assign(i, d, pickShift(d, e, slot));
      needed--;
    }
    // general - mix open/close/mid
    needed = req.general;
    let toggle = 0;
    for (const { e, i } of candidates(
      (x) => x.role === "Full time" || x.role === "Part time",
    )) {
      if (needed <= 0) break;
      const slot = toggle % 3 === 0 ? "open" : toggle % 3 === 1 ? "close" : "mid";
      assign(i, d, pickShift(d, e, slot as "open" | "close" | "mid"));
      toggle++;
      needed--;
    }
  }

  // totals
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

export function checkCoverage(rota: Rota, employees: Employee[]) {
  const issues: { day: number; message: string }[] = [];
  for (let d = 0; d < 7; d++) {
    const onShift = rota.rows.filter((r) => r.days[d].shift);
    const empMap = (id: string) => employees.find((e) => e.id === id)!;
    const managers = onShift.filter((r) => empMap(r.employeeId).role === "Manager").length;
    const supervisors = onShift.filter((r) => empMap(r.employeeId).role === "Supervisor").length;
    const general = onShift.filter((r) => {
      const role = empMap(r.employeeId).role;
      return role === "Full time" || role === "Part time";
    }).length;
    const req = dailyRequirement(d);
    if (managers < req.managers) issues.push({ day: d, message: `Need ${req.managers} Manager` });
    if (supervisors < req.supervisors) issues.push({ day: d, message: `Need ${req.supervisors} Supervisor` });
    if (general < req.general) issues.push({ day: d, message: `Need ${req.general} general staff` });
  }
  return issues;
}

export function suggestReplacement(
  rota: Rota,
  employees: Employee[],
  employeeId: string,
  dayIdx: number,
) {
  const row = rota.rows.find((r) => r.employeeId === employeeId);
  if (!row || !row.days[dayIdx].shift) {
    return { needed: false, replacements: [] as Employee[], costDelta: 0 };
  }
  const original = employees.find((e) => e.id === employeeId)!;
  const shift = row.days[dayIdx].shift!;

  // Simulate removal — does coverage still hold?
  const simulated: Rota = {
    ...rota,
    rows: rota.rows.map((r) =>
      r.employeeId === employeeId
        ? { ...r, days: r.days.map((d, i) => (i === dayIdx ? { shift: null } : d)) }
        : r,
    ),
    dailyCost: [...rota.dailyCost],
  };
  const issues = checkCoverage(simulated, employees).filter((x) => x.day === dayIdx);

  if (issues.length === 0) {
    return { needed: false, replacements: [] as Employee[], costDelta: -shift.hours * original.hourlyRate };
  }

  const candidates = employees
    .filter(
      (e) =>
        e.id !== employeeId &&
        e.role === original.role &&
        e.availability[dayIdx] &&
        !rota.rows.find((r) => r.employeeId === e.id)?.days[dayIdx].shift,
    )
    .sort((a, b) => a.hourlyRate - b.hourlyRate);

  const costDelta = candidates.length
    ? (candidates[0].hourlyRate - original.hourlyRate) * shift.hours
    : 0;
  return { needed: true, replacements: candidates, costDelta };
}
