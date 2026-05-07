import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import type { Employee, Rota } from "./types";

// Real Deichmann team — availability Mon..Sun from uploaded sheet.
// Hourly rates (manager-confirmed):
//  - Supervisors: £14.21
//  - Full time / Part time (24+): £13.21
//  - Under-24 part timers (Yusuf, Janah): £11.35
//  - Managers: excluded from labour budget
//  - Sneha, TJ, Nelima: also excluded from labour budget
const SEED_EMPLOYEES: Employee[] = [
  { id: "e1",  name: "Cad",      role: "Manager",    contractedHours: 40, hourlyRate: 15.00, availability: [true,  true,  true,  false, true,  true,  false], excludedFromBudget: true },
  { id: "e2",  name: "Sintija",  role: "Manager",    contractedHours: 40, hourlyRate: 15.00, availability: [false, false, true,  true,  true,  true,  false], excludedFromBudget: true },
  { id: "e3",  name: "Cyprian",  role: "Supervisor", contractedHours: 40, hourlyRate: 14.21, availability: [true,  true,  false, true,  true,  false, true ] },
  { id: "e4",  name: "Mary",     role: "Supervisor", contractedHours: 40, hourlyRate: 14.21, availability: [true,  true,  false, true,  false, true,  false] },
  { id: "e5",  name: "Nelima",   role: "Supervisor", contractedHours: 40, hourlyRate: 14.21, availability: [true,  true,  false, true,  true,  true,  false], excludedFromBudget: true },
  { id: "e6",  name: "Aaron",    role: "Part time",  contractedHours: 16, hourlyRate: 13.21, availability: [false, false, false, true,  true,  false, false] },
  { id: "e7",  name: "Patrick",  role: "Part time",  contractedHours: 16, hourlyRate: 13.21, availability: [false, false, true,  true,  false, true,  false] },
  { id: "e8",  name: "Cara",     role: "Part time",  contractedHours: 16, hourlyRate: 13.21, availability: [true,  true,  false, false, true,  false, false] },
  { id: "e9",  name: "Gisela",   role: "Part time",  contractedHours: 16, hourlyRate: 13.21, availability: [true,  false, true,  false, false, true,  false] },
  { id: "e10", name: "Saeed",    role: "Full time",  contractedHours: 30, hourlyRate: 13.21, availability: [false, false, true,  true,  true,  true,  true ] },
  { id: "e11", name: "Tanzila",  role: "Full time",  contractedHours: 30, hourlyRate: 13.21, availability: [true,  true,  true,  false, true,  true,  false] },
  { id: "e12", name: "Krisha",   role: "Full time",  contractedHours: 30, hourlyRate: 13.21, availability: [true,  true,  true,  true,  false, false, true ] },
  { id: "e13", name: "Roshni",   role: "Full time",  contractedHours: 30, hourlyRate: 13.21, availability: [false, false, false, true,  true,  false, false] },
  { id: "e14", name: "Faiza",    role: "Part time",  contractedHours: 16, hourlyRate: 13.21, availability: [false, true,  false, false, false, true,  true ] },
  { id: "e15", name: "Anwar",    role: "Part time",  contractedHours: 16, hourlyRate: 13.21, availability: [true,  true,  false, false, false, false, true ] },
  { id: "e16", name: "Gilda",    role: "Part time",  contractedHours: 16, hourlyRate: 13.21, availability: [false, false, false, true,  true,  true,  true ] },
  { id: "e17", name: "Iga",      role: "Full time",  contractedHours: 30, hourlyRate: 13.21, availability: [true,  true,  false, true,  false, true,  true ] },
  { id: "e18", name: "Sreya",    role: "Full time",  contractedHours: 30, hourlyRate: 13.21, availability: [true,  false, true,  false, true,  true,  true ] },
  { id: "e19", name: "Somya",    role: "Part time",  contractedHours: 16, hourlyRate: 13.21, availability: [false, true,  true,  false, true,  true,  true ] },
  { id: "e20", name: "Eventas",  role: "Part time",  contractedHours: 16, hourlyRate: 13.21, availability: [true,  false, false, true,  false, false, false] },
  { id: "e21", name: "Yusuf",    role: "Part time",  contractedHours: 16, hourlyRate: 11.35, availability: [false, false, true,  false, true,  true,  false] },
  { id: "e22", name: "Janah",    role: "Part time",  contractedHours: 16, hourlyRate: 11.35, availability: [false, true,  true,  false, true,  true,  true ] },
  { id: "e23", name: "Sneha",    role: "Full time",  contractedHours: 30, hourlyRate: 13.21, availability: [true,  true,  true,  true,  true,  false, false], excludedFromBudget: true },
  { id: "e24", name: "TJ",       role: "Full time",  contractedHours: 30, hourlyRate: 13.21, availability: [true,  true,  true,  true,  true,  false, false], excludedFromBudget: true },
];

