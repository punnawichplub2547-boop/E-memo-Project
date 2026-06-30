// Shared CAR-branded email shell. Wraps the per-event body (which the caller has
// already built as plain text / safe HTML) with the company signature block and
// the standard confidentiality disclaimer so every outbound email looks the same.
//
// Theme follows the company signature: navy headings (#1F3864), green
// environment note (#2E7D32). All styles are inlined because email clients strip
// <style> and external CSS.

const BRAND_NAVY = "#1F3864";
const BRAND_GREEN = "#2E7D32";
const BORDER = "#d8dee9";
const MUTED = "#6b7280";

const COMPANY_NAME = "Complete Auto Rubber Manufacturing Co.,Ltd.";

const SIGNATURE_LINES = [
  COMPANY_NAME,
  "700/498 M.7, T.Donhualoh",
  "A.Muang, Chonburi 20000 Thailand",
  "Tel  : 038-454-106-108 Ext.109",
  "Email : punnawich@car-1996.com",
  "Website : www.c-autorubber.com",
];

const ENV_NOTE = "Please consider the environment before printing this email";

const DISCLAIMER =
  "This message and all information transmitted here from Complete Auto Rubber Co.,Ltd. " +
  "is only for the person or entity to which it is addressed and may contain confidential " +
  "and/or privileged material. If you have received this email in error please notify the " +
  "sender and delete this message, any disclosure, copying, or distribution of this message, " +
  "or taking of any action based on it, is strictly prohibited. Please note that any views or " +
  "opinions presented in this mail are solely those of the author and do not necessarily " +
  "represent those of the company. Finally, the recipient should check this email and any " +
  "attachments for the presence of viruses. The company accepts no liability for any damage " +
  "caused by any virus transmitted by this email.";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function baseUrl(): string {
  return (process.env.APP_PUBLIC_BASE_URL ?? "").trim().replace(/\/$/, "");
}

// Plain-text alternative: inner body, then signature + env note + disclaimer.
export function wrapEmailText(innerText: string): string {
  return [
    innerText.trimEnd(),
    "",
    "—",
    "Thank you and Best Regards,",
    "",
    ...SIGNATURE_LINES,
    "",
    ENV_NOTE,
    "",
    "................................................................",
    DISCLAIMER,
  ].join("\n");
}

function brandHeader(): string {
  const base = baseUrl();
  const logo = base
    ? `<img src="${base}/CARLOGO.png" alt="${escapeHtml(COMPANY_NAME)}" height="40" style="display:block;border:0;outline:none;text-decoration:none;height:40px;" />`
    : `<span style="font-size:16px;font-weight:700;color:#ffffff;">Complete Auto Rubber</span>`;
  return `<tr><td style="background:${BRAND_NAVY};padding:16px 24px;">${logo}</td></tr>`;
}

function signatureBlockHtml(): string {
  const lines = SIGNATURE_LINES.map(
    (line) => `<div style="color:${BRAND_NAVY};font-size:13px;line-height:1.6;">${escapeHtml(line)}</div>`,
  ).join("");
  return (
    `<div style="margin-top:8px;color:${BRAND_NAVY};font-size:13px;">Thank you and Best Regards,</div>` +
    `<div style="margin-top:8px;">${lines}</div>` +
    `<div style="margin-top:8px;color:${BRAND_GREEN};font-size:13px;font-weight:700;">🌳 ${escapeHtml(ENV_NOTE)}</div>`
  );
}

// Full branded HTML document. innerHtml is embedded verbatim — callers must pass
// already-escaped / trusted HTML (the notification builders escape their inputs).
export function wrapEmailHtml(innerHtml: string, opts?: { heading?: string }): string {
  const heading = opts?.heading
    ? `<h1 style="margin:0 0 12px;font-size:18px;color:${BRAND_NAVY};">${escapeHtml(opts.heading)}</h1>`
    : "";
  return `<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f1f4f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
        ${brandHeader()}
        <tr><td style="padding:24px;color:#1f2937;font-size:14px;line-height:1.7;">
          ${heading}
          <div>${innerHtml}</div>
          <hr style="border:none;border-top:1px solid ${BORDER};margin:20px 0;" />
          ${signatureBlockHtml()}
        </td></tr>
        <tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid ${BORDER};">
          <p style="margin:0;color:${MUTED};font-size:11px;line-height:1.6;">${escapeHtml(DISCLAIMER)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
