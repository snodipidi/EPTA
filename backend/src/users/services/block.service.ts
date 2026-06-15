import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Owns the user_blocks relation. Other modules (chats, follows, feeds) call
 * `isBlockedEitherWay` to enforce blocks without duplicating the query.
 */
@Injectable()
export class BlockService {
  constructor(private readonly prisma: PrismaService) {}

  async block(blockerId: string, blockedUsername: string): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { username: blockedUsername },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === blockerId) {
      throw new BadRequestException('You cannot block yourself');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userBlock.upsert({
        where: {
          blockerId_blockedId: { blockerId, blockedId: target.id },
        },
        create: { blockerId, blockedId: target.id },
        update: {},
      });
      // Blocking severs any follow relationship in both directions.
      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followingId: target.id },
            { followerId: target.id, followingId: blockerId },
          ],
        },
      });
    });
  }

  async unblock(blockerId: string, blockedUsername: string): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { username: blockedUsername },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.userBlock.deleteMany({
      where: { blockerId, blockedId: target.id },
    });
  }

  async listBlocked(blockerId: string): Promise<string[]> {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId },
      select: { blockedId: true },
    });
    return rows.map((r) => r.blockedId);
  }

  /** True if either user has blocked the other. Used to gate interactions. */
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const count = await this.prisma.userBlock.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return count > 0;
  }
}
