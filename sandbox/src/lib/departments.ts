// Canonical department list from the paper Internal Memo form (21 entries, fixed order).
// Single source of truth for the create-memo department dropdown and admin user form.
export const DEPARTMENTS = [
  "HR&GA", "ACC/FIN", "FM", "IT", "MK", "DC", "QA/QC", "R&D",
  "PU", "PC", "LGT", "EN", "PE", "MT", "PD", "MIX", "CUT", "FMG", "FNG/NT", "EXT", "PLA",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
