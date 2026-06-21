import { randomBytes, timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Helpers for the OAuth login-CSRF defence. We don't run express-session, so we
 * use a stateless "double-submit" pattern: the entry route mints a random nonce,
 * stores it in a short-lived httpOnly cookie AND sends it to Google as the
 * `state` parameter; the callback requires the two to match.
 */

/** Name of the short-lived cookie that carries the OAuth state nonce. */
export const OAUTH_STATE_COOKIE = 'epta_oauth_state';

/** Cookie path — scoped to the auth routes that set and read it. */
export const OAUTH_STATE_PATH = '/api/auth';

/** Lifetime of the OAuth state cookie (10 minutes). */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** Generate a URL-safe random nonce for the OAuth `state` parameter. */
export function generateOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Read a single cookie from the raw `Cookie` header. We parse it by hand to
 * avoid pulling in cookie-parser for one value (the app uses no other cookies).
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Constant-time comparison of the cookie state and the query state. Returns
 * false on any missing value or length mismatch (so a missing cookie never
 * accidentally matches an empty query value).
 */
export function statesMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
