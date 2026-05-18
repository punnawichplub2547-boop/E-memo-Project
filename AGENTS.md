# Agent Instructions

This workspace contains an HR&GA E-Memo prototype derived from `D:\Hrproject\Book1.xlsx`.

## Project Layout

- `Book1.xlsx`: original requirement workbook.
- `docs/requirements-from-excel.md`: human-readable requirement extraction.
- `sandbox/`: Next.js 16 + React 19 web app prototype.
- `sandbox/src/lib/approval.ts`: approval matrix and seed memo data.
- `sandbox/src/components/ememo-dashboard.tsx`: primary dashboard UI.

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

## Commands

```bash
cd D:\Hrproject\sandbox
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

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
