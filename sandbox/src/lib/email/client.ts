import nodemailer from "nodemailer";

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

export type EmailAttachment = { filename: string; content: Buffer };

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
    const result = await transport.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(config.replyTo ? { replyTo: config.replyTo } : {}),
      ...(message.attachments && message.attachments.length > 0
        ? { attachments: message.attachments }
        : {}),
    });
    return { messageId: result.messageId ?? "" };
  } catch (err) {
    // Non-blocking by design (callers treat null as "not sent"), but the reason
    // must be visible — otherwise an SMTP outage silently drops every email.
    console.error("[sendEmailMessage] SMTP send failed:", err);
    return null;
  }
}
