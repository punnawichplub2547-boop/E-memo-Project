# AI Draft Preview Closing Remark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the "หมายเหตุ / Closing Remark" text (already collected on a separate tab) appended at the very end of the "AI Draft Preview" tab's document mockup, hidden entirely when empty.

**Architecture:** `closingRemark` state already lives in `src/app/create/page.tsx` (backs the existing `ClosingRemarkCard` tab). Thread the same value through as a new prop on `DraftPreviewPanel` and render it as the last block inside the existing document-mockup `<div>`, after the request-items table. No new state, no new files.

**Tech Stack:** Next.js 16 / React 19 (client component, plain JSX + inline styles — matches existing file's style).

## Global Constraints

- Windows dev machine: use `npm.cmd`, not `npm`, for all commands (per CLAUDE.md).
- Pure presentational change — no `src/lib/*.ts` business-rule logic touched, so no new unit test file is required (CLAUDE.md's test-when-changing-business-rules rule does not apply here). Verification is lint + build + manual browser check instead.
- Design spec: `docs/superpowers/specs/2026-07-09-draft-preview-closing-remark-design.md` — follow it exactly for visibility/labeling behavior.

---

### Task 1: Wire `closingRemark` into `DraftPreviewPanel`

**Files:**
- Modify: `src/app/create/_components/DraftPreviewPanel.tsx:6-22` (props interface), `:24-40` (destructure), `:97` (insert render block)
- Modify: `src/app/create/page.tsx:895-911` (call site)

**Interfaces:**
- Consumes: `closingRemark: string` — the exact same state value already passed to `ClosingRemarkCard` at `page.tsx:914-917` (`value={closingRemark}`).
- Produces: nothing consumed by later tasks — this is the only task in this plan.

- [ ] **Step 1: Add the `closingRemark` prop to `DraftPreviewPanelProps` and the component's destructured params**

In `src/app/create/_components/DraftPreviewPanel.tsx`, edit the props interface:

```typescript
// Before (lines 6-22):
interface DraftPreviewPanelProps {
  subject: string;
  category: ApprovalCategory;
  department: string;
  amount: number;
  description: string;
  effectiveApprover: ApprovalLevel;
  selectedRoute: ApprovalLevel[];
  orderedReadRecipients: string[];
  routeReview: { requiresReason: boolean };
  recommendation: { notifyMD: boolean };
  currentDateLabel: string;
  requestItems: RequestItem[];
  requestItemsGrandTotal: number;
  cleanOverrideReason: string;
  issuerName: string;
}

// After:
interface DraftPreviewPanelProps {
  subject: string;
  category: ApprovalCategory;
  department: string;
  amount: number;
  description: string;
  effectiveApprover: ApprovalLevel;
  selectedRoute: ApprovalLevel[];
  orderedReadRecipients: string[];
  routeReview: { requiresReason: boolean };
  recommendation: { notifyMD: boolean };
  currentDateLabel: string;
  requestItems: RequestItem[];
  requestItemsGrandTotal: number;
  cleanOverrideReason: string;
  issuerName: string;
  closingRemark: string;
}
```

Then edit the component's destructured parameters:

```typescript
// Before (lines 24-40):
export function DraftPreviewPanel({
  subject,
  category,
  department,
  amount,
  description,
  effectiveApprover,
  selectedRoute,
  orderedReadRecipients,
  routeReview,
  recommendation,
  currentDateLabel,
  requestItems,
  requestItemsGrandTotal,
  cleanOverrideReason,
  issuerName,
}: DraftPreviewPanelProps) {

// After:
export function DraftPreviewPanel({
  subject,
  category,
  department,
  amount,
  description,
  effectiveApprover,
  selectedRoute,
  orderedReadRecipients,
  routeReview,
  recommendation,
  currentDateLabel,
  requestItems,
  requestItemsGrandTotal,
  cleanOverrideReason,
  issuerName,
  closingRemark,
}: DraftPreviewPanelProps) {
```

- [ ] **Step 2: Add the conditional remark render block after the request-items table**

In the same file, the request-items table block currently ends like this (lines 95-98):

```typescript
// Before:
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// After:
              </table>
            </>
          )}
          {closingRemark.trim() && (
            <>
              <hr className="em-divider" style={{ margin: "10px 0 14px" }} />
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>หมายเหตุ</div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{closingRemark.trim()}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Pass `closingRemark` at the call site in `page.tsx`**

```typescript
// Before (page.tsx:895-911):
                    <DraftPreviewPanel
                      subject={subject}
                      category={category}
                      department={department}
                      amount={amount}
                      description={description}
                      effectiveApprover={effectiveApprover}
                      selectedRoute={selectedRoute}
                      orderedReadRecipients={orderedReadRecipients}
                      routeReview={routeReview}
                      recommendation={recommendation}
                      currentDateLabel={currentDateLabel}
                      requestItems={requestItems}
                      requestItemsGrandTotal={requestItemsGrandTotal}
                      cleanOverrideReason={cleanOverrideReason}
                      issuerName={user.name}
                    />

// After:
                    <DraftPreviewPanel
                      subject={subject}
                      category={category}
                      department={department}
                      amount={amount}
                      description={description}
                      effectiveApprover={effectiveApprover}
                      selectedRoute={selectedRoute}
                      orderedReadRecipients={orderedReadRecipients}
                      routeReview={routeReview}
                      recommendation={recommendation}
                      currentDateLabel={currentDateLabel}
                      requestItems={requestItems}
                      requestItemsGrandTotal={requestItemsGrandTotal}
                      cleanOverrideReason={cleanOverrideReason}
                      issuerName={user.name}
                      closingRemark={closingRemark}
                    />
```

- [ ] **Step 4: Run lint**

Run (from `sandbox/`): `npm.cmd run lint`
Expected: no errors related to `DraftPreviewPanel.tsx` or `page.tsx` (pre-existing unrelated warnings elsewhere, if any, are not this task's concern).

- [ ] **Step 5: Run build**

Run (from `sandbox/`): `npm.cmd run build`
Expected: build succeeds — confirms the new prop is type-correct end-to-end (no missing-prop TS error at the call site, no unused-variable error in the component).

- [ ] **Step 6: Manual browser verification**

Run (from `sandbox/`): `npm.cmd run dev`, open `http://localhost:3000/create` in a browser.

Check each of these:
1. Leave "หมายเหตุ / Closing Remark" tab empty → switch to "AI Draft Preview" tab → confirm no divider/"หมายเหตุ" block appears anywhere (block fully absent).
2. Type a two-line remark (e.g. `กรุณาดำเนินการก่อนสิ้นเดือนนี้` on line 1, `ขอบคุณครับ` on line 2) into the "หมายเหตุ" tab → switch to "AI Draft Preview" tab → confirm the divider, "หมายเหตุ" header, and both lines (on separate lines, not merged) appear as the last block in the document mockup, after the request-items table if items were entered.
3. Clear the remark back to empty → confirm the block disappears again immediately (live sync, no page reload needed).
4. Open browser dev tools, switch to a mobile viewport (e.g. 375px width, iPhone SE), repeat check 2 → confirm the remark text wraps normally with no horizontal overflow/scroll on the preview box.

- [ ] **Step 7: Commit**

```bash
git add sandbox/src/app/create/_components/DraftPreviewPanel.tsx sandbox/src/app/create/page.tsx
git commit -m "feat(create): show closing remark at the end of AI Draft Preview"
```
