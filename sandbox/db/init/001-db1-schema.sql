-- DB-1 schema for the HR&GA E-Memo prototype.
-- Scope: schema only. Seed migration, read API, and write persistence come later.

CREATE TABLE IF NOT EXISTS memos (
  id                              BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  memo_no                         VARCHAR(50)   NOT NULL,
  UNIQUE KEY uq_memo_no (memo_no),

  title                           VARCHAR(500)  NOT NULL,
  requester_name                  VARCHAR(255)  NOT NULL,
  department_name                 VARCHAR(100)  NOT NULL,
  category                        VARCHAR(80)   NOT NULL,

  amount                          DECIMAL(15,2) NOT NULL,
  budget_status                   VARCHAR(50)   NULL,
  account_code                    VARCHAR(100)  NULL,
  budget_plan                     DECIMAL(15,2) NULL,
  budget_used                     DECIMAL(15,2) NULL,
  description                     TEXT          NULL,

  status                          VARCHAR(50)   NOT NULL DEFAULT 'draft',
  workflow_state                  VARCHAR(80)   NULL,
  current_step                    VARCHAR(100)  NOT NULL,
  cycle_hours                     INT           NULL,

  recommended_final_approver      VARCHAR(100)  NULL,
  recommended_route_json          JSON          NULL,
  selected_route_json             JSON          NULL,
  route_mode                      VARCHAR(80)   NULL,
  route_override_reason           TEXT          NULL,
  notify_md                       BOOLEAN       NOT NULL DEFAULT FALSE,

  is_price_adjustment             BOOLEAN       NOT NULL DEFAULT FALSE,
  follows_production_plan         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_dead_stock                   BOOLEAN       NOT NULL DEFAULT FALSE,
  dept_monthly_over_budget_total  DECIMAL(15,2) NULL,

  return_reason                   TEXT          NULL,
  reject_reason                   TEXT          NULL,
  reject_disposition              VARCHAR(50)   NULL,

  revision_no                     INT           NOT NULL DEFAULT 0,
  revision_submitted_at           DATETIME      NULL,
  revision_note                   TEXT          NULL,

  price_comparisons_json          JSON          NULL,
  selected_vendor_id              VARCHAR(100)  NULL,
  selected_vendor_reason          TEXT          NULL,
  price_adjustment_reason         TEXT          NULL,

  request_items_json              JSON          NULL,
  read_recipients_json            JSON          NULL,

  created_at                      DATETIME      NOT NULL,
  updated_at                      DATETIME      NOT NULL,

  -- Soft-delete marker. NULL = active; non-NULL = voided/archived by an admin.
  -- Rows are never hard-deleted, preserving the workflow_step_actions audit trail.
  deleted_at                      DATETIME      NULL DEFAULT NULL,

  INDEX idx_memos_status          (status),
  INDEX idx_memos_current_step    (current_step),
  INDEX idx_memos_requester       (requester_name),
  INDEX idx_memos_department      (department_name),
  INDEX idx_memos_created_at      (created_at),
  INDEX idx_memos_id_revision     (id, revision_no),
  INDEX idx_memos_deleted_at      (deleted_at)
);

CREATE TABLE IF NOT EXISTS memo_revisions (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  memo_id           BIGINT       NOT NULL,
  revision_no       INT          NOT NULL,

  source            VARCHAR(80)  NOT NULL,
  return_reason     TEXT         NULL,
  reject_reason     TEXT         NULL,
  revision_note     TEXT         NULL,
  submitted_at      DATETIME     NOT NULL,
  snapshot_json     JSON         NOT NULL,
  revision_impact   VARCHAR(80)  NULL,
  created_at        DATETIME     NOT NULL,

  CONSTRAINT fk_rev_memo FOREIGN KEY (memo_id) REFERENCES memos(id),
  UNIQUE KEY uq_rev_memo_revision (memo_id, revision_no),
  INDEX idx_rev_memo_id (memo_id)
);

CREATE TABLE IF NOT EXISTS read_actions (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  memo_id           BIGINT       NOT NULL,
  revision_no       INT          NOT NULL DEFAULT 0,
  recipient_name    VARCHAR(255) NOT NULL,
  status            VARCHAR(50)  NOT NULL DEFAULT 'pending',
  acted_at          DATETIME     NULL,
  skip_reason       TEXT         NULL,
  created_at        DATETIME     NOT NULL,
  updated_at        DATETIME     NOT NULL,

  CONSTRAINT fk_ra_memo FOREIGN KEY (memo_id) REFERENCES memos(id),
  UNIQUE KEY uq_ra_memo_revision_recipient (memo_id, revision_no, recipient_name),
  INDEX idx_ra_memo_revision (memo_id, revision_no)
);

CREATE TABLE IF NOT EXISTS workflow_step_actions (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  memo_id         BIGINT       NOT NULL,
  revision_no     INT          NOT NULL DEFAULT 0,
  action_type     VARCHAR(80)  NOT NULL,
  step_label      VARCHAR(100) NULL,
  actor_name      VARCHAR(255) NULL,
  result          VARCHAR(100) NULL,
  reason          TEXT         NULL,
  acted_at        DATETIME     NOT NULL,
  metadata_json   JSON         NULL,

  CONSTRAINT fk_wsa_memo FOREIGN KEY (memo_id) REFERENCES memos(id),
  INDEX idx_wsa_memo_id  (memo_id),
  INDEX idx_wsa_memo_rev (memo_id, revision_no),
  INDEX idx_wsa_acted_at (acted_at)
);
