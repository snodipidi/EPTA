import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

/** Build a fake ExecutionContext carrying a user with the given role. */
function contextFor(role?: UserRole): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard (hierarchy)', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows any user when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextFor(UserRole.USER))).toBe(true);
  });

  it('admits a higher role than required (ADMIN passes a MODERATOR gate)', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.MODERATOR]);
    expect(guard.canActivate(contextFor(UserRole.ADMIN))).toBe(true);
  });

  it('rejects a lower role than required (USER fails a MODERATOR gate)', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.MODERATOR]);
    expect(() => guard.canActivate(contextFor(UserRole.USER))).toThrow(
      ForbiddenException,
    );
  });

  it('admits an exact role match', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.OWNER]);
    expect(guard.canActivate(contextFor(UserRole.OWNER))).toBe(true);
  });

  it('rejects when there is no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
