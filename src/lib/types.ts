export type Role = "Manager" | "Supervisor" | "Full time" | "Part time";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export const SECTIONS = [
  "Manager",
  "Supervisor",
  "Ladies 1",
  "Ladies 2/3",
  "Mens",
  "Kids",
  "Tills",
] as const;
export type Section = (typeof SECTIONS)[number];

export interface Employee {
  id: string;
  name: string;
  role: Role;
  contractedHours: number;
  hourlyRate: number;
  // availability per day index 0..6 (Mon..Sun)
  availability: boolean[];
  // If true, this employee's labour cost is excluded from the weekly/daily
  // budget tracker (e.g. Managers and named off-budget headcount).
  excludedFromBudget?: boolean;
}

export interface Shift {
  start: string; // "HH:mm"
  end: string;
  hours: number;
}

export interface DayAssignment {
  shift: Shift | null;
  section?: Section | null;
}

export interface RotaRow {
  employeeId: string;
  days: DayAssignment[]; // length 7
  totalHours: number;
  cost: number;
}

export interface Rota {
  weekStartISO: string;
  rows: RotaRow[];
  dailyCost: number[];
}

// A week in the imported sales plan (Mon..Sun aligned)
export interface SalesPlanWeek {
  // ISO date (yyyy-mm-dd) of the Monday that starts this week
  weekStartISO: string;
  label: string; // e.g. "Week 1"
  daily: number[]; // 7 numbers
  weekly: number; // sum / planned
}
