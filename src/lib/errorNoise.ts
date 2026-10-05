// Client error reports that carry no information. Pure (no server-only), so
// the browser reporter, the log-error route and the tests share one rule.

/**
 * "Script error." is all a browser will say about an error thrown by code of
 * another origin: no message, file, line or stack, on purpose. HouseSync's own
 * code can't produce it (the CSP allows only same-origin and nonce'd scripts,
 * so every error of ours arrives in full). What does produce it is code the
 * browser itself injects: in-app browsers such as Snapchat's (both reports on
 * 05/10/2026 came from one), Instagram's and TikTok's, or extensions. There
 * is nothing in it to act on, so it isn't logged.
 */
export function isOpaqueScriptError(message: string, stack?: string | null): boolean {
  return /^script error\.?$/i.test(message.trim()) && !stack;
}
