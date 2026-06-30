import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  replyTo?: string;
  // TLS overrides for mail servers whose cert CN/SAN differs from SMTP_HOST
  // (e.g. a vanity host mail.car-1996.com fronting hmail02.readyidc.cloud).
  tlsServername?: string;
  tlsRejectUnauthorized?: boolean;
};

// `cid` makes nodemailer embed the attachment inline so `<img src="cid:...">`
// in the HTML body renders (used for the CAR logo in the branded header).
export type EmailAttachment = { filename: string; content: Buffer; cid?: string };

// Content-ID the branded email header references (must match template.ts LOGO_CID).
const LOGO_CID = "carlogo";

// Read public/CARLOGO.png once and cache. In the standalone build cwd is /app, so
// the file lives at /app/public/CARLOGO.png; in dev/test it is <repo>/public.
// undefined = not attempted, null = file unavailable.
let cachedLogo: EmailAttachment | null | undefined;

function loadLogoAttachment(): EmailAttachment | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const file = path.join(process.cwd(), "public", "CARLOGO.png");
    cachedLogo = { filename: "CARLOGO.png", content: fs.readFileSync(file), cid: LOGO_CID };
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

type EmailTransport = {
  sendMail: (message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    attachments?: EmailAttachment[];
  }) => Promise<{ messageId?: string }>;
};

type EmailDeps = {
  getConfig?: () => EmailConfig | null;
  createTransport?: (config: EmailConfig) => EmailTransport;
  getLogo?: () => EmailAttachment | null;
};

function envEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 587;
}

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig | null {
  if (!envEnabled(env.EMAIL_NOTIFICATIONS_ENABLED)) return null;

  const host = env.SMTP_HOST?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!host || !from) return null;

  const port = parsePort(env.SMTP_PORT);
  const secure = env.SMTP_SECURE == null
    ? port === 465
    : envEnabled(env.SMTP_SECURE);
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  const replyTo = env.EMAIL_REPLY_TO?.trim();
  const tlsServername = env.SMTP_TLS_SERVERNAME?.trim();
  const tlsRejectUnauthorized = env.SMTP_TLS_REJECT_UNAUTHORIZED == null
    ? undefined
    : envEnabled(env.SMTP_TLS_REJECT_UNAUTHORIZED);

  return {
    host,
    port,
    secure,
    ...(user ? { user } : {}),
    ...(pass ? { pass } : {}),
    from,
    ...(replyTo ? { replyTo } : {}),
    ...(tlsServername ? { tlsServername } : {}),
    ...(tlsRejectUnauthorized !== undefined ? { tlsRejectUnauthorized } : {}),
  };
}

function defaultTransport(config: EmailConfig): EmailTransport {
  const tls: { servername?: string; rejectUnauthorized?: boolean } = {};
  if (config.tlsServername) tls.servername = config.tlsServername;
  if (config.tlsRejectUnauthorized === false) tls.rejectUnauthorized = false;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user || config.pass
      ? { auth: { user: config.user ?? "", pass: config.pass ?? "" } }
      : {}),
    ...(Object.keys(tls).length > 0 ? { tls } : {}),
  });
}

export async function sendEmailMessage(
  message: EmailMessage,
  deps: EmailDeps = {},
): Promise<{ messageId: string } | null> {
  const config = deps.getConfig ? deps.getConfig() : getEmailConfig();
  if (!config) return null;

  try {
    const transport = (deps.createTransport ?? defaultTransport)(config);

    // Build the attachment list: caller attachments + the inline logo when the HTML
    // references it (and it isn't already present). Text-only mail gets no logo.
    const attachments: EmailAttachment[] = [...(message.attachments ?? [])];
    if (
      message.html?.includes(`cid:${LOGO_CID}`) &&
      !attachments.some((a) => a.cid === LOGO_CID)
    ) {
      const logo = (deps.getLogo ?? loadLogoAttachment)();
      if (logo) attachments.push(logo);
    }

    const result = await transport.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(config.replyTo ? { replyTo: config.replyTo } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    });
    return { messageId: result.messageId ?? "" };
  } catch (err) {
    // Non-blocking by design (callers treat null as "not sent"), but the reason
    // must be visible — otherwise an SMTP outage silently drops every email.
    console.error("[sendEmailMessage] SMTP send failed:", err);
    return null;
  }
}
