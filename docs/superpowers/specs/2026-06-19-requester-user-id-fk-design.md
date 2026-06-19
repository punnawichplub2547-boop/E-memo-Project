# เพิ่ม `requester_user_id` FK ให้ตาราง `memos`

วันที่: 2026-06-19
สถานะ: approved (คุณพลับ 2026-06-19)
แนวทาง: A (real FK + graceful name fallback)
ทีม: เท่ง (ออกแบบ) · โหน่ง (build) · หม่ำ (review)

## ปัญหา

ระบบระบุตัว "ผู้ขอ" (requester) ด้วยการ match ชื่อ free-text (`requester_name`)
ใน 3 จุด — notification fan-out, memo visibility, ownership check — ซึ่งเปราะ:
ชื่อซ้ำ → ระบุผิดคน/เห็น memo คนอื่น; ชื่อเปลี่ยน → ระบุไม่เจอเงียบๆ

## เป้าหมาย

เพิ่ม `requester_user_id` FK → `users(id)` แล้วให้ทั้ง 3 จุด identity ใช้ FK
เป็นหลัก ตกหล่นค่อย fallback ไป match ชื่อ (รองรับ legacy/seed/prototype)

## หลักการกลาง (สำคัญสุด)

- FK **ไม่ null** → ใช้ FK เด็ดขาด **ห้าม fallback ไป match ชื่อต่อ** (นี่คือตัวแก้บั๊กชื่อซ้ำ)
- FK **null** → fallback match ชื่อเดิม (รองรับข้อมูลเก่า/seed/prototype)
- field เป็น **optional** ทุกชั้น → ข้อมูล/test เดิมที่ไม่ระบุ FK = พฤติกรรมเดิม (fallback ชื่อ)

## 1. Migration (ไฟล์เดียว)

`db/migrations/2026-06-19-add-memo-requester-user-id.sql`

```sql
-- 1) Column (nullable — legacy/seed/prototype rows may have no real user)
ALTER TABLE memos
  ADD COLUMN requester_user_id BIGINT NULL DEFAULT NULL AFTER requester_name;

-- 2) FK → users(id). ON DELETE SET NULL: deleting a user never destroys memos;
--    the name fallback still identifies them. FK auto-creates its index
--    (do NOT also declare an explicit index — avoids a duplicate index).
ALTER TABLE memos
  ADD CONSTRAINT fk_memos_requester_user
    FOREIGN KEY (requester_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Backfill (best-effort, unambiguous active-name matches only)
UPDATE memos m
JOIN (
  SELECT CONCAT(first_name, ' ', last_name) AS full_name, MIN(id) AS user_id
  FROM users
  WHERE status = 'active'
  GROUP BY CONCAT(first_name, ' ', last_name)
  HAVING COUNT(*) = 1            -- skip names mapping to >1 active user
) u ON u.full_name = m.requester_name
SET m.requester_user_id = u.user_id
WHERE m.requester_user_id IS NULL;
```

Backfill edge cases:
- ชื่อซ้ำ (active >1) → `HAVING COUNT(*)=1` ข้าม ไม่เดา → null → fallback ชื่อ
- ชื่อ match ไม่เจอ (seed/prototype/ลาออก) → null → fallback ชื่อ
- match เฉพาะ `status='active'` (สอดคล้อง `resolveRequesterRecipient` เดิม)
- ALTER เป็น implicit commit (wrap transaction ไม่ได้); UPDATE backfill idempotent ด้วย
  `WHERE requester_user_id IS NULL` รันซ้ำได้ปลอดภัย — แต่ migration นี้ตั้งใจรันครั้งเดียวตามสไตล์โปรเจกต์

## 2. จุดแก้โค้ด 3 จุด

### 2.1 Notification — `resolveRequesterRecipient`
`src/lib/notification-recipients.ts` + `src/lib/notify-memo-event.ts`
- เปลี่ยน signature: `resolveRequesterRecipient(requesterName, requesterUserId: number|null, pool)`
- logic: FK ไม่ null → `SELECT id FROM users WHERE id=? AND status='active'` (ถ้าเจอคืน id; **ถ้า user ถูก suspend → คืน null ไม่ fallback ชื่อ**); FK null → fallback query ชื่อเดิม
- `getMemo()` ใน notify-memo-event.ts: เพิ่ม `requester_user_id` ใน SELECT + type `MemoRow`
- `notifyWatchers`: ส่ง `memo.requester_user_id` เข้า resolver

