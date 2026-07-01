-- MD Review / Opinion step for price-adjustment memos (Book1 "ต้องเสนอ MD";
-- docs/system-analysis-dfd-erd.md §6.5). Upgrades the previous notify-only
-- notify_md flag into a real blocking gate. See
-- docs/superpowers/specs/2026-07-01-md-review-step-design.md.

ALTER TABLE memos
  ADD COLUMN requires_md_review BOOLEAN NOT NULL DEFAULT FALSE AFTER notify_md,
  ADD COLUMN md_review_status VARCHAR(20) NULL DEFAULT NULL AFTER requires_md_review,
  ADD COLUMN md_review_resume_step VARCHAR(80) NULL DEFAULT NULL AFTER md_review_status,
  ADD COLUMN md_review_comment TEXT NULL AFTER md_review_resume_step,
  ADD COLUMN md_review_acted_by VARCHAR(200) NULL AFTER md_review_comment,
  ADD COLUMN md_review_acted_at DATETIME NULL AFTER md_review_acted_by;
