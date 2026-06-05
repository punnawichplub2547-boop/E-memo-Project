-- Migration: add soft-delete support to memos.
--
-- WHY THIS FILE EXISTS:
-- Scripts in db/init/ run ONLY when the MySQL data volume is first created
-- (docker-entrypoint-initdb.d). An already-populated dev/trial database will NOT
-- pick up the new `deleted_at` column from 001-db1-schema.sql automatically.
--
-- Run this once against any existing database to enable the admin soft-delete /
-- restore feature. Fresh databases already have the column from 001 and do NOT
-- need this file. MySQL has no "ADD COLUMN IF NOT EXISTS", so running this twice
-- will error with "Duplicate column name" - that is expected and harmless.
--
--   docker compose exec -T hr-ememo-db \
--     mysql -u hr_ememo -p hr_ememo < db/migrations/2026-06-05-add-memos-deleted-at.sql

ALTER TABLE memos
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at,
  ADD INDEX idx_memos_deleted_at (deleted_at);
