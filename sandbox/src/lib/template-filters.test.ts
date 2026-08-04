import { describe, it, expect } from "vitest";
import {
  UNCATEGORIZED_LABEL,
  templateCategoryLabel,
  filterTemplates,
  countTemplatesByCategory,
  findExactNameMatch,
  formatTemplateDate,
} from "./template-filters";
import type { MemoTemplateSummary } from "./db-templates";

const t = (id: number, name: string, category: string | null): MemoTemplateSummary => ({
  id,
  name,
  category,
  updatedAt: "2026-07-28T03:00:00.000Z",
});

const TEMPLATES: MemoTemplateSummary[] = [
  t(1, "ซื้อยาง EPDM ม.ค.", "วัตถุดิบ"),
  t(2, "ซื้อยาง EPDM ก.พ.", "วัตถุดิบ"),
  t(3, "จ้างเหมาทำความสะอาด", "บริการ"),
  t(4, "Buy SPARE parts", null),
];

describe("templateCategoryLabel", () => {
  it("labels null, blank and whitespace categories as uncategorised", () => {
    expect(templateCategoryLabel(null)).toBe(UNCATEGORIZED_LABEL);
    expect(templateCategoryLabel("")).toBe(UNCATEGORIZED_LABEL);
    expect(templateCategoryLabel("   ")).toBe(UNCATEGORIZED_LABEL);
  });

  it("keeps a real category, trimmed", () => {
    expect(templateCategoryLabel(" วัตถุดิบ ")).toBe("วัตถุดิบ");
  });
});

describe("filterTemplates", () => {
  it("returns everything for an empty or whitespace query", () => {
    expect(filterTemplates(TEMPLATES, {})).toHaveLength(4);
    expect(filterTemplates(TEMPLATES, { query: "" })).toHaveLength(4);
    expect(filterTemplates(TEMPLATES, { query: "   " })).toHaveLength(4);
  });

  it("matches a partial name and keeps every month of a monthly series", () => {
    const found = filterTemplates(TEMPLATES, { query: "EPDM" });
    expect(found.map((x) => x.id)).toEqual([1, 2]);
  });

  it("matches Thai text inside the name", () => {
    expect(filterTemplates(TEMPLATES, { query: "ทำความสะอาด" }).map((x) => x.id)).toEqual([3]);
  });

  it("matches the category too, so typing a category name lists its templates", () => {
    expect(filterTemplates(TEMPLATES, { query: "วัตถุดิบ" }).map((x) => x.id)).toEqual([1, 2]);
  });

  it("is case-insensitive and trims the query", () => {
    expect(filterTemplates(TEMPLATES, { query: "  spare  " }).map((x) => x.id)).toEqual([4]);
  });

  it("filters by category label, including the uncategorised bucket", () => {
    expect(filterTemplates(TEMPLATES, { category: "บริการ" }).map((x) => x.id)).toEqual([3]);
    expect(filterTemplates(TEMPLATES, { category: UNCATEGORIZED_LABEL }).map((x) => x.id)).toEqual([4]);
  });

  it("combines category and query", () => {
    expect(filterTemplates(TEMPLATES, { category: "วัตถุดิบ", query: "ก.พ." }).map((x) => x.id)).toEqual([2]);
  });

  it("returns an empty array when nothing matches, without throwing on null categories", () => {
    expect(filterTemplates(TEMPLATES, { query: "ไม่มีทางเจอ" })).toEqual([]);
  });
});

describe("countTemplatesByCategory", () => {
  it("counts each category and never emits a zero bucket", () => {
    const counts = countTemplatesByCategory(TEMPLATES);
    expect(counts).toEqual([
      { label: "วัตถุดิบ", count: 2 },
      { label: "บริการ", count: 1 },
      { label: UNCATEGORIZED_LABEL, count: 1 },
    ]);
    expect(counts.every((c) => c.count > 0)).toBe(true);
  });

  it("returns an empty list for no templates", () => {
    expect(countTemplatesByCategory([])).toEqual([]);
  });
});

describe("findExactNameMatch", () => {
  it("finds a name that matches exactly, ignoring case and surrounding spaces", () => {
    expect(findExactNameMatch(TEMPLATES, "  buy spare PARTS ")?.id).toBe(4);
  });

  it("does not match a near-miss monthly name", () => {
    expect(findExactNameMatch(TEMPLATES, "ซื้อยาง EPDM มี.ค.")).toBeNull();
  });

  it("returns null for an empty name", () => {
    expect(findExactNameMatch(TEMPLATES, "   ")).toBeNull();
  });
});

describe("formatTemplateDate", () => {
  it("formats a real date into a short readable string", () => {
    const out = formatTemplateDate("2026-07-28T03:00:00.000Z");
    expect(out).not.toBe("");
    expect(out).toContain("28");
  });

  it("accepts the raw MySQL DATETIME shape", () => {
    expect(formatTemplateDate("2026-07-28 10:00:00")).toContain("28");
  });

  it("returns an empty string for missing or unparsable input", () => {
    expect(formatTemplateDate(null)).toBe("");
    expect(formatTemplateDate(undefined)).toBe("");
    expect(formatTemplateDate("not a date")).toBe("");
  });
});
