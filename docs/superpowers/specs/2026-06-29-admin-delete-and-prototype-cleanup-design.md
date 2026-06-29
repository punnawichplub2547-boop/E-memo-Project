# Spec — Admin: permanent-delete buttons + remove Prototype Users tab

วันที่: 2026-06-29 · สถานะ: design approved · เจ้าของ: คุณพลับ · ผู้รับแผนไปทำต่อ: Codex

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
- จบงาน: `npm.cmd test` + `npm.cmd run lint` + `npm.cmd run build` เขียว แล้ว rebuild docker

## 3. Referential integrity (สำคัญ — ตรวจแล้ว)

- ตาราง `memos` เก็บ **ทั้ง** `item_subcategory_id` (มี INDEX แต่ **ไม่มี FOREIGN KEY constraint**) **และ** `item_subcategory_label` (snapshot ข้อความ)
- → **ลบ subcategory ถาวรปลอดภัย**: ไม่ละเมิด FK (ไม่มี) และ memo เก่ายังโชว์ `item_subcategory_label` เดิมได้ปกติ (id ที่ค้างเป็น dangling แต่ไม่ถูกใช้แสดงผล)
- `issue_reports` ไม่มีตารางอื่นอ้างถึง → ลบถาวรปลอดภัย

## 4. งานที่ต้องทำ

### 4.1 Item Subcategory — ลบถาวร

**Backend**
- `src/lib/db-item-subcategories.ts`: เพิ่ม `deleteItemSubcategory(id: number): Promise<void>` → `DELETE FROM item_subcategories WHERE id = ?` (mirror `setItemSubcategoryActive`)
- `src/app/api/admin/item-subcategories/[id]/route.ts`: เพิ่ม `export async function DELETE` ใช้ `requireAdmin` ตัวเดิม + validate id → เรียก `deleteItemSubcategory` → `{ ok: true }`

**Frontend** — `src/app/admin/_components/ItemSubcategoryPanel.tsx`
- ในแถว **edit** (ที่มี Save/Cancel) เพิ่มปุ่ม "ลบถาวร" (สีแดง) → กดแล้วเปลี่ยนเป็น confirm inline ("ลบถาวร? กู้คืนไม่ได้" + ยืนยัน/ยกเลิก) → `fetch(DELETE /api/admin/item-subcategories/${id})` → refresh list
- **คงปุ่ม Deactivate (soft) ไว้เหมือนเดิม** — "ลบถาวร" เป็นทางเลือกเพิ่ม ไม่ใช่แทน

**Tests**
- `db-item-subcategories` delete: db-helper test (fake pool) — ยิง SQL ถูก + param id
- route `DELETE`: 401 ไม่มี session, 403 ไม่ใช่ admin, 400 id ไม่ถูก, 200 + เรียก `deleteItemSubcategory` เมื่อ admin

### 4.2 เอา Prototype Users ออกจาก Admin (Option A)

**`src/app/admin/page.tsx`**
- ลบ `"users"` ออกจาก type `Tab` (บรรทัด ~52)
- ลบ entry `["users", IconUsers, "Prototype Users"]` ออกจาก tab list (บรรทัด ~358)
- ลบ block `{tab === "users" && (...)}` ทั้งก้อน (บรรทัด ~569–668)
- ลบ state/handlers/imports ที่ใช้เฉพาะ prototype tab จนไม่เหลือ unused (ตัวที่คาดว่าเกี่ยว: `useAdminUsers` import + `users/addUser/updateUser/deleteUser/resetToDefaults`, `showAddUser`, `newUser`, `emptyNewUser`, `NewUserState`, `saveEdit`/`cancelEdit`/`addUser`-handler ที่ผูกกับ prototype, `editingId`/`editState` เฉพาะส่วนนี้) — **Codex ต้องตรวจ references จริงก่อนลบแต่ละตัว** เพราะ `editingId` ฯลฯ อาจ shared กับแท็บอื่น (ถ้า shared ห้ามลบ)
- ถ้า `src/lib/admin-users.tsx` ไม่ถูก import ที่อื่นเลยหลังแก้ → ลบไฟล์ + test ทิ้งได้ (ตรวจ `grep -r admin-users` ก่อน)
- **ห้ามแตะ** `prototype-users.ts`, `prototype-user-context.tsx`, sidebar selector, และ `usePrototypeUser` ในไฟล์อื่น (นั่นคือระบบ fallback ที่ create/queue/visibility ใช้)

**Tests**
- ปรับ/ลบ test ที่อ้าง prototype-users admin tab (ถ้ามี) ให้ผ่าน — ต้องไม่มี test แตก

### 4.3 Issue Reports — ลบถาวร

**Backend**
- `src/lib/issue-reports.ts`: เพิ่ม `deleteIssueReport(pool, id): Promise<boolean>` → `DELETE FROM issue_reports WHERE id = ?` (mirror `setIssueReportStatus` signature ที่รับ pool, คืน `affectedRows > 0`)
- สร้าง `src/app/api/admin/issues/[id]/route.ts`: `export async function DELETE` — auth/admin guard (mirror `[id]/status/route.ts`), validate id → `deleteIssueReport(getDbPool(), id)` → `{ ok: true, deleted }`

**Frontend** — `src/app/admin/page.tsx` (issues tab, ~876–973)
- เพิ่มปุ่มลบ (ไอคอนถังขยะ สีแดง) ต่อแถว ข้างปุ่มจัดการสถานะ → confirm inline → `fetch(DELETE /api/admin/issues/${id})` → `setIssueRefresh(n=>n+1)` (โหลดใหม่)
- เพิ่ม handler `handleDeleteIssue(id)` คล้าย `toggleIssueStatus`

**Tests**
- `deleteIssueReport` db-helper test (fake pool, แบบ `issue-reports.test.ts`)
- route `DELETE`: 401/403/400/200 + เรียก helper เมื่อ admin

## 5. Out of scope (งานแยกในอนาคต)

- **รื้อระบบ prototype-user ทั้งหมด** (แทนทุก `usePrototypeUser` ด้วย real auth ใน create/queue/visibility/memo-store) — เป็น refactor ใหญ่ ต้องมี spec/plan/test ของตัวเอง เปิด ticket แยก
- ไม่เพิ่ม soft-delete/undo ให้ subcategory หรือ issue (คุณพลับขอ "ถาวร")

## 6. Verification

- `npm.cmd test` (รวม test ใหม่ทั้งหมด) ผ่าน
- `npm.cmd run lint` + `npm.cmd run build` เขียว (ไม่มี unused import/var หลังเอา prototype tab ออก)
- rebuild docker local ตรวจด้วยตา: ลบ subcategory ได้, แท็บ Prototype Users หายไป, ลบ issue ได้
- ไม่มี migration ใหม่ (ใช้ตารางเดิมทั้งหมด)
