# Agent Instructions

This workspace contains an HR&GA E-Memo prototype derived from `D:\Hrproject\Book1.xlsx`.

## Project Layout

- `Book1.xlsx`: original requirement workbook (source of truth for approval rules).
- `docs/requirements-from-excel.md`: human-readable requirement extraction.
- `sandbox/`: Next.js 16 + React 19 web app prototype.
- `sandbox/src/lib/approval.ts`: approval matrix, seed memos, `getApprovalRecommendation`, `buildApprovalFlow`.
- `sandbox/src/lib/approval.test.ts`: vitest cases covering Book1 rules — update whenever business logic changes.
- `sandbox/src/lib/memo-store.tsx`: in-memory memo reducer (`useMemos`, `ADD_MEMO`).
- `sandbox/src/app/page.tsx`: dashboard (KPIs, workflow status, recent activity, queue preview).
- `sandbox/src/app/create/page.tsx`: memo creation form — the ONLY page that exercises the approval logic interactively.
- `sandbox/src/app/queue/page.tsx`, `history/page.tsx`, `search/page.tsx`: secondary list views.
- `sandbox/src/components/sidebar.tsx`, `topbar.tsx`, `icons.tsx`: shared chrome.
- `sandbox/src/components/ememo-dashboard.tsx`: LEGACY/UNUSED — not imported by any page; ignore unless deleting.
- `sandbox/src/app/globals.css`: all styling lives here; uses `em-*` class prefix (e.g. `em-card`, `em-btn`, `em-tier`).

## Development Rules

- Keep the source workbook untouched unless explicitly asked to edit it.
- Work inside `sandbox/` for web app changes.
- Use `npm.cmd`, not `npm`, in PowerShell on this machine.
- Keep UI copy Thai/English mixed because the source requirement is Thai with English system terms.
- This is an internal operations tool. Prefer dense, clear, restrained SaaS UI over marketing layout.
- Current phase is prototype-only. Do not add database, authentication, real email delivery, or live AI calls unless the user explicitly approves moving beyond prototype.
- The product should eventually serve all company employees. Executives and high-level managers should have special approval views and elevated visibility.
- Approval behavior should follow `Book1.xlsx` first. If the workbook is ambiguous, ask before changing the rule.
- Gemini API from Google AI Studio is allowed as a future option, but only via server-side environment variables. Never expose API keys in client components or committed files.
- React 19 + Next 16 Turbopack are strict about `react-hooks/set-state-in-effect`. Do NOT call `setState` inside `useEffect` to reset state when a prop/state changes — derive the "effective" value in render instead (see how `effectiveIsPriceAdjustment` etc. are computed in `create/page.tsx`).
- When extending the approval engine, update both `approval.test.ts` AND the test runs as `npm.cmd test` from `sandbox/`. The test file uses vitest.

## Commands

