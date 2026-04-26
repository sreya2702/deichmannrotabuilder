import { useEffect, useState } from "react";
import type { Employee, Rota } from "./types";

const SEED_EMPLOYEES: Employee[] = [
  { id: "e1", name: "Marcus Vane", role: "Manager", contractedHours: 40, hourlyRate: 22, availability: [true, true, true, true, true, true, false] },
  { id: "e2", name: "Sarah Chen", role: "Supervisor", contractedHours: 37.5, hourlyRate: 18.5, availability: [true, true, true, false, false, true, true] },
  { id: "e3", name: "Elena Rossi", role: "Supervisor", contractedHours: 37.5, hourlyRate: 17.8, availability: [true, true, true, true, true, false, true] },
  { id: "e4", name: "Julian Gray", role: "Full time", contractedHours: 40, hourlyRate: 14.5, availability: [true, true, true, true, true, true, true] },
  { id: "e5", name: "Lena Volkov", role: "Part time", contractedHours: 20, hourlyRate: 12.5, availability: [false, false, true, true, true, true, true] },
  { id: "e6", name: "Theo West", role: "Full time", contractedHours: 40, hourlyRate: 13.8, availability: [true, true, true, true, true, true, false] },
  { id: "e7", name: "Sia Melina", role: "Part time", contractedHours: 16, hourlyRate: 11.8, availability: [false, true, true, false, true, true, true] },
  { id: "e8", name: "Owen Pike", role: "Full time", contractedHours: 40, hourlyRate: 13.2, availability: [true, true, false, true, true, true, true] },
];

interface BudgetCfg {
  yearly: number;
  weekly: number;
  daily: number[]; // 7
}

const DEFAULT_BUDGET: BudgetCfg = {
  yearly: 14250 * 52,
  weekly: 14250,
  daily: [1850, 1850, 1850, 2100, 2400, 2200, 2000],
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
  if (_employees === null) _employees = load("rota.employees", SEED_EMPLOYEES);
  if (_budget === null) _budget = load("rota.budget", DEFAULT_BUDGET);
  if (_rota === null) _rota = load<Rota | null>("rota.current", null);
}

export function getEmployees(): Employee[] {
  ensure();
  return _employees!;
}
export function setEmployees(next: Employee[]) {
  _employees = next;
  save("rota.employees", next);
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
  save("rota.current", next);
  emit();
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
