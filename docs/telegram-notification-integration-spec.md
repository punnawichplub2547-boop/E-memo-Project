# Spec: Telegram Hybrid Notification and Executive Action Integration

## Context

Project: `D:\Hrproject\sandbox`

This E-Memo prototype already has:
- Real `users` table and JWT authentication.
- Memo persistence in MySQL.
- Workflow audit rows in `workflow_step_actions`.
- Read/CC acknowledgement rows in `read_actions`.
- Existing web workflow actions for approve, return, reject, read, skip reads, resubmit, and submit revision.

This spec assumes the workflow hardening work in `docs/telegram-workflow-hardening-spec.md` is completed first. Telegram actions must call the trusted server-side workflow service created by that spec.

## Goal

Add a hybrid notification design:
- In-app notifications are the primary system notification channel.
- Telegram DM is a push-alert delivery channel.
- Users self-link their Telegram account so the system can store `chat_id` automatically.
- Executives and authorized approvers can approve from Telegram.
- Return and reject can be supported through a reason + confirmation flow after the initial approve flow is stable.

## Non-Goals

Do not implement:
- LINE integration.
- Email integration.
- Public Telegram groups for memo notifications.
- Telegram as the primary source of workflow truth.
- Telegram-only memo review with full attachment/price detail.
- Any client-side exposure of bot tokens or secrets.

## Important Telegram Constraints

Design must follow Telegram Bot API constraints:
- Bot DM requires a known chat id. Users must start/link the bot first.
- `sendMessage` uses `chat_id`.
- Inline button `callback_data` is limited to a small payload, so store only a short opaque token in the button.
- Telegram webhook should be HTTPS in production.
- Bot token and webhook secret must live only in server-side environment variables.

## Environment Variables

