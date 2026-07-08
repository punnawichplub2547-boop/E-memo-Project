# HR&GA E-Memo Sandbox

Next.js 16 + React 19 trial-grade app for the HR&GA E-Memo and online approval workflow described in `../Book1.xlsx`.

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

## Docker

Build the image from `D:\Hrproject\sandbox`:

```bash
docker build -t hr-ememo-sandbox .
```

Run the container:

```bash
docker run --rm -p 3000:3000 hr-ememo-sandbox
```

Open `http://localhost:3000`.

For a server that should keep the app running continuously, use Docker Compose:

```bash
docker compose up -d --build
```

This project intentionally ships with a single Compose file: `compose.yaml`. Older local copies may still have `docker-compose.yml`; remove it if present so Docker Compose does not warn about multiple config files.

`compose.yaml` uses:

- `restart: unless-stopped`
- fixed container name: `hr-ememo-sandbox`
- host port `3000` mapped to container port `3000`
- MySQL 8 service `hr-ememo-db` for DB-1 schema validation
- host port `3307` mapped to MySQL container port `3306` by default
- schema init file mounted from `db/init/001-db1-schema.sql`
- named volume `hr-ememo-attachments-data` mounted at `/app/storage/attachments` so uploaded attachment files persist across container rebuild/restart (back this up alongside the DB; see `../docs/server-deploy.md`)

Use `env.compose.example` as a template if the server should override the default dev MySQL credentials through a `.env` file.

Useful server commands:

```bash
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

For a step-by-step post-deploy smoke test, see `../docs/server-smoke-checklist.md`.

If the server reboots, the container will start again automatically as long as the Docker service itself starts on boot.

To reset the local DB-1 prototype database and re-run the schema init file:

```bash
docker compose down -v
docker compose up -d --build
```

This deletes all Docker volumes for the stack (MySQL data **and** the `hr-ememo-attachments-data` attachment volume), so use it only for disposable prototype data.

Seed the DB-1 tables from the current `seedMemos` prototype data:

```bash
npm.cmd run db:seed
```

The seed script inserts 8 mock/demo memos and one `submit` workflow action per memo. It is idempotent for prototype use: it clears the four DB-1 tables before re-inserting the seed data. Do not run `db:seed` against any environment that already contains real trial/user data.

`db:seed` runs without extra confirmation only for local database URLs (`127.0.0.1`, `localhost`, or `::1`). If `DATABASE_URL` points to a non-local host such as a Compose service on a server, the script exits unless the destructive reset is explicitly confirmed:

```powershell
$env:CONFIRM_DB_SEED="YES"
npm.cmd run db:seed
Remove-Item Env:\CONFIRM_DB_SEED
```

## Current Scope

- Dashboard for memo volume, pending approvals, approval cycle time, and approval queue.
- AI draft memo panel with automatic approver recommendation from the approval matrix.
- Workflow timeline from requester through Manager, GM, and MD.
- Search panel for historical memo lookup by keyword, memo number, requester, or category.
- DB-1 read path is active: `MemoProvider` hydrates initial memos from `GET /api/memos` when MySQL is available.
- DB-2 complete: all eight write actions are persisted to MySQL — new memo creation (`ADD_MEMO`), approval advancement (`ADVANCE_STEP`), return-for-revision (`RETURN_MEMO`), rejection (`REJECT_MEMO`), read acknowledgement actions (`MARK_READ`, `SKIP_ALL_READS`), quick resubmit (`RESUBMIT_MEMO`), and edit-and-resubmit (`SUBMIT_REVISION`).
- Empty DB Trial Mode is supported: when `GET /api/memos` returns an empty array, the app shows an intentionally empty workspace instead of falling back to demo seeds.
- If the DB/API is unavailable, the app falls back to static `seedMemos` so the prototype remains usable.
- Email notification delivery is available through SMTP when `EMAIL_NOTIFICATIONS_ENABLED=true` and the SMTP env vars are configured; in-app notifications remain the default/fallback.
- Password reset is implemented through `/forgot-password` and `/reset-password`; delivery of reset links depends on SMTP configuration.
- Telegram account linking, approval callbacks, and MD-review callbacks/replies are implemented when bot env vars and webhook are configured.
- Admin includes user approval, memo void/restore/destroy, item subcategories, audit log, issue reports, and system checks.
- MD Review is a blocking workflow gate for price-adjustment memos in the qualifying categories.
- No production AI integration yet.

## Email Notifications

Email delivery reuses the existing notification fan-out. The app always writes in-app notifications first; then it sends email best-effort to the same resolved user recipients when SMTP is enabled.

Required env vars:

```bash
EMAIL_NOTIFICATIONS_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mailer@example.com
SMTP_PASS=change-me
EMAIL_FROM="HR&GA E-Memo <no-reply@example.com>"
EMAIL_REPLY_TO=hr@example.com
```

If any required email setting is missing, workflow actions continue normally and no email delivery row is created.

## Project Direction

- Trial/prototype-grade for validation; real persistence/auth/email/Telegram paths exist, but production hardening is still separate work.
- Target users are all company employees.
- Executives and high-level managers should receive special approval views.
- Approval rules should follow `../Book1.xlsx` first.
- Gemini API may be used later through a server-side `GEMINI_API_KEY`, with mock AI retained as fallback.

## Visual QA Artifacts

- `design-concept.png`: generated design concept used for direction.
- `dashboard-screenshot.png`: desktop browser screenshot.
- `dashboard-mobile-screenshot.png`: mobile browser screenshot.