### 2.2 Visibility — `isMemoVisibleTo`
`src/lib/memo-visibility.ts`
```
if (session.roles.includes("requester")) {
  if (memo.requesterUserId != null) {
    if (memo.requesterUserId === session.userId) return true;
    // FK ชี้คนอื่น → ไม่ใช่เจ้าของ; ห้าม fallback ชื่อ
  } else if (memo.requester === fullName) {
    return true; // legacy: FK ว่าง → match ชื่อ
  }
}
```

### 2.3 Ownership — resubmit / submit-revision
`src/app/api/memos/[id]/resubmit/route.ts` + `.../submit-revision/route.ts`
- เพิ่ม `requester_user_id` ใน SELECT (`MemoIdRow`)
```
const owns = memo.requester_user_id != null
  ? memo.requester_user_id === session.userId
  : memo.requester_name === `${session.firstName} ${session.lastName}`;
if (!isAdmin && !owns) return 403;
```

## 3. Type + mapping

| จุด | เปลี่ยน |
|---|---|
| `MemoRecord` (`approval.ts`) | + `requesterUserId?: number \| null` |
| `MemoDbRow` (`db-memos.ts`) | + `requester_user_id?: number \| null` (optional, เผื่อ DB ยังไม่ migrate) |
| `serializeMemoRecord` (`db-memos.ts`) | `requesterUserId: row.requester_user_id ?? undefined` |
| `MemoSeedRow` + `memoToDbSeedRow` (`db-seed.ts`) | + `requester_user_id: memo.requesterUserId ?? null` |
| `SessionUser` | ไม่ต้องแก้ (มี `userId` แล้ว) |

SQL:
- INSERT (`route.ts`): เพิ่มคอลัมน์ + `?` + param; POST handler set `memo.requesterUserId = session.userId` คู่กับ `memo.requester = ...`
- GET /api/memos ใช้ `SELECT *` → ได้คอลัมน์ใหม่ฟรี
- submit-revision UPDATE: เพิ่ม `requester_user_id` เข้า **exclude list** (immutable หลัง insert)

## 4. ผลกระทบ flow อื่น
- **Prototype path:** POST /api/memos บังคับ session จริงอยู่แล้ว → memo ที่สร้างผ่าน API มี userId เสมอ; prototype selector (ไม่มี auth) สร้าง memo ผ่าน API จริงไม่ได้ → ไม่เพิ่ม FK-null
- **seed:** demo memo เป็นชื่อ free-text → `requester_user_id=NULL` → fallback ชื่อ (default null ใน `memoToDbSeedRow`)
- **DESTROY:** ไม่กระทบ (ลบทั้ง row); FK `ON DELETE SET NULL` เป็นฝั่ง users→memos
- **RESUBMIT/SUBMIT_REVISION:** requester ไม่เปลี่ยน (identity, immutable); snapshot ต่อ revision ไม่ต้องเก็บ requester_user_id

## 5. Test plan
- `memo-visibility.test.ts` (~48): เคสเดิมไม่ระบุ FK → undefined → fallback ชื่อ → **ยังผ่าน**; เพิ่ม (a) FK==userId เห็น, (b) FK คนอื่น+ชื่อตรง **ไม่เห็น**, (c) FK null+ชื่อตรง เห็น
- resubmit/submit-revision: (a) FK ตรง 200, (b) FK คนอื่น+ชื่อตรง 403, (c) FK null+ชื่อตรง 200, (d) admin 200
- `notification-recipients`: (a) FK active คืน id ไม่ query ชื่อ, (b) FK null fallback ชื่อ, (c) FK suspended คืน null
- backfill: (a) ชื่อ unique active → backfill, (b) ชื่อซ้ำ → null, (c) match suspended → null
- ปิดงาน: `npm.cmd test` (เดิม 395) + `lint` + `build` ต้องผ่าน

## 6. ลำดับ implement (low-risk → high)
1. Migration (additive, NULL ไม่กระทบโค้ดเดิม)
2. Type + mapping (additive, optional)
3. Set ตอน insert (memo ใหม่เริ่มมี FK)
4. แก้ read/identity paths: visibility → ownership → notification (ทีละจุด + test คู่)
5. test/lint/build

## 7. ความเสี่ยงที่ต้องระวัง
1. อย่าประกาศ index ซ้ำ (ให้ FK สร้างเอง)
2. ต้องคง fallback ชื่อทุกจุด ไม่งั้น legacy/seed มองไม่เห็น/ไม่แจ้ง (regression เงียบ)
3. **FK ไม่ null = เด็ดขาด ห้าม fallback ชื่อ** — เผลอ fallback บั๊กชื่อซ้ำกลับมา
4. MemoRecord field ต้อง optional ไม่งั้น test เดิม 48 อันพังหมด