```bash
cd D:\Hrproject\sandbox
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

## Approval Logic (current implementation)

The approval engine in `sandbox/src/lib/approval.ts` follows Book1 + user-confirmed clarifications. Use `getApprovalRecommendation(input)` — it returns `{ recommendedFinalApprover, reason, notifyMD, notifyMDReason? }`.

`ApprovalInput` fields:

- `category`: `"raw-material" | "fixed-asset" | "service-contract" | "general-purchase" | "mold"`
- `amount`: number (THB)
- `budgetStatus`: `"in-budget" | "over-budget" | "no-budget"`
- `isPriceAdjustment?`: Supplier raising price. Applies ONLY to categories 1 (raw-material) and 2 (fixed-asset). Sets `notifyMD: true` but the approver still follows amount/budget rules — does NOT force MD as the final approver.
- `followsProductionPlan?`: Raw-material only. Recommends GM regardless of amount (Book1 row 1.1).
- `isDeadStockOrSlowMovement?`: Raw-material only. UI tag for context; does NOT affect routing.
- `departmentMonthlyOverBudgetTotal?`: For over/no-budget requests. If `total + amount > 10,000` the recommendation escalates to MD (Book1 monthly per-department quota).

Routing rules (after the flags above):

- Mold → MD always.
- Raw-material in-budget ≤10k → GM (Book1 row 1.2 does NOT allow Manager-tier for this category; this was a recent fix).
- Raw-material in-budget 10,001–50,000 → GM.
- Raw-material in-budget >50,000 → MD.
- Fixed-asset in-budget ≤100,000 → GM; >100,000 → MD (no Manager tier).
- Service-contract / general-purchase in-budget: ≤10k Manager, 10,001–50,000 GM, >50,000 MD.
- Over/no-budget: 1–10k → GM (if dept quota not exceeded), else MD; >10k → MD.

`buildApprovalFlow(finalApprover)` returns the stair-pattern list of steps the memo must pass. **Manager / Top Section is always the first step**, even when the final approver is GM or MD. Pass `{ respectChosenOnly: true }` to skip intermediates (e.g. Manager → MD directly).

`analyzeApprovalRoute(recommendedFinalApprover, selectedRoute)` compares the Book1 stair recommendation with the user-selected route and returns `{ recommendedRoute, selectedRoute, mode, requiresReason, reasonLabel }`.

Route modes:

- `recommended`: selected route exactly matches the Book1 stair route.
- `escalated`: selected route goes above the recommendation without skipping recommended steps.
- `exception`: selected route skips a recommended step or ends below the Book1 recommendation; UI must capture `routeOverrideReason`.

`getApprovalLevel(input)` is a backwards-compat wrapper returning just the level string.

## Flow Philosophy (user-confirmed)

Recommend, don't hard-block. Normal workflow should default to the stair pattern, but users may choose a different route when real-world context requires it. The UI in `create/page.tsx`:

- Shows the system recommendation with a `reason` memo.
- Lets the user pick a different approval route/final approver when needed.
- Marks the system's recommendation with "(แนะนำ)" and offers a Reset button.
- Defaults to a stair-pattern route for most memos, e.g. Manager -> GM -> MD when MD is recommended.
- Requires an override/exception reason when the selected route skips steps or ends below the Book1 recommendation.
- Stores route metadata on `MemoRecord`: `recommendedRoute`, `selectedRoute`, `routeMode`, `routeOverrideReason`, `readRecipients`, and `workflowState`.
- Supports `Read` recipients for acknowledgement-only routing based on the paper flow chart.
- Tags the first Manager step as `MANDATORY` — the only hard requirement.
- Displays a gold `แจ้ง MD เพื่อทราบ` badge + CC line in draft preview when `notifyMD` is true.

Do not hard-block the user from choosing a "lower" approver than recommended, but do capture a reason for audit/history.

## Paper Flow/Form References

Additional user-provided reference images:

- `Hrworkflow.jpg` / Image #1: flow chart for `INTERNAL MEMO (เอกสารขออนุมัติ)`.
- `Form.jpg` / Image #2: paper `INTERNAL MEMO` form that the web app should gradually replace to reduce paper use.

Paper flow to reflect in the prototype:

- Start with `Issued Person` creating the memo.
- HR Officer reference in the chart is `K. Ampa`; current paper flow has HR checking/supporting data entry for issued memo fields.
- Required header data includes Ref. No. / Memo number, Date, From, To, Subject, and Attachments.
- Main request content should capture purpose/reason (`Why`), work or purchase detail, necessity summary (`How`), and related explanation lines.
- Budget section should capture Account Code & Description, Budget Plan, budget already used, budget requested/used by this memo, and remaining budget.
- Price comparison section should capture vendor/provider name, offered price, discount if any, final buy/sell total, selected vendor/service, and remark.
- Detail / Flow Status should show document state through `Checked`, `Read`, `Approved`, and `Rejected`.
- `Checked` means reviewed by the person responsible for checking, usually Supervisor / Manager.
- `Read` means a person/dept receives the memo for acknowledgement only.
- `Approved` means authorized approval; `Rejected` means authorized rejection and should return to the issued person for revision or more information.
- Rejected/returned memo should go back to the issued person with clear reason and required corrections.
- Return/SLA note from the chart: normal memo/general document should be returned to the issued person within 3 working days after completion of the process; ISO-related wording appears to mention 7 working days but should be confirmed before encoding as a rule.

Paper form fields to consider for future UI:

- Company/form identity: Complete Auto Rubber Manufacturing Co., Ltd.; form code `F-DC-006 Rev.12 Effective Date: 01/07/2022`.
- Recipient checkboxes include executive and departments such as MD, SGM, GM, FM, HR&GA, ACC/FIN, DC, IT, MK, QA/QC, R&D, PU, PC, LGT, EN, PE, MT, PD, MIX, CUT, FMG, FNG/NT, EXT, PLA.
- Signature/approval slots shown on paper: Supervisor, Department Manager, General Manager, Sr.General Manager, Managing Director.
- The web app should reduce paper by turning these paper fields into structured inputs and workflow status rather than recreating the paper form as a static image.

## Product Scope

The first prototype should support:

- E-Memo dashboard and approval queue.
- Memo creation draft flow.
- Automatic approval-level recommendation from category, budget state, and amount.
- Status timeline for requester, manager, GM, and MD.
- Search over historical memo records.
- Documentation for future Codex and Claude agents.

## Future Gemini Notes

- Candidate provider: Google AI Studio Gemini API, free tier for prototype/testing where available.
- Store key as `GEMINI_API_KEY` in a local `.env.local` file that is not committed.
- Use server routes or server actions for Gemini calls. Do not call Gemini directly from browser/client code.
- Keep a mock provider available so the prototype still works when quota is exhausted or the key is missing.
