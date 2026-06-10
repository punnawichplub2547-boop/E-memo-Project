-- Demo account setup for presentation
-- Fixes admin name charset bug + adds MD demo account
--
-- Run (from D:\Hrproject\sandbox):
--   docker exec -i hr-ememo-db mysql --default-character-set=utf8mb4 -uhr_ememo -phr_ememo_dev_password hr_ememo < db/demo/demo-setup.sql

SET NAMES utf8mb4;

-- 1. Fix admin name (stored as ????? due to charset issue on initial migration)
UPDATE users
SET first_name = 'ปุณณวิช', last_name = 'ภูประเสริฐ'
WHERE employee_card_id = '6905003S';

-- 2. Add MD demo account
--    Password: Admin@1234 (same hash as admin account)
--    Login: md@car-1996.com
INSERT INTO users
  (employee_card_id, email, first_name, last_name, password_hash, department, roles_json, approval_level, status)
VALUES (
  'MD-DEMO-001',
  'md@car-1996.com',
  'วิชาญ',
  'ประสิทธิ์ชัย',
  '$2b$12$2LOdyxvZHumHzDeABunwRO69kZITfjKBigiJpDzoQKK1WfE5MD.Hm',
  'Executive',
  '["managing-director"]',
  'Managing Director',
  'active'
)
ON DUPLICATE KEY UPDATE
  first_name     = VALUES(first_name),
  last_name      = VALUES(last_name),
  roles_json     = VALUES(roles_json),
  approval_level = VALUES(approval_level),
  status         = VALUES(status);

-- Verify result
SELECT employee_card_id, first_name, last_name, email, department, roles_json, approval_level, status
FROM users
ORDER BY created_at;
