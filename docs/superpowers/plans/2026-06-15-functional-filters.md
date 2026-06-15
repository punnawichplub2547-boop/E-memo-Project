# Functional Filter Dropdowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the decorative Tier/Date chips on the Approval Queue and the Range/Actor chips on History actually filter the visible list (client-side, combined with the existing search/status filters), and remove the dead "More filters" button.

**Architecture:** One reusable `FilterDropdown` component (chip + popover, outside-click/Escape close — same pattern as `notification-bell.tsx`) plus pure, unit-tested filter helpers. Each page owns local filter state and ANDs the predicates over the in-memory `memos` from `useMemos()`.

**Tech Stack:** React (Next.js client components), vitest. Spec: `docs/superpowers/specs/2026-06-15-functional-filters-design.md`.

---

## File Structure

- `src/lib/memo-filters.ts` — pure helpers `parseMemoDate`, `isWithinDays`, `matchesTier` + `DATE_OPTIONS` / `tierOptions()` constants.
- `src/lib/memo-filters.test.ts` — unit tests for the helpers.
- `src/components/filter-dropdown.tsx` — reusable chip+popover.
- `src/app/globals.css` — `.em-filter-*` styles.
- `src/app/queue/page.tsx` — wire Tier + Date dropdowns, remove More filters.
- `src/app/history/page.tsx` — wire Range + Actor dropdowns.

---

## Task 1: Pure filter helpers

**Files:**
- Create: `src/lib/memo-filters.ts`
- Test: `src/lib/memo-filters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/memo-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMemoDate, isWithinDays, matchesTier } from "./memo-filters";

describe("parseMemoDate", () => {
  it("parses 'DD Mon YYYY HH:MM'", () => {
    const d = parseMemoDate("09 Jun 2026 09:15")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(9);
  });
  it("parses without a time part", () => {
    expect(parseMemoDate("05 Jan 2026")?.getMonth()).toBe(0);
  });
  it("returns null for unparseable input", () => {
    expect(parseMemoDate("not a date")).toBeNull();
    expect(parseMemoDate("")).toBeNull();
  });
});

describe("isWithinDays", () => {
  const now = new Date(2026, 5, 15, 12, 0); // 15 Jun 2026
  it("days <= 0 means All time (always true)", () => {
    expect(isWithinDays("01 Jan 2020 00:00", 0, now)).toBe(true);
  });
  it("true when inside the window", () => {
    expect(isWithinDays("10 Jun 2026 09:00", 30, now)).toBe(true);
  });
  it("false when outside the window", () => {
    expect(isWithinDays("01 Jan 2026 09:00", 30, now)).toBe(false);
  });
  it("false for unparseable date", () => {
    expect(isWithinDays("bad", 30, now)).toBe(false);
  });
});

describe("matchesTier", () => {
  it("empty tier matches everything", () => {
    expect(matchesTier("General Manager", "")).toBe(true);
  });
  it("matches exact currentStep", () => {
    expect(matchesTier("Managing Director", "Managing Director")).toBe(true);
  });
  it("rejects non-match", () => {
    expect(matchesTier("Manager / Top Section", "Managing Director")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- --run src/lib/memo-filters.test.ts`
Expected: FAIL — module not found / functions not exported.

- [ ] **Step 3: Implement**

Create `src/lib/memo-filters.ts`:

