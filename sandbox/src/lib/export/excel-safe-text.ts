// เซลล์ที่ขึ้นต้นด้วยอักขระเหล่านี้จะถูก Excel/LibreOffice ตีความเป็นสูตร
// การเติม ' นำหน้าบังคับให้เป็นข้อความ และ ' จะไม่ถูกแสดงในเซลล์
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

export function safeSpreadsheetText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = String(value);
  return FORMULA_TRIGGERS.some((char) => text.startsWith(char)) ? `'${text}` : text;
}
