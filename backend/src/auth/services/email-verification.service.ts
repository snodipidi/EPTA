import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { AuthFlowConfig } from '../../config/configuration';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_ATTEMPTS = 5;

/**
 * Issues and checks the email-confirmation code. DECISION: mirrors the
 * refresh-token approach — we store a sha256 HASH of the 6-digit code, never the
 * raw value. Issuing a new code invalidates prior un-consumed ones (single active
 * code per user), and `attempts` caps brute-force guessing.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.ttlSeconds =
      config.getOrThrow<AuthFlowConfig>('authFlow').emailCodeTtl;
  }

  /** Generate a fresh code, persist its hash, and email it. No-op if verified. */
  async issue(userId: string, email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    if (!user || user.emailVerifiedAt) return;

    // Invalidate any previous outstanding codes for this user.
    await this.prisma.emailVerificationCode.deleteMany({ where: { userId } });

    const code = this.generateCode();
    await this.prisma.emailVerificationCode.create({
      data: {
        userId,
        codeHash: this.sha256(code),
        expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
      },
    });

    await this.mail.sendVerificationCode(email, code);
  }

  /**
   * Check a submitted code. On success marks the user verified and consumes the
   * code. Throws BadRequest on wrong/expired/too-many-attempts.
   */
  async verify(userId: string, code: string): Promise<void> {
    const record = await this.prisma.emailVerificationCode.findFirst({
      where: { userId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(
        'No active verification code — request a new one',
      );
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'Verification code expired — request a new one',
      );
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts — request a new code');
    }

    if (record.codeHash !== this.sha256(code.trim())) {
      await this.prisma.emailVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code');
    }

    // Correct: consume the code and flip the user to verified in one transaction.
    await this.prisma.$transaction([
      this.prisma.emailVerificationCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }

  private generateCode(): string {
    // 6 digits, zero-padded. randomInt is cryptographically secure.
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
