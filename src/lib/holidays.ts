// UK England & Wales bank holidays (gov.uk). Add years as needed.
// Format: yyyy-MM-dd
export const UK_BANK_HOLIDAYS: Record<string, string> = {
  // 2025
  "2025-01-01": "New Year's Day",
  "2025-04-18": "Good Friday",
  "2025-04-21": "Easter Monday",
  "2025-05-05": "Early May bank holiday",
  "2025-05-26": "Spring bank holiday",
  "2025-08-25": "Summer bank holiday",
  "2025-12-25": "Christmas Day",
  "2025-12-26": "Boxing Day",
  // 2026
  "2026-01-01": "New Year's Day",
  "2026-04-03": "Good Friday",
  "2026-04-06": "Easter Monday",
  "2026-05-04": "Early May bank holiday",
  "2026-05-25": "Spring bank holiday",
  "2026-08-31": "Summer bank holiday",
  "2026-12-25": "Christmas Day",
  "2026-12-28": "Boxing Day (substitute)",
};

export function isBankHoliday(isoDate: string): string | null {
  return UK_BANK_HOLIDAYS[isoDate] ?? null;
}

/** Returns true if the date is within ±3 days of a bank holiday (peak trading window). */
export function isNearBankHoliday(date: Date): boolean {
  const ms = 24 * 60 * 60 * 1000;
  for (let off = -3; off <= 3; off++) {
    const d = new Date(date.getTime() + off * ms);
    const key = d.toISOString().slice(0, 10);
    if (UK_BANK_HOLIDAYS[key]) return true;
  }
  return false;
}
