// Which approvers get a signature column on the paper form (F-DC-006).
//
// The ISO form has exactly 5 signature columns and Q21 froze it: the form does not
// change. A custom route can name more than 5 people, so Q24 decides who is shown —
// the first four, plus the FINAL approver, who must always have a signature line
// because that is the signature the paper document exists to carry. Everyone in
// between is reported as a count so the reader knows the sheet is a summary.
import { customStepRole, type CustomApprover } from "../custom-route";
import type { MemoSignature } from "./memo-excel";

export const MAX_SIGNATURE_SLOTS = 5;

export type SignatureSlot = {
  label: string;
  subLabel: string;
  stepKey: string | null;
  signature: MemoSignature | undefined;
};

const ROLE_LABEL = { check: "ตรวจ/เห็นชอบ", approve: "อนุมัติ" } as const;

export function buildCustomSignatureSlots(
  approvers: readonly CustomApprover[],
  signatures: readonly MemoSignature[],
): { slots: SignatureSlot[]; hiddenCount: number } {
  if (approvers.length === 0) return { slots: [], hiddenCount: 0 };

  // Carry each person's real position with them: the same user may legitimately
  // appear twice in a route, so indexOf() on the approver object would resolve the
  // duplicate to the wrong position and mislabel who approves.
  const positioned = approvers.map((approver, i) => ({ approver, position: i + 1 }));
  const shown =
    positioned.length <= MAX_SIGNATURE_SLOTS
      ? positioned
      : [...positioned.slice(0, MAX_SIGNATURE_SLOTS - 1), positioned[positioned.length - 1]];
  const hiddenCount = Math.max(0, positioned.length - shown.length);

  const slots = shown.map(({ approver, position }) => {
    const role = customStepRole(position, approvers.length);
    // Last match wins: a step re-signed after a return carries the newer signature.
    const matches = signatures.filter((s) => s.stepLabel === approver.stepKey);
    return {
      label: approver.name,
      subLabel: [approver.approvalLevel, ROLE_LABEL[role]].filter(Boolean).join(" · "),
      stepKey: approver.stepKey,
      signature: matches[matches.length - 1],
    };
  });

  return { slots, hiddenCount };
}
