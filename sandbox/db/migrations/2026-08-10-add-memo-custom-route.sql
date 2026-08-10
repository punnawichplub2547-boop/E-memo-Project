-- Adds memos.custom_route_json — the display snapshot (name / approval level /
-- department at submit time) for a per-person "custom" approval route. NULL means
-- the memo uses the classic Book1 approval-level route, which is unchanged; the
-- route order itself still lives in selected_route_json as it always has.
-- The deploy script runs this only when the column is missing (idempotent).
-- SET NAMES utf8mb4 keeps Thai names from double-encoding through the mysql CLI.
SET NAMES utf8mb4;
ALTER TABLE memos ADD COLUMN custom_route_json JSON NULL AFTER selected_route_json;
