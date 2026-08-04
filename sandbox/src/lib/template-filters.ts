import type { MemoTemplateSummary } from "./db-templates";

export const UNCATEGORIZED_LABEL = "ไม่ระบุหมวด";

/** Bucket label for a template — old templates saved before the category
 *  field existed come back with null and must still be usable. */
export function templateCategoryLabel(category: string | null): string {
  const trimmed = (category ?? "").trim();
  return trimmed === "" ? UNCATEGORIZED_LABEL : trimmed;
}

export interface TemplateFilterOptions {
  query?: string;
  /** null / undefined = every category */
  category?: string | null;
}

/** Substring search over name + category, case-insensitive. Users name
 *  templates by month ("… ม.ค." / "… ก.พ."), so a search for the shared
 *  part must return the whole series rather than one "best" hit. */
export function filterTemplates(
  templates: MemoTemplateSummary[],
  options: TemplateFilterOptions
): MemoTemplateSummary[] {
  const query = (options.query ?? "").trim().toLowerCase();
  const category = options.category ?? null;

  return templates.filter((template) => {
    if (category !== null && templateCategoryLabel(template.category) !== category) {
      return false;
    }
    if (query === "") return true;
    const haystack = `${template.name} ${templateCategoryLabel(template.category)}`.toLowerCase();
    return haystack.includes(query);
  });
}

export interface TemplateCategoryCount {
  label: string;
  count: number;
}

/** Counts per category in first-seen order. A bucket only exists when it has
 *  templates, so the UI never renders a zero filter button. */
export function countTemplatesByCategory(templates: MemoTemplateSummary[]): TemplateCategoryCount[] {
  const counts = new Map<string, number>();
  for (const template of templates) {
    const label = templateCategoryLabel(template.category);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

/** Same comparison rule as the search: trimmed, case-insensitive. Only an
 *  exact hit offers "overwrite" — near-identical monthly names must not. */
export function findExactNameMatch(
  templates: MemoTemplateSummary[],
  name: string
): MemoTemplateSummary | null {
  const target = name.trim().toLowerCase();
  if (target === "") return null;
  return templates.find((t) => t.name.trim().toLowerCase() === target) ?? null;
}

/** Short "28 ก.ค." label. The API hands back whatever MySQL stored, so accept
 *  both the ISO string and the raw "YYYY-MM-DD HH:mm:ss" DATETIME shape. */
export function formatTemplateDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const parsed = new Date(typeof raw === "string" ? raw.replace(" ", "T") : raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
