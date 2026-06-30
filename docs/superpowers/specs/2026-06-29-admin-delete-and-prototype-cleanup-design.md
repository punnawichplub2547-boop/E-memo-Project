# Spec — Admin: permanent-delete buttons + remove Prototype Users tab

วันที่: 2026-06-29 · สถานะ: ✅ **IMPLEMENTED** · เจ้าของ: คุณพลับ · Commit: `c774d76`

> Implemented on branch `codex/admin-delete-prototype-cleanup` — committed and pushed to origin.

## 1. เป้าหมาย

เพิ่มความสามารถ "ลบถาวร" ให้ admin ในหน้า `/admin` 2 จุด และเอา section ที่ไม่จำเป็นออก 1 จุด:

1. **Item Subcategory** — ปุ่ม "ลบถาวร" ในแถว edit (ลบ subcategory ออกจาก DB จริง)
2. **Prototype Users** — เอาแท็บ/section นี้ออกจาก Admin Panel (Option A: เฉพาะ UI ในแอดมิน ไม่แตะระบบ fallback ใต้ฮุด)
3. **Issue Reports (แจ้งปัญหา)** — ปุ่มลบถาวรต่อรายการ

ทุกอย่างเป็น **admin-only** + มี **ขั้น confirm** ที่ UI + ทำแบบ **TDD**.

## 2. หลักการความปลอดภัย (ยึดของเดิม)

- ทุก DELETE route ผ่าน `getActiveSessionUserFromToken` + เช็ค `roles.includes("admin")` → 401/403 (เหมือน `destroy`/issues-status route)
- การลบถาวรต้องมี **confirm step** ที่ UI (กดสองชั้น) — ไม่มี undo
- ทำ **TDD**: route tests (mock `@/lib/auth` + `@/lib/db`) + db-helper tests (fake pool, แบบ `issue-reports.test.ts`)
- จบงาน: `npm.cmd test` (568 passed) + `npm.cmd run lint` + `npm.cmd run build` เขียว

## 3. Referential integrity (สำคัญ — ตรวจแล้ว)

- ตาราง `memos` เก็บ **ทั้ง** `item_subcategory_id` (มี INDEX แต่ **ไม่มี FOREIGN KEY constraint**) **และ** `item_subcategory_label` (snapshot ข้อความ)
- → **ลบ subcategory ถาวรปลอดภัย**: ไม่ละเมิด FK (ไม่มี) และ memo เก่ายังโชว์ `item_subcategory_label` เดิมได้ปกติ (id ที่ค้างเป็น dangling แต่ไม่ถูกใช้แสดงผล)
- `issue_reports` ไม่มีตารางอื่นอ้างถึง → ลบถาวรปลอดภัย

## 4. งานที่ทำแล้ว

### 4.1 Item Subcategory — ลบถาวร ✅

**Backend**
- `src/lib/db-item-subcategories.ts`: เพิ่ม `deleteItemSubcategory(id: number): Promise<void>`
- `src/app/api/admin/item-subcategories/[id]/route.ts`: เพิ่ม `export async function DELETE`

**Frontend** — `src/app/admin/_components/ItemSubcategoryPanel.tsx`
- ในแถว edit เพิ่มปุ่ม "ลบถาวร" (สีแดง) → confirm inline → delete → refresh

**Tests**
- `db-item-subcategories.test.ts` (1 test)
- `item-subcategories/[id]/route.test.ts` (3 tests: 403, 400, 200)

### 4.2 เอา Prototype Users ออกจาก Admin ✅

**`src/app/admin/page.tsx`:**
- ลบ `"users"` ออกจาก type `Tab`
- ลบ tab entry + block ทั้งก้อน
- ลบ imports ที่ไม่ใช้แล้ว (`useAdminUsers`, `IconUserPlus`, ฯลฯ)
- **เก็บ** `admin-users.tsx` ไว้เพราะ `prototype-user-context.tsx` ยัง import ใช้

**ไม่ได้แตะ:** `prototype-users.ts`, `prototype-user-context.tsx`, sidebar selector, `usePrototypeUser` ใน create/queue

### 4.3 Issue Reports — ลบถาวร ✅

**Backend**
- `src/lib/issue-reports.ts`: เพิ่ม `deleteIssueReport(pool, id): Promise<boolean>`
- สร้าง `src/app/api/admin/issues/[id]/route.ts`: `export async function DELETE`

**Frontend** — `src/app/admin/page.tsx` (issues tab)
- เพิ่มปุ่มลบ (ถังขยะ สีแดง) ต่อแถว ข้างปุ่มจัดการสถานะ → confirm inline → refresh

**Tests**
- `deleteIssueReport` tests ใน `issue-reports.test.ts` (2 tests)
- `issues/[id]/route.test.ts` (4 tests: 401, 403, 400, 200)

## 5. Out of scope (งานแยกในอนาคต)

- **รื้อระบบ prototype-user ทั้งหมด** (แทนทุก `usePrototypeUser` ด้วย real auth) — refactor ใหญ่
- ไม่เพิ่ม soft-delete/undo ให้ subcategory หรือ issue (คุณพลับขอ "ถาวร")

## 6. Verification ✅

| Check | Result |
|---|---|
| `npm.cmd test` | **568 passed** (46 files) |
| `npm.cmd run lint` | Clean |
| `npm.cmd run build` | Compiled, 26 routes |
| Docker rebuild | Done by youพลับ |
| working tree | Clean (เหลือ `next-env.d.ts` CRLF noise) |

## 7. Changes from original design

- `admin-users.tsx` **ไม่ได้ลบ** — ยังมี `prototype-user-context.tsx` import ใช้อยู่ (ตาม spec ระบุไว้ให้ตรวจ)
- รวม commit **ครั้งเดียว** (`c774d76`) แทนที่จะแยกตาม task — เพราะคุณพลับขอ commit รวม
