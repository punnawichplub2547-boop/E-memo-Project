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
2. Inspect `sandbox/src/lib/approval.ts` before changing approval behavior.
3. Add or update tests in `sandbox/src/lib/*.test.ts` when changing business rules.
4. Run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build` from `sandbox/`.

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
