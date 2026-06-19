// Pure ownership rule shared by the resubmit / submit-revision routes.
//
// requesterUserId is the authoritative identity once set:
//   - FK set  → owner iff FK === session userId. A FK pointing to another user
//               is NOT theirs; never fall back to a name match (this is the
//               name-collision fix the FK was introduced for).
//   - FK null → fall back to the legacy free-text name match
//               (legacy/seed/prototype rows created before the FK existed).
//
// Admin override is handled by the caller (route), not here.
export function isMemoOwner(input: {
  requesterUserId: number | null | undefined;
  requesterName: string;
  sessionUserId: number;
  sessionFullName: string;
}): boolean {
  if (input.requesterUserId != null) {
    return input.requesterUserId === input.sessionUserId;
  }
  return input.requesterName === input.sessionFullName;
}
