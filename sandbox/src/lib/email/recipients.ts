// Parse a free-typed recipient string (one or more addresses separated by
// comma / semicolon / newline) into validated + invalid buckets. The email
// check is intentionally permissive — it catches obvious typos before the
// addresses reach the SMTP transport, not full RFC 5322 validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRecipientEmails(input: string): { emails: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const raw of input.split(/[,;\n]/)) {
    const candidate = raw.trim();
    if (!candidate) continue;
    if (!EMAIL_RE.test(candidate)) {
      invalid.push(candidate);
      continue;
    }
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    emails.push(candidate);
  }
  return { emails, invalid };
}
