# HR&GA E-Memo Online System — Data Flow Diagram (Level 0 / 1 / 2 / 3)

**Complete Auto Rubber Manufacturing Co., Ltd.**
สร้างเมื่อ 2026-07-27 · อิงโค้ดจริงใน `sandbox/src` ไม่ใช่ฉบับร่างออกแบบ

## ไฟล์ในชุดนี้

แยกเป็น **ไฟล์ละหนึ่งระดับ** เปิดทีละไฟล์ได้เลย ไม่ต้องสลับหน้าใน draw.io

| ไฟล์ | ระดับ | เนื้อหา | เส้นตัดกัน |
|---|---|---|---|
| `level-0-context.drawio` | **Level 0** | Context Diagram — ระบบเป็นกล่องเดียว + 6 ผู้ใช้ + 3 ระบบภายนอก | 8 |
| `level-1.drawio` | **Level 1** | โปรเซสหลัก P1–P8 + แหล่งเก็บข้อมูล D1–D9 | 3 |
| `level-2-p1-create-memo.drawio` | **Level 2** | แตก **P1 สร้าง / แก้ไขบันทึก** → 1.1–1.7 | 20 |
| `level-2-p4-workflow-action.drawio` | **Level 2** | แตก **P4 ประมวลผลการดำเนินการ** → 4.0–4.5 | 17 |
| `level-2-p5-notify.drawio` | **Level 2** | แตก **P5 แจ้งเตือน & กระจายช่องทาง** → 5.1–5.5 | 4 |
| `level-3-p4-1-approve-step.drawio` | **Level 3** | แตก **P4.1 อนุมัติ / ผ่านขั้นตอน** → 4.1.1–4.1.8 | 13 |
| `level-3-p5-3-multi-channel-delivery.drawio` | **Level 3** | แตก **P5.3 ส่งหลายช่องทาง** → 5.3.1–5.3.5 | 3 |

ไฟล์ประกอบ:

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `hr-ememo-dfd-all-pages.drawio` | ฉบับรวมทั้ง 7 ระดับในไฟล์เดียว (7 หน้า) — สะดวกเวลาต้องส่งไฟล์เดียว |
| `hr-ememo-dfd.mmd` | Mermaid source ทุกระดับ (diagram-as-code, commit ลง git ได้) |
| `preview/*.png` | ภาพ preview ชื่อตรงกับไฟล์ `.drawio` (เรนเดอร์จากพิกัดในไฟล์ ไม่ใช่ export จาก draw.io) |
| `drawio-open-url-all-pages.txt` | URL เปิดฉบับรวมในเบราว์เซอร์ทันที |

> ไฟล์แยกกับฉบับรวมมีเนื้อหาเหมือนกันทุกตัวอักษร (แยกด้วยการตัดบล็อก `<diagram>` ตรง ๆ) — ถ้าแก้ไฟล์ไหนแล้วอยากให้ตรงกัน ต้องแก้อีกฝั่งด้วย

ใช้สัญลักษณ์ **Gane & Sarson** — External Entity = สี่เหลี่ยมเทา, Process = กล่องมนมีแถบเลขที่, Data Store = กล่องเหลืองแบ่งช่อง `Dn | ชื่อ`, เส้นประ = ระบบภายนอก / best-effort
แหล่งข้อมูลที่วาดซ้ำในหน้าเดียวกันมี **ขีดหนาเพิ่มที่ขอบซ้าย** ตามธรรมเนียม Gane & Sarson (ลดการลากเส้นยาว)

---

## Level 1 — โปรเซสหลัก

