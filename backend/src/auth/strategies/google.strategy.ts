import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { GoogleConfig } from '../../config/configuration';
import { GoogleProfile } from '../auth.service';

/**
 * Google OAuth 2.0 strategy. DECISION: only provided via the module when
 * GOOGLE_CLIENT_ID/SECRET are configured (see AuthModule) — so the app boots
 * fine without Google creds, and the strategy is never half-initialized.
 *
 * `validate` maps Google's profile to our minimal GoogleProfile; the controller
 * callback then turns it into our own session (find-or-create + token pair).
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const google = config.getOrThrow<GoogleConfig>('google');
    super({
      clientID: google.clientId!,
      clientSecret: google.clientSecret!,
      callbackURL: google.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new UnauthorizedException('Google account has no email'), undefined);
      return;
    }

    // SECURITY: only trust the email if Google asserts it is verified. We use
    // the address as the key to find / create / link a local account, so an
    // unverified address would open an account-takeover path. Google may return
    // the claim as a boolean (OIDC userinfo) — accept only an explicit true.
    const emailVerified =
      profile.emails?.[0]?.verified === true ||
      profile._json?.email_verified === true;
    if (!emailVerified) {
      done(
        new UnauthorizedException('Google email is not verified'),
        undefined,
      );
      return;
    }

    const mapped: GoogleProfile = {
      googleId: profile.id,
      email,
      displayName: profile.displayName ?? email,
    };
    done(null, mapped);
  }
}
