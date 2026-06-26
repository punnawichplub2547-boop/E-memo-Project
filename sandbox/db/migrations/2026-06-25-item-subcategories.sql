-- Adds Book1 Table 2 item subcategories as editable master data.
-- Existing DB volumes do not re-run db/init scripts, so apply this migration
-- before using the Admin > Master Data editor on an existing environment.

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

ALTER TABLE memos
  ADD COLUMN item_subcategory_id BIGINT NULL AFTER category,
  ADD COLUMN item_subcategory_label VARCHAR(255) NULL AFTER item_subcategory_id,
  ADD INDEX idx_memos_item_subcat (item_subcategory_id);
