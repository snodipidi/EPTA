import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { buildCursorPage, PaginatedResult } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  NotificationResponseDto,
  UnreadCountDto,
} from './dto/notification-response.dto';

/** Cross-process channel the WebSocket gateway subscribes to for live push. */
export const REALTIME_NOTIFICATION_CHANNEL = 'realtime:notification';

export interface NotifyParams {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  postId?: string;
  data?: Prisma.InputJsonValue;
}

const notificationInclude = {
  actor: {
    select: {
      id: true,
      username: true,
      profile: { select: { displayName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.NotificationInclude;

type NotificationWithActor = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Create a notification and push it in real time. Called by other domain
   * services (follows, reactions, comments). Self-notifications are skipped.
   * DECISION: real-time delivery goes through Redis pub/sub, not a direct
   * gateway call — so this module never imports the WebSocket layer, and push
   * works across multiple backend instances.
   */
  async notify(params: NotifyParams): Promise<NotificationResponseDto | null> {
    if (params.actorId && params.actorId === params.recipientId) {
      return null; // never notify yourself
    }

    const created = await this.prisma.notification.create({
      data: {
        recipientId: params.recipientId,
        actorId: params.actorId,
        type: params.type,
        postId: params.postId,
        data: params.data,
      },
      include: notificationInclude,
    });

    const dto = this.toResponse(created);
    // Fire-and-forget publish; a failed push must not fail the originating action.
    void this.redis.client
      .publish(
        REALTIME_NOTIFICATION_CHANNEL,
        JSON.stringify({ userId: params.recipientId, notification: dto }),
      )
      .catch(() => undefined);

    return dto;
  }

  async list(
    userId: string,
    params: { cursor?: string; limit: number; unreadOnly?: boolean },
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    const rows = await this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...(params.unreadOnly ? { readAt: null } : {}),
      },
      include: notificationInclude,
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const page = buildCursorPage(rows, params.limit);
    return new PaginatedResult(
      page.items.map((n) => this.toResponse(n)),
      page.nextCursor,
    );
  }

  async unreadCount(userId: string): Promise<UnreadCountDto> {
    const unread = await this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });
    return { unread };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      // Either it doesn't exist, isn't ours, or was already read.
      const exists = await this.prisma.notification.findFirst({
        where: { id, recipientId: userId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private toResponse(n: NotificationWithActor): NotificationResponseDto {
    return {
      id: n.id,
      type: n.type,
      actor: n.actor
        ? {
            id: n.actor.id,
            username: n.actor.username,
            displayName: n.actor.profile?.displayName ?? n.actor.username,
            avatarUrl: n.actor.profile?.avatarUrl ?? undefined,
          }
        : undefined,
      postId: n.postId ?? undefined,
      data: (n.data as Record<string, unknown>) ?? undefined,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
