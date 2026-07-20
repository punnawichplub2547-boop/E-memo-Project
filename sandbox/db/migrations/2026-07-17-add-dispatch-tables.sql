-- Add dispatches and dispatch_recipients tables for the Dispatch System.
-- Run: docker exec -i hr-ememo-db mysql --default-character-set=utf8mb4 \
--        -uhr_ememo -phr_ememo_dev_password hr_ememo < db/migrations/2026-07-17-add-dispatch-tables.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS dispatches (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  
  dispatch_no     VARCHAR(50)   NOT NULL,
  UNIQUE KEY uq_dispatch_no (dispatch_no),
  
  subject         VARCHAR(500)  NOT NULL,
  content         TEXT          NOT NULL,
  sender_user_id  BIGINT        NOT NULL,
  memo_id         BIGINT        NULL,
  
  status          VARCHAR(50)   NOT NULL DEFAULT 'active',
  attachments_json JSON         NULL,
  
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_dispatch_sender FOREIGN KEY (sender_user_id) REFERENCES users(id),
  CONSTRAINT fk_dispatch_memo FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE SET NULL,
  INDEX idx_dispatches_status (status),
  INDEX idx_dispatches_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dispatch_recipients (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  
  dispatch_id     BIGINT        NOT NULL,
  recipient_type  ENUM('user', 'department') NOT NULL,
  
  target_user_id  BIGINT        NOT NULL,
  target_dept     VARCHAR(100)  NULL,
  
  status          ENUM('pending', 'read', 'acknowledged') NOT NULL DEFAULT 'pending',
  read_at         DATETIME      NULL,
  acknowledged_at DATETIME      NULL,
  feedback_notes  TEXT          NULL,
  
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_dr_dispatch FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE,
  CONSTRAINT fk_dr_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_dr_dispatch_user (dispatch_id, target_user_id),
  INDEX idx_dr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
