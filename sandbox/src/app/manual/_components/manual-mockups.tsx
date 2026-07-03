/**
 * Pure-CSS/HTML "screenshot" illustrations for the manual. These are drawn with
 * the same design tokens as the real app (see manual-styles.tsx) so they read as
 * faithful mockups rather than raw screenshots. No interactivity — presentation
 * only. Each export is one framed illustration + caption.
 */
import type { ReactNode } from "react";

function Shot({ url, caption, children }: { url: string; caption: string; children: ReactNode }) {
  return (
    <>
      <figure className="man-shot">
        <div className="man-shot-chrome">
          <i /><i /><i />
          <span>{url}</span>
        </div>
        <div className="man-mock">{children}</div>
      </figure>
      <p className="man-figcaption">{caption}</p>
    </>
  );
}

export function LoginShot() {
  return (
    <Shot url="memo.car-1996.com/login" caption="ภาพประกอบจำลองหน้าจอเข้าสู่ระบบ (โครงสร้างและข้อความตรงกับระบบจริง)">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", minHeight: 250 }}>
        <div style={{ background: "linear-gradient(148deg, #060C1F, #102060)", color: "#fff", padding: "22px 20px" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", color: "var(--navy-900)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, marginBottom: 10 }}>CAR</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 3 }}>E-Memo</div>
          <div style={{ fontSize: 9, color: "var(--ice-300)", marginBottom: 14 }}>ระบบบันทึกข้อความภายใน</div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 9, color: "#D7DDF0" }}>✓ สร้างและส่งเมโมดิจิทัล</div>
            <div style={{ fontSize: 9, color: "#D7DDF0" }}>✓ อนุมัติตามสายการบังคับบัญชา</div>
            <div style={{ fontSize: 9, color: "#D7DDF0" }}>✓ ติดตามสถานะแบบ Real-time</div>
          </div>
        </div>
        <div style={{ padding: "22px 24px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 3 }}>ยินดีต้อนรับ</div>
          <div style={{ fontSize: 9.5, color: "var(--muted-2)", marginBottom: 14 }}>Sign in to your E-Memo account</div>
          <div className="man-field-lbl">Company Email</div>
          <div className="man-field">name@car-1996.com</div>
          <div className="man-field-lbl">Password</div>
          <div className="man-field">••••••••</div>
          <div style={{ background: "var(--primary-grad)", color: "#fff", textAlign: "center", borderRadius: 7, padding: 8, fontSize: 10.5, fontWeight: 700, marginTop: 6 }}>เข้าสู่ระบบ</div>
        </div>
      </div>
    </Shot>
  );
}

