import type { Section } from "./types";

// Manager-defined section preferences (lowercase name → ranked sections).
// Earlier in array = stronger preference. Aliases handled in resolve().
// Note: "Delivery" and "Bags & accessories" don't exist as sections in the app.
// Delivery skill → mapped to Ladies 1 (stock/floor support).
// Bags & accessories → mapped to Ladies 2/3.
const RAW: Record<string, Section[]> = {
  // Managers
  cad:      ["Manager", "Ladies 1"], // delivery only as last-resort fallback
  sintija:  ["Manager", "Ladies 2/3"],

  // Supervisors
  cyprian:  ["Supervisor", "Ladies 1"], // primary delivery lead
  mary:     ["Supervisor", "Ladies 1"],
  nelima:   ["Supervisor"],

  // Bags & accessories → Ladies 2/3
  cara:     ["Ladies 2/3", "Tills"],
  iga:      ["Ladies 2/3"],

  // Ladies 1 floor
  anwar:    ["Ladies 1"],
  saeed:    ["Ladies 1", "Mens"], // also delivery + mens stock

  // Ladies 2/3 floor
  sneha:    ["Ladies 2/3"],
  gisela:   ["Ladies 2/3"],
  gilda:    ["Ladies 2/3"],
  somya:    ["Ladies 2/3", "Tills"],

  // Sreya is the all-rounder — preferred across multiple sections.
  sreya:    ["Ladies 2/3", "Kids", "Mens", "Tills"],

  // Kids
  faiza:    ["Kids"],
  krisha:   ["Kids", "Tills"],
  janah:    ["Kids"], // "Jannah" — only if needed / learning support

  // Mens
  yusuf:    ["Mens"],
  akash:    ["Mens"],
  ashish:   ["Mens", "Ladies 1"],

  // Tills
  tanzila:  ["Tills"],
  eventas:  ["Tills"],
  roshni:   ["Tills"],

  // Stock replenishment helpers (no dedicated section → floor fallback)
  aaron:    ["Ladies 1"],
  patrick:  ["Ladies 1", "Ladies 2/3"],
  tj:       ["Ladies 2/3"],
};

const ALIASES: Record<string, string> = {
  jannah: "janah",
  neelima: "nelima",
  sesha: "sreya",
};

export function preferredSections(name: string): Section[] {
  const k = name.trim().toLowerCase();
  const key = ALIASES[k] ?? k;
  return RAW[key] ?? [];
}

/** Score 0..1 for how strongly an employee prefers a section. 0 = no preference. */
export function preferenceScore(name: string, section: Section): number {
  const list = preferredSections(name);
  const idx = list.indexOf(section);
  if (idx === -1) return 0;
  return 1 - idx * 0.15; // 1.0, 0.85, 0.70, ...
}

/**
 * Names that should be deprioritised for a given section even if they CAN cover it.
 * Used to keep Cad off Delivery/Ladies 1 unless no one else is available, and
 * Jannah off Kids unless needed.
 */
export function isLastResort(name: string, section: Section): boolean {
  const k = name.trim().toLowerCase();
  if (k === "cad" && section === "Ladies 1") return true;
  if ((k === "jannah" || k === "janah") && section === "Kids") return true;
  return false;
}
