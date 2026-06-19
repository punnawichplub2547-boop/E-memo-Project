-- Add requester_user_id FK to memos so the 3 identity paths (notification fan-out,
-- memo visibility, ownership check) can match on a stable user id instead of the
-- fragile free-text requester_name. Name fallback is kept for legacy/seed/prototype
-- rows whose FK is NULL.

-- 1) Column (nullable — legacy/seed/prototype rows may have no real user)
ALTER TABLE memos
  ADD COLUMN requester_user_id BIGINT NULL DEFAULT NULL AFTER requester_name;

-- 2) FK -> users(id). ON DELETE SET NULL: deleting a user never destroys memos;
--    the name fallback still identifies them. The FK auto-creates its index
--    (do NOT also declare an explicit index — avoids a duplicate index).
ALTER TABLE memos
  ADD CONSTRAINT fk_memos_requester_user
    FOREIGN KEY (requester_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Backfill (best-effort, unambiguous active-name matches only).
--    Idempotent via WHERE requester_user_id IS NULL — safe to re-run.
UPDATE memos m
JOIN (
  SELECT CONCAT(first_name, ' ', last_name) AS full_name, MIN(id) AS user_id
  FROM users
  WHERE status = 'active'
  GROUP BY CONCAT(first_name, ' ', last_name)
  HAVING COUNT(*) = 1            -- skip names mapping to >1 active user
) u ON u.full_name = m.requester_name
SET m.requester_user_id = u.user_id
WHERE m.requester_user_id IS NULL;
