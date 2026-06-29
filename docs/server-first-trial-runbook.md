# Go-Live Runbook — First Real-User Trial

> วันที่: 2026-06-29 · สำหรับ: คุณพลับ รัน **บนเครื่อง prod `10.255.255.173`** ผ่าน TightVNC
>
> เอกสารนี้คือ "ลำดับเปิดใช้จริงรอบแรก" รวมทุกขั้นไว้ที่เดียว — อ้างของเดิม ไม่เขียนซ้ำ:
> - กลไก deploy/DB/attachment → [`server-deploy.md`](./server-deploy.md)
> - External access (Cloudflare Tunnel + WAF + setWebhook) → [`superpowers/specs/2026-06-25-ememo-external-access-design.md`](./superpowers/specs/2026-06-25-ememo-external-access-design.md) §6
> - Smoke test หลัง deploy → [`server-smoke-checklist.md`](./server-smoke-checklist.md)
>
> **ของที่ runbook นี้เติมเข้ามา (ไม่มีในเอกสารอื่น):** การ apply DB migration ที่ค้าง + การล้าง seed/demo data ก่อนเปิดให้คนจริง

---

## ลำดับทำงาน (ทำตามทีละขั้น)

### ขั้น 0 — ก่อนเริ่ม
- [ ] มีสิทธิ์เข้าเครื่อง `10.255.255.173` (TightVNC) และ login Cloudflare admin (`car-1996.com`) ได้
- [ ] เตรียมรายชื่อพนักงานชุดแรกที่จะอนุมัติให้เข้าใช้ (เริ่มกลุ่มเล็ก)

### ขั้น 1 — ดึงโค้ดล่าสุด + rebuild
```powershell
cd <repo>\Hrproject
git pull origin main
cd sandbox
docker compose up -d --build hr-ememo-sandbox
docker compose ps
docker compose logs --tail=50 hr-ememo-sandbox
```
> ⚠️ **ห้าม `docker compose down -v`** — ลบทั้ง DB และไฟล์แนบ (attachment volume)

### ขั้น 2 — Apply DB migrations ที่ค้าง (สำคัญ — ทำก่อนให้คนใช้)
DB prod ถูกสร้างก่อนหน้าฟีเจอร์ใหม่ ฉะนั้นต้อง apply migration ที่ยังไม่มีในตาราง **ตรวจก่อน apply** (idempotent — apply เฉพาะที่ยังขาด):

| Migration | คำสั่งเช็คว่ามีหรือยัง | ถ้ายังไม่มี → apply |
|---|---|---|
| `2026-06-19-add-memo-requester-user-id.sql` | `SHOW COLUMNS FROM memos LIKE 'requester_user_id';` | (ไม่มี column = ยังไม่ได้รัน) |
| `2026-06-25-item-subcategories.sql` | `SHOW TABLES LIKE 'item_subcategories';` | (ไม่มี table = ยังไม่ได้รัน) |
| `2026-06-29-password-reset-tokens.sql` | `SHOW TABLES LIKE 'password_reset_tokens';` | (ไม่มี table = ยังไม่ได้รัน — จำเป็นสำหรับ "ลืมรหัสผ่าน") |

เช็ค (เปลี่ยน `<root_pass>` เป็นรหัสจริง):
```powershell
docker compose exec hr-ememo-db mysql -u root -p<root_pass> hr_ememo -e "SHOW COLUMNS FROM memos LIKE 'requester_user_id'; SHOW TABLES LIKE 'item_subcategories';"
```
Apply เฉพาะตัวที่ขาด (ขึ้น `SET NAMES utf8mb4;` ในไฟล์ .sql อยู่แล้ว — กันภาษาไทยเพี้ยน):
```powershell
docker compose exec -T hr-ememo-db mysql -u root -p<root_pass> hr_ememo < db/migrations/2026-06-19-add-memo-requester-user-id.sql
docker compose exec -T hr-ememo-db mysql -u root -p<root_pass> hr_ememo < db/migrations/2026-06-25-item-subcategories.sql
```
> หมายเหตุ: migration เก่ากว่านี้ (`deleted_at`, `attachments_json`, `users`, `closing-remark`, `telegram-tables`, `admin-account-separation`, `issue-reports`) ควร apply ไปแล้วในรอบก่อน — ถ้าไม่แน่ใจให้เช็คด้วยวิธีเดียวกัน (column/table หาย = ยังไม่ได้รัน)