export function DashboardShot() {
  return (
    <Shot url="memo.car-1996.com/" caption="ภาพประกอบจำลองหน้า Dashboard">
      <div className="man-app-frame">
        <div className="man-app-side">
          <div className="man-app-brand"><em>EM</em><div><b>E-Memo</b><small>HR&amp;GA</small></div></div>
          <div className="man-app-nav">
            <div className="on">Dashboard</div>
            <div>Create Memo</div>
            <div>Approval Queue</div>
            <div>AI Search</div>
            <div>History</div>
          </div>
        </div>
        <div className="man-app-main">
          <div className="man-app-topbar">
            <div><div className="man-crumb">Complete Auto Rubber / HR&amp;GA / Dashboard</div><h4>Approval Center Overview</h4></div>
            <span className="man-pill blue">+ New Memo</span>
          </div>
          <div className="man-hero-card">
            <div className="date">FRIDAY, 3 JULY 2026</div>
            <h5>สวัสดีตอนเช้า, ปุณณวิช ภูประเสริฐ</h5>
            <p>มีเอกสาร 0 ฉบับ รอการอนุมัติ &nbsp;·&nbsp; <span style={{ textDecoration: "underline" }}>Review Queue</span></p>
          </div>
          <div className="man-kpi-row">
            <div className="man-kpi"><div className="lbl">TOTAL MEMO</div><div className="val">3</div></div>
            <div className="man-kpi"><div className="lbl">PENDING</div><div className="val">0</div></div>
            <div className="man-kpi"><div className="lbl">APPROVED</div><div className="val">3</div></div>
            <div className="man-kpi"><div className="lbl">AVG. CYCLE</div><div className="val">12h</div></div>
          </div>
          <div className="man-card" style={{ marginTop: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Recent Activity</div>
            <div className="man-timeline-item"><div className="man-tl-dot">✓</div><div style={{ fontSize: 9.5 }}>Managing Director อนุมัติ EM-2026-002 · การว่าจ้าง/สัญญา</div></div>
          </div>
        </div>
      </div>
    </Shot>
  );
}

export function CreateDetailsShot() {
  return (
    <Shot url="memo.car-1996.com/create" caption="ภาพประกอบจำลองฟอร์มขั้นตอนที่ 1 — รายละเอียด Memo">
      <div style={{ padding: "16px 18px" }}>
        <div className="man-mrow" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="man-crumb">สร้าง Memo / ฉบับร่างใหม่</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>รายละเอียด Memo</div>
          </div>
          <div className="man-mrow" style={{ margin: 0 }}>
            <span className="man-pill ghost">Save Draft</span>
            <span className="man-pill blue">Send to Approval</span>
          </div>
        </div>
        <div className="man-field-lbl" style={{ marginTop: 10 }}>เรื่อง *</div>
        <div className="man-field filled">ขออนุมัติจัดซื้อวัตถุดิบยางสังเคราะห์ สำหรับสายการผลิต A</div>
        <div className="man-two-col">
          <div>
            <div className="man-field-lbl">หมวดรายการ *</div>
            <div className="man-field filled">วัตถุดิบ / ชิ้นงานเพื่อการผลิต</div>
          </div>
          <div>
            <div className="man-field-lbl">แผนก *</div>
            <div className="man-field filled">IT</div>
          </div>
        </div>
        <div className="man-two-col">
          <div>
            <div className="man-field-lbl">จำนวนเงิน (THB) *</div>
            <div className="man-field filled">฿ 8,500</div>
          </div>
          <div>
            <div className="man-field-lbl">สถานะงบประมาณ *</div>
            <div className="man-field filled">● ในงบ &nbsp;&nbsp;○ เกินงบ &nbsp;&nbsp;○ ไม่มีงบ</div>
          </div>
        </div>
      </div>
    </Shot>
  );
}

export function MdReviewShot() {
  return (
    <Shot url="memo.car-1996.com/create — เงื่อนไขเพิ่มเติม" caption='ภาพประกอบจำลอง — เมื่อติ๊ก "Supplier ปรับราคา" ระบบจะเตือนด้วยกล่องสีทอง'>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>เงื่อนไขเพิ่มเติม (Book1)</div>
        <div className="man-chk-row"><div className="man-chk-box" /><div><b>ซื้อตามแผนการผลิต (Book1 ข้อ 1.1)</b><br /><span>ระบบจะแนะนำ GM โดยไม่ผูกจำนวนเงิน</span></div></div>
        <div className="man-chk-row"><div className="man-chk-box" /><div><b>Dead stock / Slow movement &lt; KPI</b><br /><span>แสดงเป็นแท็กให้ผู้อนุมัติทราบ — ไม่กำหนด flow อัตโนมัติ</span></div></div>
        <div className="man-chk-row"><div className="man-chk-box on" /><div><b>Supplier ปรับราคา (Book1 หมวด 1/2)</b><br /><span>ต้องผ่านการพิจารณาของ MD ก่อนอนุมัติ - flow จะหยุดรอจนกว่า MD จะตอบกลับ</span></div></div>
        <div className="man-callout-mini" style={{ marginTop: 10 }}>
          <div className="ic">★</div>
          <div><b style={{ display: "block", fontSize: 10.5 }}>ต้องผ่านการพิจารณาของ MD ก่อนอนุมัติ</b>Supplier ปรับราคา ต้องผ่านการพิจารณาของ MD ก่อนอนุมัติ (Book1 หมวด 1/2)</div>
        </div>
      </div>
    </Shot>
  );
}

export function RoutingShot() {
  return (
    <Shot url="Approver Routing panel" caption="ภาพประกอบจำลองแผง Approver Routing">
      <div style={{ padding: "16px 18px" }}>
        <div className="man-mrow" style={{ alignItems: "center" }}>
          <span className="man-pill ghost">TIER · GM</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, margin: "4px 0 8px" }}>General Manager</div>
        <div className="man-card" style={{ background: "var(--emerald-soft)", borderColor: "rgba(4,120,87,0.22)" }}>
          <span style={{ fontSize: 9.5, color: "var(--emerald)" }}>✓ ซื้อทั่วไป ภายใน Budget &lt;= 10,000 บาท → GM (Book1 ข้อ 1.2 — หมวดนี้ไม่ให้ Manager อนุมัติ)</span>
        </div>
        <div className="man-field-lbl" style={{ marginTop: 8 }}>เลือกผู้อนุมัติสุดท้าย (override ได้)</div>
        <div className="man-field filled">General Manager (แนะนำ)</div>
        <div className="man-mrow" style={{ alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 9.5, color: "var(--muted-2)" }}>ROUTE STATUS</span>
          <span className="man-pill good">recommended</span>
        </div>
        <div style={{ fontSize: 9.5, color: "var(--slate)", margin: "6px 0 10px" }}>ใช้เส้นทางแนะนำของ Book1 (stair route)</div>
        <div className="man-card"><span style={{ fontSize: 10 }}>Manager / Top Section <b style={{ color: "var(--gold)" }}>MANDATORY</b></span></div>
        <div className="man-card" style={{ background: "var(--primary-grad-soft)", borderColor: "var(--ice-200)" }}><span style={{ fontSize: 10 }}>→ General Manager <i style={{ color: "var(--primary)", fontStyle: "normal" }}>ผู้อนุมัติสุดท้ายที่เลือก</i></span></div>
      </div>
    </Shot>
  );
}

