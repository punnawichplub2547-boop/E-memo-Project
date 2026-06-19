# Attachment Access Control

วันที่: 2026-06-19
สถานะ: approved (คุณพลับ 2026-06-19)
ทีม: ฟ้าใส (ออกแบบ/coordinate) · โหน่ง (build) · หม่ำ (review)

## ปัญหา

route attachment ปัจจุบันไม่มี per-memo authorization:
- **Download** (`GET /api/attachments/[memoId]/[storedName]`) — มี path-traversal
  defense แน่น แต่ user ที่ login แล้วคนไหนก็ดึง attachment ของ memo ใดก็ได้ถ้ารู้
  memoId + storedName (memoId เดาได้ เช่น EM-2026-XXX)
- **Upload** (`POST /api/attachments`) — handler ไม่เช็ค session เลย (มีแค่ middleware
  กันคนยังไม่ login) ใครที่ login แล้ว upload ไฟล์ไป memoId ใดก็ได้

middleware กันแค่ "login แล้วหรือยัง" ไม่ได้กัน "เห็น/เป็นเจ้าของ memo นี้ไหม"

## เป้าหมาย

เพิ่ม per-memo authorization โดย reuse `isMemoVisibleTo()` + `isMemoOwner()` ที่มีอยู่
ย้าย authorization logic เป็น pure helper (testable) — route เรียกใช้ (สไตล์เดียวกับ
`isMemoOwner` ใน feature ก่อน)

## ขอบเขต (YAGNI)

โฟกัส **access control** อย่างเดียว — virus scan, rate limiting อยู่นอก scope
(future production item ตาม CLAUDE.md)

## Helper ใหม่

- `loadMemoRecord(memoNo: string): Promise<MemoRecord | null>` ใน `src/lib/db-memos.ts`
  — โหลด memo เดี่ยวจาก DB + `serializeMemoRecord` (reuse) คืน null ถ้าไม่เจอ.
  ใช้ร่วมทั้ง 2 route
- `canDownloadAttachment(memo: MemoRecord | null, session: SessionUser, storedName: string): boolean`
- `canUploadAttachment(memo: MemoRecord | null, session: SessionUser): boolean`
  — pure helper (เสนอไว้ที่ `src/lib/attachment-access.ts` ใหม่) unit-test ได้

## Download (`GET /api/attachments/[memoId]/[storedName]`)

1. verify session (`getActiveSessionUserFromToken`) → ไม่มี → **401**
2. `loadMemoRecord(memoId)` → ไม่เจอ → **404**
3. `canDownloadAttachment(memo, session, storedName)`:
   - `isMemoVisibleTo(memo, session)` = false → false → route ตอบ **403**
   - storedName ไม่อยู่ใน `memo.attachments` (เทียบ `storedName`) → false → route ตอบ **404**
     (defense-in-depth: กันดึงไฟล์ที่อยู่ในโฟลเดอร์แต่ไม่ใช่ attachment ที่ลิสต์)
   - ผ่านทั้งคู่ → true
4. คง path-traversal defense (`isSafeAttachmentSegment` + `path.relative`) + streaming เดิม

หมายเหตุลำดับ: เช็ค session + authorization **ก่อน** อ่านไฟล์จากดิสก์

## Upload (`POST /api/attachments`) — hybrid

1. verify session → ไม่มี → **401**
2. `loadMemoRecord(memoId)` แล้ว `canUploadAttachment(memo, session)`:
   - **memo == null** (memo ใหม่กำลังสร้าง ยังไม่ลง DB) → true (session-only) — รองรับ
     flow create เดิม (`uploadSelectedAttachments(memoId)` ยิงก่อน memo ถูก persist)
   - **memo != null** → ต้อง `isMemoOwner(memo, session)` หรือ `session.roles.includes("admin")`
     → ไม่ใช่ → false → route ตอบ **403**
3. คง validation เดิม (size 10MB / allowed type / sanitize) + storage

## Test plan

`src/lib/attachment-access.test.ts` (ใหม่):
- `canDownloadAttachment`:
  (a) visible + storedName listed → true
  (b) visible แต่ storedName ไม่ listed → false
  (c) ไม่ visible → false
  (d) memo null → false
- `canUploadAttachment`:
  (a) memo null (ใหม่) + session → true
  (b) memo มี + owner → true
  (c) memo มี + คนอื่น (ไม่ owner ไม่ admin) → false
  (d) memo มี + admin → true

ปิดงาน: `npm.cmd test` (เดิม 410) + `lint` + `build` ต้องผ่าน

## ผลกระทบ flow อื่น

- **Create flow**: upload เกิดก่อน memo ลง DB → `canUploadAttachment` คืน true (memo null
  + session) → flow เดิมไม่พัง
- **Revision**: attachment editing deferred อยู่แล้ว (UI ไม่เปิด file picker) — ถ้ามีการ
  เรียก POST ด้วย memoId ที่มีใน DB จะถูก gate ด้วย owner/admin (ถูกต้อง)
- **Queue drawer download**: ผู้ที่เห็น memo (อยู่ในเงื่อนไข visibility) ดาวน์โหลดได้ตามเดิม
  — ไม่กระทบ UX ของคนที่มีสิทธิ์

## ความเสี่ยง / ลำดับ implement

1. helper `loadMemoRecord` + `attachment-access.ts` + tests (RED→GREEN) ก่อน
2. เสียบเข้า download route (เพิ่ม session + authorize ก่อนอ่านไฟล์)
3. เสียบเข้า upload route (เพิ่ม session + authorize ก่อนเขียนไฟล์)
4. test/lint/build

ระวัง:
- อย่าทำ create flow พัง — memo null = อนุญาต upload (session-only)
- เทียบ attachment ด้วย `storedName` (ค่าใน URL) ไม่ใช่ `originalName`
- session อ่านใน handler (routes เป็น nodejs runtime อยู่แล้ว — ใช้ getActiveSessionUserFromToken ได้)
