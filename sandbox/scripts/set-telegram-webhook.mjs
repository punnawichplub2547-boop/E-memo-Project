// One-shot: point the Telegram bot webhook at APP_PUBLIC_BASE_URL.
// Run ON the prod host after the tunnel + hostname are live (spec §6.5).
// Hostname is stable, so this only needs to run once (not every restart).
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = process.env.APP_PUBLIC_BASE_URL;

const missing = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "APP_PUBLIC_BASE_URL"]
  .filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[set-telegram-webhook] missing env: ${missing.join(", ")}`);
  process.exit(1);
}

const api = (method) => `https://api.telegram.org/bot${token}/${method}`;

async function main() {
  const url = `${base.replace(/\/$/, "")}/api/telegram/webhook`;
  const setRes = await fetch(api("setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
  }).then((r) => r.json());
  console.log("[setWebhook]", JSON.stringify(setRes));
  if (!setRes.ok) process.exit(1);

  const info = await fetch(api("getWebhookInfo")).then((r) => r.json());
  console.log("[getWebhookInfo]", JSON.stringify(info.result ?? info, null, 2));
  if (info?.result?.url !== url) {
    console.error(`[set-telegram-webhook] registered url mismatch: ${info?.result?.url} !== ${url}`);
    process.exit(1);
  }
  console.log("[set-telegram-webhook] OK");
}

main().catch((e) => { console.error("[set-telegram-webhook] failed:", e); process.exit(1); });