| # | โปรเซส | อยู่ที่ไหนในโค้ด | หน้าที่ |
|---|---|---|---|
| **P1** | สร้าง / แก้ไขบันทึก | `app/create/*` · `POST /api/memos` | รับข้อมูลฟอร์ม เทมเพลต AI ไฟล์แนบ แล้วส่งเข้าเวิร์กโฟลว์ |
| **P2** | แนะนำเส้นทางอนุมัติ | `lib/approval.ts` | ใช้กฎ Book1 หาผู้อนุมัติสุดท้าย (`getApprovalRecommendation`) |
| **P3** | สร้างเส้นทาง & ผู้รับทราบ | `buildApprovalFlow` · `read_actions` | แปลงคำแนะนำเป็น `selected_route_json` + รายชื่อผู้ต้องรับทราบ |
| **P4** | ประมวลผลการดำเนินการ | `lib/workflow-actions.ts` | approve / return / reject / read / MD review — **ทางเดียวที่เขียนเวิร์กโฟลว์ได้** |
| **P5** | แจ้งเตือน & กระจายช่องทาง | `lib/notify-memo-event.ts` | หาผู้รับ สร้างแจ้งเตือน แล้วส่ง in-app / email / Telegram |
| **P6** | ค้นหา / แดชบอร์ด / ประวัติ | `/queue` `/history` `/search` `/report` | อ่านอย่างเดียว กรองตาม `isMemoVisibleTo()` |
| **P7** | จัดการผู้ใช้ & ข้อมูลหลัก | `/admin` · `/api/admin/*` | อนุมัติผู้ใช้ กำหนดบทบาท จัดการหมวดย่อย |
| **P8** | ร่องรอยตรวจสอบ & เวอร์ชัน | `/audit` · `lib/audit-query.ts` | อ่าน `workflow_step_actions` + `memo_revisions` |

## แหล่งเก็บข้อมูล (Data Store) — ตารางจริงใน MySQL

| รหัส | ตาราง | ใช้โดย |
|---|---|---|
| **D1** | `memos` | P3 เขียน · P4 อัปเดต · P1/P6/P8 อ่าน |
| **D2** | `memo_revisions` | P1 (แก้ไขและส่งใหม่) · P4 · P8 |
| **D3** | `workflow_step_actions` | P1/P4 เขียน (append-only) · P6/P8 อ่าน |
| **D4** | `read_actions` | P3 สร้าง · P4 อัปเดตสถานะรับทราบ |
| **D5** | `users` / roles | P7 จัดการ · P4/P5 อ่านสิทธิ์ |
| **D6** | `notifications` + `notification_deliveries` | P5 เขียน · P6 อ่าน |
| **D7** | `memo_templates` + `item_subcategories` | P1 อ่าน/เขียน · P7 จัดการ |
| **D8** | ไฟล์แนบบนดิสก์ (`storage/attachments/`) | P1 เขียน — ยังไม่ใช่ DMS จริง |
| **D9** | `user_telegram_accounts` + token tables | P5 อ่าน/เขียน |

> **ไม่มี `audit_logs`** — Audit Trail สร้างจาก `workflow_step_actions` (D3) ผ่าน `lib/audit-query.ts` ดังนั้นในไดอะแกรม P8 จึงอ่าน D3 ไม่ใช่มีแหล่งเก็บของตัวเอง

---

## จุดสำคัญที่ไดอะแกรมพยายามสื่อ

**1. P4.0 เป็น "ประตูร่วม" ที่ทุกการกระทำต้องผ่าน (หน้า 4)**
`approve / return / reject / read / MD review` ทั้งจากเว็บและจาก Telegram ต้องผ่าน `loadMemoForUpdate` (`SELECT … FOR UPDATE`) + `loadActor` + `canActOnStep` ก่อนเสมอ ทำให้กฎเรื่อง "ห้ามอนุมัติบันทึกของตัวเอง" และ "Manager/Supervisor จำกัดเฉพาะแผนกตัวเอง" บังคับใช้ได้จากจุดเดียว

**2. ลำดับประตูใน P4.1 สลับไม่ได้ (หน้า 6)**
สิทธิ์ → การรับทราบ (`countPendingReads > 0 → 409`) → คำนวณขั้นถัดไป → MD Review gate
ถ้าสลับลำดับ จะเปิดช่องให้ข้ามการรับทราบ หรือข้ามการพิจารณาของ MD ได้

