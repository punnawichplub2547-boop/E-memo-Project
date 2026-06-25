# Spec — ให้ E-Memo รันนอกโรงงานได้ (External Access via Cloudflare Tunnel)

วันที่: 2026-06-25 · สถานะ: design approved, ยังไม่ implement · เจ้าของ: คุณพลับ (admin Cloudflare `car-1996.com`)

แทนที่แผนเดิมใน [`docs/telegram-transport-security-notes.md`](../../telegram-transport-security-notes.md) (ตอนนี้ blocker เรื่อง domain หายแล้ว — `car-1996.com` อยู่บน Cloudflare แล้ว)

---

## 1. เป้าหมาย

ให้ **พนักงานจริงใช้ E-Memo จากนอกเครือข่ายโรงงาน** ได้ และทำให้ **Telegram webhook เสถียรถาวร** (เลิก quick tunnel แบบ ephemeral ที่ตายทุก restart) โดย **ฟรี** (ใช้ของที่บริษัทมีบน Cloudflare อยู่แล้ว) และ **ปลอดภัยพอสำหรับ production ช่วงแรก**

**ไม่ใช่เป้าหมาย (out of scope):** ย้ายแอปขึ้น cloud, Cloudflare Access/SSO (เลื่อนเป็นอนาคต), Telegram Phase 2 (Return/Reject ผ่าน TG), multi-region, แตะ DNS/แอปอื่นของ `car-1996.com`

---

## 2. สภาพแวดล้อมจริง (ข้อเท็จจริงที่ยืนยันแล้ว)

| เรื่อง | ค่า |
|---|---|
| Domain | `car-1996.com` อยู่บน Cloudflare แล้ว, คุณพลับเป็น **admin** |
| Subdomain เป้าหมาย | `memo.car-1996.com` |
| Cloudflare plan | **Free** (DNS Setup: Full = CF authoritative). พอสำหรับเฟส 1 — ดู §10 ข้อจำกัด free-tier |
| เครื่อง prod | **Windows + Docker @ `10.255.255.173`** (แอปรันใน container, map port `3000`) |
| เครื่อง dev/test | เครื่อง trainee (ที่รัน Claude Code) — **test เท่านั้น ไม่ใช่ prod** |
| Server หลัง NAT | เข้าจากเน็ตตรงๆ ไม่ได้ → ต้องใช้ tunnel (outbound-only) |
| เน็ตขาออก → api.telegram.org | เปิด (ยืนยันจาก setWebhook/getWebhookInfo เคยสำเร็จ) |
| Bot | `@CarEmemobot` (id 8657187309), env 4 ตัวตั้งครบใน `.env.local` ของ prod |

---

## 3. สถาปัตยกรรม

```
                         ┌──────────────── Cloudflare Edge ─────────────────┐
                         │              memo.car-1996.com (HTTPS)           │
 พนักงาน (เบราว์เซอร์) ──▶│  WAF rate-limit (/login /register /api/auth/*)   │
                         │  + Bot Fight Mode                                │──┐
 Telegram (webhook) ────▶│  /api/telegram/webhook: WAF allow Telegram-IP   │  │ Cloudflare
                         │                          เท่านั้น                 │  │ Named Tunnel
                         └──────────────────────────────────────────────────┘  │ (outbound-only)
                                                                                ▼
                                       cloudflared (Windows service บน 10.255.255.173)
                                                                                │
                                                                                ▼
                                                          Docker container :3000 (Next.js)
```

**คุมการเข้าถึง = admin-approval ในแอป** (ระบบเดิม): พนักงาน register → `status: pending` → admin อนุมัติที่ `/admin` → login. **ไม่มี Cloudflare Access** ในเฟส 1

---

## 4. Security model

| ชั้น | กลไก | ครอบส่วน |
|---|---|---|
| 1 | **Cloudflare WAF rate-limiting** | `/login`, `/register`, `/api/auth/*` — กัน brute-force/spam register |
| 2 | **Bot Fight Mode** (ฟรี) | ทั้งโดเมน — กันบอตอัตโนมัติ |
| 3 | **App JWT + middleware** (เดิม) | ทุก route ยกเว้น public — unauth → `/login` |
| 4 | **App admin-approval** (เดิม) | pending account login ไม่ได้จนกว่า admin อนุมัติ |
| **webhook** | WAF allow เฉพาะ Telegram CIDR + `TELEGRAM_WEBHOOK_SECRET` header (เดิม) + โค้ดเช็ค `CF-Connecting-IP` (ใหม่) | `/api/telegram/webhook` |

**ความเสี่ยงที่ยอมรับ (เฟส 1):** `/login` `/register` เปิด public — ชดเชยด้วยชั้น 1–2. อนาคตเพิ่ม Cloudflare Access/SSO ได้โดยไม่ต้องรื้อ

