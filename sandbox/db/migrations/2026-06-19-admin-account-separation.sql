-- Admin account separation (least privilege).
-- Creates a dedicated system-admin account and demotes the personal account
-- (ปุณณวิช / punnawich) to a normal IT-department user.
--
-- Run: docker exec -i hr-ememo-db mysql --default-character-set=utf8mb4 \
--        -uhr_ememo -phr_ememo_dev_password hr_ememo \
--        < db/migrations/2026-06-19-admin-account-separation.sql
--
-- IMPORTANT: keep --default-character-set=utf8mb4. Without it the mysql CLI
-- announces the connection as latin1, so the UTF-8 Thai below ("ผู้ดูแลระบบ")
-- gets double-encoded into the utf8mb4 column and renders as mojibake
-- (à¸œà¹‰à¸"...). This already happened once and had to be repaired in place.
--
-- Order matters: create the new admin FIRST so the system is never left without
-- an admin, THEN demote punnawich.

-- Force the session charset to utf8mb4 regardless of how the mysql CLI is invoked.
-- This is the real safeguard: even if someone runs this file with the old command
-- (no --default-character-set), the Thai below is interpreted correctly instead of
-- being double-encoded into mojibake. Keep this as the first statement.
SET NAMES utf8mb4;

-- 1) Dedicated admin account.
--    name "ผู้ดูแลระบบ E-Memo" (first/last split so CONCAT = the full label).
--    🔴 SECURITY: never write the plaintext password in this file. It used to be
--    here in clear text, and this repository is PUBLIC — anyone could read the
--    admin credentials for a system that is reachable from the internet. The
--    plaintext lives in the owner's password manager and nowhere else.
--
--    The bcrypt hash below is a LOCAL-DEVELOPMENT seed and is public knowledge by
--    definition (it is committed here, and the password it was built from was
--    published). Treat it as compromised: on ANY database that is not a throwaway
--    local one, rotate the password immediately after running this file —
--      node -e "require('bcryptjs').hash('<new password>',12).then(console.log)"
--      UPDATE users SET password_hash='<hash>' WHERE employee_card_id='ADMIN001';
--    Re-running this migration RESETS the password back to the public seed, which
--    is why it is deliberately excluded from scripts/deploy-prod.ps1.
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
