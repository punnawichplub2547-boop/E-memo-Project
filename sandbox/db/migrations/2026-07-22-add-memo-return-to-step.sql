-- Adds the memos.return_to_step column that stores the step a returned memo should
-- re-enter on resubmit (selectable return destination). NULL = restart from the first
-- step (the original, backward-compatible behaviour). The deploy script runs this
-- only when the column is missing (idempotent). SET NAMES utf8mb4 keeps any Thai text
-- from double-encoding when piped through the mysql CLI.
SET NAMES utf8mb4;
ALTER TABLE memos ADD COLUMN return_to_step VARCHAR(100) NULL AFTER return_reason;
