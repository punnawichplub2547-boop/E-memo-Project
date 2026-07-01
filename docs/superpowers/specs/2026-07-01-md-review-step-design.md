# MD Review Step (Book1 §"ยกเว้นปรับราคา ต้องเสนอ MD")

วันที่: 2026-07-01
สถานะ: approved (คุณพลับ 2026-07-01) — รอ writing-plans ก่อนลงมือ
ไฟล์เป้าหมาย (โดยประมาณ): `sandbox/src/lib/approval.ts`, `workflow-rules.ts`, `workflow-actions.ts`,
`db-memo-write.ts`, `db-seed.ts`, `app/api/memos/[id]/md-review/route.ts` (ใหม่),
`app/queue/_components/drawer-footer.tsx`, `app/create/_components/RoutingCard.tsx` (หรือไฟล์ badge ที่เกี่ยวข้อง),
`lib/telegram/*`, `app/api/telegram/webhook/route.ts`, `db/migrations/*.sql` (ใหม่)

อ้างอิง spec ต้นทาง: `docs/system-analysis-dfd-erd.md` §6.5 (MD Review For Price Adjustment),
§7 (state model), §14.9 (memos ERD), §14.16 (workflow_step_actions). พบเป็นช่องว่างจาก
audit เต็มโปรเจกต์ 2026-07-01 (ดู ERR-0007 ใน `D:\MEMORY` / memory `project_full_audit_0701.md`).

## ปัญหา

Book1 กำหนดว่ากรณีปรับราคา (raw-material/fixed-asset ที่ตั้ง `isPriceAdjustment`) ต้อง
"เสนอ MD" — spec ตีความว่าเป็น **MD Review / Opinion ที่บล็อก workflow จนกว่า MD จะตอบ**
แรงกว่าการอ่านรับทราบเฉยๆ (`notifyMD` ปัจจุบันเป็นแค่ CC ไม่บล็อกอะไร ไม่ตรง spec)

โค้ดปัจจุบัน (`getApprovalRecommendation`) ตั้ง `notifyMD: true` เมื่อ `isPriceAdjustment`
เป็นจริงบน raw-material/fixed-asset เท่านั้น — เป็น trigger เดียว ไม่ถูกใช้ซ้ำเพื่อจุดประสงค์อื่น
จึงนำ trigger เดิมมาต่อยอดเป็นเกทใหม่ได้โดยไม่กระทบ business rule อื่น

## การตัดสินใจ

### 1) ตำแหน่งของเกท
MD Review เกิด **หลัง Manager/Top Section check เสร็จ ก่อนขั้น GM/MD ถัดไป** — Manager
ยังเช็คได้ทันทีตามปกติไม่ถูกบล็อก ตรงกับลำดับ state ที่ spec เขียนไว้
(`pending_check → pending_read → pending_review → pending_approval`)

กลไก: ตอน Manager's check คำนวณ "ขั้นต่อไปจริง" ตามเส้นทางปกติ (`calculateNextStep`)
ถ้า `requires_md_review` เป็นจริงและยังไม่เคย review — **stash** ขั้นต่อไปจริงไว้ที่
`md_review_resume_step`, ตั้ง `current_step = "Managing Director"`,
`md_review_status = "pending"` แทนที่จะเดินไปขั้นจริงตรงๆ Manager's check ยัง record
ตามปกติ ไม่มีอะไรเปลี่ยนสำหรับ Manager

### 2) 4 คำตอบของ MD (ตรงตาม spec)
- `acknowledged_no_objection` / `comment` → `md_review_status = "completed"`,
  `current_step` ← `md_review_resume_step`. **ข้อยกเว้น:** ถ้า `md_review_resume_step`
  เป็น `"Managing Director"` เอง (คือ MD เป็นผู้อนุมัติสุดท้ายตามเกณฑ์ปกติอยู่แล้ว) —
  คำตอบนี้ **finalize เป็น approved ทันทีในคลิกเดียว** (merge MD_REVIEW+APPROVE ตาม
  spec บรรทัด 246) ไม่ต้องให้ MD กดอนุมัติซ้ำ
- `request_revision` → **ใช้ flow เดียวกับ Return ที่มีอยู่แล้วทุกอย่าง**
  (`status → returned`, ต้องมีเหตุผล, กลับไปหา Issued Person, resubmit แล้วรีเซ็ต
  `md_review_status` กลับเป็น `pending` เพราะ price-adjustment flag เป็น risk-driving
  field ตาม §6.8)
- `escalate_to_md_approval` → **MD ตัดสินใจเองทันที ข้าม GM ที่เหลือ จบเลย**
  (`status → approved` ทันที ไม่สนใจ `md_review_resume_step`)

