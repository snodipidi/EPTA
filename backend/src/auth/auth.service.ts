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
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

export interface RequestContext {
  userAgent?: string;
  ip?: string;
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

    const pair = await this.tokens.issuePair(user, ctx);
    return this.buildResponse(user, user.profile?.displayName ?? '', pair);
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { profile: { select: { displayName: true } } },
    });

    // Constant-ish path: always run a verify to avoid leaking whether the email
    // exists via response timing.
    const valid =
      user && (await this.passwords.verify(user.passwordHash, dto.password));

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
      },
    };
  }
}
