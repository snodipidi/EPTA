import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GoogleConfig } from '../config/configuration';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * GoogleStrategy is only instantiated when OAuth creds are configured. Without
 * them, constructing the strategy would throw (passport requires a clientID), so
 * we gate it behind a factory that returns null when disabled — the app boots
 * either way.
 */
const googleStrategyProvider: Provider = {
  provide: GoogleStrategy,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const google = config.getOrThrow<GoogleConfig>('google');
    return google.enabled ? new GoogleStrategy(config) : null;
  },
};

/**
 * Auth feature module. JwtModule is registered without global secrets — each
 * sign/verify call passes its own secret (access vs refresh) so the two token
 * types can never be confused.
 */
@Module({
  imports: [PassportModule, JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    EmailVerificationService,
    JwtStrategy,
    googleStrategyProvider,
  ],
  exports: [TokenService, PasswordService],
})
export class AuthModule {}
