// Pure per-memo attachment authorization, shared by the upload (POST) and
// download (GET) attachment routes. Routes handle session verification and
// disk/streaming work; this module only answers "is this allowed?".
//
// Reuses the existing visibility/ownership rules so attachment access stays in
// lockstep with memo list visibility — a user who cannot see a memo must not be
// able to read its files, and only the owner/admin may attach to an existing memo.

import type { MemoRecord } from "./approval";
import type { SessionUser } from "./auth-jwt";
import { isMemoVisibleTo } from "./memo-visibility";
import { isMemoOwner } from "./memo-ownership";

/**
 * Download authorization for GET /api/attachments/[memoId]/[storedName].
 *
 * - memo == null → false (route maps this to 404; nothing to authorize).
 * - memo not visible to the session → false (route maps to 403).
 * - storedName not listed in memo.attachments → false (route maps to 404).
 *   Compares the stored name from the URL, never originalName — defense-in-depth
 *   so a file sitting in the memo folder but not on the memo cannot be fetched.
 * - visible AND listed → true.
 *
 * Admin visibility is already covered by isMemoVisibleTo (admin bypass).
 */
export function canDownloadAttachment(
  memo: MemoRecord | null,
  session: SessionUser,
  storedName: string,
): boolean {
  if (!memo) return false;
  if (!isMemoVisibleTo(memo, session)) return false;
  const listed = (memo.attachments ?? []).some((a) => a.storedName === storedName);
  return listed;
}

/**
 * Upload authorization for POST /api/attachments (hybrid).
 *
 * - memo == null → true (session-only). The create flow uploads files before the
 *   memo is persisted, so there is no DB row to own yet. Session presence is
 *   verified by the route; this just permits the not-yet-persisted case.
 * - memo != null → owner or admin only. A non-owner, non-admin authenticated user
 *   must not attach files to someone else's existing memo.
 */
export function canUploadAttachment(
  memo: MemoRecord | null,
  session: SessionUser,
): boolean {
  if (!memo) return true;
  if (session.roles.includes("admin")) return true;
  return isMemoOwner({
    requesterUserId: memo.requesterUserId,
    requesterName: memo.requester,
    sessionUserId: session.userId,
    sessionFullName: `${session.firstName} ${session.lastName}`,
  });
}
