import type { Section } from "./types";

// Manager-defined section preferences (lowercase name → ranked sections).
// Earlier in array = stronger preference. Aliases handled in resolve().
const RAW: Record<string, Section[]> = {
  // Delivery is treated as Stock replenishment (no dedicated section in app).
  cad:      ["Manager", "Ladies 1"],
  cyprian:  ["Supervisor", "Ladies 1"],
  mary:     ["Supervisor"],
  nelima:   ["Supervisor"],
  sintija:  ["Manager", "Ladies 2/3"],

  // Bags & accessories → mapped to Ladies 2/3 (closest section in app).
  cara:     ["Ladies 2/3", "Tills"],
  iga:      ["Ladies 2/3"],

  // Ladies 1
  anwar:    ["Ladies 1"],
  saeed:    ["Ladies 1", "Mens"],

  // Ladies 2/3
  sneha:    ["Ladies 2/3"],
  gisela:   ["Ladies 2/3"],
  gilda:    ["Ladies 2/3"],
  sreya:    ["Ladies 2/3"],
  somya:    ["Ladies 2/3", "Tills"],

  // Kids
  faiza:    ["Kids"],
  krisha:   ["Kids", "Tills"],
  janah:    ["Kids"], // "Jannah" alias

  // Mens
  yusuf:    ["Mens"],
  ashish:   ["Mens", "Ladies 1"],
  akash:    ["Mens"],

  // Tills
  tanzila:  ["Tills"],
  eventas:  ["Tills"],
  roshni:   ["Tills"],

  // Stock replenishment helpers (no section, fall back to floor)
  aaron:    ["Ladies 1"],
  patrick:  ["Ladies 1", "Ladies 2/3"],
  tj:       ["Ladies 2/3"],
};

const ALIASES: Record<string, string> = {
  jannah: "janah",
  sesha: "sreya",
  nelima: "nelima",
  neelima: "nelima",
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
