-- V2 §3 — short note ที่ส่งไปกับการแจ้งเตือนตอนส่งเมโมครั้งแรกเท่านั้น (Q13/Q16)
-- 3 คอลัมน์นี้ "เขียนอย่างเดียว": serializeMemoRecord() จงใจไม่อ่านกลับมา เพื่อให้
-- ข้อกำหนด Q14 (ไม่ขึ้นในเมโมและในฟอร์ม F-DC-006) เป็นจริงโดยโครงสร้าง
-- deploy script รันไฟล์นี้เฉพาะตอนคอลัมน์ยังไม่มี (idempotent)
-- SET NAMES utf8mb4 กันภาษาไทย double-encode ผ่าน mysql CLI
SET NAMES utf8mb4;
ALTER TABLE memos
  ADD COLUMN notify_note TEXT NULL AFTER closing_remark,
  ADD COLUMN notify_note_images_json JSON NULL AFTER notify_note,
  ADD COLUMN notify_attach_excel TINYINT(1) NOT NULL DEFAULT 0 AFTER notify_note_images_json;
