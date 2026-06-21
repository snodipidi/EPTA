import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { JwtConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import {
  JwtPayload,
  RefreshTokenPayload,
  TokenPair,
} from '../interfaces/jwt-payload.interface';

interface IssueContext {
  userAgent?: string;
  ip?: string;
}

/**
 * Owns the full refresh-token lifecycle: issue, rotate, revoke. Kept separate
 * from AuthService so the rotation/reuse-detection logic is testable in
 * isolation and AuthService stays an orchestration layer.
 */
@Injectable()
export class TokenService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.jwtConfig = config.getOrThrow<JwtConfig>('jwt');
  }

  /** Issue a fresh access+refresh pair, starting a NEW token family (login). */
  async issuePair(user: User, ctx: IssueContext = {}): Promise<TokenPair> {
    const family = randomUUID();
    const { pair } = await this.createPair(user, family, ctx);
    return pair;
  }

  /**
   * Rotate a refresh token. Verifies the presented token, detects reuse of a
   * revoked token (and nukes the whole family if so), then issues a new pair in
   * the same family while revoking the old row.
   */
  async rotate(
    rawRefreshToken: string,
    ctx: IssueContext = {},
  ): Promise<{ pair: TokenPair; user: User }> {
    const payload = await this.verifyRefresh(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });

    if (!stored || stored.tokenHash !== this.sha256(rawRefreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // ── Reuse detection ──────────────────────────────────────────────────
    // A revoked token being presented again means it was stolen and replayed.
    // Revoke every token in the family to force a full re-login.
    if (stored.revokedAt) {
      await this.revokeFamily(stored.family);
      throw new ForbiddenException(
        'Refresh token reuse detected — all sessions revoked',
      );
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate within a transaction: revoke old, mint new, link them.
    return this.prisma.$transaction(async () => {
      const { pair, id: newId } = await this.createPair(
        stored.user,
        stored.family,
        ctx,
      );
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedById: newId },
      });
      return { pair, user: stored.user };
    });
  }

  /** Revoke a single refresh token (logout of one session). */
  async revoke(rawRefreshToken: string): Promise<void> {
    const payload = await this.verifyRefresh(rawRefreshToken).catch(() => null);
    if (!payload) return; // already invalid — nothing to do
    await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every active token for a user (logout everywhere / password change). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async createPair(
    user: User,
    family: string,
    ctx: IssueContext,
  ): Promise<{ pair: TokenPair; id: string }> {
    const jti = randomUUID();

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    };
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti, family };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.jwtConfig.accessSecret,
      // TTL strings ("900s", "30d") are validated at config load; the JWT lib
      // types this as the `ms` StringValue template, so a narrow cast is correct.
      expiresIn: this.jwtConfig.accessTtl as unknown as number,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.jwtConfig.refreshSecret,
      expiresIn: this.jwtConfig.refreshTtl as unknown as number,
    });

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: this.sha256(refreshToken),
        family,
        userAgent: ctx.userAgent,
        ip: ctx.ip,
        expiresAt: new Date(
          Date.now() + this.ttlToMs(this.jwtConfig.refreshTtl),
        ),
      },
    });

    return {
      pair: {
        accessToken,
        refreshToken,
        expiresIn: Math.floor(this.ttlToMs(this.jwtConfig.accessTtl) / 1000),
      },
      id: jti,
    };
  }

  private async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /** Parse a TTL like "900s", "15m", "30d", "12h" into milliseconds. */
  private ttlToMs(ttl: string): number {
    const match = /^(\d+)\s*(s|m|h|d)?$/.exec(ttl.trim());
    if (!match) return Number(ttl) || 0;
    const value = Number(match[1]);
    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * multipliers[unit];
  }
}
