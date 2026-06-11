# Backlog Three Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement closing remark UI, monthly report page, and role-free CC visibility — without breaking any of the 252 existing tests.

**Architecture:** Three independent features applied in isolation. Closing remark is purely additive (new field wired end-to-end). CC visibility is a surgical change to one function plus test additions. Monthly report is a new isolated page + API route.

**Tech Stack:** Next.js 15 App Router, TypeScript, MySQL2, Vitest, React 19

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/db-memos.ts` | Modify line 104 | Add `closingRemark` mapping to `serializeMemoRecord()` |
| `src/app/api/memos/route.ts` | Modify lines 113–138, 182–225 | Add `closing_remark` to INSERT column list and `memoRowParams()` |
| `src/app/create/_components/ClosingRemarkCard.tsx` | Create | New form card component for closing remark |
| `src/app/create/page.tsx` | Modify | Add `closingRemark` state, render card, include in submit payloads |
| `src/app/queue/_components/drawer-panel.tsx` | Modify | Render `memo.closingRemark` in Summary section |
| `src/lib/memo-visibility.ts` | Modify | Remove `read-recipient` role gate from CC check |
| `src/lib/memo-visibility.test.ts` | Modify | Add new tests for role-free CC visibility |
| `src/components/icons.tsx` | Modify | Add `IconBarChart` |
| `src/components/sidebar.tsx` | Modify | Add Monthly Report nav link for privileged roles |
| `src/app/report/page.tsx` | Create | Monthly report page with month navigator + KPI + tables |
| `src/app/api/report/route.ts` | Create | API: query memos by month, aggregate by status + department |

---

## Task 1: Fix `closing_remark` DB mapper

**Files:**
- Modify: `src/lib/db-memos.ts` (line 104 area)

- [ ] **Step 1: Add `closingRemark` to `serializeMemoRecord()`**

In `serializeMemoRecord()`, after line 104 (`description: optional(row.description),`), add:

```ts
closingRemark: optional(row.closing_remark),
```

The full block around the change (lines 102–106):
```ts
    budgetPlan: toNumber(row.budget_plan),
    budgetUsed: toNumber(row.budget_used),
    description: optional(row.description),
    closingRemark: optional(row.closing_remark),   // ← ADD THIS LINE
    status: row.status as MemoStatus,
```

- [ ] **Step 2: Run tests to confirm no regressions**

```
npm.cmd test
```
Expected: 252 tests pass.

- [ ] **Step 3: Commit**

```
git add src/lib/db-memos.ts
git commit -m "fix: map closing_remark column to closingRemark in serializeMemoRecord"
```

---

## Task 2: Add `closing_remark` to the INSERT route

**Files:**
- Modify: `src/app/api/memos/route.ts` (lines 113–138 and 182–225)

The `closing_remark` column exists in the DB but is missing from the `insertMemo()` INSERT statement and from `memoRowParams()`. Fix both.

- [ ] **Step 1: Add column to INSERT statement**

In `insertMemo()`, the INSERT currently lists `description` but not `closing_remark`. Change the column list and VALUES placeholders:

```ts
  const [result] = await connection.execute<import("mysql2").ResultSetHeader>(
    `INSERT INTO memos (
      memo_no, title, requester_name, department_name, category,
      amount, budget_status, account_code, budget_plan, budget_used, description, closing_remark,
      status, workflow_state, current_step, cycle_hours,
      recommended_final_approver, recommended_route_json, selected_route_json,
      route_mode, route_override_reason, notify_md,
      is_price_adjustment, follows_production_plan, is_dead_stock, dept_monthly_over_budget_total,
      return_reason, reject_reason, reject_disposition,
      revision_no, revision_submitted_at, revision_note,
      price_comparisons_json, selected_vendor_id, selected_vendor_reason, price_adjustment_reason,
      request_items_json, read_recipients_json, attachments_json,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )`,
    memoRowParams(row)
  );
