import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { buildCursorPage, PaginatedResult } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockService } from '../users/services/block.service';
import { UserSummaryDto } from './dto/user-summary.dto';

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlockService,
    private readonly notifications: NotificationsService,
  ) {}

  async follow(followerId: string, targetUsername: string): Promise<void> {
    const target = await this.requireUser(targetUsername);
    if (target.id === followerId) {
      throw new BadRequestException('You cannot follow yourself');
    }
    if (await this.blocks.isBlockedEitherWay(followerId, target.id)) {
      throw new ForbiddenException('Cannot follow this user');
    }

    try {
      await this.prisma.$transaction([
        this.prisma.follow.create({
          data: { followerId, followingId: target.id },
        }),
        this.prisma.profile.update({
          where: { userId: target.id },
          data: { followersCount: { increment: 1 } },
        }),
        this.prisma.profile.update({
          where: { userId: followerId },
          data: { followingCount: { increment: 1 } },
        }),
      ]);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Already following');
      }
      throw e;
    }

    await this.notifications.notify({
      recipientId: target.id,
      actorId: followerId,
      type: NotificationType.FOLLOW,
    });
  }

  async unfollow(followerId: string, targetUsername: string): Promise<void> {
    const target = await this.requireUser(targetUsername);

    // Only decrement if a row was actually removed (idempotent unfollow).
    const deleted = await this.prisma.follow.deleteMany({
      where: { followerId, followingId: target.id },
    });
    if (deleted.count === 0) return;

    await this.prisma.$transaction([
      this.prisma.profile.update({
        where: { userId: target.id },
        data: { followersCount: { decrement: 1 } },
      }),
      this.prisma.profile.update({
        where: { userId: followerId },
        data: { followingCount: { decrement: 1 } },
      }),
    ]);
  }

  listFollowers(
    username: string,
    params: { cursor?: string; limit: number },
  ): Promise<PaginatedResult<UserSummaryDto>> {
    return this.listEdge(username, 'followers', params);
  }

  listFollowing(
    username: string,
    params: { cursor?: string; limit: number },
  ): Promise<PaginatedResult<UserSummaryDto>> {
    return this.listEdge(username, 'following', params);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async listEdge(
    username: string,
    edge: 'followers' | 'following',
    params: { cursor?: string; limit: number },
  ): Promise<PaginatedResult<UserSummaryDto>> {
    const user = await this.requireUser(username);

    // followers → rows where followingId = user; following → followerId = user.
    const where: Prisma.FollowWhereInput =
      edge === 'followers' ? { followingId: user.id } : { followerId: user.id };

    const rows = await this.prisma.follow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        follower: this.userSelect(),
        following: this.userSelect(),
      },
    });

    const page = buildCursorPage(rows, params.limit);
    const items = page.items.map((row) => {
      const u = edge === 'followers' ? row.follower : row.following;
      return {
        id: u.id,
        username: u.username,
        displayName: u.profile?.displayName ?? u.username,
        avatarUrl: u.profile?.avatarUrl ?? undefined,
      };
    });
    return new PaginatedResult(items, page.nextCursor);
  }

  private userSelect() {
    return {
      select: {
        id: true,
        username: true,
        profile: { select: { displayName: true, avatarUrl: true } },
      },
    } satisfies Prisma.UserDefaultArgs;
  }

  private async requireUser(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
