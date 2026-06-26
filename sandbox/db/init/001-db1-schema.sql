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
  item_subcategory_id             BIGINT        NULL,
  item_subcategory_label          VARCHAR(255)  NULL,

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
  attachments_json                JSON          NULL,

  created_at                      DATETIME      NOT NULL,
  updated_at                      DATETIME      NOT NULL,

  -- Soft-delete marker. NULL = active; non-NULL = voided/archived by an admin.
  -- Hard-delete is only possible via the admin "Delete forever" action (DESTROY_MEMO),
  -- which also cascades child table rows and removes the on-disk attachment directory.
  deleted_at                      DATETIME      NULL DEFAULT NULL,

  INDEX idx_memos_status          (status),
  INDEX idx_memos_current_step    (current_step),
  INDEX idx_memos_requester       (requester_name),
  INDEX idx_memos_department      (department_name),
  INDEX idx_memos_item_subcat     (item_subcategory_id),
  INDEX idx_memos_created_at      (created_at),
  INDEX idx_memos_id_revision     (id, revision_no),
  INDEX idx_memos_deleted_at      (deleted_at)
);

CREATE TABLE IF NOT EXISTS item_subcategories (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  category_key      VARCHAR(80)  NOT NULL,
  label_th          VARCHAR(255) NOT NULL,
  sort_order        INT          NOT NULL DEFAULT 0,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  source_reference  VARCHAR(255) NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_item_subcat_category_label (category_key, label_th),
  INDEX idx_item_subcat_category_active (category_key, is_active, sort_order)
);

INSERT INTO item_subcategories (id, category_key, label_th, sort_order, is_active, source_reference) VALUES
  (1001, 'raw-material', 'วัตถุดิบ และ ชิ้นงาน', 10, TRUE, 'Book1.xlsx Table 2'),
  (1002, 'raw-material', 'วัสดุประกอบ', 20, TRUE, 'Book1.xlsx Table 2'),
  (1003, 'raw-material', 'วัสดุสิ้นเปลือง', 30, TRUE, 'Book1.xlsx Table 2'),
  (1004, 'raw-material', 'วัสดุโรงงาน', 40, TRUE, 'Book1.xlsx Table 2'),
  (1005, 'raw-material', 'ซื้อเพื่อทดลอง หรือ งานตัวอย่าง', 50, TRUE, 'Book1.xlsx Table 2'),
  (2001, 'fixed-asset', 'เครื่องจักร และ อุปกรณ์การผลิต', 10, TRUE, 'Book1.xlsx Table 2'),
  (2002, 'fixed-asset', 'เครื่องมือเครื่องใช้โรงงาน', 20, TRUE, 'Book1.xlsx Table 2'),
  (2003, 'fixed-asset', 'เครื่องมือเครื่องใช้สำนักงาน', 30, TRUE, 'Book1.xlsx Table 2'),
  (2004, 'fixed-asset', 'รถยนต์', 40, TRUE, 'Book1.xlsx Table 2'),
  (2005, 'fixed-asset', 'สินทรัพย์อื่น ๆ', 50, TRUE, 'Book1.xlsx Table 2'),
  (3001, 'service-contract', 'ระบบสาธารณูปโภค', 10, TRUE, 'Book1.xlsx Table 2'),
  (3002, 'service-contract', 'การซ่อมแซมบำรุงรักษาโรงงาน', 20, TRUE, 'Book1.xlsx Table 2'),
  (3003, 'service-contract', 'สำนักงาน และ โรงงาน', 30, TRUE, 'Book1.xlsx Table 2'),
  (3004, 'service-contract', 'อื่น ๆ', 40, TRUE, 'Book1.xlsx Table 2'),
  (4001, 'general-purchase', 'สวัสดิการพนักงาน', 10, TRUE, 'Book1.xlsx Table 2'),
  (4002, 'general-purchase', 'ซื้ออุปกรณ์เครื่องมือเครื่องใช้ / ซ่อมบำรุง', 20, TRUE, 'Book1.xlsx Table 2'),
  (4003, 'general-purchase', 'ซื้อของทั่วไปสำนักงาน - โรงงาน', 30, TRUE, 'Book1.xlsx Table 2'),
  (4004, 'general-purchase', 'อื่น ๆ', 40, TRUE, 'Book1.xlsx Table 2')
ON DUPLICATE KEY UPDATE
  category_key = VALUES(category_key),
  label_th = VALUES(label_th),
  sort_order = VALUES(sort_order),
  source_reference = VALUES(source_reference);

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