export function QueueShot() {
  return (
    <Shot url="memo.car-1996.com/queue" caption="ภาพประกอบจำลองหน้า Approval Queue">
      <div style={{ padding: "16px 18px" }}>
        <div className="man-mrow" style={{ justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Approval Queue</div>
        </div>
        <div className="man-mrow">
          <span className="man-pill blue">All 3</span>
          <span className="man-pill ghost">Pending 0</span>
          <span className="man-pill ghost">Approved 3</span>
          <span className="man-pill ghost">Rejected 0</span>
          <span className="man-pill ghost">Returned 0</span>
          <span className="man-pill ghost">Draft 0</span>
        </div>
        <table className="man-mini">
          <tbody>
            <tr><th>Memo ID</th><th>เรื่อง</th><th>จำนวนเงิน</th><th>ระดับผู้อนุมัติ</th><th>สถานะ</th></tr>
            <tr><td className="man-num">EM-2026-014</td><td>จัดซื้อสินทรัพย์ถาวร</td><td className="man-num">฿70,000</td><td>General Manager</td><td><span className="man-pill good">Approved</span></td></tr>
            <tr><td className="man-num">EM-2026-002</td><td>ซ่อมบำรุงระบบไฟฟ้า</td><td className="man-num">฿45,000</td><td>Managing Director</td><td><span className="man-pill good">Approved</span></td></tr>
            <tr><td className="man-num">EM-2026-005</td><td>ต่ออายุซอฟต์แวร์</td><td className="man-num">฿76,000</td><td>Managing Director</td><td><span className="man-pill good">Approved</span></td></tr>
          </tbody>
        </table>
      </div>
    </Shot>
  );
}

export function HistoryShot() {
  return (
    <Shot url="memo.car-1996.com/history" caption="ภาพประกอบจำลองหน้า History">
      <div style={{ padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Memo History &amp; Audit</div>
        <div className="man-kpi-row" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          <div className="man-kpi"><div className="lbl">TOTAL</div><div className="val">3</div></div>
          <div className="man-kpi"><div className="lbl">APPROVAL RATE</div><div className="val">100%</div></div>
          <div className="man-kpi"><div className="lbl">REJECTED</div><div className="val">0</div></div>
          <div className="man-kpi"><div className="lbl">AVG. CYCLE</div><div className="val">12h</div></div>
          <div className="man-kpi"><div className="lbl">MD-TIER</div><div className="val">2</div></div>
        </div>
        <div className="man-card">
          <div style={{ fontSize: 9, color: "var(--muted-2)", marginBottom: 6 }}>15 Jun 2026</div>
          <div className="man-timeline-item"><div className="man-tl-dot">✓</div><div style={{ fontSize: 9.5 }}>EM-2026-014 · General Manager อนุมัติ ฿70,000 <span className="man-pill ghost" style={{ marginLeft: 4 }}>GM</span></div></div>
          <div className="man-timeline-item"><div className="man-tl-dot">✓</div><div style={{ fontSize: 9.5 }}>EM-2026-002 · Managing Director อนุมัติ ฿45,000 <span className="man-pill gold" style={{ marginLeft: 4 }}>MD</span></div></div>
        </div>
      </div>
    </Shot>
  );
}

export function ProfileShot() {
  return (
    <Shot url="memo.car-1996.com/profile" caption="ภาพประกอบจำลองหน้าโปรไฟล์">
      <div style={{ padding: "16px 18px" }}>
        <div className="man-avatar-hero">
          <div className="man-avatar-circ">ปภ</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>ปุณณวิช ภูประเสริฐ</div>
          <div style={{ marginTop: 4 }}><span className="man-pill ghost" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>Requester</span></div>
        </div>
        <div className="man-card">
          <div className="man-mrow" style={{ justifyContent: "space-between", marginBottom: 0 }}><span style={{ fontSize: 9.5, color: "var(--muted-2)" }}>รหัสบัตรพนักงาน</span><span className="man-num" style={{ fontSize: 10 }}>6905003S</span></div>
        </div>
        <div className="man-card">
          <div className="man-mrow" style={{ justifyContent: "space-between", marginBottom: 0 }}><span style={{ fontSize: 9.5, color: "var(--muted-2)" }}>อีเมล</span><span style={{ fontSize: 10 }}>punnawich@car-1996.com</span></div>
        </div>
        <div className="man-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 10.5, fontWeight: 700 }}>Telegram</div><div style={{ fontSize: 9, color: "var(--emerald)" }}>● เชื่อมต่อแล้ว · 2026-06-15</div></div>
          <span className="man-pill ghost">ยกเลิกการเชื่อมต่อ</span>
        </div>
      </div>
    </Shot>
  );
}
