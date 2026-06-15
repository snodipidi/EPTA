import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role-based authorization with a HIERARCHY: a higher role satisfies any
 * requirement met by a lower one (OWNER ⊇ ADMIN ⊇ MODERATOR ⊇ USER). So
 * `@Roles(MODERATOR)` admits moderators, admins and owners — you never have to
 * enumerate every superior role on a route.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private static readonly RANK: Record<UserRole, number> = {
    [UserRole.USER]: 0,
    [UserRole.MODERATOR]: 1,
    [UserRole.ADMIN]: 2,
    [UserRole.OWNER]: 3,
  };

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException('Authentication required');

    const userRank = RolesGuard.RANK[user.role as UserRole] ?? -1;
    const minRequired = Math.min(...required.map((r) => RolesGuard.RANK[r]));

    if (userRank < minRequired) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
