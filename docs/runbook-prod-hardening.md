# Runbook — Prod Hardening ในเซสชัน TightVNC เดียว

> เครื่องเป้าหมาย: prod `10.255.255.173` · repo `D:\Hr\E-memo-Project\sandbox` · แอป `https://memo.car-1996.com`
> ครอบคลุม: **ERR-0011** (เปลี่ยนรหัสผ่าน DB จากค่า default), **§6.5** (env ถาวร + Telegram webhook), **Cloudflare** (Redirect Rule ที่ค้างครึ่งทาง + Bot Fight + rate-limit §6.4)
> เวลาโดยประมาณ: 30–45 นาที · downtime ของแอป ~1–2 นาทีช่วง rebuild (tunnel ไม่ดับ เพราะ cloudflared อยู่นอก compose)
> คำสั่งทั้งหมดรันใน **PowerShell บนเครื่อง prod** จากโฟลเดอร์ `D:\Hr\E-memo-Project\sandbox` เว้นแต่ระบุอื่น

---

## เฟส 0 — เตรียมก่อนต่อ VNC (ทำบนเครื่องตัวเอง)

1. สร้างรหัสผ่านใหม่ 2 ชุดใน password manager:
   - `NEW_APP_PW` — สำหรับ MySQL user `hr_ememo`
   - `NEW_ROOT_PW` — สำหรับ MySQL `root`
   - **กติกา:** ยาว ≥ 24 ตัว ใช้เฉพาะ `A-Z a-z 0-9 - _ .` เท่านั้น — **ห้าม** `@ : / # ? % '` เพราะรหัสถูกฝังใน `DATABASE_URL` (เป็น URL) และใน SQL string
