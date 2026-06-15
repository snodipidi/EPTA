import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The authenticated principal attached to the request by JwtStrategy.
 * Kept deliberately small — just what guards/controllers need without a DB hit.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

/**
 * Injects the current user (or one of its fields) into a controller handler:
 *   findMe(@CurrentUser() user: AuthenticatedUser)
 *   findMyId(@CurrentUser('id') id: string)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    return data ? user?.[data] : user;
  },
);
