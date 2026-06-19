# Telegram Transport & Security — สถานะปัจจุบันและแผนก่อน deploy

วันที่บันทึก: 2026-06-19

## สถานะปัจจุบัน (interim — ยอมรับได้เพราะยังไม่ deploy จริง)

- **Transport: Webhook + Cloudflare quick tunnel** (`trycloudflare.com`)
- bot: `@CarEmemobot`, env อยู่ใน `sandbox/.env.local` (`TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, `APP_PUBLIC_BASE_URL`)
- webhook route: `src/app/api/telegram/webhook/route.ts` — มี timing-safe
  `TELEGRAM_WEBHOOK_SECRET` check แล้ว
- **ยังไม่ deploy production** — ระบบเป็น prototype/sandbox ฉะนั้นรับความเสี่ยง
  ของ quick tunnel ไว้ก่อนได้

### ข้อจำกัด/ความเสี่ยงที่รู้ตัว (ของ interim นี้)
1. **quick tunnel เป็น ephemeral** — สุ่ม hostname ใหม่ + ตายเมื่อ process/เครื่อง
   restart ต้องเปิด tunnel ใหม่แล้ว `setWebhook` ซ้ำทุกครั้ง
   - relive: `cloudflared tunnel --url http://localhost:3000` → setWebhook
     URL ใหม่ + `secret_token=<TELEGRAM_WEBHOOK_SECRET>`
2. **tunnel เปิด "ทั้งแอป" ออกสู่อินเทอร์เน็ต** ไม่ใช่แค่ path webhook — ใครรู้ URL
   ก็ยิงหน้า login/โจมตีทั้งระบบได้ (attack surface ก้อนใหญ่) ป้องกันด้วย JWT +
   middleware ของแอปเท่านั้น ณ ตอนนี้

## Infra จริงของบริษัท (เช็คแล้ว 2026-06-19)
- `car-1996.com` ใช้ DNS ภายใน (`adserver.car-1996.com` → `10.0.0.236`, private IP)
- app server อยู่หลัง NAT เข้าถึงจากอินเทอร์เน็ตตรงๆ ไม่ได้ → ต้องพึ่ง tunnel
- เน็ตขาออกไป `api.telegram.org` เปิดอยู่ (ยืนยันจากการ setWebhook/getWebhookInfo สำเร็จ)

## แผน hardening ที่ต้องทำ "ก่อน deploy จริง" (ตัดสินใจไว้ ยังไม่ลงมือ)

ทางที่เลือก: **อยู่กับ Cloudflare แต่ทำให้ปลอดภัยสุด** (ดูบทสนทนา 2026-06-19)

1. **Named Cloudflare Tunnel** แทน quick tunnel — hostname คงที่ + รันเป็น Windows
   service (แก้ ephemeral/restart)
2. **Cloudflare Access (Zero Trust)** ครอบทั้งแอป — บังคับยืนยันตัวตนก่อนถึงแอป
   (ฟรีถึง 50 users) อุดช่องโหว่ "ทั้งแอปโผล่บนเน็ต"
3. **ยกเว้น path `/api/telegram/webhook`** จาก Access (Bypass policy) เพราะ Telegram
   เป็นบอท login ไม่ได้ — ชดเชยด้วย:
   - `TELEGRAM_WEBHOOK_SECRET` header (มีแล้ว)
   - WAF rule อนุญาตเฉพาะ IP Telegram: `149.154.160.0/20`, `91.108.4.0/22`
   - (โค้ด) เพิ่มเช็ค `CF-Connecting-IP` เทียบ CIDR Telegram ใน webhook route
4. WAF / rate limit / bot protection บนส่วนที่เหลือ

**เงื่อนไขชี้ขาด:** ต้องมี **domain บน Cloudflare** ก่อน (จด domain ใหม่ ~฿300-400/ปี
แล้วเข้า Cloudflare เอง, หรือให้ IT บริษัทย้าย/delegate subdomain ของ `car-1996.com`)

## ทางเลือกสำรองที่เคยพิจารณา (ไม่เลือกตอนนี้)
- **Long polling (`getUpdates`)** — ไม่ต้องมี tunnel/URL/HTTPS/domain เลย เหมาะกับ
  server หลัง NAT และปลอดภัยกว่า (ไม่เปิด attack surface) ปุ่ม `✅ อนุมัติ`
  (callback) ยังกดจากนอกเน็ตได้ **ไม่เลือกเพราะ** ปุ่ม `เปิดใน E-Memo` (เปิดตัวแอป)
  จะใช้จากนอกเครือข่ายไม่ได้ — คุณพลับต้องการให้เปิดแอปจากนอกได้ จึงคง webhook+tunnel ไว้
