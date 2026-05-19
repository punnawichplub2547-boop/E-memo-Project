# Claude Project Guide

Read `AGENTS.md` first. The active app is in `D:\Hrproject\sandbox`.

## Context

The business requirement comes from `Book1.xlsx` and is summarized in `docs/requirements-from-excel.md`. The project is an HR&GA E-Memo Online and Workflow Approval sandbox.

Confirmed direction:

- Prototype UI only for now.
- Future users include everyone in the company.
- Executives and high-level managers need special approval views or privileged windows.
- Approval rules should follow the Excel workbook first.
- Gemini API from Google AI Studio can be considered later, but keep it server-side and optional.

## Preferred Workflow

1. Inspect `docs/requirements-from-excel.md`.
2. Inspect `sandbox/src/lib/approval.ts` before changing approval behavior. Use `getApprovalRecommendation(input)` (returns `{ recommendedFinalApprover, reason, notifyMD, notifyMDReason? }`). `getApprovalLevel` is a backwards-compat wrapper.
3. The interactive form lives at `sandbox/src/app/create/page.tsx` — that is where new approval-related UI goes. `src/components/ememo-dashboard.tsx` is legacy/unused.
4. Add or update tests in `sandbox/src/lib/*.test.ts` when changing business rules.
5. Run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build` from `sandbox/`.

## Approval Engine Cheat Sheet

Full details in `AGENTS.md` — quick reference:

- `ApprovalInput` accepts optional `isPriceAdjustment`, `followsProductionPlan`, `isDeadStockOrSlowMovement`, `departmentMonthlyOverBudgetTotal`.
- `isPriceAdjustment` only applies to raw-material / fixed-asset. It sets `notifyMD: true` but does NOT change the recommended approver.
- `followsProductionPlan` is raw-material only → recommends GM regardless of amount.
- `isDeadStockOrSlowMovement` is a UI tag only; no routing effect.
- Over-budget 1–10k escalates to MD when `departmentMonthlyOverBudgetTotal + amount > 10,000` (per-department per-month quota).
- Manager / Top Section is mandatory as the first step on every flow. Use `buildApprovalFlow(finalApprover)` to construct the step list.
- Use `analyzeApprovalRoute(recommendedFinalApprover, selectedRoute)` to classify routes as `recommended`, `escalated`, or `exception`.
- Store route metadata on memos with `recommendedRoute`, `selectedRoute`, `routeMode`, `routeOverrideReason`, `readRecipients`, and `workflowState`.
- Raw-material in-budget ≤10k routes to GM (NOT Manager) — Book1 row 1.2 does not allow Manager-tier for this category.

## UI/Behavior Rules

- The approval flow philosophy is **recommend, don't hard-block**. Default to a stair-pattern route, but allow route/final approver overrides for real-world exceptions.
- If a selected route skips steps or ends below the Book1 recommendation, require an override reason for audit/history instead of blocking submission.
- `Read` is acknowledgement-only routing, separate from approval.
- React 19 lint blocks `setState` inside `useEffect` for cross-state resets. Derive "effective" values in render (e.g. `const effectiveX = supportsX && x`) instead of `useEffect(() => { if (!supportsX) setX(false); })`.

## Paper Flow/Form References

User-provided images `Hrworkflow.jpg` and `Form.jpg` are important references. They show the current paper Internal Memo flow and form that the prototype should replace with structured inputs.

Key points:

- Flow states include `Issued`, `Checked`, `Read`, `Approved`, and `Rejected`.
- `Checked` is usually Supervisor / Manager review.
- `Read` is acknowledgement-only routing to people/departments.
- Rejected memos return to the issued person with reasons/corrections.
- Header fields include Ref. No., Date, From, To, Subject, and Attachments.
- Request details should capture why the memo is needed, work/purchase details, summary of necessity, budget plan/actual, and vendor/price comparison.
- Budget fields include Account Code & Description, Budget Plan, used budget, memo budget usage, and remaining budget.
- Paper signature slots include Supervisor, Department Manager, General Manager, Sr.General Manager, and Managing Director.
- Recipient/dept checkboxes include MD, SGM, GM, FM, HR&GA, ACC/FIN, DC, IT, MK, QA/QC, R&D, PU, PC, LGT, EN, PE, MT, PD, MIX, CUT, FMG, FNG/NT, EXT, PLA.
- Chart note says normal/general memos should be returned within 3 working days after process completion. ISO-related 7-working-day wording is visible but should be confirmed before turning it into a hard rule.

## UI Direction

- Enterprise internal tool.
- Thai/English labels are expected.
- Avoid landing pages, oversized hero sections, and decorative background blobs.
- Keep cards to repeated KPI/table/search items only.
- Use compact controls, visible states, and readable tables.

## Future Integration Notes

Real integrations are intentionally not implemented yet:

- Authentication and role-based access.
- Email notification delivery.
- Document attachment storage.
- AI memo generation API.
- AI search over historical memo corpus.
- Database persistence.

If Gemini is added later:

- Use `GEMINI_API_KEY` from `.env.local`.
- Never commit the key or expose it to client-side code.
- Keep mock AI behavior as fallback for free-tier quota limits or missing credentials.
