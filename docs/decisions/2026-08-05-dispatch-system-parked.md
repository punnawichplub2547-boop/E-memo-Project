# Decision — Park the dispatch system and disable its API

- **Date:** 2026-08-05
- **Status:** Accepted
- **Decided by:** คุณพลับ (owner), analysis by IT Ranger
- **Scope:** `src/app/api/dispatches/*`, `src/lib/db-dispatches.ts`, tables `dispatches` / `dispatch_recipients`

## Context

A "dispatch" backend (send an internal notice to individuals or a whole
department, then track read / acknowledged per recipient) was built and deployed
to prod on 2026-07-20: two tables, four API routes, and a DB layer with 41 tests.
It has **no UI**, and both tables hold **0 rows** — it has never been exercised
by a real user.

`PROJECT-CONTEXT.md` §8 states plainly that the meaning of "ระบบ dispatch" was
never specified. The backend was therefore built on an interpretation, not on a
requirement.

## Decision

**Do not build a dispatch UI now.** Keep the code and the tables, but make the
API unreachable by default behind the `DISPATCH_ENABLED` env flag.

## Reasoning

1. **The core product has not landed yet.** The prod DB still holds demo/test
   data; E-Memo is not in full company-wide use. Adding a second module before
   the approval workflow has proven itself widens the failure surface.
2. **User-facing prod gaps outrank a feature nobody asked for.**
   `APP_PUBLIC_BASE_URL` is still unset on prod, which breaks password-reset
   links and the email logo. That hurts real users today.
3. **Building further on an unconfirmed spec compounds the original mistake.**
   The expensive part is not the code written but the code that must be torn out
   when the real requirement arrives.
4. **It may not warrant a separate module at all.** E-Memo already has
   `read_actions` + a read-recipient picker, an in-app notification bell,
   Telegram delivery, and a 21-department directory. If dispatch is just "a memo
   with no approval route", the cheaper answer is a *notice-only memo type*, not
   a parallel system. A separate module only earns its keep if it needs
   behaviour a memo cannot express — recurring sends, expiry dates, or
   escalation when unread.
5. **Long-term maintenance cost.** Every module added is something that must be
   owned after the internship ends.

## What was actually reachable before this change

`POST /api/dispatches` was live on prod and guarded only by "has a session" —
**any** logged-in user could create a dispatch and fan it out to an entire
department. No role check, no UI, no one watching. That is the concrete risk
this decision closes.

## Implementation

- `src/lib/dispatch-feature-flag.ts` — `isDispatchEnabled()` (pure) and
  `dispatchDisabledResponse()`.
- All five dispatch handlers return **404** (not 403) when the flag is off,
  before the session check, so a disabled route is indistinguishable from one
  that was never deployed and the response is identical for authenticated and
  anonymous callers. Same enumeration-safety principle already adopted for
  `GET /api/templates/[id]`.
- Opt-in requires exactly `DISPATCH_ENABLED=true`; `1`, `yes`, and `on` do not
  enable it, so the flag cannot be turned on by accident.
- Tests: `src/lib/dispatch-feature-flag.test.ts` (5) and six added cases in
  `src/app/api/dispatches/route.test.ts` asserting 404 **and** that no DB
  function is called.

**No migration, no rollback step.** The tables stay as they are (0 rows). Prod
needs nothing set — unset means off. Deploy is a rebuild only.

## Revisit when any of these becomes true

1. HR&GA states the pain themselves — e.g. "we announce a policy and cannot tell
   who has read it."
2. E-Memo has been in real company-wide use and stable for 2–4 weeks.
3. A requirement appears that a memo genuinely cannot express (recurring sends,
   expiry, unread escalation).

## Known defects to fix *before* any revival

These were found during review and are deliberately **left unfixed** — fixing
them now would be investing in a parked feature:

1. No notification fan-out at all. `createDispatch` never calls
   `notifyMemoEvent` or Telegram, so recipients would have no way to learn a
   dispatch exists.
2. `generateDispatchNo` derives the sequence from `COUNT(*)`, so deleting a row
   or two concurrent sends produce a duplicate `dispatch_no` and hit the unique
   key.
3. `createDispatch` is not transactional — a failure while inserting recipients
   leaves a dispatch row with no recipients.
4. Department recipients are expanded to active users at send time, so anyone
   who joins later never sees that notice. May be correct or not; undecided
   because the requirement is undecided.
5. No role guard — see "What was actually reachable" above. Even with the flag
   on, sending should almost certainly be restricted.
