import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AppConfig, GoogleConfig } from '../../config/configuration';
import {
  generateOAuthState,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_PATH,
  OAUTH_STATE_TTL_MS,
} from '../oauth-state.util';

/**
 * Triggers the 'google' passport strategy on the OAuth entry + callback routes.
 * Separate from the global JWT guard; these routes are @Public().
 *
 * The strategy is only registered when Google creds are configured (see
 * AuthModule). If they aren't, we fail with a clean 503 instead of letting
 * passport throw an opaque "Unknown strategy" 500.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (!this.config.getOrThrow<GoogleConfig>('google').enabled) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this server',
      );
    }
    return super.canActivate(context);
  }

  /**
   * On the entry request, mint a random OAuth `state`, drop it in a short-lived
   * httpOnly cookie, and hand the same value to passport so it round-trips to
   * Google. The controller's callback compares the returned `state` against the
   * cookie (double-submit) to block login CSRF. On the callback request itself
   * we add nothing — passport ignores `state` here (NullStore), and the
   * controller does the comparison.
   */
  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    // Callback leg (code/error present) — don't mint a fresh nonce here.
    if (req.query?.code || req.query?.error) {
      return {};
    }

    const res = http.getResponse<Response>();
    const state = generateOAuthState();
    const isProd =
      this.config.getOrThrow<AppConfig>('app').nodeEnv === 'production';
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: OAUTH_STATE_PATH,
      maxAge: OAUTH_STATE_TTL_MS,
    });
    return { state };
  }
}
