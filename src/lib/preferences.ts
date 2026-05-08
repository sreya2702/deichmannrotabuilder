import type { Section } from "./types";

// Manager-defined section preferences (lowercase name → ranked sections).
// Earlier in array = stronger preference. Aliases handled in resolve().
// Note: "Delivery" and "Bags & accessories" don't exist as Section enum values.
//   Delivery → handled separately via deliveryRank() (early shift, Ladies 1).
//   Bags & accessories → mapped to Ladies 2/3 (Cara, Sintija, Iga).
const RAW: Record<string, Section[]> = {
  // Managers
  cad:      ["Manager", "Ladies 1"],            // delivery only as last-resort
  sintija:  ["Manager", "Ladies 2/3"],          // also Bags & accessories

  // Supervisors
  cyprian:  ["Supervisor", "Ladies 1"],         // primary delivery lead
  mary:     ["Supervisor", "Ladies 1"],
  nelima:   ["Supervisor"],

  // Bags & accessories → Ladies 2/3
  cara:     ["Ladies 2/3", "Tills"],
  iga:      ["Ladies 2/3"],

  // Ladies 1 floor
  anwar:    ["Ladies 1"],
  saeed:    ["Ladies 1", "Mens"],               // also delivery + mens stock

  // Ladies 2/3 floor (Sneha, Iga, Gisela, Gilda, Sreya, Somya)
  sneha:    ["Ladies 2/3"],
  gisela:   ["Ladies 2/3"],
  gilda:    ["Ladies 2/3"],
  somya:    ["Ladies 2/3", "Tills"],

  // Sreya — all-rounder, top of Kids/Mens, also Ladies 2/3 + Tills
  sreya:    ["Kids", "Mens", "Ladies 2/3", "Tills"],

  // Kids (Sreya, Faiza, Krisha top; Janah learning/PT)
  faiza:    ["Kids"],
  krisha:   ["Kids", "Tills"],
  janah:    ["Kids"],                           // learning + part time

  // Mens (Sreya, Saeed, Akash, Yusuf, Ashish)
  yusuf:    ["Mens"],
  akash:    ["Mens"],
  ashish:   ["Mens", "Ladies 1"],               // slower per customer → after Yusuf

  // Tills (Tanzila, Krisha, Eventas, Somya, Roshni)
  tanzila:  ["Tills"],
  eventas:  ["Tills"],
  roshni:   ["Tills"],

  // Stock replenishment helpers (no dedicated section → floor fallback)
  aaron:    ["Ladies 1"],                       // delivery + Ladies 1 fill
  patrick:  ["Ladies 1", "Ladies 2/3"],         // delivery + Ladies 2/3 fill
  tj:       ["Ladies 2/3"],
};

const ALIASES: Record<string, string> = {
  jannah: "janah",
  neelima: "nelima",
  sesha: "sreya",
};

function key(name: string): string {
  const k = name.trim().toLowerCase();
  return ALIASES[k] ?? k;
}

export function preferredSections(name: string): Section[] {
  return RAW[key(name)] ?? [];
}

/** Score 0..1 for how strongly an employee prefers a section. 0 = no preference. */
export function preferenceScore(name: string, section: Section): number {
  const list = preferredSections(name);
  const idx = list.indexOf(section);
  if (idx === -1) return 0;
  return 1 - idx * 0.15;
}

/**
 * Ranked delivery-team list (lower index = preferred for the early/delivery slot).
 * Cad only as fallback when Cyprian is off (last position).
 */
const DELIVERY_ORDER = [
  "cyprian", "aaron", "patrick", "ashish", "saeed", "mary", "cad",
];
export function deliveryRank(name: string): number {
  const i = DELIVERY_ORDER.indexOf(key(name));
  return i === -1 ? 99 : i;
}
export function isDeliveryTeam(name: string): boolean {
  return deliveryRank(name) < 99;
}

/**
 * Names that should be deprioritised for a section even if they CAN cover it.
 * Cad is kept off Ladies 1 / delivery unless no one else available;
 * Janah is kept off Kids unless needed.
 */
export function isLastResort(name: string, section: Section): boolean {
  const k = key(name);
  if (k === "cad" && section === "Ladies 1") return true;
  if (k === "janah" && section === "Kids") return true;
  return false;
}

/**
 * Hard-coded contracted shift windows for staff with fixed weekly timings.
 * Returns null when no fixed window applies (use template defaults).
 * dayIdx: 0=Mon..6=Sun.
 */
export interface FixedShift { start: string; end: string; hours: number }
export function fixedShiftFor(name: string, dayIdx: number): FixedShift | null {
  const k = key(name);
  if (k === "patrick") {
    // Patrick: 08:00–15:00 (7h, no break) on his working days.
    return { start: "08:00", end: "15:00", hours: 7 };
  }
  if (k === "cara") {
    // Cara alternates: weekdays 11:00–18:00, weekends 08:00–16:00.
    return dayIdx >= 5
      ? { start: "08:00", end: "16:00", hours: 7.5 }
      : { start: "11:00", end: "18:00", hours: 7 };
  }
  return null;
}
