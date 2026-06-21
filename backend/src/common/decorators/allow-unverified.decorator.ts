import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

/**
 * Marks a route as reachable by an authenticated user whose email is NOT yet
 * verified. Read by EmailVerifiedGuard. Use on the verification endpoints
 * themselves (verify-email, resend-code) and on logout — otherwise an
 * unverified user could never escape the gate.
 */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
