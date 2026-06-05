# Server Smoke Checklist

Use this checklist after a fresh deploy or update deploy of the HR&GA E-Memo prototype.

## 0. Decide Data Mode First

Choose one before touching the database:

- Demo mode: mock seed data is allowed.
- Real-user trial mode: start with an empty DB or a separate sanitized seed process.

Do not run `npm.cmd run db:seed` against an environment that already contains real trial/user data. The seed script clears the prototype tables before inserting demo records.

## 1. Pull And Start

```bash
cd Hrproject
git pull
cd sandbox
docker compose up -d --build
```

Expected:

- no warning about multiple Compose config files
- `hr-ememo-sandbox` starts
- `hr-ememo-db` starts and becomes healthy

Check:

```bash
docker compose ps
docker compose logs --tail=80 hr-ememo-sandbox
docker compose logs --tail=80 hr-ememo-db
```

## 2. Database Health

```bash
docker compose exec hr-ememo-db mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "USE hr_ememo; SHOW TABLES;"
```

Expected tables:

- `memos`
- `memo_revisions`
- `read_actions`
- `workflow_step_actions`

If the shell does not have `MYSQL_ROOT_PASSWORD`, use the configured root password from the server `.env`.

## 3. Optional Demo Seed

Only for disposable demo data:

```bash
export CONFIRM_DB_SEED=YES
npm run db:seed
unset CONFIRM_DB_SEED
```

On Windows PowerShell:

```powershell
$env:CONFIRM_DB_SEED="YES"
npm.cmd run db:seed
Remove-Item Env:\CONFIRM_DB_SEED
```

Expected:

- 8 demo memos inserted
- 8 seed `submit` workflow action rows inserted

## 4. API Smoke

From the server:

```bash
curl -i http://localhost:3000/api/memos
```

Expected:

- HTTP `200`
- JSON array response
- demo mode: includes `EM-2026-001` through `EM-2026-008`
- real-user trial mode: empty array is acceptable and should render an empty workspace, not demo seed data

## 5. Browser Smoke

Open:

```text
http://<server-ip-or-domain>:3000
```

Check:

- dashboard loads
- real-user trial mode: dashboard says there are no memos in the Trial DB and offers to create the first memo
- queue page loads
- create page loads
- history page loads
- search page loads

## 6. Workflow Smoke

Use a disposable memo.

1. Go to `/create`.
2. Create and submit a new memo.
3. Confirm it appears in `/queue`.
4. Open the drawer.
5. If read recipients exist, mark read or skip reads.
6. Approve one step.
7. Confirm the memo's current step/status updates.
8. Expand Audit Log in the drawer.
9. Confirm workflow action rows appear.

## 7. Return / Revision Smoke

Use a disposable memo.

1. Return a pending memo with a reason.
2. Confirm returned memo shows the reason.
3. Use the edit-and-resubmit action.
4. Submit the revision.
5. Confirm `Rev.1` appears.
6. Confirm Audit Log includes the return/resubmit path.

## 8. Reject Smoke

Use a disposable memo.

1. Reject a pending memo.
2. Choose `close`.
3. Confirm it becomes rejected and cannot be resubmitted.
4. Repeat with `revision-allowed`.
5. Confirm edit/resubmit is available.

## 9. Final Checks

```bash
docker compose ps
docker compose logs --tail=120 hr-ememo-sandbox
```

Expected:

- both services running
- DB is healthy
- no repeated `ECONNREFUSED` from `/api/memos`
- no repeated build/runtime errors

## 10. Rollback

If a deploy breaks:

```bash
cd Hrproject
git log --oneline -5
git checkout <known-good-commit>
cd sandbox
docker compose up -d --build
```

If the DB volume contains real trial/user data, do not run `docker compose down -v`.
