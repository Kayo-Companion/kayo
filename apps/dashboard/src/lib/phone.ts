/**
 * Normalize a user-typed phone number to E.164. Returns null for inputs we
 * can't make sense of. Bare 9–11 digit inputs are treated as Japanese (+81)
 * with a leading-zero strip; anything starting with `+` is taken as-is once
 * stripped of separators.
 */
export function normalizePhoneE164(input: string): string | null {
  const cleaned = input.trim().replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) {
    return /^\+\d{8,15}$/.test(cleaned) ? cleaned : null;
  }
  if (/^\d{9,11}$/.test(cleaned)) {
    return `+81${cleaned.replace(/^0/, "")}`;
  }
  return null;
}
