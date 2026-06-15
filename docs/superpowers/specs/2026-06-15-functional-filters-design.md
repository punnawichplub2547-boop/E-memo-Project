# Functional filter dropdowns for Approval Queue + History

**Date:** 2026-06-15
**Status:** Design approved, pending spec review

## Problem

The Approval Queue and History pages show filter chips that look interactive but are decorative `<div>`/`<button>` elements with no state or handlers:

- **Queue** (`src/app/queue/page.tsx`): `Tier: All levels`, `Date: Last 30 days`, and a `More filters` button.
- **History** (`src/app/history/page.tsx`): `Range: All time`, `Actor: All approvers`.

(Search inputs and status tabs/KPI cards on both pages already work.) All memo data is in memory via `useMemos()`, so filtering is client-side.

## Goal

Make these chips actually filter the visible list, combined (AND) with the existing search/status filters.

## Decisions (locked)

- **More filters** (queue) — **removed** (no extra filters needed; YAGNI).
- **Actor** (history) — filters by **approver tier** (`All approvers` / `Manager` / `General Manager` / `Managing Director`) against `memo.currentStep`. Not per-person.
- **Date / Range** — windows `All time` / `Last 7 days` / `Last 30 days` / `Last 90 days` against `memo.createdAt`. **Default `All time`** (never hide data unless the user chooses a window).
- **Tier** (queue) — `All levels` / `Manager` / `General Manager` / `Managing Director` against `memo.currentStep`; initial value seeded from the existing `?tier=` URL param so executive views still pre-select.
- No filter persistence (URL/localStorage), no multi-select, no per-person/department/amount filters.

## Architecture

Client-side only. One reusable dropdown component + pure filter helpers; pages own the filter state and AND the predicates over `memos`.

### Component — `src/components/filter-dropdown.tsx`

```ts
type FilterOption = { value: string; label: string };
function FilterDropdown(props: {
  icon: React.ReactNode;
  label: string;                  // e.g. "Tier"
  options: FilterOption[];
  selected: string;               // current value
  onSelect: (value: string) => void;
}): JSX.Element
```

- Renders the existing chip style (icon + `label:` + selected option's label + chevron) as a `<button>`.
- Click toggles a popover listing options; the selected one is checked.
- Closes on outside click and Escape (same pattern as `notification-bell.tsx`).
- CSS reuses/extends existing chip styling; popover styled like `.em-notif-panel` (new minimal classes in `globals.css` if needed).

### Pure helpers — `src/lib/memo-filters.ts` (unit-tested)

```ts
// "09 Jun 2026 09:15" -> Date | null  (month map; locale-independent)
export function parseMemoDate(s: string): Date | null;

// days === 0 ("all") -> always true; otherwise createdAt >= now - days
export function isWithinDays(createdAt: string, days: number, now: Date): boolean;

// tier === "" ("all") -> true; otherwise currentStep === tier
export function matchesTier(currentStep: string, tier: string): boolean;
```

`TIER_OPTIONS` (shared): `[{value:"",label:"All levels"|"All approvers"}, {value:"Manager / Top Section",label:"Manager"}, {value:"General Manager",label:"General Manager"}, {value:"Managing Director",label:"Managing Director"}]`. `DATE_OPTIONS`: `[{value:"0",label:"All time"},{value:"7",label:"Last 7 days"},{value:"30",label:"Last 30 days"},{value:"90",label:"Last 90 days"}]`.

### Queue page changes

- Convert `tierFilter` to local state: `const [tier, setTier] = useState<string>(() => tierParam ? (TIER_STEP_MAP[tierParam] ?? "") : "")`. Keep using it where `tierFilter` was used (filter + activeTab reset effect).
- Add `const [dateDays, setDateDays] = useState("0")`.
- Replace the static `Tier` chip with `<FilterDropdown label="Tier" icon={<IconUsers/>} options={TIER_OPTIONS} selected={tier} onSelect={setTier}/>`.
- Replace the static `Date` chip with `<FilterDropdown label="Date" icon={<IconCalendar/>} options={DATE_OPTIONS} selected={dateDays} onSelect={setDateDays}/>`.
- Remove the `More filters` button.
- Extend the list predicate: `matchesTier(m.currentStep, tier) && isWithinDays(m.createdAt, Number(dateDays), now) && <existing tab + search>`.

### History page changes

- Add `const [actorTier, setActorTier] = useState("")` and `const [dateDays, setDateDays] = useState("0")`.
- Replace the static `Range` chip with a `FilterDropdown` (DATE_OPTIONS → `setDateDays`).
- Replace the static `Actor` chip with a `FilterDropdown` (TIER_OPTIONS with "All approvers" label → `setActorTier`).
- Extend the `filtered` predicate to AND `matchesTier(m.currentStep, actorTier)` and `isWithinDays(m.createdAt, Number(dateDays), now)` with the existing `tabFilter` logic.

## Testing

- `src/lib/memo-filters.test.ts`: `parseMemoDate` (valid string, bad string → null), `isWithinDays` (days 0 → true; in-window true; out-of-window false; bad date → false), `matchesTier` ("" → true; match; non-match).
- `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.
- Manual smoke: on each page, pick a Date window and a Tier/Actor → the visible list shrinks accordingly; resetting to All shows everything; filters combine with search/tabs.

## Out of scope (YAGNI)

- Filter persistence across navigation/reload.
- Multi-select, per-person/department/amount filters.
- Any server/API or DB change.