**UI simplification (เห็นด้วยจากทีม):** ถ้า `md_review_resume_step === "Managing Director"`
อยู่แล้ว ปุ่ม "ยกระดับ" กับ "ไม่มีข้อโต้แย้ง" จะให้ผลเหมือนกันทุกอย่าง (approved ทันที) —
**ซ่อนปุ่ม "ยกระดับ" ในเคสนี้** เหลือ 3 ปุ่ม กันความสับสน

### 3) ความสัมพันธ์กับ Read-gate
**เป็นคนละเรื่องกัน โดยเจตนา** — `evaluateReviewAction` ไม่เช็ค `pendingReadCount`
เลย MD ตอบ review ได้แม้ read recipients ยังไม่ครบ (read-gate ยังคงบล็อกเฉพาะ
approve action ปกติเหมือนเดิม ไม่เปลี่ยนพฤติกรรมเดิม)

### 4) การบล็อก approve ปกติระหว่างรอ review
`evaluateApproveAction` (และ return/reject) ต้องปฏิเสธเมื่อ
`md_review_status === "pending"` (409 "รอ MD พิจารณาก่อน") กันไม่ให้ข้ามเกทผ่าน
endpoint เดิมตรงๆ

### 5) Telegram — ทำแบบ hybrid ไม่ทำเต็มรูป
- **2 ปุ่มที่กดจบในคลิกเดียว** (`ไม่มีข้อโต้แย้ง`, `ยกระดับ`) — ทำจริงผ่าน Telegram
  โดย copy pattern `telegram_action_tokens` / `createApproveActionToken` /
  `handleApproveCallback` เดิมทุกอย่าง แค่เพิ่ม `action_type` ใหม่
  (`review_no_objection`, `review_escalate`) และ callback data รูปแบบเดียวกัน
  (`review_no_objection:<tokenDbId>`, `review_escalate:<tokenDbId>`)
- **2 ปุ่มที่ต้องพิมพ์ข้อความ** (`แสดงความเห็น`, `ขอแก้ไข`) — **ไม่ทำ conversation state
  รอบนี้** ปุ่ม Telegram กดแล้วตอบกลับข้อความ "กรุณาดำเนินการต่อในเว็บแอป" พร้อมลิงก์
  deep-link ไปหน้า queue ของเมโมนั้น (ใช้ `toSafeInternalPath`/`actionUrl` pattern
  เดิม) — ของเดิม `telegram_conversation_states` ที่เคย defer ไว้สำหรับ Return/Reject
  **ยังคง deferred เหมือนเดิม ไม่แตะ**

## Data model (คอลัมน์ใหม่บน `memos`)

| Column | Type | หมายเหตุ |
|---|---|---|
| `requires_md_review` | BOOLEAN NOT NULL DEFAULT 0 | คำนวณจาก trigger เดียวกับ `notify_md` ปัจจุบัน (price adjustment บน raw-material/fixed-asset) |
| `md_review_status` | VARCHAR(20) NULL | `pending` \| `completed` \| `escalated` \| NULL (ไม่ต้อง review) |
| `md_review_resume_step` | VARCHAR(80) NULL | ขั้นที่ควรไปต่อจริงหลัง review เคลียร์ |
| `md_review_comment` | TEXT NULL | คอมเมนต์ของ MD (ตอบ `comment`) |
| `md_review_acted_by` | VARCHAR(200) NULL | ชื่อ MD ที่ตอบ |
| `md_review_acted_at` | DATETIME NULL | เวลาที่ตอบ |

Migration ใหม่: `db/migrations/2026-07-01-add-md-review-columns.sql` (ALTER TABLE เพิ่ม
6 คอลัมน์ข้างต้น, ต้องรันบน DB ที่มีอยู่แล้วเหมือน migration อื่นๆ ในโปรเจกต์)

`workflow_step_actions` (ตารางเดิม ไม่ต้องเพิ่มตาราง): บันทึก
`action_type: "review"`, `result` = หนึ่งใน 4 ค่า, `reason`/`comment` ใน field ที่มีอยู่

## การเปลี่ยนโค้ด

- `approval.ts`: เพิ่ม `requiresMdReview` ในผลลัพธ์ของ `getApprovalRecommendation`
  (คำนวณเงื่อนไขเดียวกับ `notifyMD` — อาจ derive ตรงจาก `notifyMD` เลยแทนคำนวณซ้ำ)
- `workflow-rules.ts`: เพิ่ม `evaluateReviewAction()` (pattern เดียวกับ evaluateApproveAction
  ฯลฯ) — guard: actor เป็น Managing Director tier (หรือ admin), `current_step ===
  "Managing Director"`, `md_review_status === "pending"`. แก้ `guardActorAndMemo`
  (หรือจุดเทียบเท่า) ให้ approve/return/reject ปกติ reject เมื่อ `md_review_status
  === "pending"`. แก้ transition หลัง Manager's check ให้ stash resume step
