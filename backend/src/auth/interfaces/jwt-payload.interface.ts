import { UserRole } from '@prisma/client';

/** Claims carried in the signed access token. */
export interface JwtPayload {
  /** subject — the user id */
  sub: string;
  email: string;
  username: string;
  role: UserRole;
  /** Email-verification state at issue-time (access tokens are short-lived). */
  emailVerified: boolean;
}

/** Claims carried in the signed refresh token. */
export interface RefreshTokenPayload {
  sub: string;
  /** the persisted RefreshToken.id this JWT corresponds to */
  jti: string;
  /** token family for chain revocation on reuse */
  family: string;
}

/** What we issue to a client on login / refresh. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access-token lifetime in seconds
}