**Telegram source CIDR:** `149.154.160.0/20`, `91.108.4.0/22`

---

## 5. งานโค้ด (ทำใน repo → push → deploy ที่ 10.255.255.173)

### 5.1 `sandbox/src/app/api/telegram/webhook/route.ts` — เพิ่ม CF-Connecting-IP check
- เพิ่ม helper `isFromTelegramIp(ip: string): boolean` เทียบ CIDR `149.154.160.0/20`, `91.108.4.0/22` (pure function, แยกไฟล์ `src/lib/telegram/ip-allowlist.ts` เพื่อเทสต์ได้)
- ใน `POST` ก่อน `verifySecret`: อ่าน `request.headers.get("cf-connecting-ip")`; ถ้ามีค่า **และ** ไม่อยู่ใน Telegram CIDR → `403`. ถ้า header ไม่มี (เช่นรันหลัง tunnel ที่ไม่ส่ง หรือ local test) → ข้าม (ให้ secret เป็นด่าน — ไม่ break local/dev)
- **Defense-in-depth:** ชั้นนี้สำรองจาก WAF ไม่ใช่ตัวหลัก
- เทสต์: `ip-allowlist.test.ts` (in-range/out-range/ขอบ CIDR) + เพิ่มเคสใน `webhook/route.test.ts` (IP นอกช่วง → 403, ไม่มี header → ผ่านไปเช็ค secret)

### 5.2 npm script `telegram:set-webhook` — `sandbox/scripts/set-telegram-webhook.mjs`
- อ่าน `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `APP_PUBLIC_BASE_URL` จาก env
- POST `setWebhook` ด้วย `url=${APP_PUBLIC_BASE_URL}/api/telegram/webhook`, `secret_token`, `allowed_updates=["message","callback_query"]`, `drop_pending_updates=true`
- แล้ว `getWebhookInfo` พิมพ์ผลยืนยัน (url, pending_count, last_error)
- เพิ่มใน `package.json`: `"telegram:set-webhook": "node scripts/set-telegram-webhook.mjs"`
- **เพราะ hostname คงที่แล้ว → รันครั้งเดียว** (ไม่ต้องทำทุก restart อีก)

### 5.3 env (ตั้งบนเครื่อง prod `10.255.255.173`, ไฟล์ `.env.local`/compose env)
```
APP_PUBLIC_BASE_URL=https://memo.car-1996.com
AUTH_COOKIE_SECURE=true
```
(ตัว `TELEGRAM_*` มีอยู่แล้ว)

> ⚠️ `AUTH_COOKIE_SECURE=true` ทำให้ cookie ส่งเฉพาะ HTTPS — ใช้ได้เพราะหลัง Cloudflare เป็น HTTPS จริง. **ห้ามตั้ง true บน dev ที่เป็น http://localhost** (จะ login ไม่ได้)

---

## 6. Runbook — งาน infra (รัน **บนเครื่อง prod `10.255.255.173`**)

> ผม (Claude) ทำส่วนนี้ให้ตรงๆ ไม่ได้ — เป็นขั้นตอนที่ต้องรันบนเครื่อง prod โดยคุณพลับ/คนที่เข้าเครื่องนั้นได้

### 6.1 ติดตั้ง + สร้าง Named Tunnel
```powershell
winget install --id Cloudflare.cloudflared    # หรือดาวน์โหลด cloudflared .msi
cloudflared tunnel login                       # เลือก zone car-1996.com ในเบราว์เซอร์
cloudflared tunnel create ememo                # ได้ <TUNNEL-UUID> + ไฟล์ credentials .json
```

### 6.2 config `C:\Users\<user>\.cloudflared\config.yml`
```yaml
tunnel: <TUNNEL-UUID>
credentials-file: C:\Users\<user>\.cloudflared\<TUNNEL-UUID>.json
ingress:
  - hostname: memo.car-1996.com
    service: http://localhost:3000
  - service: http_status:404
