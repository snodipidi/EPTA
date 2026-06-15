import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PasswordService } from '../auth/services/password.service';
import { TokenService } from '../auth/services/token.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';

/**
 * Account-level operations on the User row (credentials, lifecycle). Public
 * presentation lives in ProfilesService — this keeps the identity concern
 * separate from the presentation concern.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ok = await this.passwords.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!ok) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Changing the password invalidates every existing session.
    await this.tokens.revokeAllForUser(userId);
  }

  /**
   * Soft-delete + anonymize. DECISION (the audit's #1 fix in action): we never
   * hard-delete the row — posts/comments reference it NOT NULL. We free up the
   * email/username (so they can be reused), scrub PII, flip status to DELETED,
   * and revoke all sessions. Heavy cleanup (S3 media, search index) would be a
   * queued job; the synchronous part is just the anonymization.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ok = await this.passwords.verify(user.passwordHash, password);
    if (!ok) throw new ForbiddenException('Password is incorrect');

    const tombstone = randomUUID().slice(0, 8);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          deletedAt: new Date(),
          email: `deleted+${tombstone}@epta.invalid`,
          username: `deleted_${tombstone}`,
          passwordHash: randomUUID(),
        },
      }),
      this.prisma.profile.update({
        where: { userId },
        data: {
          displayName: 'Удалённый пользователь',
          bio: null,
          avatarUrl: null,
          coverUrl: null,
          website: null,
          location: null,
        },
      }),
    ]);

    await this.tokens.revokeAllForUser(userId);
  }
}
