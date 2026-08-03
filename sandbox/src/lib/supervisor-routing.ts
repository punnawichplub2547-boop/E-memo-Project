import type { ApprovalLevel } from "./approval";

// Server-authoritative Supervisor prepend. The client never decides whether a memo
// gets the optional "Supervisor" pre-Manager check step — the server does, based on
// whether the requesting department has an active Supervisor (departmentHasActiveSupervisor).
//
// Rules:
//   1. Any client-supplied "Supervisor" entry is stripped first (never trusted).
//   2. If the department has an active Supervisor, a single "Supervisor" is prepended
//      to the front of each non-empty route. Empty routes stay empty (never produce a
//      Supervisor-only route — the Manager step is always the mandatory anchor).
//
// Supervisor is NOT on the rank ladder (approval.ts approvalLevels), so this only
// affects routing/step order, never the Book1 amount/budget matrix.
export function applySupervisorRouting(
  selectedRoute: ApprovalLevel[] | undefined,
  recommendedRoute: ApprovalLevel[] | undefined,
  hasSupervisor: boolean,
): { selectedRoute: ApprovalLevel[]; recommendedRoute: ApprovalLevel[] } {
  return {
    selectedRoute: prepend(selectedRoute, hasSupervisor),
    recommendedRoute: prepend(recommendedRoute, hasSupervisor),
  };
}

function prepend(route: ApprovalLevel[] | undefined, hasSupervisor: boolean): ApprovalLevel[] {
  const stripped = (route ?? []).filter((step) => step !== "Supervisor");
  if (hasSupervisor && stripped.length > 0) {
    return ["Supervisor", ...stripped];
  }
  return stripped;
}