```ts
export type FilterOption = { value: string; label: string };

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// Parses the app's display timestamp "DD Mon YYYY HH:MM" (time optional). Locale-independent.
export function parseMemoDate(s: string): Date | null {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s.trim());
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (mon === undefined) return null;
  const d = new Date(Number(m[3]), mon, Number(m[1]), m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

// days <= 0 → "All time" (always true). Otherwise createdAt must be within the last `days`.
export function isWithinDays(createdAt: string, days: number, now: Date): boolean {
  if (!days || days <= 0) return true;
  const d = parseMemoDate(createdAt);
  if (!d) return false;
  return d.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

// tier "" → matches all; otherwise exact currentStep match.
export function matchesTier(currentStep: string, tier: string): boolean {
  return tier === "" || currentStep === tier;
}

export const DATE_OPTIONS: FilterOption[] = [
  { value: "0", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

// allLabel differs by page ("All levels" on queue, "All approvers" on history).
export function tierOptions(allLabel: string): FilterOption[] {
  return [
    { value: "", label: allLabel },
    { value: "Manager / Top Section", label: "Manager" },
    { value: "General Manager", label: "General Manager" },
    { value: "Managing Director", label: "Managing Director" },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- --run src/lib/memo-filters.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add sandbox/src/lib/memo-filters.ts sandbox/src/lib/memo-filters.test.ts
git commit -m "feat: pure memo filter helpers (date window + tier)"
```

---

## Task 2: FilterDropdown component + styles

**Files:**
- Create: `src/components/filter-dropdown.tsx`
- Modify: `src/app/globals.css` (append styles)

- [ ] **Step 1: Create the component**

Create `src/components/filter-dropdown.tsx`:

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { IconChevDown, IconCheck } from "./icons";

export type FilterOption = { value: string; label: string };

