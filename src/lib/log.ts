/**
 * Error text that is safe to log: provider and SDK messages can echo request
 * data, so email addresses and long tokens are redacted and length is capped.
 */
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;

export function errorSummary(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return raw.replace(EMAIL, "[email]").replace(LONG_TOKEN, "[token]").slice(0, 300);
}
