import { Injectable } from '@nestjs/common';
import { ModerationStatus, Prisma } from '@prisma/client';
import { buildCursorPage, PaginatedResult } from '../common/dto/pagination.dto';
import { PythonServiceClient } from '../integrations/python/python-service.client';
import { PostResponseDto } from '../posts/dto/post-response.dto';
import { PostMapper } from '../posts/post.mapper';
import { postInclude } from '../posts/posts.types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BlockService } from '../users/services/block.service';
import { TrendingHashtagDto } from './dto/trending-hashtag.dto';

@Injectable()
export class FeedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: PostMapper,
    private readonly redis: RedisService,
    private readonly blocks: BlockService,
    private readonly python: PythonServiceClient,
  ) {}

  /**
   * Following feed ("лента подписок"): posts authored by accounts the viewer
   * follows, newest first. DECISION: this is a PULL (fan-out-on-read) feed — we
   * query by the follow set at read time. It's simple and correct for our scale;
   * the seam to switch to fan-out-on-write (a materialized per-user timeline in
   * Redis) is the cache layer below, without touching callers.
   */
  async following(
    userId: string,
    params: { cursor?: string; limit: number },
  ): Promise<PaginatedResult<PostResponseDto>> {
    const followingIds = await this.prisma.follow
      .findMany({
        where: { followerId: userId },
        select: { followingId: true },
      })
      .then((rows) => rows.map((r) => r.followingId));

    if (followingIds.length === 0) {
      return new PaginatedResult<PostResponseDto>([], null);
    }

    const rows = await this.prisma.post.findMany({
      where: {
        authorId: { in: followingIds },
        deletedAt: null,
        moderationStatus: {
          in: [ModerationStatus.APPROVED, ModerationStatus.PENDING],
        },
        parentPostId: null, // exclude pure reposts from the home feed body
      },
      include: postInclude,
      orderBy: { publishedAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const viewer = await this.viewerContext(
      userId,
      rows.map((r) => r.id),
    );
    const page = buildCursorPage(rows, params.limit);
    return new PaginatedResult(
      this.mapper.toResponseList(page.items, viewer),
      page.nextCursor,
    );
  }

  /**
   * Trending posts ("тренды"): top posts of the last 48h by an engagement score.
   * Cached briefly in Redis — trends move slowly relative to request volume.
   */
  async trending(limit = 20): Promise<PostResponseDto[]> {
    return this.redis.remember(`feed:trending:${limit}`, 120, async () => {
      const since = new Date(Date.now() - 48 * 3600 * 1000);
      const rows = await this.prisma.post.findMany({
        where: {
          deletedAt: null,
          moderationStatus: ModerationStatus.APPROVED,
          publishedAt: { gte: since },
        },
        include: postInclude,
        // Approximate "hotness" via raw engagement counters. A dedicated score
        // column maintained by a job (or the analytics service) would refine this.
        orderBy: [
          { likesCount: 'desc' },
          { commentsCount: 'desc' },
          { repostsCount: 'desc' },
        ],
        take: limit,
      });
      return this.mapper.toResponseList(rows);
    });
  }

  /** Trending hashtags, derived from recent posts. */
  async trendingHashtags(limit = 10): Promise<TrendingHashtagDto[]> {
    return this.redis.remember(`feed:trending:tags:${limit}`, 120, async () => {
      const since = new Date(Date.now() - 48 * 3600 * 1000);
      // Unnest the text[] hashtags and count occurrences in the window.
      const rows = await this.prisma.$queryRaw<
        Array<{ tag: string; count: bigint }>
      >(Prisma.sql`
        SELECT lower(tag) AS tag, COUNT(*)::bigint AS count
        FROM "posts", unnest("hashtags") AS tag
        WHERE "deleted_at" IS NULL
          AND "published_at" >= ${since}
        GROUP BY lower(tag)
        ORDER BY count DESC
        LIMIT ${limit}
      `);
      return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
    });
  }

  /**
   * Recommended posts ("архитектура для рекомендаций"). Asks the Python
   * recommendation-service for ranked ids; if it's not configured/available,
   * falls back to a heuristic: popular recent posts from accounts the viewer
   * does NOT already follow. Either way the caller gets a usable feed.
   */
  async recommended(userId: string, limit = 20): Promise<PostResponseDto[]> {
    const recommendedIds = await this.python.getRecommendedPostIds(
      userId,
      limit,
    );

    if (recommendedIds && recommendedIds.length > 0) {
      const rows = await this.prisma.post.findMany({
        where: { id: { in: recommendedIds }, deletedAt: null },
        include: postInclude,
      });
      // Preserve the service's ranking order.
      const order = new Map(recommendedIds.map((id, i) => [id, i]));
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      const viewer = await this.viewerContext(
        userId,
        rows.map((r) => r.id),
      );
      return this.mapper.toResponseList(rows, viewer);
    }

    return this.heuristicRecommendations(userId, limit);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async heuristicRecommendations(
    userId: string,
    limit: number,
  ): Promise<PostResponseDto[]> {
    const [followingIds, blockedIds] = await Promise.all([
      this.prisma.follow
        .findMany({
          where: { followerId: userId },
          select: { followingId: true },
        })
        .then((r) => r.map((x) => x.followingId)),
      this.blocks.listBlocked(userId),
    ]);

    const excluded = [...new Set([userId, ...followingIds, ...blockedIds])];
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const rows = await this.prisma.post.findMany({
      where: {
        authorId: { notIn: excluded },
        deletedAt: null,
        moderationStatus: ModerationStatus.APPROVED,
        publishedAt: { gte: since },
        parentPostId: null,
      },
      include: postInclude,
      orderBy: [{ likesCount: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
    });

    const viewer = await this.viewerContext(
      userId,
      rows.map((r) => r.id),
    );
    return this.mapper.toResponseList(rows, viewer);
  }

  private async viewerContext(userId: string, postIds: string[]) {
    if (postIds.length === 0) return {};
    const [likes, bookmarks] = await Promise.all([
      this.prisma.reaction.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.bookmark.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
    ]);
    return {
      likedPostIds: new Set(
        likes.map((l) => l.postId).filter((id): id is string => !!id),
      ),
      bookmarkedPostIds: new Set(bookmarks.map((b) => b.postId)),
    };
  }
}
