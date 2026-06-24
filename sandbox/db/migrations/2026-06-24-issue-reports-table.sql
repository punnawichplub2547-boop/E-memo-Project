-- User-reported issues raised from the profile page ("แจ้งปัญหาถึงแอดมิน").
-- The report is persisted here (durable log) AND fanned out as in-app
-- notifications to every admin. Admins triage via the /admin "แจ้งปัญหา" tab.

-- Thai text is stored here; set the client charset first so Thai is not
-- double-encoded when this file is piped through the mysql CLI (recurring
-- mojibake lesson).
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS issue_reports (
  id                   BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  -- Reporter identity. user id is the stable key; the name/department/email are
  -- snapshotted at submit time so the log stays readable even if the user later
  -- changes or is removed.
  reporter_user_id     BIGINT        NULL DEFAULT NULL,
  reporter_name        VARCHAR(200)  NOT NULL,
  reporter_department  VARCHAR(100)  NOT NULL,
  reporter_email       VARCHAR(200)  NOT NULL,

  description          TEXT          NOT NULL,

  status               ENUM('open','resolved') NOT NULL DEFAULT 'open',
  created_at           DATETIME      NOT NULL,
  resolved_at          DATETIME      NULL DEFAULT NULL,
  resolved_by_user_id  BIGINT        NULL DEFAULT NULL,

  KEY idx_status_created (status, created_at),

  -- ON DELETE SET NULL: removing a user never destroys the log; the snapshot
  -- name/email still identifies the reporter.
  CONSTRAINT fk_issue_reports_reporter
    FOREIGN KEY (reporter_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_issue_reports_resolver
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
