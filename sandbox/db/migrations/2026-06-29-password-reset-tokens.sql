-- Single-use, time-limited password reset tokens for the "forgot password" flow.
-- A raw token is emailed to the user; only its sha256 hash is stored here.
-- Tokens are consumed atomically (UPDATE ... WHERE used_at IS NULL) and expire
-- after 60 minutes (see src/lib/password-reset.ts).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  user_id     BIGINT        NOT NULL,
  token_hash  CHAR(64)      NOT NULL,
  expires_at  DATETIME      NOT NULL,
  used_at     DATETIME      NULL DEFAULT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_token_hash (token_hash),
  KEY idx_user (user_id),

  -- Removing a user discards their outstanding reset tokens.
  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
