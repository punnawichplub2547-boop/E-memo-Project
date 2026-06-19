# Admin Audit Log (dedicated view) + per-memo audit auth fix

วันที่: 2026-06-19
สถานะ: approved (คุณพลับ 2026-06-19)
ทีม: ฟ้าใส (ออกแบบ/vet/coordinate) · โหน่ง (build) · หม่ำ (review)

## ปัญหา

`workflow_step_actions` (audit trail จริง) ถูก surface เฉพาะใน queue drawer ต่อ memo
เท่านั้น — ไม่มีหน้า audit รวมระบบ และ endpoint per-memo เดิมก็ไม่มี authorization

## เป้าหมาย (2 ส่วน)

1. **หน้า Audit Log รวมระบบ (admin-only)** — tab ที่ 5 ใน `/admin` + API ใหม่
2. **อุด gap**: gate endpoint per-memo เดิม (`GET /api/memos/[id]/workflow-actions`)
   ด้วย memo visibility (theme เดียวกับ attachment access control)

## Access

admin-only (gate ด้วย role `admin` = บัญชี ADMIN001 ที่เพิ่งแยกออกมา) — audit ข้าม
memo เป็นข้อมูลอ่อนไหว HR&GA ไม่ใช่ privileged role

## 1. API ใหม่: `GET /api/admin/audit`

- gate: `getActiveSessionUserFromToken(token)` → ไม่มี = **401**; `!roles.includes("admin")` = **403**
  (pattern เดียวกับ `/api/admin/users`)
- query `workflow_step_actions` **JOIN `memos`** (เอา `memo_no`) — **ไม่กรอง `deleted_at`**
  (audit ต้องเห็น action ของ memo ที่ถูก void ด้วย; destroyed memo ลบ action ไปแล้วเป็นปกติ)
- `ORDER BY acted_at DESC, id DESC`
- filters (query param, optional): `memo` (memo_no LIKE), `action` (action_type =),
  `actor` (actor_name LIKE), `from` / `to` (acted_at range)
- pagination: `limit` (default 50, **clamp 1..100**) + `offset` (default 0, >=0)
- คืน `{ rows: WorkflowAction[], total }` (total = COUNT(*) ด้วย WHERE เดียวกัน)
- reuse `serializeWorkflowAction(memo_no, row)` (มี memo_no จาก JOIN)

## 2. Pure helper (testable) — `src/lib/audit-query.ts`

`buildAuditQuery(filters)` → `{ whereSql, params, limit, offset }`
- รับ filters ที่ normalize แล้ว (memo/action/actor/from/to/limit/offset)
- ประกอบ WHERE จากเฉพาะ filter ที่มีค่า + params ตามลำดับ
- clamp limit เป็น 1..100 (default 50), offset >= 0 (default 0)
- action_type filter: ตรวจกับ **รายการตายตัว** ของ action types ที่รู้จัก
  — **ค่าจริงที่ระบบ INSERT (verify แล้วตอน build):**
  `submit, save_draft, check, approve, return_for_revision, reject, read,
  skip_read, resubmit, void, restore` (11 ค่า; export เป็น `KNOWN_ACTION_TYPES`
  ใน audit-query.ts) ค่านอกรายการ = ไม่ filter
  (หมายเหตุ: ฉบับร่างแรกเดาชื่อผิด — แก้เป็นค่าจริงนี้)
- route เรียก helper นี้แล้วต่อ SQL — logic filter/clamp ทดสอบได้แบบ unit

## 3. UI: tab ที่ 5 "Audit Log / ประวัติการดำเนินการ" ใน `/admin`

- ตาราง: เวลา (actedAt) · memo_no · action_type · step_label · actor_name · result · reason
  (null → แสดง "—"; reason ยาว → truncate + ขยายได้)
- filter controls: action_type (reuse `FilterDropdown`), ช่องค้น memo_no, ช่องค้น actor,
  date range (from/to)
- pagination: prev/next (ใช้ offset) + แสดง total
- สไตล์ตาม admin tab เดิม (อ่าน `/admin/page.tsx` ตาม pattern tab ที่มี)

## 4. Fix endpoint per-memo เดิม

`src/app/api/memos/[id]/workflow-actions/route.ts`:
- เพิ่ม verify session (401 ถ้าไม่มี)
- `loadMemoRecord(memoNo)` (reuse จาก feature attachment) → ไม่เจอ = 404
- `isMemoVisibleTo(memo, session)` = false → **403**
- ผ่านแล้วค่อยคืน actions เดิม
- หมายเหตุ: route นี้รับ memo_no อยู่แล้ว; loadMemoRecord ใช้ memo_no

## Test plan

`src/lib/audit-query.test.ts` (ใหม่):
- (a) ไม่มี filter → whereSql ว่าง, limit default 50, offset 0
- (b) แต่ละ filter (memo/action/actor/from/to) → where + param ถูกต้องตามลำดับ
- (c) limit เกิน 100 → clamp 100; limit < 1 หรือไม่ใช่ตัวเลข → default 50; offset ติดลบ → 0
- (d) action นอกรายการตายตัว → ไม่เข้า where
- (e) ผสมหลาย filter → where ต่อด้วย AND ครบ params เรียงถูก

ปิดงาน: `npm.cmd test` (เดิม 419) + `lint` + `build` ต้องผ่าน

## Known limitation (ไม่ทำรอบนี้ — note ไว้)

`workflow_step_actions.actor_name` เป็น free-text (ไม่ใช่ FK) — audit actor ยังกำกวม
แบบเดียวกับ requester ก่อนทำ FK การเพิ่ม `actor_user_id` FK เป็นงานใหญ่กว่า แยกทีหลัง

## นอก scope (YAGNI)

export CSV/PDF, real-time refresh, actor_user_id FK — ยังไม่ทำ (read-only view ก่อน)

## ลำดับ implement

1. pure helper `audit-query.ts` + test (RED→GREEN)
2. API `/api/admin/audit` (gate + JOIN + helper + pagination)
3. fix per-memo endpoint (session + loadMemoRecord + isMemoVisibleTo)
4. UI tab ใน /admin
5. test/lint/build
