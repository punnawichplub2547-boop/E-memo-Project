-- Adds optional closing remark (หมายเหตุ) field to memos table.

ALTER TABLE memos
  ADD COLUMN closing_remark TEXT NULL AFTER description;