interface BudgetCfg {
  yearly: number;
  weekly: number;
  daily: number[]; // 7
}

// 26-week sales plan from the uploaded sheet.
// Stored as date -> daily budget. Week label mapped per range.
// Date format: yyyy-mm-dd
type DailyBudgetMap = Record<string, number>;

const SALES_PLAN_RAW: Array<{ label: string; start: string; daily: number[] }> = [
  { label: "Week 1",  start: "2026-01-01", daily: [13005, 11703, 12433, 15116, 10767] },
  { label: "Week 2",  start: "2026-01-06", daily: [11407, 10166, 10674, 8229, 7867, 16532, 8609] },
  { label: "Week 3",  start: "2026-01-13", daily: [8525, 8077, 7638, 7952, 9545, 15654, 6925] },
  { label: "Week 4",  start: "2026-01-20", daily: [7567, 7096, 6573, 7766, 10017, 14747, 9344] },
  { label: "Week 5",  start: "2026-01-27", daily: [7810, 7312, 8041, 7697, 8043, 12899, 7998] },
  { label: "Week 6",  start: "2026-02-03", daily: [7916, 7758, 8406, 8293, 8700, 12572, 9203] },
  { label: "Week 7",  start: "2026-02-10", daily: [9310, 10710, 8773, 8488, 9064, 14112, 8416] },
  { label: "Week 8",  start: "2026-02-17", daily: [9784, 7813, 7576, 9493, 9340, 14706, 9625] },
  { label: "Week 9",  start: "2026-02-24", daily: [8431, 7318, 6315, 8857, 9267, 18261, 9827] },
  { label: "Week 10", start: "2026-03-03", daily: [9102, 8808, 8945, 8852, 9323, 15777, 7661] },
  { label: "Week 11", start: "2026-03-10", daily: [6412, 7114, 6836, 7235, 7646, 15934, 8367] },
  { label: "Week 12", start: "2026-03-17", daily: [9328, 7987, 6981, 8356, 8163, 15664, 10577] },
  { label: "Week 13", start: "2026-03-24", daily: [11363, 10950, 9813, 12372, 17075, 20124, 0] },
  { label: "Week 14", start: "2026-03-31", daily: [19883, 17228, 13783, 13682, 14786, 22856, 13675] },
  { label: "Week 15", start: "2026-04-07", daily: [15906, 14951, 10931, 12219, 15699, 18635, 9951] },
  { label: "Week 16", start: "2026-04-14", daily: [11897, 10585, 8693, 9650, 11130, 19927, 10700] },
  { label: "Week 17", start: "2026-04-21", daily: [11331, 10136, 9215, 8689, 12813, 16933, 12023] },
  { label: "Week 18", start: "2026-04-28", daily: [9031, 10036, 9583, 10889, 11604, 18090, 11958] },
  { label: "Week 19", start: "2026-05-05", daily: [16939, 10064, 8696, 11598, 15416, 22277, 13048] },
  { label: "Week 20", start: "2026-05-12", daily: [13840, 13808, 11856, 11966, 14087, 21900, 13132] },
  { label: "Week 21", start: "2026-05-19", daily: [14156, 10645, 13131, 12198, 14331, 21071, 12059] },
  { label: "Week 22", start: "2026-05-26", daily: [19956, 12636, 13887, 14689, 15812, 19376, 13673] },
  { label: "Week 23", start: "2026-06-02", daily: [16328, 17792, 13926, 13145, 16045, 22988, 13825] },
  { label: "Week 24", start: "2026-06-09", daily: [12974, 13880, 12759, 13886, 13739, 21398, 10567] },
  { label: "Week 25", start: "2026-06-16", daily: [13553, 13409, 13422, 12225, 16466, 21250, 13720] },
  { label: "Week 26", start: "2026-06-23", daily: [16329, 16560, 16132, 14098, 16302, 24830, 14357] },
];