2. เตรียมค่า Telegram (ถ้าจะเปิดใช้รอบนี้): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME` (@CarEmemobot) — จาก password manager / BotFather

---

## เฟส 1 — pull โค้ดล่าสุด

```powershell
cd D:\Hr\E-memo-Project\sandbox
git pull origin main
```

รอบนี้**ไม่มี migration ใหม่** (โค้ดชุด 07-08 เป็น code-only) — ยังไม่ต้อง build ตอนนี้ จะ build ครั้งเดียวในเฟส 4

---

## เฟส 2 — เปลี่ยนรหัสผ่าน DB (ERR-0011)

> ⚠️ **ลำดับสำคัญ:** ต้อง `ALTER USER` ก่อนแก้ไฟล์ env แล้วค่อย recreate container — ถ้าสลับลำดับ แอปจะต่อ DB ไม่ได้
> หมายเหตุ: connection เดิมที่แอปถืออยู่จะยังใช้ได้หลัง ALTER (รหัสมีผลกับ connection ใหม่) จึงมีช่วง buffer ให้ทำเฟส 3–4 ต่อได้เลย

### 2.1 เข้า MySQL ด้วยรหัส root เดิม

```powershell
docker exec -it -e MYSQL_HISTFILE=/dev/null hr-ememo-db mysql -uroot -p
```

(ใส่รหัส root เดิม: `hr_ememo_root_password` — `MYSQL_HISTFILE=/dev/null` กันรหัสใหม่ค้างใน history ของ container)

### 2.2 เปลี่ยนรหัสทั้ง 3 บัญชี (แทน `<NEW_APP_PW>` / `<NEW_ROOT_PW>` ด้วยค่าจริง)

```sql
ALTER USER 'hr_ememo'@'%' IDENTIFIED BY '<NEW_APP_PW>';
ALTER USER 'root'@'%' IDENTIFIED BY '<NEW_ROOT_PW>';
ALTER USER 'root'@'localhost' IDENTIFIED BY '<NEW_ROOT_PW>';
EXIT;
```

### 2.3 ทดสอบรหัสใหม่ทันที (ก่อนไปต่อ)

```powershell
docker exec -it -e MYSQL_HISTFILE=/dev/null hr-ememo-db mysql -uhr_ememo -p hr_ememo
```

ใส่ `<NEW_APP_PW>` → ถ้าเข้า prompt ได้ ลอง `SELECT COUNT(*) FROM memos;` แล้ว `EXIT;` — **ถ้าเข้าไม่ได้ หยุด อย่าไปเฟสถัดไป** (rollback: ALTER กลับเป็นค่าเดิม)

### 2.4 เขียนไฟล์ `.env` ข้างๆ `compose.yaml` (compose อ่านไฟล์นี้อัตโนมัติ)

สร้าง/แก้ `D:\Hr\E-memo-Project\sandbox\.env`:

```
MYSQL_PASSWORD=<NEW_APP_PW>
MYSQL_ROOT_PASSWORD=<NEW_ROOT_PW>
```

(ไฟล์ `.env*` ถูก gitignore อยู่แล้ว — ห้าม commit เด็ดขาด)

---

## เฟส 3 — env ถาวร §6.5 (`.env.local`)

แก้/เพิ่มใน `D:\Hr\E-memo-Project\sandbox\.env.local`:

```
APP_PUBLIC_BASE_URL=https://memo.car-1996.com
AUTH_COOKIE_SECURE=true
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_WEBHOOK_SECRET=<secret>
TELEGRAM_BOT_USERNAME=CarEmemobot
```

- `APP_PUBLIC_BASE_URL` คือตัวสำคัญ — ไม่มีค่านี้ ลิงก์ password-reset ในอีเมล + โลโก้อีเมล + ปุ่ม Telegram พังหมด
- `AUTH_COOKIE_SECURE=true` จริงๆ ซ้ำกับ `NODE_ENV=production` แต่ใส่ไว้เพื่อประกาศเจตนา (compose ไม่ override ค่านี้)
- 3 บรรทัด Telegram ใส่เฉพาะถ้าเปิดใช้รอบนี้ ข้ามได้ถ้ายังไม่พร้อม

---

## เฟส 4 — rebuild ครั้งเดียว (โค้ดใหม่ + env ใหม่ทั้ง 2 container)

```powershell
docker compose up -d --build
```

DB container จะถูก recreate ด้วย (env เปลี่ยน) — ข้อมูลอยู่ใน volume ปลอดภัย, init script **ไม่** รันซ้ำ

### ตรวจทันทีหลังขึ้น

```powershell
docker ps                                   # ทั้ง 2 container ต้อง Up, db ต้อง (healthy)
docker logs hr-ememo-sandbox --tail 30      # ต้องไม่มี DB connection error
curl.exe -s -o NUL -w "%{http_code}" https://memo.car-1996.com/login   # ต้องได้ 200
curl.exe -sI http://memo.car-1996.com/login | findstr /i "HTTP location"  # ต้องได้ 308 → https://memo.car-1996.com/...
```

แล้ว**เปิด browser จริง login ด้วยบัญชี admin** (`admin@car-1996.com` — คุณพลับพิมพ์รหัสเอง) → เข้า dashboard ได้ = DB creds ใหม่ทำงานครบวงจร

> ❌ ถ้าแอปต่อ DB ไม่ได้: เทียบค่าใน `.env` กับที่ ALTER ไว้ (พิมพ์ผิด/ตัวอักษรต้องห้าม?) แก้แล้ว `docker compose up -d` ใหม่ · rollback สุดท้าย = ALTER USER กลับค่าเดิม + ลบ `.env` + `docker compose up -d`

---

## เฟส 5 — Telegram setWebhook (ข้ามถ้าไม่เปิด Telegram รอบนี้)

Image ไม่มีโฟลเดอร์ `scripts/` (standalone) — ยิงจาก PowerShell บน host แทน (แทนค่า 2 ตัวแปรแรก):

```powershell
$token  = "<TELEGRAM_BOT_TOKEN>"
$secret = "<TELEGRAM_WEBHOOK_SECRET>"
$body = @{ url = "https://memo.car-1996.com/api/telegram/webhook"; secret_token = $secret;
           allowed_updates = @("message","callback_query"); drop_pending_updates = $true } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -ContentType "application/json" -Body $body
Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getWebhookInfo" | ConvertTo-Json -Depth 5
```

ผ่านเมื่อ: setWebhook ตอบ `ok: true` และ getWebhookInfo แสดง `url = https://memo.car-1996.com/api/telegram/webhook`, `last_error_message` ว่าง
(hostname ถาวรแล้ว — รันครั้งเดียวพอ ไม่ต้องรันซ้ำทุก restart · ปิด PowerShell window นี้หลังเสร็จ เพราะ token ค้างในตัวแปร session)

**ทดสอบจริง:** ส่งเมโมทดสอบ 1 ฉบับ → ข้อความต้องเด้งเข้า Telegram พร้อมปุ่ม "เปิดใน E-Memo" ที่กดแล้วเปิดเว็บได้ · ถ้าไม่มา ดู `docker logs hr-ememo-sandbox | findstr telegram` — โค้ดชุดใหม่ (07-08) log สาเหตุที่ Telegram reject แล้ว ไม่เงียบเหมือนเดิม

