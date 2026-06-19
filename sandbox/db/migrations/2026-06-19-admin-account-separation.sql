-- Admin account separation (least privilege).
-- Creates a dedicated system-admin account and demotes the personal account
-- (ปุณณวิช / punnawich) to a normal IT-department user.
--
-- Run: docker exec -i hr-ememo-db mysql -uhr_ememo -phr_ememo_dev_password hr_ememo \
--        < db/migrations/2026-06-19-admin-account-separation.sql
--
-- Order matters: create the new admin FIRST so the system is never left without
-- an admin, THEN demote punnawich.

-- 1) Dedicated admin account.
--    name "ผู้ดูแลระบบ E-Memo" (first/last split so CONCAT = the full label).
--    password: Admincar_1996  (bcrypt cost 12; change after first login)
--    Idempotent: re-running refreshes the admin's core fields instead of erroring
--    on the unique card_id/email.
INSERT INTO users
  (employee_card_id, email, first_name, last_name, password_hash, department, roles_json, approval_level, status)
VALUES (
  'ADMIN001',
  'admin@car-1996.com',
  'ผู้ดูแลระบบ',
  'E-Memo',
  '$2b$12$oSQTEDsJMn2GYQcADG6v/unIqRBW5ZZcUBrGIdXlO.mRQQtYWLzTG',
  'IT',
  '["admin"]',
  NULL,
  'active'
)
ON DUPLICATE KEY UPDATE
  email         = VALUES(email),
  first_name    = VALUES(first_name),
  last_name     = VALUES(last_name),
  password_hash = VALUES(password_hash),
  department    = VALUES(department),
  roles_json    = VALUES(roles_json),
  status         = VALUES(status);

-- 2) Demote the personal account to a normal IT user (keep it active so the
--    person can still log in and use the system as a requester).
UPDATE users
SET roles_json = '["requester"]'
WHERE employee_card_id = '6905003S';