Add server-only environment variables:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_BOT_USERNAME=
APP_PUBLIC_BASE_URL=
```

Notes:
- `TELEGRAM_BOT_TOKEN` must never be imported by client components.
- `APP_PUBLIC_BASE_URL` is used to build "Open in E-Memo" links.
- For local development, webhook testing may require a public HTTPS tunnel, but the production design should assume a normal HTTPS app URL.

## Database Changes

Create migrations for the following tables.

### 1. user_telegram_accounts

Stores the Telegram account linked to an E-Memo user.

```sql
CREATE TABLE user_telegram_accounts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  user_id BIGINT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  telegram_username VARCHAR(255) NULL,
  first_name VARCHAR(255) NULL,
  last_name VARCHAR(255) NULL,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  linked_at DATETIME NOT NULL,
  last_seen_at DATETIME NULL,
  revoked_at DATETIME NULL,

  CONSTRAINT fk_uta_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_uta_user_active (user_id, is_active),
  UNIQUE KEY uq_uta_telegram_user (telegram_user_id),
  INDEX idx_uta_chat_id (telegram_chat_id)
);
```

Implementation note:
- MySQL unique keys with booleans may make relinking awkward if inactive rows remain. If needed, use application logic to deactivate old rows before inserting the new active row, or use a generated active-only key strategy.

### 2. telegram_link_tokens

Supports self-linking from the E-Memo profile page.

```sql
CREATE TABLE telegram_link_tokens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  token_hash CHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,

  CONSTRAINT fk_tlt_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_tlt_token_hash (token_hash),
  INDEX idx_tlt_user (user_id),
  INDEX idx_tlt_expires (expires_at)
);
```

Token rules:
- Store only a hash of the token.
- Token should be one-time use.
- Expire within 10-30 minutes.

### 3. notifications

Primary in-app notification record.

```sql
CREATE TABLE notifications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  memo_id BIGINT NULL,
  recipient_user_id BIGINT NOT NULL,
  notification_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NULL,
  action_url VARCHAR(500) NULL,

  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL,

  CONSTRAINT fk_notifications_memo FOREIGN KEY (memo_id) REFERENCES memos(id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (recipient_user_id) REFERENCES users(id),
  INDEX idx_notifications_recipient_read (recipient_user_id, is_read),
  INDEX idx_notifications_created (created_at)
);
```

Example `notification_type` values:
- `memo_pending_approval`
- `memo_pending_read`
- `memo_cc`
- `memo_returned`
- `memo_rejected`
- `memo_approved`

### 4. notification_deliveries

Tracks channel delivery status, including Telegram.

```sql
CREATE TABLE notification_deliveries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  notification_id BIGINT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  provider_message_id VARCHAR(255) NULL,
  error_message TEXT NULL,
  attempted_at DATETIME NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL,

  CONSTRAINT fk_nd_notification FOREIGN KEY (notification_id) REFERENCES notifications(id),
  UNIQUE KEY uq_nd_notification_channel (notification_id, channel),
  INDEX idx_nd_status (channel, status)
);
```

Channel values:
- `in_app`
- `telegram`

Status values:
- `pending`
- `sent`
- `failed`
- `skipped`

### 5. telegram_action_tokens

Stores short-lived tokens for Telegram action buttons.

```sql
CREATE TABLE telegram_action_tokens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  token_hash CHAR(64) NOT NULL,
  memo_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,

  metadata_json JSON NULL,

  CONSTRAINT fk_tat_memo FOREIGN KEY (memo_id) REFERENCES memos(id),
  CONSTRAINT fk_tat_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_tat_token_hash (token_hash),
  INDEX idx_tat_user (user_id),
  INDEX idx_tat_memo (memo_id),
  INDEX idx_tat_expires (expires_at)
);
```

Action type values:
- `approve`
- `return_start`
- `reject_start`
- `open`

## User Linking Flow

### Profile / Connect Telegram

Add a profile section or admin/user page action:
- Show Telegram connection status.
- If not linked, show `Connect Telegram`.
- On click, call a server route that creates a short-lived token and returns:

```text
https://t.me/<TELEGRAM_BOT_USERNAME>?start=<raw_token>
```

The user clicks the link and presses Start in Telegram.

### Telegram /start Handling

Webhook receives:

```text
/start <raw_token>
```

Server must:
- Hash token.
- Find unused, unexpired token.
- Load target active user.
- Deactivate old active Telegram account for this user if present.
- Insert or update `user_telegram_accounts`.
- Mark token as used.
- Send Telegram confirmation message.

If token is invalid or expired:
- Send a short message asking the user to generate a new link from E-Memo.

## Recipient Resolution

Current memo CC/read recipients may be stored as strings such as:
- full name
- department
- email
- recipient group label

Add a server helper:

`src/lib/notification-recipients.ts`

Responsibilities:
- Resolve memo requester to a user where possible.
- Resolve current approval step to active users with matching `approval_level`.
- Resolve read/CC recipient labels to active users by:
  - exact email
  - exact full name
  - exact department
  - future recipient group mapping, if added

Rules:
- If a label resolves to multiple users, notify all matching active users unless product policy says otherwise.
- If a label resolves to no users, create no Telegram delivery but keep the memo workflow intact.
- Do not grant memo visibility or workflow permission solely because a Telegram message was sent.

## Notification Creation Rules

Create notifications for these events:

### Memo Submitted

Recipients:
- Current approver(s) for `current_step`.
- Read/CC recipients if present.

Types:
- Current approver: `memo_pending_approval`
- Read recipient: `memo_pending_read`
- CC awareness: `memo_cc`

### Memo Advanced

If memo remains pending:
- Notify next approver(s).

If memo becomes approved:
- Notify requester.

### Memo Returned

Notify requester.

### Memo Rejected

Notify requester.

### Memo Resubmitted / Submit Revision

Notify first approver and read recipients again, consistent with current workflow behavior.

## Telegram Delivery Rules

Telegram is a delivery channel, not the source of truth.

For every notification:
- Always create the in-app notification.
- Create a Telegram delivery only if the recipient has an active linked Telegram account.
- If no linked account exists, mark Telegram delivery as `skipped` or do not create the delivery, based on implementation preference.

Message content should be intentionally minimal:

```text
E-Memo: รออนุมัติ
เลขที่: EM-...
เรื่อง: ...
ผู้ขอ: ...
สถานะ: รออนุมัติที่ Managing Director
```

Do not include:
- full vendor price comparison
- attachment contents
- sensitive budget detail
- full reject/return history

Always include an "Open in E-Memo" button.

## Executive Telegram Actions

### Phase 1: Approve Only

For authorized approvers, Telegram message may include:
- `Approve`
- `Open in E-Memo`

When sending the message:
- Create a `telegram_action_tokens` row for `approve`.
- Put only the short raw token or token id in `callback_data`.

When callback is received:
- Verify webhook secret.
- Find token by hash.
- Check token is unused and unexpired.
- Load linked Telegram account and active E-Memo user.
- Ensure token user matches Telegram user.
- Call `approveMemoAction({ memoNo, actorUserId, source: "telegram", metadata })`.
- Mark token used only if the workflow action succeeds, or mark used before action inside the same transaction if the implementation can guarantee rollback on action failure.
- Answer callback query with success/failure message.
- Send follow-up DM summarizing the result.

### Phase 2: Return / Reject

Return and reject require a reason. Do not execute immediately from the first button.

Flow:
1. User taps `Return` or `Reject`.
2. Bot records a pending conversation state for that user/action/memo.
3. Bot asks for reason.
4. User sends reason text.
5. Bot shows confirmation buttons:
   - Confirm Return / Confirm Reject
   - Cancel
6. On confirm, call the trusted workflow service.

Reject must also capture disposition:
- `close`
- `revision-allowed`

Implementation can either:
- Ask disposition first, then reason, then confirm.
- Or provide two reject-start buttons: `Reject: Close` and `Reject: Allow Revision`.

Add a table if needed:

```sql
CREATE TABLE telegram_conversation_states (
  id BIGINT NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),

  telegram_user_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  memo_id BIGINT NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  state VARCHAR(80) NOT NULL,
  payload_json JSON NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,

  INDEX idx_tcs_telegram_user (telegram_user_id),
  INDEX idx_tcs_expires (expires_at)
);
```

## API Routes

Add routes:

### POST /api/telegram/webhook

Responsibilities:
- Validate Telegram webhook secret header.
- Handle `/start <token>`.
- Handle callback queries.
- Handle reason text for pending return/reject conversation states.
- Never expose bot token.

This route must be public from the browser-session perspective, but protected by Telegram webhook secret verification.

Update middleware public paths to allow:
- `/api/telegram/webhook`

### POST /api/profile/telegram-link-token

Requires active web session.

Creates link token and returns bot deep link.

### DELETE /api/profile/telegram-account

Requires active web session.

Revokes the active Telegram link for the current user.

### GET /api/profile/telegram-account

Requires active web session.

Returns current Telegram link status.

## Services / Modules

Add:

### src/lib/telegram/client.ts

Server-only helper for Telegram Bot API:
- `sendTelegramMessage`
- `answerCallbackQuery`
- optional helpers for inline keyboards

Must read `TELEGRAM_BOT_TOKEN` only on the server.

### src/lib/telegram/tokens.ts

Helpers:
- create raw random token
- hash token with SHA-256
- compare token hash

### src/lib/telegram/linking.ts

Helpers:
- create link token
- consume link token
- upsert/deactivate Telegram account

### src/lib/notifications.ts

Helpers:
- create in-app notification
- create delivery rows
- mark delivery status
- compose Telegram-safe message text

### src/lib/notification-recipients.ts

Recipient resolution helpers.

### src/lib/telegram/actions.ts

Helpers:
- create Telegram action token
- consume action token
- dispatch to workflow action service

## Security Requirements

- Never trust Telegram `username` as identity.
- Trust only linked `telegram_user_id` / `telegram_chat_id` mapped to a real active E-Memo user.
- Never put memo authority in callback data.
- Action tokens must be one-time and short-lived.
- Re-check memo status, current step, active user, and permission at callback time.
- A Telegram message must not grant visibility or approval permission by itself.
- Bot token must stay server-side.
- Webhook route must verify `TELEGRAM_WEBHOOK_SECRET`.
- Audit every Telegram workflow action through `workflow_step_actions.metadata_json`.

Example metadata:

```json
{
  "source": "telegram",
  "telegram_user_id": "123456",
  "telegram_chat_id": "123456",
  "telegram_message_id": "789"
}
```

## Failure Handling

If Telegram send fails:
- Mark delivery `failed`.
- Do not block memo workflow.
- Keep in-app notification.

If user has no linked Telegram:
- Keep in-app notification.
- Mark Telegram delivery `skipped` or omit it.

If callback token is expired/used:
- Answer callback with "This action has expired. Please open E-Memo."
- Do not update memo.

If permission changed after message was sent:
- Deny action.
- Answer callback with "You no longer have permission for this step."
- Do not update memo.

If memo already moved to another step:
- Deny action.
- Answer callback with "This memo has already moved."
- Do not update memo.

## Rollout Plan for 100+ Users

Recommended rollout:

1. Admin/executive pilot:
   - Link Telegram for MD/GM/Manager users first.
   - Enable Telegram DM for pending approval.
   - Enable Telegram Approve only.

2. Department read/CC pilot:
   - Enable Telegram DM for read recipients and CC users.
   - No Telegram read acknowledgement yet unless explicitly approved.

3. Company-wide self-link:
   - Add dashboard/profile banner.
   - Admin dashboard shows linked/unlinked counts.
   - Keep E-Memo usable for users who do not link Telegram.

4. Return/reject actions:
   - Add reason + confirm flow after approve path is stable.

## Admin / Monitoring UI

Add admin visibility eventually:
- Users linked to Telegram.
- Users not linked.
- Last Telegram delivery status.
- Failed delivery list.
- Revoke Telegram account link.
- Regenerate link instructions.

This can be deferred if implementation starts with a small executive pilot.

## Testing Requirements

Unit tests:
- Token generation/hash/expiry.
- Link token consume succeeds once.
- Link token cannot be reused.
- Recipient resolution by email, full name, and department.
- Notification delivery is skipped if no Telegram account.
- Action token cannot be reused.
- Action token cannot be used by another Telegram user.
- Expired action token is rejected.
- Callback calls trusted workflow service with `source: "telegram"`.

Integration-style tests, if practical:
- `/start <token>` links a Telegram account.
- Approve callback moves memo only when actor is authorized.
- Approve callback fails when memo has moved.
- Approve callback fails when pending read actions remain.

Manual smoke tests:
- Link Telegram from profile.
- Submit memo to an executive step.
- Receive Telegram DM.
- Click Open in E-Memo.
- Click Approve in Telegram.
- Confirm audit log records source as Telegram.

## Verification

Run from `D:\Hrproject\sandbox`:

```bash
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

All must pass.

## Acceptance Criteria

- Users can self-link Telegram without admin manually entering chat ids.
- In-app notifications remain the primary notification source.
- Telegram DM is sent only to linked users.
- Missing Telegram link never blocks memo workflow.
- Executive Telegram approve works only through trusted server-side workflow action service.
- Telegram action callbacks use one-time, expiring tokens.
- Return/reject are either not exposed yet or require reason + confirmation flow.
- Every Telegram workflow action is audited in `workflow_step_actions`.
- No Telegram secrets or API keys are exposed to client components or committed files.
