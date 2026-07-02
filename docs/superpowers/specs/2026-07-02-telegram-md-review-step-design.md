# Telegram MD Review Step (follow-up plan)

วันที่: 2026-07-02
สถานะ: approved (คุณพลับ 2026-07-02) — รอ writing-plans ก่อนลงมือ
ไฟล์เป้าหมาย (โดยประมาณ): `sandbox/src/lib/workflow-rules.ts`, `workflow-actions.ts`,
`lib/telegram/actions.ts` (ใหม่: token/conversation-state helpers), `lib/notify-memo-event.ts`,
`lib/notifications.ts` (copy templates), `app/api/telegram/webhook/route.ts`

อ้างอิงงานต้นทาง: `docs/superpowers/specs/2026-07-01-md-review-step-design.md` — ส่วน
"5) Telegram — ทำแบบ hybrid ไม่ทำเต็มรูป" ระบุไว้ชัดว่า 2 ปุ่มที่ต้องพิมพ์ข้อความ
(`comment`, `request_revision`) เป็น **out of scope โดยเจตนา**, ใช้ `telegram_conversation_states`
เดิมที่ scaffold ไว้ตั้งแต่ commit ตาราง Telegram (2026-06-12) แต่ไม่เคยเปิดใช้เลย — งานนี้คือ
follow-up ที่ปิด gap นั้น ตามที่คุณพลับสั่งวันที่ 2026-07-02

## ปัญหา

หลัง MD Review Step (10-task) merge และแก้บั๊ก requiresMdReview เสร็จ (commit `82dd846`)
ตรวจพบ 2 ช่องว่างที่ Telegram integration ยังไม่รองรับ:

1. **ปุ่มผิดที่**: เมื่อประตู MD arm (`md_review_status === "pending"`) `current_step` จะเป็น
   `"Managing Director"` ซึ่งทำให้ `notifyApprovers()` resolve ผู้รับถูกต้อง (MD) แต่ยังคง
   ส่งปุ่ม "✅ อนุมัติ" เดิม (`action_type: "approve"`) ซึ่งพอกดจะโดน `evaluateApproveAction`
   ปฏิเสธด้วย 409 "Awaiting MD review" — ปุ่มที่เห็นใช้งานจริงไม่ได้
2. **2 ใน 4 ทางเลือกใช้ผ่าน Telegram ไม่ได้เลย**: `comment`/`request_revision` ต้องมีข้อความ
   อิสระประกอบ ตอนออกแบบรอบแรกจึง defer ไว้ทั้งคู่ ให้ MD ต้องสลับไปเว็บแอปเสมอ
3. **ข้อความ error เป็นภาษาอังกฤษ** (`"Awaiting MD review"` ฯลฯ) โผล่ตรงในแชท Telegram
   ที่พูดไทยทั้งบอท ผ่าน `answerCallbackQuery(cqId, msg, true)` — ข้อความเหล่านี้มาจาก
   `evaluate*Action` helper ทุกตัวใน `workflow-rules.ts`/`workflow-actions.ts` ซึ่งเป็นไฟล์
   กลางที่เว็บก็ใช้ร่วม (เว็บไม่ได้แสดงข้อความนี้ตรงๆ ให้ end-user เห็นตอนนี้ แต่เป็น
   สัญญาแฝงว่าฝั่งเดียวกันควรพูดภาษาเดียวกัน)

## การตัดสินใจ (ยืนยันกับคุณพลับ 2026-07-02)

### 1) ขอบเขต — ทำครบ 4 ทางเลือกผ่าน Telegram

ไม่ใช่แค่ 2 ปุ่มเดิม (ไม่มีข้อโต้แย้ง / ยกระดับ) แต่เปิดใช้ `telegram_conversation_states`
ที่ scaffold ไว้แล้วให้รองรับ `comment`/`request_revision` ด้วย — ไม่มีตารางใหม่ ไม่มี
migration ใหม่ (schema เดิมรองรับได้ครบ: `telegram_user_id`, `user_id`, `memo_id`,
`action_type`, `state`, `payload_json`, `expires_at`)

### 2) แปล error message ทั้งหมดเป็นไทย

แปลทุกข้อความใน `workflow-rules.ts` (13 ข้อความ) และ `workflow-actions.ts` (2 ข้อความ:
"Memo not found", "Forbidden") — ไม่ใช่แค่ที่เกี่ยวกับ MD review เท่านั้น เพื่อให้เว็บ+Telegram
พูดภาษาเดียวกันทั้งหมด ตรวจสอบแล้วว่า**ไม่มี test ใดอ้างอิงข้อความอังกฤษตรงๆ**
(`grep` ทั้ง `workflow-rules.test.ts` และ `route.test.ts` ของ telegram webhook ไม่พบ
`.message`/`.toBe("...")` บนข้อความเหล่านี้เลย) จึงแก้ได้โดยไม่กระทบเทสต์เดิม

