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

This project ships with `compose.yaml` using:

- `restart: unless-stopped`
- fixed container name: `hr-ememo-sandbox`
- host port `3000` mapped to container port `3000`
- MySQL 8 service `hr-ememo-db` for DB-1 schema validation
- host port `3307` mapped to MySQL container port `3306` by default
- schema init file mounted from `db/init/001-db1-schema.sql`

Use `env.compose.example` as a template if the server should override the default dev MySQL credentials through a `.env` file.

Useful server commands:

```bash
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

If the server reboots, the container will start again automatically as long as the Docker service itself starts on boot.

To reset the local DB-1 prototype database and re-run the schema init file:

```bash
docker compose down -v
docker compose up -d --build
```

This deletes the MySQL Docker volume, so use it only for disposable prototype data.

## Current Scope

- Dashboard for memo volume, pending approvals, approval cycle time, and approval queue.
- AI draft memo panel with automatic approver recommendation from the approval matrix.
- Workflow timeline from requester through Manager, GM, and MD.
- Search panel for historical memo lookup by keyword, memo number, requester, or category.
- Static seed data in the app only. DB-1 MySQL schema exists for validation, but the app does not read/write the database yet.
- No authentication, email delivery, or production AI integration yet.

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
