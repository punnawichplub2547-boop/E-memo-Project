/**
 * Determines whether an authenticated session user may see a given memo.
 *
 * Temporary limitation — requester name matching:
 *   memo.requester is the free-text name stored at create time (from the form's
 *   requester field). Matching uses exact string equality with
 *   `${session.firstName} ${session.lastName}`.trim(). If the name was entered
 *   differently at create time (e.g. via the prototype user selector vs. real
 *   auth), the match will fail silently. Accepted for the prototype trial.
 *
 * Visibility vs. action permission:
 *   This function controls list visibility only. It does NOT imply any
 *   approval, return, or reject permission. In particular:
 *   - A managing-director user is shown notifyMD memos for awareness; approval
 *     permission is governed separately by canApproveMemo() in prototype-users.ts.
 *   - HR&GA department name alone never grants visibility. Only session.roles
 *     are evaluated — no department-based branch exists in this function.
 *   - admin is the only role that grants system-wide visibility.
 */

import type { MemoRecord, ApprovalLevel } from "./approval";
import type { SessionUser } from "./auth-jwt";

export function isMemoVisibleTo(memo: MemoRecord, session: SessionUser): boolean {
  // Admin: full visibility — the only system-wide bypass
  if (session.roles.includes("admin")) return true;

  const fullName = `${session.firstName} ${session.lastName}`.trim();

  // Requester: sees memos they submitted (exact name match — see temporary limitation above)
  if (session.roles.includes("requester") && memo.requester === fullName) return true;

  // Approver: sees memos where their approval level appears in any route source or is currentStep.
  // Manager / Top Section has an extra department filter — they only see memos from their own
  // department. GM and MD have no department restriction.
  const approvalLevel = toApprovalLevel(session.approvalLevel);
  if (approvalLevel) {
    const routeSteps = new Set<string>([
      ...(memo.selectedRoute ?? []),
      ...(memo.recommendedRoute ?? []),
    ]);
    const inRoute = routeSteps.has(approvalLevel) || memo.currentStep === approvalLevel;
    if (inRoute) {
      if (approvalLevel === "Manager / Top Section") {
        if (session.department && memo.department === session.department) return true;
      } else {
        return true;
      }
    }
  }

  // Managing Director: also sees notifyMD memos (awareness only — not approval permission)
  if (session.roles.includes("managing-director") && memo.notifyMD === true) return true;

  // CC visibility: any user whose name, department, or email appears in read recipients
  // can see the memo — no read-recipient role required.
  const labels = new Set<string>(
    [fullName, session.department, session.email].filter((s): s is string => Boolean(s))
  );
  const recipients: string[] = [
    ...(memo.readRecipients ?? []),
    ...(memo.readActions?.map(ra => ra.recipient) ?? []),
  ];
  if (recipients.some(r => labels.has(r))) return true;

  return false;
}

function toApprovalLevel(level: string | null | undefined): ApprovalLevel | null {
  if (
    level === "Manager / Top Section" ||
    level === "General Manager" ||
    level === "Managing Director"
  ) {
    return level;
  }
  return null;
}