---

## เฟส 6 — Cloudflare dashboard (ทำจาก browser เครื่องไหนก็ได้ ไม่ต้อง VNC)

### 6.1 Redirect Rule ที่ค้างครึ่งทาง (สืบเนื่อง ERR-0008 — อย่า re-derive ใหม่)

`Rules > Redirect Rules > Create rule` template "Redirect from HTTP to HTTPS" แล้วแก้ 4 จุดจากค่า default ก่อนกด Deploy:

1. Request URL: `http://*` → `http://memo.car-1996.com/*`
2. Target URL: `https://${1}` → `https://memo.car-1996.com/${1}`
3. Status code: `301` → **`308`** (301 อาจแปลง POST→GET ทำ login ผ่าน http พัง; 308 คงเมธอด ตรงกับ middleware ของแอป)
4. ติ๊ก **"Preserve query string"** (default ไม่ติ๊ก) — กัน deep-link `/queue?memo=...` หลุด query

> **ห้ามใช้** toggle zone-wide "Always Use HTTPS" — จะกระทบ `car-1996.com`/`www` (เว็บบริษัท คนละเซิร์ฟเวอร์) ที่ยังไม่เคยยืนยันว่า https ใช้ได้ · **HSTS เลื่อนต่อไป** (เป็น zone-wide เท่านั้น scope ไม่ได้) จนกว่าจะเปิด `https://car-1996.com` ใน browser จริงแล้วเห็นว่าใช้ได้

### 6.2 Bot Fight Mode

`Security > Bots` → เปิด **Bot Fight Mode** (free)

### 6.3 Rate-limit (§6.4 — Free plan ได้ 1 rule จึงรวมเป็น expression เดียว)

`Security > WAF > Rate limiting rules > Create rule`:

- Expression: `(http.host eq "memo.car-1996.com" and (http.request.uri.path eq "/login" or http.request.uri.path eq "/register" or starts_with(http.request.uri.path, "/api/auth/")))`
- แนะนำ: 10 requests / 1 นาที ต่อ IP → Block 10 นาที (ปรับได้ตามจริง — ผู้ใช้ปกติไม่ยิง auth ถี่ขนาดนั้น)

### 6.4 WAF custom rule — ล็อก webhook เฉพาะ IP Telegram

`Security > WAF > Custom rules`:

- Expression: `(http.host eq "memo.car-1996.com" and starts_with(http.request.uri.path, "/api/telegram/webhook") and not ip.src in {149.154.160.0/20 91.108.4.0/22})`
- Action: **Block** — โค้ดฝั่งแอปเช็ค `cf-connecting-ip` อยู่แล้ว rule นี้เป็นชั้นนอกเพิ่ม (defense-in-depth)

---

## เฟส 7 — เช็คลิสต์ปิดงาน

- [ ] `https://memo.car-1996.com/login` → 200 และ login admin ผ่าน browser ได้
- [ ] `http://` → 308 ไป host ที่ถูกต้อง (curl จากเครื่องนอกได้ ไม่ต้อง VNC)
- [ ] Forgot password ส่งถึงอีเมลตัวเอง แล้วลิงก์ในเมลขึ้นต้น `https://memo.car-1996.com/reset-password` และกดใช้ได้
- [ ] (ถ้าเปิด Telegram) เมโมทดสอบเด้งเข้า Telegram + ปุ่มเปิดเว็บทำงาน
- [ ] `docker logs hr-ememo-sandbox --tail 50` ไม่มี error ค้าง
- [ ] รหัสใหม่ทั้ง 2 อยู่ใน password manager แล้ว และไม่ถูกพิมพ์ลงไฟล์อื่นนอก `.env`
- [ ] แจ้ง Claude ในเซสชันถัดไปให้ปิด ERR-0011 ใน `D:\MEMORY` + อัปเดต memory (§6.4/§6.5 เสร็จ)

## บันทึกแก้ทีหลัง (ไม่บล็อกงานนี้)

- `docs/server-deploy.md` ยังโชว์รหัส default เดิม — โอเค เพราะมันเป็นค่า dev example และ prod override แล้ว แต่ควรเติมประโยคเตือนว่า "prod ต้อง override เสมอ" (ทำจากเครื่อง dev ได้)
- ลบเมโม demo/test ออกจาก prod DB ก่อนเปิด trial จริง (งานแยก มี checklist ของตัวเอง)