- `workflow-actions.ts`: เพิ่ม `reviewMemoAction()` — trusted path เดียวกับ
  approve/return/reject (`FOR UPDATE`, transaction เดียวกัน)
- API ใหม่: `POST /api/memos/[id]/md-review` — body `{ response, comment?, reason? }`
  (reason จำเป็นเมื่อ `response === "request_revision"`)
- `db-memo-write.ts` / `db-seed.ts`: เพิ่ม 6 คอลัมน์ใหม่เข้า insert/serialize path;
  `sanitizeNewMemoInput` (ที่เพิ่งทำวันนี้จาก audit) ต้อง force
  `md_review_status = requiresMdReview ? "pending" : null` ตอนสร้างเมโมใหม่เช่นกัน —
  ห้ามให้ client กำหนดค่าพวกนี้เองตอนสร้าง (คนละสาเหตุ แต่หลักการ trust-boundary
  เดียวกับที่แก้ไปแล้วใน ERR-0007)
- `db-memo-write.ts` (resubmit/submit-revision payload builders): รีเซ็ต
  `md_review_status` กลับเป็น `pending` (ถ้ายัง `requiresMdReview`) ทุกครั้งที่ resubmit
- `drawer-footer.tsx`: footer ใหม่เมื่อ `current_step === "Managing Director" &&
  md_review_status === "pending"` — 3-4 ปุ่มตาม resume_step (ดูข้อ 2)
- `create/page.tsx` (badge): เปลี่ยนคำจาก "แจ้ง MD เพื่อทราบ" เป็นข้อความสะท้อนว่าเป็น
  เกทบล็อกจริง เช่น "ต้องผ่านการพิจารณาของ MD ก่อนอนุมัติ"
- `lib/telegram/actions.ts`: เพิ่ม `createReviewActionToken`/`consumeReviewActionToken`
  (สอง action_type: `review_no_objection`, `review_escalate`)
- `app/api/telegram/webhook/route.ts`: เพิ่ม branch รับ callback `review_no_objection:` /
  `review_escalate:` (เรียก `reviewMemoAction`) และ branch สำหรับ 2 ปุ่มที่ต้องพิมพ์
  (`review_comment:`, `review_request_revision:`) ที่แค่ตอบข้อความ + ลิงก์ ไม่ต้องเรียก
  action ใดๆ
- `notify-memo-event.ts` / การส่ง Telegram แจ้ง MD: เปลี่ยนจากส่ง inline keyboard ปุ่มเดียว
  (approve) เป็น 3-4 ปุ่มเมื่อ memo อยู่ในสถานะ `md_review_status === "pending"`

## Test impact

- `workflow-rules.test.ts`: เพิ่มเทสต์ `evaluateReviewAction` ครบ 4 response, เทสต์ merge
  (resume_step = Managing Director → auto-approve), เทสต์ approve/return/reject ปกติ
  ถูก reject เมื่อ `md_review_status === "pending"`
- `db-memo-write.test.ts`: เทสต์ `sanitizeNewMemoInput` force ค่าเริ่มต้นของ md_review_*
  ให้ถูกต้อง, เทสต์ resubmit/submit-revision รีเซ็ต `md_review_status`
- `approval.test.ts`: เทสต์ `requiresMdReview` sync กับ `notifyMD` เดิม
- Telegram: เทสต์ token create/consume สำหรับ 2 action_type ใหม่ (pattern เดียวกับ
  approve token tests ที่มีอยู่)

## Out of scope (รอบนี้ไม่ทำ)

- Telegram conversation state สำหรับ `comment`/`request_revision` (ยังคง deferred
  เหมือนเดิม — ไม่ใช่ของใหม่ที่ค้างจากงานนี้)
- Revision-impact classification (minor vs approval-affecting) เต็มรูป — resubmit
  ทุกกรณียังกลับไป Manager ก่อนเหมือนเดิม (known gap เดิม ไม่ได้แก้ในรอบนี้)
- Normalized `workflow_steps`/`approval_rule_sets` ตาม ERD เต็มรูป — ยังใช้
  `current_step` string + `selected_route_json` array แบบเดิม

## วิธีทำ

TDD ตามทุกไฟล์ที่แตะ business logic: เขียนเทสต์ก่อน (RED) → implement (GREEN) →
`npm.cmd test` + `npm.cmd run lint` + `npm.cmd run build` ก่อนถือว่าเสร็จ แยกเป็นงานย่อย
ตามลำดับที่ต้องพึ่งพากัน: (1) data model + sanitize, (2) evaluateReviewAction +
reviewMemoAction + API, (3) UI (badge + drawer footer), (4) resubmit reset, (5)
Telegram hybrid buttons
