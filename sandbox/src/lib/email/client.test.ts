import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailConfig, sendEmailMessage, type EmailConfig } from "./client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getEmailConfig", () => {
  it("returns null until email notifications are explicitly enabled", () => {
    expect(getEmailConfig({
      EMAIL_NOTIFICATIONS_ENABLED: "false",
      SMTP_HOST: "smtp.example.com",
      EMAIL_FROM: "E-Memo <no-reply@example.com>",
    })).toBeNull();
  });

  it("parses SMTP settings when email delivery is enabled", () => {
    expect(getEmailConfig({
      EMAIL_NOTIFICATIONS_ENABLED: "true",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "mailer",
      SMTP_PASS: "secret",
      EMAIL_FROM: "E-Memo <no-reply@example.com>",
      EMAIL_REPLY_TO: "hr@example.com",
    })).toEqual({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "mailer",
      pass: "secret",
      from: "E-Memo <no-reply@example.com>",
      replyTo: "hr@example.com",
    });
  });

  it("returns null when required SMTP fields are missing", () => {
    expect(getEmailConfig({
      EMAIL_NOTIFICATIONS_ENABLED: "true",
      SMTP_HOST: "smtp.example.com",
    })).toBeNull();
  });
});

describe("sendEmailMessage", () => {
  const config: EmailConfig = {
    host: "smtp.example.com",
    port: 587,
    secure: false,
    user: "mailer",
    pass: "secret",
    from: "E-Memo <no-reply@example.com>",
  };

  it("uses the configured transport and returns the provider message id", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "abc-123" });
    const result = await sendEmailMessage(
      {
        to: "approver@example.com",
        subject: "รออนุมัติ: EM-1",
        text: "Please review",
        html: "<p>Please review</p>",
      },
      {
        getConfig: () => config,
        createTransport: () => ({ sendMail }),
      },
    );

    expect(result).toEqual({ messageId: "abc-123" });
    expect(sendMail).toHaveBeenCalledWith({
      from: "E-Memo <no-reply@example.com>",
      to: "approver@example.com",
      subject: "รออนุมัติ: EM-1",
      text: "Please review",
      html: "<p>Please review</p>",
    });
  });

  it("returns null when email delivery is not configured", async () => {
    const sendMail = vi.fn();
    vi.stubEnv("EMAIL_NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("EMAIL_FROM", "E-Memo <no-reply@example.com>");
    await expect(sendEmailMessage(
      {
        to: "approver@example.com",
        subject: "รออนุมัติ: EM-1",
        text: "Please review",
      },
      {
        getConfig: () => null,
        createTransport: () => ({ sendMail }),
      },
    )).resolves.toBeNull();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("returns null instead of throwing when SMTP send fails", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("SMTP down"));
    await expect(sendEmailMessage(
      {
        to: "approver@example.com",
        subject: "รออนุมัติ: EM-1",
        text: "Please review",
      },
      {
        getConfig: () => config,
        createTransport: () => ({ sendMail }),
      },
    )).resolves.toBeNull();
  });
});
