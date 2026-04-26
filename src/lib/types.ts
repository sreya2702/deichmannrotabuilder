export type Role = "Manager" | "Supervisor" | "Full time" | "Part time";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export interface Employee {
  id: string;
  name: string;
  role: Role;
  contractedHours: number;
  hourlyRate: number;
  // availability per day index 0..6 (Mon..Sun)
  availability: boolean[];
}

export interface Shift {
  start: string; // "HH:mm"
  end: string;
  hours: number;
}

export interface DayAssignment {
  shift: Shift | null;
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
