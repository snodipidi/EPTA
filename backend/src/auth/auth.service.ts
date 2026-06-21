import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, SubscriptionTier, User, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

export interface RequestContext {
  userAgent?: string;
  ip?: string;
}

/** Profile fields a Google sign-in carries. */
export interface GoogleProfile {
  googleId: string;
  email: string;
  displayName: string;
}

/**
 * Orchestrates the auth use-cases. It composes PasswordService + TokenService +
 * Prisma — deliberately NOT a god service: hashing and token mechanics live in
 * their own units; this layer only sequences them and enforces business rules.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  async register(
    dto: RegisterDto,
    ctx: RequestContext,
  ): Promise<AuthResponseDto> {
    const passwordHash = await this.passwords.hash(dto.password);

    let user: User & { profile: { displayName: string } | null };
    try {
      // One transaction provisions the whole account: credentials, public
      // profile, and a default FREE subscription. Either all land or none do.
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          username: dto.username,
          passwordHash,
          profile: { create: { displayName: dto.displayName } },
          subscription: { create: { tier: SubscriptionTier.FREE } },
        },
        include: { profile: { select: { displayName: true } } },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const field = (e.meta?.target as string[])?.[0] ?? 'credentials';
        throw new ConflictException(`This ${field} is already taken`);
      }
      throw e;
    }

    // Fire off the verification code. The account exists and can log in, but it
    // stays unverified (emailVerifiedAt = null) until the code is confirmed.
    await this.emailVerification.issue(user.id, user.email);

    const pair = await this.tokens.issuePair(user, ctx);
    return this.buildResponse(user, user.profile?.displayName ?? '', pair);
  }

  /**
   * Sign in a user from a Google profile whose email the strategy already
   * confirmed as verified, then issue our own token pair.
   *
   * Account resolution:
   *  1. Returning Google user — matched by the stable googleId.
   *  2. A local account already exists on this email — link Google to it ONLY
   *     if that account's email is itself verified (the owner has proven control
   *     of the address). Linking to an unverified, possibly squatted account
   *     would hand it to whoever owns the Google email, so we refuse instead.
   *  3. Otherwise create a fresh, pre-verified account.
   */
  async loginWithGoogle(
    profile: GoogleProfile,
    ctx: RequestContext,
  ): Promise<AuthResponseDto> {
    const email = profile.email.toLowerCase();

    // 1. Returning Google user.
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
      include: { profile: { select: { displayName: true } } },
    });

    if (!user) {
      // 2. Local account on this email, not yet linked to Google.
      const existing = await this.prisma.user.findUnique({
        where: { email },
        include: { profile: { select: { displayName: true } } },
      });

      if (existing) {
        if (!existing.emailVerifiedAt) {
          throw new UnauthorizedException(
            'An account with this email already exists but is not verified. ' +
              'Sign in with your password and verify your email first.',
          );
        }
        user = await this.prisma.user.update({
          where: { id: existing.id },
          data: { googleId: profile.googleId },
          include: { profile: { select: { displayName: true } } },
        });
      } else {
        // 3. Brand-new account — Google verified the email, so it's pre-verified.
        user = await this.prisma.user.create({
          data: {
            email,
            username: await this.uniqueUsername(email),
            googleId: profile.googleId,
            emailVerifiedAt: new Date(),
            profile: { create: { displayName: profile.displayName || email } },
            subscription: { create: { tier: SubscriptionTier.FREE } },
          },
          include: { profile: { select: { displayName: true } } },
        });
      }
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const pair = await this.tokens.issuePair(user, ctx);
    return this.buildResponse(user, user.profile?.displayName ?? '', pair);
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { profile: { select: { displayName: true } } },
    });

    // Always run a full password verification — even when the user doesn't
    // exist (PasswordService falls back to a dummy hash) — so response time
    // can't tell registered emails apart from unknown ones (timing enumeration).
    const valid = await this.passwords.verify(
      user?.passwordHash ?? null,
      dto.password,
    );

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const pair = await this.tokens.issuePair(user, ctx);
    return this.buildResponse(user, user.profile?.displayName ?? '', pair);
  }

  async refresh(
    refreshToken: string,
    ctx: RequestContext,
  ): Promise<AuthResponseDto> {
    const { pair, user } = await this.tokens.rotate(refreshToken, ctx);
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
      select: { displayName: true },
    });
    return this.buildResponse(user, profile?.displayName ?? '', pair);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  /** Current user summary (for session-restore on the client + OAuth callback). */
  async getMe(userId: string): Promise<AuthResponseDto['user']> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { displayName: true } } },
    });
    if (!user) throw new UnauthorizedException('Account not found');
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.profile?.displayName ?? '',
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private buildResponse(
    user: User,
    displayName: string,
    pair: { accessToken: string; refreshToken: string; expiresIn: number },
  ): AuthResponseDto {
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName,
        role: user.role,
        emailVerified: user.emailVerifiedAt !== null,
      },
    };
  }

  /** Derive a free, valid username from an email local-part for OAuth signups. */
  private async uniqueUsername(email: string): Promise<string> {
    const base =
      email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 24) || 'user';
    let candidate = base.length >= 3 ? base : `${base}_user`;
    let suffix = 0;
    // Probe for a free handle. Bounded, append a numeric suffix on collision.
    while (
      await this.prisma.user.findUnique({ where: { username: candidate } })
    ) {
      suffix += 1;
      candidate = `${base}_${suffix}`.slice(0, 30);
    }
    return candidate;
  }
}