function buildSalesMap(): DailyBudgetMap {
  const map: DailyBudgetMap = {};
  for (const blk of SALES_PLAN_RAW) {
    const start = parseISO(blk.start);
    blk.daily.forEach((v, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      map[format(d, "yyyy-MM-dd")] = v;
    });
  }
  return map;
}

const SALES_MAP: DailyBudgetMap = buildSalesMap();

// Fixed weekly LABOUR budget (scheduled cost cap). Sales plan = revenue target,
// not labour budget. Manager confirmed: £4,862 / week labour cap.
export const WEEKLY_LABOUR_BUDGET = 4862;

// Default fallback (used when picked week is outside the sales plan window)
const DEFAULT_BUDGET: BudgetCfg = {
  yearly: WEEKLY_LABOUR_BUDGET * 52,
  weekly: WEEKLY_LABOUR_BUDGET,
  daily: [600, 600, 600, 700, 800, 850, 712], // ~ proportional, sums to 4862
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

let _employees: Employee[] | null = null;
let _budget: BudgetCfg | null = null;
let _rota: Rota | null = null;

function ensure() {
  if (_employees === null) _employees = load("rota.employees.v3", SEED_EMPLOYEES);
  if (_budget === null) _budget = load("rota.budget", DEFAULT_BUDGET);
  if (_rota === null) _rota = load<Rota | null>("rota.current.v2", null);
}

export function getEmployees(): Employee[] {
  ensure();
  return _employees!;
}
export function setEmployees(next: Employee[]) {
  _employees = next;
  save("rota.employees.v3", next);
  emit();
}
export function getBudget(): BudgetCfg {
  ensure();
  return _budget!;
}
export function setBudget(next: BudgetCfg) {
  _budget = next;
  save("rota.budget", next);
  emit();
}
export function getRota(): Rota | null {
  ensure();
  return _rota;
}
export function setRota(next: Rota | null) {
  _rota = next;
  save("rota.current.v2", next);
  emit();
}

/**
 * For a given Monday, return:
 *  - dailySales: the sales TARGETS for each day (Mon..Sun) from the 26-week plan
 *  - weeklySales: implied weekly sales target
 *  - daily: the LABOUR budget per day (£4,862 split proportionally to sales)
 *  - weekly: the fixed labour budget cap (£4,862)
 *  - label / inPlan: which sales-plan weeks the range covers
 */
export function getBudgetForWeek(monday: Date): {
  daily: number[];
  weekly: number;
  dailySales: number[];
  weeklySales: number;
  label: string;
  inPlan: boolean;
} {
  const dailySales: number[] = [];
  let inPlan = false;
  const labels = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = format(d, "yyyy-MM-dd");
    const v = SALES_MAP[key];
    if (v !== undefined) {
      dailySales.push(v);
      inPlan = true;
      for (const blk of SALES_PLAN_RAW) {
        const start = parseISO(blk.start);
        const end = new Date(start);
        end.setDate(start.getDate() + blk.daily.length - 1);
        if (d >= start && d <= end) {
          labels.add(blk.label);
          break;
        }
      }
    } else {
      dailySales.push(0);
    }
  }
  const weeklySales = dailySales.reduce((s, n) => s + n, 0);
  const weekly = WEEKLY_LABOUR_BUDGET;
  // Split labour budget across days proportional to sales targets.
  // Fallback: even split if no sales data for that week.
  const daily = weeklySales > 0
    ? dailySales.map((v) => Math.round((v / weeklySales) * weekly))
    : Array(7).fill(Math.round(weekly / 7));
  const label = labels.size ? Array.from(labels).join(" / ") : "Outside sales plan";
  return { daily, weekly, dailySales, weeklySales, label, inPlan };
}

export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return {
    employees: getEmployees(),
    budget: getBudget(),
    rota: getRota(),
  };
}
