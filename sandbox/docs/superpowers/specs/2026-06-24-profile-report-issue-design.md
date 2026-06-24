# Design: ปุ่มแจ้งปัญหาหาแอดมิน (หน้าโปรไฟล์)

วันที่: 2026-06-24
สถานะ: approved (คุณพลับ — "จัดการเลย")

## ขอบเขต (YAGNI)

ผู้ใช้ทั่วไปกดปุ่มในหน้าโปรไฟล์เพื่อแจ้งปัญหาการใช้งานไปยังแอดมิน แล้วแอดมินทุกคนได้รับ
in-app notification (bell dropdown ที่มีอยู่แล้ว).

**ทำ:**
- การ์ดขยายในหน้าโปรไฟล์ + textarea ช่องเดียว (รายละเอียดอย่างเดียว)
- บันทึก report ลงตาราง `issue_reports` (durable log)
- API สร้าง notification ให้แอดมินทุกคน
- แท็บ "แจ้งปัญหา" ใน /admin ให้แอดมินดู log + เปลี่ยนสถานะ open/resolved

**ไม่ทำ:** หน้า admin detail แยก, Telegram push ของ issue, หมวดหมู่/หัวข้อ, แนบไฟล์,
ตอบกลับผู้แจ้งในแอป, มอบหมายผู้รับผิดชอบ, exclude ผู้แจ้งที่เป็น admin เอง.

> **อัปเดต (เพิ่ม log):** เดิมตั้งใจ "แจ้งเตือนอย่างเดียว ไม่มีตาราง" — คุณพลับขอเก็บ log
> เพื่อตามเรื่องย้อนหลังได้ จึงเพิ่มตาราง `issue_reports` + แท็บ admin (สถานะ open/resolved)
> ส่วนฟอร์ม + notification fan-out คงเดิม.

## 1. UI — `src/app/profile/page.tsx`

การ์ดใหม่ "แจ้งปัญหาถึงแอดมิน" วางถัดจาก Telegram card ก่อนปุ่ม logout.

- หัวการ์ด: ข้อความ "พบปัญหาการใช้งาน?" + ปุ่ม "แจ้งปัญหา"
- กดปุ่ม → กางลงมาเป็น `<textarea>` + ปุ่ม "ส่งให้แอดมิน"
- State: `reportOpen: boolean`, `reportText: string`, `reportStatus: "idle" | "sending" | "sent" | "error"`
- ปุ่มส่ง disabled เมื่อ `reportText.trim()` ว่าง หรือกำลังส่ง
- ส่งสำเร็จ → แสดง "ส่งให้แอดมินแล้ว ✓", เคลียร์ text, พับการ์ด
- ส่งล้มเหลว → แสดงข้อความ error สั้น ๆ ให้ลองใหม่
- Inline `<style>` โทนเดียวกับการ์ดเดิม (ไม่เพิ่ม dependency)

## 2. Migration — `db/migrations/2026-06-24-issue-reports-table.sql`

ตาราง `issue_reports`: `id` (BIGINT), `reporter_user_id` (FK→users, NULL), `reporter_name/department/email`
(snapshot), `description TEXT`, `status ENUM('open','resolved') DEFAULT 'open'`, `created_at`,
`resolved_at`, `resolved_by_user_id` (FK→users), index `(status, created_at)`.
- ขึ้นต้น `SET NAMES utf8mb4;`, `CHARSET=utf8mb4` — กัน Thai mojibake
- FK `ON DELETE SET NULL` — ลบ user ไม่ทำลาย log
- ⚠️ ต้องรันบน DB จริงเอง (เหมือน migration อื่น)

## 3. Helpers — `src/lib/issue-reports.ts` (pool-injected, เทสต์ด้วย fake pool)

`createIssueReport`, `listIssueReports({status?, limit, offset})` → `{reports, total}`,
`setIssueReportStatus(id, status, byUserId)`, `mapIssueReportRow`, `parseIssueStatusFilter`.

## 4. API — `src/app/api/profile/report-issue/route.ts` (ใหม่)

- `POST` เท่านั้น
- Auth: `getActiveSessionUserFromToken` → ไม่มี session = `401`
- Body: `{ description: string }` — trim; ว่าง → `400`; ยาว > 2000 ตัว → `400`
- **บันทึก `createIssueReport()` ก่อน** (log ไม่หายแม้ noti พลาด), `reporter_user_id = session.userId`
- หาแอดมิน: `SELECT id FROM users WHERE roles_json LIKE '%"admin"%' AND status = 'active'`
  - หมายเหตุ: `roles_json` เป็น VARCHAR เก็บ JSON string เช่น `["admin"]`; ใช้ `LIKE` robust กว่า `JSON_CONTAINS`
- วน `createNotification()` ให้แอดมินทุกคน (รวมผู้แจ้งถ้าเป็น admin เอง):
  - `type: "user_issue_report"`, `memoId: null`, `actionUrl: null`
  - `title` / `body` มาจาก helper `buildIssueReportNotification()`
- ตอบ `{ ok: true, notified: <จำนวน admin> }`

## 5. Admin API (admin-gated)

- `GET /api/admin/issues?status=&limit=&offset=` → `{ rows, total }`
- `POST /api/admin/issues/[id]/status` body `{ status: "open" | "resolved" }` → `{ ok, changed }`

## 6. Admin UI — แท็บ "แจ้งปัญหา" ใน `src/app/admin/page.tsx`

ตาราง: เวลา · ผู้แจ้ง(+อีเมล) · แผนก · รายละเอียด · สถานะ(badge) · ปุ่ม จัดการแล้ว/เปิดใหม่
+ filter (ทั้งหมด/ยังไม่จัดการ/จัดการแล้ว) + pagination (mirror แท็บ Audit, IconBell).

## 7. Notification helper + label — `src/lib/notifications.ts`

- เพิ่ม `user_issue_report: "แจ้งปัญหาจากผู้ใช้"` ใน `TYPE_LABELS`
- เพิ่ม pure helper (ทดสอบได้โดยไม่ผูก DB):

```ts
export function buildIssueReportNotification(input: {
  reporterName: string;
  department: string;
  email: string;
  description: string;
}): { title: string; body: string };
```

- `title`: `แจ้งปัญหา: <reporterName>`
- `body`: รวมชื่อ + แผนก + อีเมลผู้แจ้ง + รายละเอียดปัญหา (context ทั้งหมดอยู่ใน body เพราะไม่มีหน้า detail)

## 8. Tests

- `src/lib/notifications.test.ts`: `buildIssueReportNotification` — title format, body ครบทุก field, multi-line, blank-name fallback
- `src/lib/issue-reports.test.ts`: row mapper, status-filter parse, create, list (filter + clamp + total), status toggle (resolve stamps / reopen clears / no-op)

## ความเสี่ยง / หมายเหตุ

- CC/notification เป็น name-matched อยู่แล้วในระบบ; ที่นี่ใช้ `recipient_user_id` ตรง ๆ จาก query admin จึงแม่นยำ
- ไม่มี rate-limit — ผู้ใช้สแปมได้ (ยอมรับใน prototype; แอดมินกดอ่านทั้งหมดได้)
- bell dropdown poll ทุก 30s — แอดมินเห็น noti ภายใน ~30 วิ
