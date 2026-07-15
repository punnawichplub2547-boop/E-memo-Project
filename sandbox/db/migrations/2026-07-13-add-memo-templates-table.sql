-- Add memo_templates table for user-level templates.
-- Run: docker exec -i hr-ememo-db mysql --default-character-set=utf8mb4 \
--        -uhr_ememo -phr_ememo_dev_password hr_ememo < db/migrations/2026-07-13-add-memo-templates-table.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS memo_templates (
  id            BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  user_id       BIGINT        NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  template_json JSON          NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_templates_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
