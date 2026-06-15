import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Optional authentication: if a valid bearer token is present, `request.user`
 * is populated; if it's missing or invalid, the request proceeds anonymously
 * instead of being rejected. Used on endpoints whose RESPONSE varies by viewer
 * (e.g. profile view, feeds) but which are also reachable logged-out.
 *
 * Pair with @Public() so the global JwtAuthGuard defers to this one.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    _err: unknown,
    user: TUser | false,
  ): TUser {
    // Never throw — just pass through whatever the strategy resolved (or undefined).
    return (user || undefined) as TUser;
  }

  // Always allow the request to continue; the parent runs the strategy first.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // ignore — anonymous access is allowed
    }
    return true;
  }
}
