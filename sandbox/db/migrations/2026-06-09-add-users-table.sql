-- Add users table for real authentication.
-- Run: docker exec -i hr-ememo-db mysql -uhr_ememo -phr_ememo_dev_password hr_ememo < db/migrations/2026-06-09-add-users-table.sql

CREATE TABLE IF NOT EXISTS users (
  id                BIGINT        NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  employee_card_id  VARCHAR(30)   NOT NULL,
  UNIQUE KEY uq_employee_card_id (employee_card_id),

  email             VARCHAR(255)  NOT NULL,
  UNIQUE KEY uq_email (email),

  first_name        VARCHAR(100)  NOT NULL,
  last_name         VARCHAR(100)  NOT NULL,
  password_hash     VARCHAR(255)  NOT NULL,
  department        VARCHAR(100)  NOT NULL DEFAULT '',
  roles_json        VARCHAR(500)  NOT NULL DEFAULT '["requester"]',
  approval_level    VARCHAR(100)  NULL,

  status            ENUM('pending','active','suspended') NOT NULL DEFAULT 'pending',

  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed admin: ปุณณวิช ภูประเสริฐ (IT Support Trainee)
-- Default password: Admin@1234  (change after first login)
INSERT INTO users
  (employee_card_id, email, first_name, last_name, password_hash, department, roles_json, approval_level, status)
VALUES (
  '6905003S',
  'punnawich@car-1996.com',
  'ปุณณวิช',
  'ภูประเสริฐ',
  '$2b$12$2LOdyxvZHumHzDeABunwRO69kZITfjKBigiJpDzoQKK1WfE5MD.Hm',
  'IT',
  '["admin","requester"]',
  NULL,
  'active'
);