### ขั้น 3 — ล้าง seed/demo data ก่อนเปิดให้คนจริง
ข้อมูล demo 8 memo + ผู้ใช้ตัวอย่าง **ไม่ใช่ของจริง** — สำหรับ trial ต้องเริ่มจาก DB ว่าง (แอปรองรับ `GET /api/memos` ว่างอยู่แล้ว ไม่ fallback ไป seed)
- [ ] **อย่ารัน `npm.cmd run db:seed`** บน prod (มันลบแล้วยัด demo กลับ)
- [ ] ถ้า DB เคยมี demo อยู่ ให้ลบเฉพาะ memo ตัวอย่าง (เก็บ users จริง + admin):
```sql
-- ตรวจก่อนว่ามี memo demo อะไรบ้าง
SELECT memo_no, title, requester_name FROM memos;
-- ลบ memo demo ทั้งหมด (cascade child tables) — ปรับเงื่อนไขตามจริง เช่นกรอง requester_name ที่เป็นชื่อตัวอย่าง
-- ⚠️ ทำเฉพาะถ้ามั่นใจว่าเป็นข้อมูลทดสอบ
```
- [ ] เหลือ **admin จริง 1 บัญชี** (`punnawich@car-1996.com`) ไว้อนุมัติพนักงาน

### ขั้น 4 — ตั้ง env สำหรับ external access
ในไฟล์ `.env.local` / compose env บน prod:
```
APP_PUBLIC_BASE_URL=https://memo.car-1996.com
AUTH_COOKIE_SECURE=true
```
> 📧 **"ลืมรหัสผ่าน" ต้องมี SMTP ตั้งค่าครบ** (`EMAIL_NOTIFICATIONS_ENABLED=true` + `SMTP_HOST`/`EMAIL_FROM`/...) ไม่งั้นแอปจะรับคำขอแต่ไม่ส่งอีเมล (เงียบ — กันการ enumerate). `APP_PUBLIC_BASE_URL` ถูกใช้สร้างลิงก์รีเซ็ตด้วย จึงต้องตั้งให้ถูก
> ⚠️ `AUTH_COOKIE_SECURE=true` ใช้ได้เพราะหลัง Cloudflare เป็น HTTPS จริง — **ห้ามตั้ง true บน dev http://localhost** (จะ login ไม่ได้). `TELEGRAM_*` 4 ตัวตั้งครบแล้ว
แล้ว restart: `docker compose up -d hr-ememo-sandbox`

### ขั้น 5 — External access (Cloudflare Tunnel + WAF + setWebhook)
ทำตาม **spec §6.1–6.5 ตรงๆ** (ละไว้ไม่ซ้ำที่นี่):
- [ ] 6.1 ติดตั้ง cloudflared + `cloudflared tunnel create ememo`
- [ ] 6.2 config.yml ingress → `http://localhost:3000`
- [ ] 6.3 `cloudflared tunnel route dns ememo memo.car-1996.com` + `cloudflared service install` (+ ตั้ง Service Recovery auto-restart)
- [ ] 6.4 Cloudflare dashboard: Bot Fight Mode On + WAF rate-limit rule + webhook IP custom rule
- [ ] 6.5 `npm.cmd run telegram:set-webhook` (ครั้งเดียว — hostname คงที่แล้ว)

### ขั้น 6 — Verify (ตาม spec §7)
ขั้นต่ำที่ต้องผ่าน:
- [ ] เปิด `https://memo.car-1996.com` จากเน็ตนอก (มือถือ/4G) → เจอ `/login`
- [ ] login พนักงานที่อนุมัติแล้ว → ใช้งานได้
- [ ] `getWebhookInfo` → url ถูก, ไม่มี `last_error`
- [ ] curl webhook ไม่มี secret → `403`
- [ ] reboot เครื่อง prod → tunnel กลับมาเอง (Windows service) ไม่ต้อง setWebhook ใหม่
- [ ] /start ผูกบัญชี + กดปุ่ม ✅ อนุมัติใน Telegram + ปุ่ม "เปิดใน E-Memo" เปิดได้จากเน็ตนอก

---

## สรุปสั้น
ขั้นที่เป็น **code** เสร็จหมดแล้ว (push ขึ้น main แล้ว) — runbook นี้คือ **งาน ops + DB** ล้วนๆ. ลำดับสำคัญ: **rebuild → migration → ล้าง seed → env → tunnel/WAF → setWebhook → verify**. ห้ามข้ามขั้น migration กับล้าง seed ก่อนให้คนจริงเข้าใช้
