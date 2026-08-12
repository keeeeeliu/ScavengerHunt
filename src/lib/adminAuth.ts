/**
 * Checks the organizer passcode from an `x-admin-passcode` header.
 * Returns true when it matches the ADMIN_PASSCODE env var.
 */
export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return false;
  const provided = req.headers.get("x-admin-passcode");
  return provided === expected;
}
