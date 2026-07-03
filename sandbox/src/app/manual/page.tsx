import type { Metadata } from "next";
import Link from "next/link";
import { ManualStyles } from "./_components/manual-styles";
import { ManualSections } from "./_components/manual-sections";

export const metadata: Metadata = {
  title: "คู่มือการใช้งาน · HR&GA E-Memo",
  description: "คู่มือการใช้งานระบบ HR&GA E-Memo Online — สร้างเมโม อนุมัติตามสายบังคับบัญชา และติดตามสถานะ",
};

// Public documentation page — no auth, no app chrome (sidebar/topbar depend on a
// session the visitor may not have). Standalone branded layout echoing /login so
// it reads as the same product. Static server component; the TOC uses anchors.
const TOC = [
  { href: "#sec-login", label: "1. เข้าสู่ระบบ" },
  { href: "#sec-dashboard", label: "2. หน้า Dashboard" },
  { href: "#sec-create", label: "3. สร้างและส่งเมโม" },
  { href: "#sec-mdreview", label: "3.1 กติกา MD Review", sub: true },
  { href: "#sec-routing", label: "3.2 เส้นทางอนุมัติ", sub: true },
  { href: "#sec-queue", label: "4. Approval Queue" },
  { href: "#sec-approver", label: "5. สำหรับผู้อนุมัติ" },
  { href: "#sec-history", label: "6. ประวัติเอกสาร" },
  { href: "#sec-notify", label: "7. การแจ้งเตือน & Telegram" },
  { href: "#sec-profile", label: "8. โปรไฟล์ของฉัน" },
];

const COVER_ITEMS = [
  "เข้าสู่ระบบครั้งแรก",
  "ภาพรวมหน้า Dashboard",
  "สร้างและส่งเมโม 3 ขั้นตอน",
  "ติดตามสถานะใน Approval Queue",
  "สำหรับผู้อนุมัติ (Manager / GM / MD)",
  "ประวัติเอกสารและรายงาน",
  "การแจ้งเตือนและ Telegram",
  "จัดการโปรไฟล์ของฉัน",
];

export default function ManualPage() {
  return (
    <div className="man-root">
      <ManualStyles />

      {/* ── Cover ── */}
      <header className="man-cover">
        <div className="man-cover-inner">
          <div>
            <Link href="/login" className="man-cover-back">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              กลับหน้าเข้าสู่ระบบ
            </Link>
            <div>
              <span className="man-cover-kicker">คู่มือการใช้งาน · IT Ranger</span>
            </div>
            <h1>คู่มือใช้งานระบบ<br />HR&amp;GA E-Memo</h1>
            <p className="man-lede">ระบบร่างเมโมและอนุมัติออนไลน์ของ Complete Auto Rubber Manufacturing — ตั้งแต่สร้างเอกสาร ส่งอนุมัติตามสายบังคับบัญชา ไปจนถึงติดตามผลและแจ้งเตือนผ่าน Telegram</p>
            <div className="man-cover-meta">
              <div><strong>เวอร์ชันคู่มือ</strong>3 กรกฎาคม 2569</div>
              <div><strong>ระบบ Live</strong>memo.car-1996.com</div>
              <div><strong>จัดทำโดย</strong>ทีม IT Ranger</div>
            </div>
          </div>
          <div className="man-cover-card">
            <h3>ในคู่มือนี้มีอะไรบ้าง</h3>
            <ol>
              {COVER_ITEMS.map((item, i) => (
                <li key={i}><b>{i + 1}</b><span>{item}</span></li>
              ))}
            </ol>
          </div>
        </div>
      </header>

      {/* ── Shell: TOC + content ── */}
      <div className="man-shell">
        <aside className="man-toc">
          <div className="man-toc-label">สารบัญ</div>
          <nav>
            {TOC.map(item => (
              <a key={item.href + item.label} href={item.href} className={item.sub ? "sub" : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <ManualSections />
      </div>

      {/* ── Footer ── */}
      <footer className="man-footer">
        <span>คู่มือฉบับนี้จัดทำโดยทีม IT Ranger · <Link href="/login">กลับหน้าเข้าสู่ระบบ</Link></span>
        <span>Complete Auto Rubber Manufacturing Co., Ltd. · HR&amp;GA Workflow System</span>
      </footer>
    </div>
  );
}
