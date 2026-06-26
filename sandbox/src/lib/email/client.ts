import nodemailer from "nodemailer";

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  replyTo?: string;
};

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type EmailTransport = {
  sendMail: (message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
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

  return {
    host,
    port,
    secure,
    ...(user ? { user } : {}),
    ...(pass ? { pass } : {}),
    from,
    ...(replyTo ? { replyTo } : {}),
  };
}

function defaultTransport(config: EmailConfig): EmailTransport {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user || config.pass
      ? { auth: { user: config.user ?? "", pass: config.pass ?? "" } }
      : {}),
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
    });
    return { messageId: result.messageId ?? "" };
  } catch {
    return null;
  }
}
