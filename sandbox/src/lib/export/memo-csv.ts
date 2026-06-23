// Builds a flat CSV of memo records for the History page "Export CSV" action.
// Pure (no DB/fs/DOM) so it is fully unit-testable; the page wraps the output in a
// UTF-8 BOM + Blob for download so Excel opens Thai text without mojibake.
import { MemoRecord, approvalLabels } from "../approval";

const STATUS_LABELS: Record<string, string> = {
  draft: "ร่าง",
  pending: "รอดำเนินการ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
  returned: "ส่งกลับ",
};

// RFC 4180 field escaping: a field containing a comma, double-quote, or line break
// is wrapped in double-quotes, and each internal double-quote is doubled.
export function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const MEMO_CSV_HEADERS = [
  "เลขที่เอกสาร",
  "หัวเรื่อง",
  "แผนก",
  "ผู้จัดทำ",
  "ประเภท",
  "จำนวนเงิน (บาท)",
  "สถานะ",
  "ขั้นปัจจุบัน",
  "เส้นทางอนุมัติ",
  "โหมดเส้นทาง",
  "รอบแก้ไข",
  "ระยะเวลา (ชม.)",
  "เหตุผลส่งกลับ",
  "เหตุผลปฏิเสธ",
  "วันที่สร้าง",
  "อัปเดตล่าสุด",
] as const;

export function memoToCsvRow(m: MemoRecord): string {
  const rejectNote = m.rejectReason
    ? `${m.rejectDisposition === "revision-allowed" ? "อนุญาตให้แก้ไข" : "ปิด"}: ${m.rejectReason}`
    : "";
  const cells: Array<string | number | null | undefined> = [
    m.id,
    m.title,
    m.department,
    m.requester,
    approvalLabels[m.category] ?? m.category,
    m.amount,
    STATUS_LABELS[m.status] ?? m.status,
    m.currentStep,
    m.selectedRoute?.join(" -> ") ?? m.currentStep,
    m.routeMode ?? "",
    m.revisionNo ?? 0,
    m.cycleHours,
    m.returnReason ?? "",
    rejectNote,
    m.createdAt,
    m.updatedAt,
  ];
  return cells.map(csvCell).join(",");
}

// CRLF line endings per RFC 4180 — the format Excel expects most reliably.
export function memosToCsv(memos: MemoRecord[]): string {
  const header = MEMO_CSV_HEADERS.map(csvCell).join(",");
  const rows = memos.map(memoToCsvRow);
  return [header, ...rows].join("\r\n");
}
