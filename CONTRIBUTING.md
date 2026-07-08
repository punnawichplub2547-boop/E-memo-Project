# Collaboration Workflow

## Branching

- `main` is the shared baseline branch.
- Create a feature branch for each change:

```bash
git checkout main
git pull
git checkout -b feature/short-description
```

## Before Committing

Run these from `D:\Hrproject\sandbox`:

```bash
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Use `npm.cmd` on this Windows machine because PowerShell blocks `npm.ps1`.

## Commit Style

Use short, clear messages:

```bash
git commit -m "feat: add executive approval view"
git commit -m "fix: align approval rule with Excel matrix"
git commit -m "docs: update Gemini prototype notes"
```

## Project Rules

- Keep `Book1.xlsx` as the current requirement source of truth.
- Ask before changing approval rules when the workbook is ambiguous.
- The sandbox already has MySQL persistence, JWT auth, SMTP email delivery, Telegram hooks, and env-gated AI endpoints. Confirm with the user before adding any new external provider or exposing a new integration surface.
- Never commit `.env.local` or API keys.
