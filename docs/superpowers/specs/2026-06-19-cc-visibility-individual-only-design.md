# CC Visibility — Individual-Only (ตัด department-label match)

วันที่: 2026-06-19
สถานะ: approved (คุณพลับ 2026-06-19)
ไฟล์เป้าหมาย: `sandbox/src/lib/memo-visibility.ts`, `sandbox/src/lib/memo-visibility.test.ts`

## ปัญหา

ปัจจุบัน `isMemoVisibleTo()` ให้ visibility ผ่าน read-recipients โดยแมตช์ทั้ง
`fullName`, `session.department`, และ `email` ผลคือ **พนักงานทุกคนในแผนก**
มองเห็น memo ทุกใบที่มี "ชื่อแผนก" ของตัวเองอยู่ใน read recipients — กว้างเกินไป
และไม่สอดคล้องกับ notification fan-out (`resolveMemoCcRecipients`) ที่ skip
department labels ไปแล้ว (แจ้งเฉพาะ individual: email/ชื่อ)

ความต้องการจาก presentation (2026-06-10, requirement #3): user ทั่วไปควรเห็น memo
เฉพาะเมื่อถูกระบุตัวจริง เพื่อความลับของเนื้อหา memo

## การตัดสินใจ

CC visibility ต้องเป็น **individual-only** — แมตช์เฉพาะ `fullName` + `email`
ตัด `session.department` ออกจากชุด labels

- ขอบเขต: บล็อก CC เป็น role-independent → การตัดมีผลกับ **ทุก role** (รวม
  `read-recipient`) ซึ่งถูกต้องตามเจตนา secrecy
- กฎอื่นไม่เปลี่ยน: requester เห็น memo ตัวเอง, approver เห็นตาม route,
  MD เห็น notifyMD, admin เห็นทั้งหมด

## ผลข้างเคียงที่ยอมรับ

ถ้า memo ใส่ read-recipient เป็น "ชื่อแผนกล้วน" โดยไม่ระบุบุคคล จะไม่มีใครเห็น/
ได้รับแจ้งผ่านช่องนั้น (พฤติกรรมเดียวกับ notification ที่ skip dept label อยู่แล้ว)
การ guide ให้ผู้ใช้ใส่บุคคลในฟอร์ม create อยู่นอก scope งานนี้

## การเปลี่ยนโค้ด

`memo-visibility.ts` — เอา `session.department` ออกจาก `labels` set
(เหลือ `fullName`, `session.email`) ในบล็อก CC visibility

## Test impact (`memo-visibility.test.ts`, เดิม 35 tests)

เคสที่ assert การเห็นผ่าน "ชื่อแผนก" ต้องพลิกเป็น `false`:
- `read-recipient sees memo with their department in readRecipients`
- `requester-only user sees memo they are CC'd on by department`
- `requester+read-recipient sees memo they are a read recipient on (dept label)`
- `old-style name/dept CC still works alongside email CC (backward compat)`

เพิ่มเคสใหม่:
- คนแผนกเดียวกันแต่ไม่ถูกระบุตัว → ไม่เห็น (secrecy)
- ยืนยัน individual name / email CC ยังเห็นปกติ

เคส "does not see" เดิมยังคงผ่าน

## วิธีทำ

TDD: แก้ test สะท้อนพฤติกรรมใหม่ → รัน (RED) → แก้ `memo-visibility.ts` →
รัน (GREEN) → `npm.cmd run lint` + `npm.cmd run build`
