// Who may view the executive Audit Trail page (/audit) and its API (/api/audit).
//
// This is intentionally DISTINCT from the Admin panel's Audit Log tab, which
// stays admin-only (gated inside /api/admin/audit). The executive-facing trail
// additionally grants read access to the Managing Director so leadership can
// review the company-wide workflow history without admin rights.
//
// Pure + dependency-free so it can be reused by both the API route (server) and
// the page guard (client) and unit-tested without a DB or request context.
export function canViewAuditTrail(roles: readonly string[] | null | undefined): boolean {
  if (!roles) return false;
  return roles.includes("admin") || roles.includes("managing-director");
}
