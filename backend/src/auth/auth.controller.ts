import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AllowUnverified, CurrentUser, Public } from '../common';
import { AuthFlowConfig } from '../config/configuration';
import { AuthService, GoogleProfile } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_PATH,
  readCookie,
  statesMatch,
} from './oauth-state.util';
import { EmailVerificationService } from './services/email-verification.service';
import { TokenService } from './services/token.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly authFlow: AuthFlowConfig;

  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly emailVerification: EmailVerificationService,
    config: ConfigService,
  ) {
    this.authFlow = config.getOrThrow<AuthFlowConfig>('authFlow');
  }

  private context(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
  }

  @Public()
  // Tighter limit on account creation to blunt mass-registration abuse.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiOkResponse({ type: AuthResponseDto })
  register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.auth.register(dto, this.context(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email + password' })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.auth.login(dto, this.context(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair (rotation)',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.auth.refresh(dto.refreshToken, this.context(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a single refresh token (one session)' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @AllowUnverified()
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke every active session for the current user' })
  async logoutAll(@CurrentUser('id') userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  // ── Current session ────────────────────────────────────────────────────

  @ApiBearerAuth('access-token')
  @AllowUnverified()
  @Get('me')
  @ApiOperation({ summary: 'Current authenticated user (for session restore)' })
  @ApiOkResponse({ type: AuthResponseDto })
  me(@CurrentUser('id') userId: string): Promise<AuthResponseDto['user']> {
    return this.auth.getMe(userId);
  }

  // ── Email verification ───────────────────────────────────────────────────

  @ApiBearerAuth('access-token')
  @AllowUnverified()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm email with the 6-digit code' })
  async verifyEmail(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyEmailDto,
  ): Promise<void> {
    await this.emailVerification.verify(userId, dto.code);
  }

  @ApiBearerAuth('access-token')
  @AllowUnverified()
  // Strict limit: re-sending mints + emails a new code.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Re-send the email-verification code' })
  async resendCode(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
  ): Promise<void> {
    await this.emailVerification.issue(userId, email);
  }

  // ── Google OAuth (redirect flow) ──────────────────────────────────────────

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({ summary: 'Begin Google sign-in (redirects to Google)' })
  googleStart(): void {
    // GoogleAuthGuard issues the redirect to Google's consent screen.
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Double-submit CSRF check: the `state` Google echoes back must equal the
    // nonce we set in the httpOnly cookie when the flow started. Clear the
    // cookie regardless so each nonce is single-use.
    const cookieState = readCookie(req, OAUTH_STATE_COOKIE);
    const queryState =
      typeof req.query.state === 'string' ? req.query.state : undefined;
    res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_STATE_PATH });
    if (!statesMatch(cookieState, queryState)) {
      res.redirect(this.callbackUrl({ error: 'invalid_state' }));
      return;
    }

    const profile = req.user as GoogleProfile | undefined;
    if (!profile) {
      res.redirect(this.callbackUrl({ error: 'google_failed' }));
      return;
    }
    const result = await this.auth.loginWithGoogle(profile, this.context(req));
    // Hand tokens back to the SPA via the URL fragment (never sent to a server,
    // not logged). The frontend /auth/callback reads them and stores the session.
    res.redirect(
      this.callbackUrl({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }),
    );
  }

  /** Build the frontend callback URL with params in the fragment (#). */
  private callbackUrl(params: Record<string, string>): string {
    const fragment = new URLSearchParams(params).toString();
    return `${this.authFlow.frontendUrl}/auth/callback#${fragment}`;
  }
}
