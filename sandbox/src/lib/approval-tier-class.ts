import type { ApprovalLevel } from "./approval";

/** The `.em-tier` colour modifier defined in globals.css for each approval tier. */
export type ApprovalTierClass = "md" | "gm" | "mgr";

/**
 * Maps an approval level to its badge colour modifier. Kept as a pure function
 * rather than an inline ternary because it was inlined in one place and hardcoded
 * to "mgr" in another, so a "Managing Director" badge rendered in the Manager
 * colour — on the very card whose job is to surface the gap between the Book1
 * recommendation and the route the requester actually picked.
 *
 * Supervisor has no dedicated colour in globals.css and deliberately shares the
 * manager palette.
 */
export function approvalTierClass(level: ApprovalLevel): ApprovalTierClass {
  if (level === "Managing Director") return "md";
  if (level === "General Manager") return "gm";
  return "mgr";
}