```

- [ ] **Step 2: Add `row.closing_remark` to `memoRowParams()`**

In `memoRowParams()`, after `row.description` add `row.closing_remark`:

```ts
function memoRowParams(row: MemoSeedRow) {
  return [
    row.memo_no,
    row.title,
    row.requester_name,
    row.department_name,
    row.category,
    row.amount,
    row.budget_status,
    row.account_code,
    row.budget_plan,
    row.budget_used,
    row.description,
    row.closing_remark,         // ← ADD THIS LINE
    row.status,
    row.workflow_state,
    row.current_step,
    row.cycle_hours,
    row.recommended_final_approver,
    row.recommended_route_json,
    row.selected_route_json,
    row.route_mode,
    row.route_override_reason,
    row.notify_md,
    row.is_price_adjustment,
    row.follows_production_plan,
    row.is_dead_stock,
    row.dept_monthly_over_budget_total,
    row.return_reason,
    row.reject_reason,
    row.reject_disposition,
    row.revision_no,
    row.revision_submitted_at,
    row.revision_note,
    row.price_comparisons_json,
    row.selected_vendor_id,
    row.selected_vendor_reason,
    row.price_adjustment_reason,
    row.request_items_json,
    row.read_recipients_json,
    row.attachments_json,
    row.created_at,
    row.updated_at,
  ];
}
```

- [ ] **Step 3: Run lint**

```
npm.cmd run lint
```
Expected: No errors.

- [ ] **Step 4: Commit**

```
git add src/app/api/memos/route.ts
git commit -m "fix: include closing_remark in memo INSERT statement and row params"
```

---

## Task 3: Create `ClosingRemarkCard` component

**Files:**
- Create: `src/app/create/_components/ClosingRemarkCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { IconFileText } from "@/components/icons";

interface ClosingRemarkCardProps {
  value: string;
  onChange: (v: string) => void;
}

export function ClosingRemarkCard({ value, onChange }: ClosingRemarkCardProps) {
  return (
    <div className="em-card">
      <div className="em-card-head">
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconFileText size={15} style={{ color: "var(--primary)" }} />
            หมายเหตุ / Closing Remark
          </h3>
          <div className="em-sub">หมายเหตุเพิ่มเติมหรือข้อมูลปิดท้าย Memo (ถ้ามี)</div>
        </div>
      </div>
      <div className="em-card-body">
        <div className="em-field">
          <label className="em-label">หมายเหตุ / Closing Remark</label>
          <textarea
            className="em-textarea"
            style={{ minHeight: 100, lineHeight: 1.6, padding: "12px 13px" }}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="ระบุหมายเหตุหรือข้อมูลเพิ่มเติม (ไม่บังคับ)"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```
npm.cmd run lint
```
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/app/create/_components/ClosingRemarkCard.tsx
git commit -m "feat: add ClosingRemarkCard component"
```

---

## Task 4: Wire closing remark into create form

**Files:**
- Modify: `src/app/create/page.tsx`

- [ ] **Step 1: Import `ClosingRemarkCard`**

Near the top of `page.tsx`, add import alongside the other card imports:
```ts
import { ClosingRemarkCard } from "./_components/ClosingRemarkCard";
```

- [ ] **Step 2: Add `closingRemark` state**

Find the `description` state (around line 96):
```ts
const [description, setDescription] = useState(() =>
  isRevisionMode ? (reviseMemo!.description ?? "") : ""
);
```

Add immediately after it:
```ts
const [closingRemark, setClosingRemark] = useState(() =>
  isRevisionMode ? (reviseMemo!.closingRemark ?? "") : ""
);
```

- [ ] **Step 3: Add `closingRemark` to both submit payloads**

Search for `description: description.trim() || undefined,` — it appears in two places (the `ADD_MEMO` payload and the `SUBMIT_REVISION` payload). In both, add the closing remark field directly below:

```ts
description: description.trim() || undefined,
closingRemark: closingRemark.trim() || undefined,
```

- [ ] **Step 4: Render `ClosingRemarkCard` after `AttachmentsCard`**

Find the `<AttachmentsCard ... />` render. After its closing `/>`, add:

```tsx
<ClosingRemarkCard
  value={closingRemark}
  onChange={setClosingRemark}
/>
```

- [ ] **Step 5: Run lint and tests**

```
npm.cmd run lint
npm.cmd test
```
Expected: lint clean, 252 tests pass.

- [ ] **Step 6: Commit**

```
git add src/app/create/page.tsx
git commit -m "feat: wire closingRemark state and ClosingRemarkCard into create form"
```

---

## Task 5: Render closing remark in queue drawer

**Files:**
- Modify: `src/app/queue/_components/drawer-panel.tsx`

- [ ] **Step 1: Add closing remark display after description section**

Find the description section (around line 185–194 in drawer-panel.tsx):
```tsx
{/* 3. Description / เหตุผลการขอ */}
<section>
  <div className="em-eyebrow" ...>เหตุผลการขอ / Description</div>
  {memo.description ? (
    <p ...>{memo.description}</p>
  ) : (
    <div ...>...</div>
  )}
</section>
```

Immediately after the closing `</section>` of that block, add:

```tsx
{/* 4. Closing Remark / หมายเหตุ */}
{memo.closingRemark && (
  <section>
    <div className="em-eyebrow" style={{ marginBottom: 6 }}>หมายเหตุ / Closing Remark</div>
    <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)", margin: 0, padding: "12px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)", whiteSpace: "pre-wrap" }}>
      {memo.closingRemark}
    </p>
  </section>
)}
```

- [ ] **Step 2: Run lint and tests**

```
npm.cmd run lint
npm.cmd test
```
Expected: lint clean, 252 tests pass.

- [ ] **Step 3: Commit**

```
git add src/app/queue/_components/drawer-panel.tsx
git commit -m "feat: render closingRemark in queue drawer summary section"
```

---

## Task 6: Fix CC visibility — remove role gate

**Files:**
- Modify: `src/lib/memo-visibility.ts`
- Modify: `src/lib/memo-visibility.test.ts`

- [ ] **Step 1: Write new failing test first**

In `memo-visibility.test.ts`, add a new describe block after the existing `"read-recipient role"` block:

```ts
// ── CC visibility is role-independent ────────────────────────────────────────

