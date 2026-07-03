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

// Real screen recordings (not CSS mockups) — served from /public, so no
// self-contained/base64 constraint here unlike the standalone Artifact draft.
function DemoGif({ url, filename, alt, caption }: { url: string; filename: string; alt: string; caption: string }) {
  return (
    <>
      <figure className="man-shot">
        <div className="man-shot-chrome">
          <i /><i /><i />
          <span>{url}</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF; next/image re-encodes and drops animation */}
        <img
          src={`/manual/${filename}`}
          alt={alt}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </figure>
      <p className="man-figcaption">{caption}</p>
    </>
  );
}

export function CreateMdReviewDemoGif() {
  return (
    <DemoGif
      url="memo.car-1996.com/create"
      filename="create-memo-md-review-demo.gif"
      alt="วิดีโอสาธิตการกรอกแบบฟอร์มสร้างเมโม เลือกหมวดวัตถุดิบแล้วติ๊ก Supplier ปรับราคา จนแผง MD Review ปรากฏขึ้น"
      caption="วิดีโอสาธิตจริง — กรอกเรื่อง เลือกหมวด &ldquo;วัตถุดิบ&rdquo; แล้วติ๊ก &ldquo;Supplier ปรับราคา&rdquo; จนระบบขึ้นเงื่อนไข MD Review ให้เห็นแบบเรียลไทม์"
    />
  );
}

export function RoutingOverrideDemoGif() {
  return (
    <DemoGif
      url="memo.car-1996.com/create"
      filename="routing-override-demo.gif"
      alt="วิดีโอสาธิตการ override ผู้อนุมัติสุดท้ายจาก General Manager เป็น Managing Director และ ROUTE STATUS เปลี่ยนเป็น exception"
      caption="วิดีโอสาธิตจริง — กรอกจำนวนเงินแล้วเลือกผู้อนุมัติเองแทนคำแนะนำ ระบบขึ้น ROUTE STATUS เป็น &ldquo;escalated&rdquo; ทันที"
    />
  );
}

export function QueueBrowseDemoGif() {
  return (
    <DemoGif
      url="memo.car-1996.com/queue"
      filename="approval-queue-browse-demo.gif"
      alt="วิดีโอสาธิตการกรองแท็บสถานะและเปิด drawer รายละเอียดเมโมในหน้า Approval Queue"
      caption="วิดีโอสาธิตจริง — กรองแท็บ &ldquo;Approved&rdquo; แล้วคลิกแถวเพื่อเปิด drawer ดูรายละเอียดและไทม์ไลน์การอนุมัติ"
    />
  );
}

export function HistoryFilterDemoGif() {
  return (
    <DemoGif
      url="memo.car-1996.com/history"
      filename="history-filter-demo.gif"
      alt="วิดีโอสาธิตการกรองแท็บ Approved ในหน้าประวัติเอกสารและการ์ด KPI ที่ไฮไลต์ตาม"
      caption="วิดีโอสาธิตจริง — คลิกแท็บกรอง &ldquo;Approved&rdquo; การ์ด KPI ที่เกี่ยวข้องจะไฮไลต์ตามให้เห็นทันที"
    />
  );
}

export function NotificationBellDemoGif() {
  return (
    <DemoGif
      url="memo.car-1996.com/"
      filename="notification-bell-demo.gif"
      alt="วิดีโอสาธิตการคลิกกระดิ่งแจ้งเตือนที่มุมขวาบน แสดงรายการแจ้งเตือน"
      caption="วิดีโอสาธิตจริง — คลิกกระดิ่งแจ้งเตือนมุมขวาบน เพื่อดูรายการล่าสุด"
    />
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