### 3) Flow ปุ่มเดียวจบ — copy pattern เดิมทุกอย่าง

`ไม่มีข้อโต้แย้ง` และ `ยกระดับอนุมัติ` ใช้ `telegram_action_tokens` เหมือน `approve`
เดิมทุกประการ: สร้าง token ตอนส่งแจ้งเตือน → callback มา → consume แบบ atomic
(`telegram_user_id` ownership + expiry + `used_at IS NULL` เช็คในคำสั่ง SQL เดียว) →
เรียก `reviewMemoAction()` (ฟังก์ชันเดิมที่ web route `/api/memos/[id]/md-review` ใช้อยู่)

`action_type` ใหม่: `review_no_objection`, `review_escalate` — callback data รูปแบบเดิม
`review_no_objection:<tokenDbId>`, `review_escalate:<tokenDbId>`

ปุ่ม "ยกระดับ" ซ่อนเมื่อ `md_review_resume_step === "Managing Director"` — ตรรกะเดียวกับ
เว็บ (`drawer-footer.tsx`) ต้อง port มาที่ `notify-memo-event.ts` ตอนสร้าง keyboard

### 4) Flow ที่ต้องพิมพ์ข้อความ — เปิดใช้ conversation state

`แสดงความเห็น` / `ขอแก้ไข`:

1. กดปุ่ม (`callback_data`: `review_comment_start:<memoId>`, `review_revision_start:<memoId>`)
   → เขียนแถวใหม่ใน `telegram_conversation_states` (`action_type` = `review_comment` หรือ
   `review_revision`, `state` = `"awaiting_text"`, `expires_at` = +30 นาที เหมือน token อื่น)
   → บอทตอบ "กรุณาพิมพ์..." พร้อม inline keyboard ปุ่มเดียว "ยกเลิก"
   (`callback_data`: `review_cancel:<conversationStateId>`)
2. Webhook ต้องรองรับ **ข้อความอิสระ** เป็นครั้งแรก (ปัจจุบันรับแค่ `/start <token>` กับ
   `callback_query`) — เพิ่ม branch: ถ้า `update.message.text` ไม่ใช่ `/start` และไม่ว่าง
   → หา active conversation state ของ `telegram_user_id` นั้น (ยังไม่หมดอายุ) → ถ้าเจอ
   ถือว่าข้อความนี้คือคำตอบ → map `action_type` → `response` ของ `reviewMemoAction()` ตรงๆ:
   `review_comment` → `{ response: "comment", comment: <ข้อความ> }`,
   `review_revision` → `{ response: "request_revision", reason: <ข้อความ> }`
   → ลบแถว conversation state ก่อนเรียก action เสมอ (กันตอบซ้ำ/double-submit แม้ action
   จะ throw) → เรียก `reviewMemoAction()` ใน try/catch เดียวกับ `handleApproveCallback`
   เดิม (จับ `WorkflowActionError` → `sendTelegramMessage(chatId, err.message)` ข้อความ
   ไทยจากข้อ 2, catch อื่น → ข้อความ error ทั่วไป) → สำเร็จแล้วส่ง `sendTelegramMessage`
   ยืนยันผล
   → ถ้าไม่เจอ (ไม่มี state ค้าง, หรือหมดอายุแล้ว) → **ไม่ตอบอะไรเลย** (เหมือนพฤติกรรมเดิม
   ของ webhook ตอนเจอ update ที่ไม่รู้จัก — ไม่เพิ่ม noise)
3. กด "ยกเลิก" → ลบแถว conversation state ทันที ไม่ต้องรอ 30 นาที

**ความปลอดภัย:** `reviewMemoAction()` เช็คสิทธิ์ MD-or-admin ที่ server เสมอ (ไม่เชื่อ
Telegram เป็นตัวตัดสิน) — conversation state ผูกกับ `telegram_user_id` เจ้าของเดียวกับที่
กดปุ่มเริ่มต้นเท่านั้น (เช็คตอน insert และตอนหา active state ต้อง filter ด้วย
`telegram_user_id` เสมอ ไม่ใช่แค่ `memo_id`)

### 5) จุดที่แก้บั๊กเดิม — `notifyApprovers()`

เพิ่มเงื่อนไขใน `notify-memo-event.ts`: ถ้า `memo.md_review_status === "pending"` →
สร้าง inline keyboard 4 ปุ่ม (หรือ 3 ถ้าซ่อน "ยกระดับ") แทนปุ่ม "✅ อนุมัติ" เดิม พร้อม
เปลี่ยน copy ข้อความแจ้งเตือน (title/body) ให้สื่อว่าเป็นคิว MD review ไม่ใช่คิวอนุมัติปกติ
(เพิ่ม notification type ใหม่ เช่น `memo_md_review_pending` ใน `notifications.ts`)

## Data model

