// Page paths that an unauthenticated visitor is allowed to stay on. The
// AuthProvider must NOT force a redirect to /login for these — otherwise the
// password-reset email link (and the "forgot password" page) bounce away
// before the user can act. Keep in sync with middleware PUBLIC_PATHS pages.
export const PUBLIC_AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.includes(pathname);
}
