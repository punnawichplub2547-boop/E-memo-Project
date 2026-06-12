-- Telegram hybrid notification + executive approve tables.
-- Apply: docker exec -i hr-ememo-db mysql -uhr_ememo -phr_ememo_dev_password hr_ememo < db/migrations/2026-06-12-telegram-tables.sql

CREATE TABLE IF NOT EXISTS user_telegram_accounts (
  id                 BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  user_id            BIGINT        NOT NULL,
  telegram_user_id   BIGINT        NOT NULL,
  telegram_chat_id   BIGINT        NOT NULL,
  telegram_username  VARCHAR(255)  NULL,
  first_name         VARCHAR(255)  NULL,
  last_name          VARCHAR(255)  NULL,
  is_active          BOOLEAN       NOT NULL DEFAULT TRUE,
  linked_at          DATETIME      NOT NULL,
  last_seen_at       DATETIME      NULL,
  revoked_at         DATETIME      NULL,
  CONSTRAINT fk_uta_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_uta_telegram_user (telegram_user_id),
  INDEX idx_uta_user_active (user_id, is_active),
  INDEX idx_uta_chat_id (telegram_chat_id)
);

CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id          BIGINT      NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  token_hash  CHAR(64)    NOT NULL,
  user_id     BIGINT      NOT NULL,
  expires_at  DATETIME    NOT NULL,
  used_at     DATETIME    NULL,
  created_at  DATETIME    NOT NULL,
  CONSTRAINT fk_tlt_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_tlt_token_hash (token_hash),
  INDEX idx_tlt_user (user_id),
  INDEX idx_tlt_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS notifications (
  id                  BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  memo_id             BIGINT        NULL,
  recipient_user_id   BIGINT        NOT NULL,
  notification_type   VARCHAR(100)  NOT NULL,
  title               VARCHAR(255)  NOT NULL,
  body                TEXT          NULL,
  action_url          VARCHAR(500)  NULL,
  is_read             BOOLEAN       NOT NULL DEFAULT FALSE,
  read_at             DATETIME      NULL,
  created_at          DATETIME      NOT NULL,
  CONSTRAINT fk_notif_memo FOREIGN KEY (memo_id) REFERENCES memos(id),
  CONSTRAINT fk_notif_user FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  INDEX idx_notif_recipient_read (recipient_user_id, is_read),
  INDEX idx_notif_created (created_at)
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id                   BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  notification_id      BIGINT        NOT NULL,
  channel              VARCHAR(50)   NOT NULL,
  status               VARCHAR(50)   NOT NULL DEFAULT 'pending',
  provider_message_id  VARCHAR(255)  NULL,
  error_message        TEXT          NULL,
  attempted_at         DATETIME      NULL,
  sent_at              DATETIME      NULL,
  created_at           DATETIME      NOT NULL,
  CONSTRAINT fk_nd_notification FOREIGN KEY (notification_id) REFERENCES notifications(id),
  UNIQUE KEY uq_nd_notification_channel (notification_id, channel),
  INDEX idx_nd_status (channel, status)
);

CREATE TABLE IF NOT EXISTS telegram_action_tokens (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  token_hash    CHAR(64)     NOT NULL,
  memo_id       BIGINT       NOT NULL,
  user_id       BIGINT       NOT NULL,
  action_type   VARCHAR(50)  NOT NULL,
  expires_at    DATETIME     NOT NULL,
  used_at       DATETIME     NULL,
  created_at    DATETIME     NOT NULL,
  metadata_json JSON         NULL,
  CONSTRAINT fk_tat_memo FOREIGN KEY (memo_id) REFERENCES memos(id),
  CONSTRAINT fk_tat_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_tat_token_hash (token_hash),
  INDEX idx_tat_user (user_id),
  INDEX idx_tat_memo (memo_id),
  INDEX idx_tat_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS telegram_conversation_states (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  telegram_user_id BIGINT       NOT NULL,
  user_id          BIGINT       NOT NULL,
  memo_id          BIGINT       NOT NULL,
  action_type      VARCHAR(50)  NOT NULL,
  state            VARCHAR(80)  NOT NULL,
  payload_json     JSON         NULL,
  expires_at       DATETIME     NOT NULL,
  created_at       DATETIME     NOT NULL,
  updated_at       DATETIME     NOT NULL,
  INDEX idx_tcs_telegram_user (telegram_user_id),
  INDEX idx_tcs_expires (expires_at)
);