**ไม่มีคอลัมน์ใหม่ ไม่มี migration ใหม่** — ใช้ตารางที่มีอยู่แล้วครบ:
- `telegram_action_tokens.action_type` รับค่าใหม่ 2 ค่า (`review_no_objection`, `review_escalate`)
- `telegram_conversation_states` เปิดใช้ครั้งแรก (`action_type`: `review_comment`, `review_revision`)

## การเปลี่ยนโค้ด

- `workflow-rules.ts`: แปล 13 ข้อความ error เป็นไทย (ไม่เปลี่ยน `status` code ใดๆ)
- `workflow-actions.ts`: แปล 2 ข้อความ error เป็นไทย
- `lib/telegram/actions.ts`: เพิ่ม `createReviewActionToken`/`consumeReviewActionToken`
  (mirror `createApproveActionToken`/`consumeApproveActionToken`, รับ response type เป็น
  parameter), เพิ่ม `createReviewConversationState`, `findActiveReviewConversationState`,
  `deleteReviewConversationState` (CRUD บาง ๆ บน `telegram_conversation_states`)
- `lib/notifications.ts`: เพิ่ม copy template `memo_md_review_pending` (title/body ภาษาไทย)
- `lib/notify-memo-event.ts`: `notifyApprovers()` แยก branch ตาม `md_review_status`,
  สร้าง keyboard ใหม่ตามข้อ 3-4 ข้างบน, ซ่อนปุ่ม "ยกระดับ" ตามเงื่อนไขเดิม
- `app/api/telegram/webhook/route.ts`:
  - เพิ่ม `handleReviewCallback()` (ปุ่มเดียวจบ, mirror `handleApproveCallback`)
  - เพิ่ม `handleReviewStartCallback()` (เริ่ม conversation state + ตอบ prompt)
  - เพิ่ม `handleReviewCancelCallback()` (ลบ conversation state)
  - เพิ่ม branch รับข้อความอิสระใน `POST` handler (ก่อน return `{ok:true}` ท้ายฟังก์ชัน)
    เช็ค active conversation state แล้วเรียก `reviewMemoAction()`

## Test impact

- `workflow-rules.test.ts`: ตรวจว่าไม่มี assertion ใดพังจากการแปลข้อความ (มีอยู่แล้วว่าไม่มี
  test อ้างอิงข้อความอังกฤษ — รัน suite ยืนยันซ้ำหลังแก้)
- `telegram/actions.test.ts`: เทสต์ token create/consume สำหรับ `review_no_objection`/
  `review_escalate` (pattern เดียวกับ approve token tests เดิม), เทสต์
  conversation-state create/find-active/delete รวมกรณีหมดอายุ + telegram_user_id ไม่ตรง
- `notify-memo-event.test.ts` (หรือไฟล์เทียบเท่าที่มีอยู่): เทสต์ `notifyApprovers` ส่ง
  keyboard ถูกแบบเมื่อ `md_review_status === "pending"` เทียบกับ pending ปกติ, เทสต์ซ่อน
  ปุ่ม "ยกระดับ" ตามเงื่อนไข
- `app/api/telegram/webhook/route.test.ts`: เทสต์ callback ใหม่ทั้ง 3 ตัว
  (`review_no_objection`, `review_escalate`, `review_*_start`, `review_cancel`) และ
  เทสต์ branch รับข้อความอิสระ (มี state / ไม่มี state / state หมดอายุ / telegram_user_id
  ไม่ตรง)

## Out of scope (รอบนี้ไม่ทำ)

- Full revision-impact classification, normalized `workflow_steps`/`approval_rule_sets` —
  เหมือนเดิม ไม่เกี่ยวกับงานนี้
- Rate-limiting หรือ retry ข้อความอิสระที่ไม่ตรง conversation state ใดๆ (แค่เงียบไว้)
- แปล error message ในไฟล์อื่นนอกเหนือจาก `workflow-rules.ts`/`workflow-actions.ts`
  (เช่น `db-memo-write.ts` ถ้ามี) — ถ้าเจอระหว่างทำค่อยแยกเป็นงานถัดไป ไม่ scope-creep
  เข้ามาในแผนนี้

## วิธีทำ

TDD ตามทุกไฟล์ที่แตะ business logic แยกเป็นงานย่อยตามลำดับพึ่งพา: (1) แปล error message
ทั้งหมด (เดี่ยว ไม่พึ่งอะไร), (2) token/conversation-state helpers ใน `telegram/actions.ts`,
(3) `notify-memo-event.ts` แก้ `notifyApprovers`, (4) webhook route เพิ่ม handler ครบ 4
ทางเลือก + branch ข้อความอิสระ, (5) manual walkthrough จริงผ่าน Telegram (ไม่ใช่แค่ unit
test) ก่อนถือว่าปิดงานได้ เพราะบทเรียนจากงาน MD Review Step รอบก่อนคือ unit test เขียวหมด
ไม่ได้แปลว่า wiring จริงถูกต้อง
