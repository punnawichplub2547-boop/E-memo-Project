# HR&GA E-Memo Sandbox

Next.js 16 + React 19 prototype for the HR&GA E-Memo and online approval workflow described in `../Book1.xlsx`.

## Run

```bash
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run screenshots
```

Use `npm.cmd` on this Windows machine because PowerShell blocks `npm.ps1`.

## Current Scope

- Dashboard for memo volume, pending approvals, approval cycle time, and approval queue.
- AI draft memo panel with automatic approver recommendation from the approval matrix.
- Workflow timeline from requester through Manager, GM, and MD.
- Search panel for historical memo lookup by keyword, memo number, requester, or category.
- Static seed data only. No database, authentication, email delivery, or real AI API integration yet.

## Confirmed Prototype Direction

- Prototype only for the current phase.
- Future target users are all company employees.
- Executives and high-level managers should receive special approval views.
- Approval rules should follow `../Book1.xlsx` first.
- Gemini API may be used later through a server-side `GEMINI_API_KEY`, with mock AI retained as fallback.

## Visual QA Artifacts

- `design-concept.png`: generated design concept used for direction.
- `dashboard-screenshot.png`: desktop browser screenshot.
- `dashboard-mobile-screenshot.png`: mobile browser screenshot.