```

### 6.3 ผูก DNS + ลงเป็น Windows service
```powershell
cloudflared tunnel route dns ememo memo.car-1996.com   # สร้าง CNAME (ไม่แตะ record เดิม)
cloudflared service install                            # รันถาวร auto-start ตอนบูต
```
- ตั้ง **Service Recovery** (services.msc → cloudflared → Recovery → Restart on failure) เพื่อ auto-restart

### 6.4 Cloudflare dashboard (ทำที่ไหนก็ได้ที่ login admin ได้)
1. **Security → Bots → Bot Fight Mode: On**
2. **Security → WAF → Rate limiting rules** เพิ่ม **1 rule** (Free plan ได้ rule เดียว — รวมทุก path เข้า rule เดียว):
   - Expression: `(http.request.uri.path contains "/login") or (http.request.uri.path contains "/register") or (starts_with(http.request.uri.path, "/api/auth/"))`
   - เช่น 20 requests / 10s ต่อ IP → action: **Managed Challenge** (หรือ Block)
   - หมายเหตุ free-tier: ปรับ characteristic ได้จำกัด (นับตาม IP) — พอสำหรับเฟส 1; อยากแยกหลาย rule/เงื่อนไขละเอียด → Pro
3. **Security → WAF → Custom rules** เพิ่ม rule (webhook IP gate; Free ได้ถึง 5 custom rules):
   - `(http.request.uri.path eq "/api/telegram/webhook") and not (ip.src in {149.154.160.0/20 91.108.4.0/22})` → **Block**

### 6.5 setWebhook (ครั้งเดียว)
```powershell
cd <repo>\sandbox
npm.cmd run telegram:set-webhook      # ใช้ APP_PUBLIC_BASE_URL=https://memo.car-1996.com
```

---

## 7. Verification checklist (จบงานต้องผ่านครบ)

- [ ] `npm.cmd test` (รวมเทสต์ ip-allowlist + webhook ใหม่), `npm.cmd run lint`, `npm.cmd run build` ผ่าน
- [ ] เปิด `https://memo.car-1996.com` จาก**เน็ตนอก** (มือถือ/4G) → เจอหน้า `/login` ของแอป
- [ ] login พนักงานที่ admin อนุมัติแล้ว → ใช้งานได้
- [ ] `getWebhookInfo` → url = `https://memo.car-1996.com/api/telegram/webhook`, ไม่มี `last_error`
- [ ] curl webhook **ไม่มี secret** → `403`
- [ ] curl webhook จาก IP ที่ไม่ใช่ Telegram → **WAF block** (และโค้ด `403` เป็นชั้นสำรอง)
- [ ] end-to-end: /start ผูกบัญชี + กดปุ่ม ✅ อนุมัติใน Telegram สำเร็จ + ปุ่ม "เปิดใน E-Memo" เปิดได้จากเน็ตนอก
- [ ] restart Docker / reboot เครื่อง prod → tunnel กลับมาเอง (Windows service) โดยไม่ต้อง setWebhook ใหม่
- [ ] ลองยิง `/login` รัวๆ → โดน rate-limit/challenge

---

## 8. Rollout order

1. (repo) เขียนโค้ด 5.1–5.2 + เทสต์ → push
2. (prod) deploy: `git pull` + `docker compose up -d --build`
3. (prod) ตั้ง env 5.3 → restart container
4. (prod) Runbook 6.1–6.3 (tunnel + service)
5. (dashboard) 6.4 (Bot Fight + WAF)
6. (prod) 6.5 setWebhook
7. verify §7

---

## 9. Pending / ต้องเตรียม (ก่อน/ระหว่าง execute)

- **สิทธิ์เข้าเครื่อง `10.255.255.173`** — ใครรัน Runbook §6 (คุณพลับเอง / ประสาน IT)
- **รายชื่อพนักงานชุดแรก** ที่จะให้ admin อนุมัติเข้าใช้ (เริ่มกลุ่มเล็ก)
- **อนาคต:** เพิ่ม Cloudflare Access/SSO เป็นชั้นนอกถ้าต้องการความปลอดภัยสูงขึ้น (design รองรับ — แค่เพิ่ม ไม่ต้องรื้อ)

---

## 10. ข้อจำกัด Cloudflare Free tier (ตรวจแล้ว — ไม่บล็อก design)

| สิ่งที่ design ใช้ | Free? | หมายเหตุ |
|---|---|---|
| Named Tunnel + DNS CNAME + Universal SSL | ✅ | ต้องเป็น **proxied (orange cloud)** ถึงได้ WAF/SSL/Bot-fight |
| Bot Fight Mode (basic) | ✅ | "Super Bot Fight Mode" เท่านั้นที่ต้อง Pro |
| WAF Custom rules | ✅ | Free สูงสุด **5 rules**; ใช้ 1 (webhook IP gate) |
| Rate limiting | ⚠️ | Free ได้ **1 rule** + characteristic จำกัด (นับตาม IP) → รวม login/register/auth เป็น rule เดียว (§6.4.2) |
| Upload limit 100 MB | ✅ | แอตเทชเมนต์จำกัด 10 MB อยู่แล้ว ไม่ติด |
| DDoS protection (unmetered) | ✅ | auto |

**สรุป:** Free tier เพียงพอสำหรับเฟส 1 (ผู้ใช้น้อย). ข้อจำกัดเดียวที่ต้องปรับคือ rate-limit รวมเป็น 1 rule. อยากได้ rate-limit หลาย rule/granular หรือ Super Bot Fight → upgrade Pro ($20/เดือน) ภายหลังได้
