# Running migrations

Apply a migration file with this command — **always include `--default-character-set=utf8mb4`**:

```bash
docker exec -i hr-ememo-db mysql --default-character-set=utf8mb4 \
  -uhr_ememo -phr_ememo_dev_password hr_ememo < db/migrations/<file>.sql
```

## ⚠️ Why the charset flag is mandatory (the mojibake trap)

Without `--default-character-set=utf8mb4`, the `mysql` CLI announces the connection
as **latin1**. Migration files are UTF-8 on disk, so any Thai text in them
(e.g. a seeded name like `ปุณณวิช` or `ผู้ดูแลระบบ`) gets **double-encoded** into the
`utf8mb4` column and renders as mojibake (`à¸œà¹‰à¸"…`) in the app.

This already bit us once: `ADMIN001`'s name in
`2026-06-19-admin-account-separation.sql` kept reverting to mojibake because the file
re-inserts the name with `ON DUPLICATE KEY UPDATE`, so every re-run via the old
(no-flag) command silently clobbered the fix.

### Defense in depth

1. **Run command** — include `--default-character-set=utf8mb4` (above).
2. **In-file guard** — any migration that writes non-ASCII **data** starts with
   `SET NAMES utf8mb4;` as its first statement, so it's correct even if someone runs
   it with the old command. (Migrations whose only Thai is in `--` comments don't need
   this — comments are never stored.)

### Repairing an already-corrupted row

MySQL's `latin1` is cp1252 (has `œ` at 0x9C), so the double-encoding is reversible
entirely in SQL — no need to retype Thai:

```sql
UPDATE users
SET first_name = CONVERT(BINARY(CONVERT(first_name USING latin1)) USING utf8mb4)
WHERE employee_card_id = 'ADMIN001';
```

Confirm with `SELECT HEX(first_name) ...` — correct Thai bytes start `E0B8…`,
mojibake starts `C3A0C2B8…`.

## Order

Files are dated; apply in filename order. `db/init/001-db1-schema.sql` is the base
schema (auto-run by the Docker entrypoint on a fresh volume); everything in this
folder is applied manually on top.