**3. การแจ้งเตือนไม่บล็อกเวิร์กโฟลว์ (หน้า 5 และ 7)**
`notifyMemoEvent()` เป็น fire-and-forget เรียก**หลัง** `COMMIT` และจับ error ไว้ทั้งหมด
ในระดับช่องทาง: `notifications` (in-app) คือแหล่งความจริง ส่วน email/Telegram เขียนแถวของตัวเองใน `notification_deliveries` โดยมี `UNIQUE(notification_id, channel)` เป็น idempotency key — SMTP หรือ Telegram ล่ม สถานะเป็น `failed` แต่แจ้งเตือนในระบบยังครบ

**4. P1 ไม่ใช่แค่ฟอร์ม (หน้า 3)**
มีโปรเซสย่อย 7 ตัว รวม AI ช่วยร่าง (ThaiLLM) การสกัดข้อมูลจากใบเสนอราคา PDF การคำนวณ VAT 7% และการอัปโหลดไฟล์แนบ ทั้งหมดคุยกับ `useMemoFormFields` ผ่าน `applyBulkData()` / `snapshotFormData()` ตัวเดียว จึงไม่มีโปรเซสย่อยตัวไหนแตะชื่อฟิลด์โดยตรง

---

## การตรวจสอบสมดุล (DFD Balancing)

Data flow ที่เข้า/ออกโปรเซสแม่ ต้องปรากฏครบในไดอะแกรมลูก:

| แม่ | ลูก | เข้า | ออก | สมดุล |
|---|---|---|---|---|
| P1 (L1) | 1.1–1.7 (L2) | ข้อมูลบันทึก+ไฟล์แนบ (จาก E1), ร่างจาก AI, ตีกลับจาก P4 | เลขที่บันทึก+สถานะ (ไป E1), จำนวนเงิน/งบ/แฟล็ก (ไป P2), เหตุการณ์ submitted (ไป P5), D1/D2/D3/D4/D7/D8 | ✔ |
| P4 (L1) | 4.0–4.5 (L2) | approve/return/reject (E3), รับทราบ (E2), ความเห็น MD (E4), callback (Telegram), บันทึกที่รอ (จาก P3) | คิวงาน+MD Review (ไป E3), เหตุการณ์ (ไป P5), ตีกลับ (ไป P1), D1/D2/D3/D4/D5 | ✔ |
| P5 (L1) | 5.1–5.5 (L2) | เหตุการณ์จาก P1/P4, callback จาก Telegram | อีเมล (SMTP), ข้อความ+ปุ่ม (Telegram), D6/D9, กระดิ่งในเว็บ | ✔ |
| P4.1 (L2) | 4.1.1–4.1.8 (L3) | คำขออนุมัติ+session, สถานะจากประตูร่วม 4.0 | 200/403/409/422, เหตุการณ์ advanced, D1/D3/D4/D5 | ✔ |
| P5.3 (L2) | 5.3.1–5.3.5 (L3) | notification_id + เนื้อหา + ผู้รับ | อีเมล, ข้อความ Telegram, D6/D6b/D9/D9b | ✔ |

## หมายเหตุการวาด

ทุกเส้นกำหนด **routing lane** ตายตัวด้วย waypoint แทนการปล่อยให้ draw.io auto-route มีสคริปต์ตรวจอัตโนมัติยืนยันว่า **ไม่มี segment ใดตัดผ่านกล่องโปรเซส / แหล่งข้อมูล / ผู้ใช้ และไม่มีกล่องซ้อนกัน** ทั้ง 7 หน้า — ถ้าย้ายตำแหน่งกล่องใน draw.io ต้องย้าย waypoint ตามด้วย

## ความสัมพันธ์กับเอกสารเดิม

`docs/system-analysis-dfd-erd.md` §11–12 มี Context + Level 1 ฉบับร่างตอนออกแบบ ซึ่งใช้เลข P1–P8 ชุดเดียวกัน แต่ระบุแหล่งเก็บข้อมูลที่ไม่มีอยู่จริง (`Approval Rules`, `Audit Logs`, `Memo Items`, `Budget Details`, `Workflow Steps`) ชุดนี้แทนที่ด้วยตารางจริง 9 ตัว และเพิ่ม Level 2–3 ที่เอกสารเดิมยังไม่มี
