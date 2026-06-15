import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public so the (globally applied) JwtAuthGuard skips it.
 * DECISION: auth is opt-OUT, not opt-in. The guard is global, and endpoints that
 * should be reachable without a token declare it explicitly with @Public().
 * This fails safe — forgetting the decorator leaves a route protected, never
 * accidentally open.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
