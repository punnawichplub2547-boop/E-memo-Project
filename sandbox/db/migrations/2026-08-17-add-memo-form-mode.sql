-- db/migrations/2026-08-17-add-memo-form-mode.sql
-- เพิ่มโหมดฟอร์มและเนื้อหาแบบบล็อกสำหรับ V3
-- form_mode เป็นแหล่งความจริงของโหมด ไม่อนุมานจาก body_blocks_json
-- เพราะ parseJsonArray คืน undefined ทั้งกรณี NULL และ array ว่าง
-- DEFAULT 'standard' ทำให้เมโมเดิมทุกใบถูกต้องทันทีโดยไม่ต้อง migrate ข้อมูล
-- SET NAMES utf8mb4 กันภาษาไทย double-encode ผ่าน mysql CLI
SET NAMES utf8mb4;
ALTER TABLE memos
  ADD COLUMN form_mode ENUM('standard','freeform') NOT NULL DEFAULT 'standard'
    AFTER custom_route_json,
  ADD COLUMN body_blocks_json JSON NULL AFTER form_mode;