export function FilterDropdown({
  icon,
  label,
  options,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === selected) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="em-filter-dd" ref={rootRef}>
      <button
        type="button"
        className="em-filter-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {icon}
        <span className="em-filter-chip-label">{label}:</span>
        <strong>{current.label}</strong>
        <IconChevDown size={13} />
      </button>
      {open && (
        <div className="em-filter-menu" role="menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={opt.value === selected}
              className={`em-filter-item${opt.value === selected ? " is-selected" : ""}`}
              onClick={() => { onSelect(opt.value); setOpen(false); }}
            >
              <span className="em-filter-check">{opt.value === selected && <IconCheck size={13} />}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Append styles to `src/app/globals.css`**

Add at the end of the file:

```css
/* ===== Filter dropdown ===== */
.em-filter-dd { position: relative; }
.em-filter-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  font-size: 12.5px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font: inherit;
}
.em-filter-chip:hover { border-color: var(--line-strong); }
.em-filter-chip strong { color: var(--ink); font-weight: 700; }
.em-filter-chip-label { color: var(--muted); }
.em-filter-menu {
  position: absolute;
  top: calc(100% + 6px); left: 0;
  min-width: 180px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
  z-index: 50;
  padding: 4px;
  overflow: hidden;
}
.em-filter-item {
  display: flex; align-items: center; gap: 6px;
  width: 100%; text-align: left;
  padding: 8px 10px;
  border: none; background: none; cursor: pointer;
  border-radius: var(--r-sm);
  font-size: 12.5px; color: var(--ink); font: inherit;
}
.em-filter-item:hover { background: var(--surface-2); }
.em-filter-item.is-selected { color: var(--primary); font-weight: 600; }
.em-filter-check { width: 14px; display: inline-flex; color: var(--primary); }
```

- [ ] **Step 3: Verify it compiles**

Run: `npm.cmd run lint`
Expected: clean (no errors in `filter-dropdown.tsx`).

- [ ] **Step 4: Commit**

```bash
git add sandbox/src/components/filter-dropdown.tsx sandbox/src/app/globals.css
git commit -m "feat: reusable FilterDropdown chip+popover component"
```

---

## Task 3: Wire Queue page (Tier + Date, remove More filters)

**Files:**
- Modify: `src/app/queue/page.tsx`

- [ ] **Step 1: Add imports**

In `src/app/queue/page.tsx`, add after the existing component imports (near line 17):

```ts
import { FilterDropdown } from "@/components/filter-dropdown";
import { DATE_OPTIONS, isWithinDays, matchesTier, tierOptions } from "@/lib/memo-filters";
```

- [ ] **Step 2: Replace the URL-derived tierFilter with local state + add date state**

Replace this (lines ~46-47):

```ts
  const tierFilter: ApprovalLevel | null = TIER_STEP_MAP[tierParam] ?? null;
  const tierLabel: string | null = TIER_LABEL[tierParam] ?? null;
```

with:

```ts
  const tierLabel: string | null = TIER_LABEL[tierParam] ?? null;
  const [tier, setTier] = useState<string>(() => TIER_STEP_MAP[tierParam] ?? "");
  const [dateDays, setDateDays] = useState("0");
  const now = new Date();
```

- [ ] **Step 3: Update the tier reset effect**

Replace (lines ~72-76):

```ts
  // Reset the status tab to "pending" when entering a tier view, "all" when leaving.
  useEffect(() => {
    const applyTierDefault = () => setActiveTab(tierFilter ? "pending" : "all");
    applyTierDefault();
  }, [tierFilter]);
```

with:

```ts
  // Reset the status tab to "pending" when entering a tier view, "all" when leaving.
  useEffect(() => {
    const applyTierDefault = () => setActiveTab(tier ? "pending" : "all");
    applyTierDefault();
  }, [tier]);
```

- [ ] **Step 4: Update the list predicate**

Replace (lines ~77-89):

```ts
  const tierMemos = tierFilter ? memos.filter((m) => m.currentStep === tierFilter) : memos;

  const filtered = tierMemos.filter((m) => {
    const matchTab = activeTab === "all" || m.status === activeTab;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [m.title, m.id, m.requester, m.department, approvalLabels[m.category]]
        .join(" ")
        .toLowerCase()
        .includes(q);
    return matchTab && matchSearch;
  });
```

with:

```ts
  const tierMemos = memos.filter((m) => matchesTier(m.currentStep, tier));

  const filtered = tierMemos.filter((m) => {
    const matchTab = activeTab === "all" || m.status === activeTab;
    const matchDate = isWithinDays(m.createdAt, Number(dateDays), now);
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [m.title, m.id, m.requester, m.department, approvalLabels[m.category]]
        .join(" ")
        .toLowerCase()
        .includes(q);
    return matchTab && matchDate && matchSearch;
  });
```

- [ ] **Step 5: Replace the Tier chip block with FilterDropdown**

Replace the whole conditional block (lines ~206-245, `{tierFilter ? ( ... ) : ( ... )}`) with:

```tsx
              <FilterDropdown
                icon={<IconUsers size={13} />}
                label="Tier"
                options={tierOptions("All levels")}
                selected={tier}
                onSelect={setTier}
              />
```

- [ ] **Step 6: Replace the Date chip with FilterDropdown**

Replace the static Date `<div>` block (lines ~247-263, the one containing `Date:` and `Last 30 days`) with:

```tsx
              <FilterDropdown
                icon={<IconCalendar size={13} />}
                label="Date"
                options={DATE_OPTIONS}
                selected={dateDays}
                onSelect={setDateDays}
              />
```

- [ ] **Step 7: Remove the "More filters" button**

Delete this block (lines ~294-296):

```tsx
              <button className="em-btn sm">
                <IconFilter size={13} /> More filters
              </button>
```

- [ ] **Step 8: Lint (catch unused imports)**

Run: `npm.cmd run lint`
Expected: clean. If `IconFilter`, `IconCrown`, `Link`, `ApprovalLevel`, or `IconChevDown` become unused after the edits, remove them from their import lists. (Verify each is still referenced elsewhere before deleting — e.g. `IconCrown`/`Link` may still be used by the tier-view banner elsewhere.)

- [ ] **Step 9: Commit**

```bash
git add sandbox/src/app/queue/page.tsx
git commit -m "feat: functional Tier + Date filters on the approval queue"
```

---

## Task 4: Wire History page (Range + Actor)

**Files:**
- Modify: `src/app/history/page.tsx`

- [ ] **Step 1: Add imports**

In `src/app/history/page.tsx`, add after the existing imports (near line 15):

```ts
import { FilterDropdown } from "@/components/filter-dropdown";
import { DATE_OPTIONS, isWithinDays, matchesTier, tierOptions } from "@/lib/memo-filters";
```

- [ ] **Step 2: Add filter state**

Replace (line ~31):

```ts
  const [tabFilter, setTabFilter] = useState<"all" | "approved" | "rejected" | "returned" | "md" | "slow">("all");
```

with:

```ts
  const [tabFilter, setTabFilter] = useState<"all" | "approved" | "rejected" | "returned" | "md" | "slow">("all");
  const [actorTier, setActorTier] = useState("");
  const [dateDays, setDateDays] = useState("0");
  const now = new Date();
```

- [ ] **Step 3: Extend the list predicate**

Replace (lines ~33-38):

```ts
  const filtered = memos.filter(m => {
    if (tabFilter === "all") return true;
    if (tabFilter === "md") return m.currentStep === "Managing Director";
    if (tabFilter === "slow") return m.cycleHours > 24;
    return m.status === tabFilter;
  });
```

with:

```ts
  const filtered = memos.filter(m => {
    if (!matchesTier(m.currentStep, actorTier)) return false;
    if (!isWithinDays(m.createdAt, Number(dateDays), now)) return false;
    if (tabFilter === "all") return true;
    if (tabFilter === "md") return m.currentStep === "Managing Director";
    if (tabFilter === "slow") return m.cycleHours > 24;
    return m.status === tabFilter;
  });
```

- [ ] **Step 4: Replace the Range chip**

Replace the static Range `<div>` block (lines ~96-101, containing `Range:` and `All time`) with:

```tsx
            <FilterDropdown
              icon={<IconCalendar size={13} />}
              label="Range"
              options={DATE_OPTIONS}
              selected={dateDays}
              onSelect={setDateDays}
            />
```

- [ ] **Step 5: Replace the Actor chip**

Replace the static Actor `<div>` block (lines ~102-107, containing `Actor:` and `All approvers`) with:

```tsx
            <FilterDropdown
              icon={<IconUsers size={13} />}
              label="Actor"
              options={tierOptions("All approvers")}
              selected={actorTier}
              onSelect={setActorTier}
            />
```

- [ ] **Step 6: Lint**

Run: `npm.cmd run lint`
Expected: clean. If `IconChevDown` is now unused, remove it from the import list (verify no other usage first).

- [ ] **Step 7: Commit**

```bash
git add sandbox/src/app/history/page.tsx
git commit -m "feat: functional Range + Actor filters on history"
```

---

## Task 5: Verification

**Files:** none.

- [ ] **Step 1: Full test suite**

Run: `npm.cmd test -- --run`
Expected: all pass (existing + 10 new in `memo-filters.test.ts`).

- [ ] **Step 2: Lint + build**

Run: `npm.cmd run lint` then `npm.cmd run build`
Expected: both clean/successful.

- [ ] **Step 3: Manual smoke (dev server + browser/Playwright)**

With `PORT=3005 npm.cmd run dev` and logged in:
- `/queue`: open **Tier** → pick "Managing Director" → only MD-step memos remain; open **Date** → "Last 7 days" → list narrows by recency; reset both to All → full list. Confirm "More filters" button is gone and search still works alongside.
- `/history`: open **Range** → "Last 30 days" and **Actor** → "General Manager" → list reflects both; combining with a KPI/status tab narrows further; reset shows all.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A sandbox/
git commit -m "test: verify functional filters end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** FilterDropdown (Task 2), helpers (Task 1), queue Tier+Date+remove More filters (Task 3), history Range+Actor (Task 4), default All time (`dateDays="0"`), tier seeded from `?tier=` (Task 3 Step 2), AND with search/tabs (Tasks 3-4 predicates), tests (Tasks 1,5). All covered.
- **Type consistency:** `FilterOption {value,label}` defined in both `memo-filters.ts` and `filter-dropdown.tsx` (structurally identical; pages pass arrays from `memo-filters`). `tier`/`actorTier`/`dateDays` are all `string`; `Number(dateDays)` feeds `isWithinDays`.
- **No migration / no API change** — pure client-side.
- **Import cleanup caveat** is explicit (lint will flag any now-unused icon import to remove).