describe("CC visibility is role-independent (no read-recipient role needed)", () => {
  it("requester-only user sees memo they are CC'd on by name", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        requester: "สุภาพร เจริญสุข",
        readRecipients: ["นัดดา หาญกล้า"],
      }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", roles: ["requester"] }),
    )).toBe(true);
  });

  it("requester-only user sees memo they are CC'd on by department", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        requester: "สุภาพร เจริญสุข",
        readRecipients: ["HR&GA"],
      }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", department: "HR&GA", roles: ["requester"] }),
    )).toBe(true);
  });

  it("user with empty roles sees memo they are CC'd on by email", () => {
    expect(isMemoVisibleTo(
      makeMemo({
        readActions: [{ recipient: "nadda@car-1996.com", status: "pending" }],
      }),
      makeSession({ email: "nadda@car-1996.com", roles: [] }),
    )).toBe(true);
  });

  it("requester-only user does NOT see memo they are not CC'd on", () => {
    expect(isMemoVisibleTo(
      makeMemo({ requester: "สุภาพร เจริญสุข", readRecipients: ["IT"] }),
      makeSession({ firstName: "นัดดา", lastName: "หาญกล้า", department: "HR&GA", roles: ["requester"] }),
    )).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect 3 new failures**

```
npm.cmd test -- memo-visibility
```
Expected: 3 new tests fail ("sees memo they are CC'd on...").

- [ ] **Step 3: Update `isMemoVisibleTo()` in `memo-visibility.ts`**

Replace the entire CC block (lines 47–58 currently):

**Before:**
```ts
  // Read recipient: sees memos where any identity label matches a recipient entry
  if (session.roles.includes("read-recipient")) {
    const labels = new Set<string>(
      [fullName, session.department, session.email].filter((s): s is string => Boolean(s))
    );
    const recipients: string[] = [
      ...(memo.readRecipients ?? []),
      ...(memo.readActions?.map(ra => ra.recipient) ?? []),
    ];
    if (recipients.some(r => labels.has(r))) return true;
  }

  return false;
```

**After:**
```ts
  // CC visibility: any user whose name, department, or email appears in read recipients
  // can see the memo — no read-recipient role required.
  const labels = new Set<string>(
    [fullName, session.department, session.email].filter((s): s is string => Boolean(s))
  );
  const recipients: string[] = [
    ...(memo.readRecipients ?? []),
    ...(memo.readActions?.map(ra => ra.recipient) ?? []),
  ];
  if (recipients.some(r => labels.has(r))) return true;

  return false;
```

- [ ] **Step 4: Run tests — expect all 255 to pass**

```
npm.cmd test
```
Expected: 255 tests pass (252 original + 3 new).

- [ ] **Step 5: Run lint**

```
npm.cmd run lint
```
Expected: No errors.

- [ ] **Step 6: Commit**

```
git add src/lib/memo-visibility.ts src/lib/memo-visibility.test.ts
git commit -m "feat: make CC memo visibility role-independent — any CC'd user can see memo"
```

---

## Task 7: Add `IconBarChart` to icons

**Files:**
- Modify: `src/components/icons.tsx`

- [ ] **Step 1: Add icon**

Append to the end of `icons.tsx`:

```tsx
export const IconBarChart = (p: IconProps) => <Ic {...p}><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></Ic>;
```

- [ ] **Step 2: Run lint**

```
npm.cmd run lint
```
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/components/icons.tsx
git commit -m "feat: add IconBarChart to icons"
```

---

## Task 8: Add Monthly Report API route

**Files:**
- Create: `src/app/api/report/route.ts`

- [ ] **Step 1: Create the API route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { getActiveSessionUserFromToken, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "manager", "general-manager", "managing-director"] as const;

type DeptRow = {
  department_name: string;
  status: string;
  count: number;
  budget_total: number;
};

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = await getActiveSessionUserFromToken(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.roles.some(r => (ALLOWED_ROLES as readonly string[]).includes(r))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month parameter required (YYYY-MM)" }, { status: 400 });
    }

    const pool = getDbPool();
    const [rows] = await pool.query<(DeptRow & import("mysql2").RowDataPacket)[]>(
      `SELECT
         department_name,
         status,
         COUNT(*) AS count,
         SUM(COALESCE(budget_used, budget_plan, 0)) AS budget_total
       FROM memos
       WHERE deleted_at IS NULL
         AND DATE_FORMAT(created_at, '%Y-%m') = ?
       GROUP BY department_name, status`,
      [month]
    );

    // Aggregate into response shape
    const statusTotals: Record<string, number> = {};
    const deptMap: Record<string, { submitted: number; approved: number; rejected: number; budgetTotal: number }> = {};

    for (const row of rows) {
      const { department_name, status, count, budget_total } = row;
      statusTotals[status] = (statusTotals[status] ?? 0) + Number(count);
      if (!deptMap[department_name]) {
        deptMap[department_name] = { submitted: 0, approved: 0, rejected: 0, budgetTotal: 0 };
      }
      const dept = deptMap[department_name];
      dept.submitted += Number(count);
      if (status === "approved") dept.approved += Number(count);
      if (status === "rejected") dept.rejected += Number(count);
      dept.budgetTotal += Number(budget_total);
    }

    const total = Object.values(statusTotals).reduce((a, b) => a + b, 0);
    const byDepartment = Object.entries(deptMap)
      .map(([department, data]) => ({ department, ...data }))
      .sort((a, b) => b.submitted - a.submitted);

    return NextResponse.json({
      month,
      total,
      byStatus: {
        pending: statusTotals["pending"] ?? 0,
        approved: statusTotals["approved"] ?? 0,
        rejected: statusTotals["rejected"] ?? 0,
        returned: statusTotals["returned"] ?? 0,
        draft: statusTotals["draft"] ?? 0,
      },
      byDepartment,
    });
  } catch (error) {
    console.error("[GET /api/report]", error);
    return NextResponse.json({ error: "Unable to load report" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run lint**

```
npm.cmd run lint
```
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/app/api/report/route.ts
git commit -m "feat: add GET /api/report?month=YYYY-MM aggregation route"
```

---

## Task 9: Create Monthly Report page

**Files:**
- Create: `src/app/report/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { IconBarChart, IconArrowLeft, IconArrowRight } from "@/components/icons";

const ALLOWED_ROLES = ["admin", "manager", "general-manager", "managing-director"];

type ReportData = {
  month: string;
  total: number;
  byStatus: {
    pending: number;
    approved: number;
    rejected: number;
    returned: number;
    draft: number;
  };
  byDepartment: {
    department: string;
    submitted: number;
    approved: number;
    rejected: number;
    budgetTotal: number;
  }[];
};

function toMonthParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(param: string): string {
  const [y, m] = param.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

export default function ReportPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [month, setMonth] = useState(() => toMonthParam(new Date()));
  const [data, setData] = useState<ReportData | null>(null);
  const [fetching, setFetching] = useState(false);

  const canAccess = !loading && user && user.roles.some(r => ALLOWED_ROLES.includes(r));

  useEffect(() => {
    if (!loading && (!user || !canAccess)) {
      router.replace("/");
    }
  }, [loading, user, canAccess, router]);

  const fetchReport = useCallback(async (m: string) => {
    setFetching(true);
    setData(null);
    try {
      const res = await fetch(`/api/report?month=${m}`);
      if (res.ok) setData(await res.json());
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) fetchReport(month);
  }, [month, canAccess, fetchReport]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(toMonthParam(d));
  };

  if (loading || !canAccess) return null;

  return (
    <main style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <IconBarChart size={20} style={{ color: "var(--primary)" }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>รายงานประจำเดือน / Monthly Report</h1>
      </div>

      {/* Month Navigator */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          className="em-btn sm"
          onClick={() => shiftMonth(-1)}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <IconArrowLeft size={14} /> ก่อนหน้า
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 160, textAlign: "center" }}>
          {formatMonthLabel(month)}
        </span>
        <button
          className="em-btn sm"
          onClick={() => shiftMonth(1)}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          ถัดไป <IconArrowRight size={14} />
        </button>
      </div>

      {fetching && (
        <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>กำลังโหลด...</div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
            {[
              { label: "Memo ทั้งหมด", value: data.total, color: "var(--primary)" },
              { label: "อนุมัติแล้ว", value: data.byStatus.approved, color: "#059669" },
              { label: "ปฏิเสธ", value: data.byStatus.rejected, color: "#DC2626" },
            ].map(({ label, value, color }) => (
              <div key={label} className="em-card" style={{ textAlign: "center", padding: "20px 16px" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* By Status */}
          <div className="em-card" style={{ marginBottom: 20 }}>
            <div className="em-card-head"><h3>สถานะ Memo</h3></div>
            <div className="em-card-body">
              {[
                { key: "pending", label: "รออนุมัติ (Pending)" },
                { key: "approved", label: "อนุมัติแล้ว (Approved)" },
                { key: "rejected", label: "ปฏิเสธ (Rejected)" },
                { key: "returned", label: "ส่งคืน (Returned)" },
                { key: "draft", label: "ร่าง (Draft)" },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-2)" }}>{label}</span>
                  <span style={{ fontWeight: 700 }}>{data.byStatus[key as keyof typeof data.byStatus]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Department */}
          <div className="em-card">
            <div className="em-card-head"><h3>แยกตามแผนก</h3></div>
            <div className="em-card-body" style={{ padding: 0 }}>
              {data.byDepartment.length === 0 ? (
                <div style={{ padding: "20px 16px", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                  ไม่มีข้อมูลในเดือนนี้
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      {["แผนก", "ส่ง Memo", "อนุมัติ", "ปฏิเสธ", "งบประมาณรวม (฿)"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: h === "แผนก" ? "left" : "right", fontWeight: 600, fontSize: 12, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDepartment.map((row, i) => (
                      <tr key={row.department} style={{ background: i % 2 === 0 ? "transparent" : "var(--surface-2)" }}>
                        <td style={{ padding: "9px 14px", fontWeight: 600 }}>{row.department}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right" }}>{row.submitted}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#059669", fontWeight: 600 }}>{row.approved}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#DC2626" }}>{row.rejected}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600 }}>
                          {row.budgetTotal.toLocaleString("th-TH", { minimumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {!fetching && data && data.total === 0 && (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          ไม่มี Memo ในเดือน {formatMonthLabel(month)}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Run lint**

```
npm.cmd run lint
```
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/app/report/page.tsx
git commit -m "feat: add monthly report page at /report"
```

---

## Task 10: Add Monthly Report link to sidebar

**Files:**
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Import `IconBarChart`**

In `sidebar.tsx`, add `IconBarChart` to the icons import:
```ts
import {
  IconGauge, IconPen, IconRoute, IconSearch,
  IconHistory, IconCrown, IconShield, IconBarChart,
} from "./icons";
```

- [ ] **Step 2: Add role check and nav link**

After the existing `canSeeExec` const, add:
```ts
const canSeeReport = authUser
  ? authUser.roles.some(r => ["admin", "manager", "general-manager", "managing-director"].includes(r))
  : protoUser.roles.some(r => ["admin", "manager", "general-manager", "managing-director"].includes(r));
```

In the nav JSX, after the main items block (and before the Executive block), add:
```tsx
{canSeeReport && (
  <Link
    href="/report"
    className={`em-nav-item${isActive("/report") ? " active" : ""}`}
  >
    <IconBarChart size={17} />
    <span>Monthly Report</span>
  </Link>
)}
```

- [ ] **Step 3: Run lint and tests**

```
npm.cmd run lint
npm.cmd test
```
Expected: lint clean, 255 tests pass.

- [ ] **Step 4: Run build**

```
npm.cmd run build
```
Expected: Build completes with no errors.

- [ ] **Step 5: Commit**

```
git add src/components/sidebar.tsx
git commit -m "feat: add Monthly Report link to sidebar for admin/manager/GM/MD roles"
```

---

## Final Verification

- [ ] Run full test suite: `npm.cmd test` → 255 tests pass
- [ ] Run lint: `npm.cmd run lint` → no errors
- [ ] Run build: `npm.cmd run build` → no errors
- [ ] Manual smoke test: log in as admin, navigate to /report, verify month navigation works and data loads
- [ ] Manual smoke test: create a memo with a closing remark, open it in queue drawer, verify remark displays
- [ ] Manual smoke test: log in as a requester who is CC'd on another memo, verify they can see it
