import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator';

/** HTTP methods that only READ state — always allowed, even unverified. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Email-verification gate. DECISION: viewing is open, writing is gated. An
 * authenticated user may browse freely, but any state-changing request
 * (POST/PATCH/PUT/DELETE) requires a verified email — matching the product rule
 * "you can read everything, but to write you must confirm your email".
 *
 * Runs as a global guard AFTER JwtAuthGuard, so `request.user` is already
 * populated for protected routes. Anonymous requests (no user) are left to the
 * other guards — this one only blocks a *logged-in-but-unverified* writer.
 * Routes marked @AllowUnverified() (the verification endpoints, logout) bypass it.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowUnverified) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const user = req.user as
      | (AuthenticatedUser & { emailVerified?: boolean })
      | undefined;

    // No authenticated principal → not this guard's concern (anonymous writes
    // are already rejected by JwtAuthGuard on non-@Public routes).
    if (!user) return true;

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email not verified — confirm your email to perform this action',
      );
    }
    return true;
  }
}
