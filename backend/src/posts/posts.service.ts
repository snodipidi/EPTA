import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModerationStatus, Prisma } from '@prisma/client';
import { buildCursorPage, PaginatedResult } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueProducer } from '../queues/queue.producer';
import { BlockService } from '../users/services/block.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostCountersDto } from './dto/post-response.dto';
import { PostImageDto, PostResponseDto } from './dto/post-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostMapper } from './post.mapper';
import { postInclude, PostWithRelations, ViewerContext } from './posts.types';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: PostMapper,
    private readonly blocks: BlockService,
    private readonly queue: QueueProducer,
  ) {}

  // ── Commands ───────────────────────────────────────────────────────────

  async create(authorId: string, dto: CreatePostDto): Promise<PostResponseDto> {
    if (dto.mediaIds?.length) {
      await this.assertMediaOwnedAndReady(authorId, dto.mediaIds);
    }
    if (dto.replyToPostId) {
      await this.assertPostExists(dto.replyToPostId);
    }

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId,
          text: dto.text,
          hashtags: this.normalizeHashtags(dto.hashtags),
          replyToPostId: dto.replyToPostId,
          media: dto.mediaIds?.length
            ? {
                create: dto.mediaIds.map((mediaId, position) => ({
                  mediaId,
                  position,
                })),
              }
            : undefined,
        },
        include: postInclude,
      });

      await tx.profile.update({
        where: { userId: authorId },
        data: { postsCount: { increment: 1 } },
      });

      return created;
    });

    // Off-request: ask the moderation-service to vet the new post, and record an
    // analytics event. Both are no-ops until the Python services are configured.
    if (post.text) {
      await this.queue.moderateContent({
        contentId: post.id,
        contentType: 'post',
        text: post.text,
      });
    }
    await this.queue.trackEvent({
      name: 'post.created',
      userId: authorId,
      properties: { postId: post.id },
    });

    return this.mapper.toResponse(post);
  }

  /** Repost / quote an existing post (POST /posts/:id/repost). */
  async repost(
    authorId: string,
    parentPostId: string,
    text?: string,
  ): Promise<PostResponseDto> {
    const parent = await this.assertPostExists(parentPostId);
    if (await this.blocks.isBlockedEitherWay(authorId, parent.authorId)) {
      throw new ForbiddenException('Cannot repost this user');
    }

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId,
          text,
          type: text ? 'QUOTE' : 'REPOST',
          parentPostId,
        },
        include: postInclude,
      });
      await tx.post.update({
        where: { id: parentPostId },
        data: { repostsCount: { increment: 1 } },
      });
      await tx.profile.update({
        where: { userId: authorId },
        data: { postsCount: { increment: 1 } },
      });
      return created;
    });

    return this.mapper.toResponse(post);
  }

  async update(
    postId: string,
    userId: string,
    dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        text: dto.text ?? post.text,
        hashtags:
          dto.hashtags !== undefined
            ? this.normalizeHashtags(dto.hashtags)
            : post.hashtags,
        editedAt: new Date(),
      },
      include: postInclude,
    });
    return this.mapper.toResponse(updated);
  }

  /** Soft-delete (the post row survives so replies/quotes stay coherent). */
  async remove(
    postId: string,
    userId: string,
    isModerator = false,
  ): Promise<void> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');
    if (post.authorId !== userId && !isModerator) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.profile.update({
        where: { userId: post.authorId },
        data: { postsCount: { decrement: 1 } },
      }),
    ]);
  }

  // ── Queries ────────────────────────────────────────────────────────────

  /**
   * Public timeline (GET /posts): recent, visible posts newest-first with cursor
   * pagination. Posts from/by blocked users are filtered out for logged-in viewers.
   */
  async list(
    params: { cursor?: string; limit: number },
    viewerId?: string,
  ): Promise<PaginatedResult<PostResponseDto>> {
    const blockedIds = viewerId ? await this.blocks.listBlocked(viewerId) : [];

    const rows = await this.prisma.post.findMany({
      where: this.visibleWhere(blockedIds, viewerId),
      include: postInclude,
      orderBy: { publishedAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const viewer = await this.viewerContext(
      viewerId,
      rows.map((r) => r.id),
    );
    const page = buildCursorPage(rows, params.limit);
    return new PaginatedResult(
      this.mapper.toResponseList(page.items, viewer),
      page.nextCursor,
    );
  }

  async findOne(postId: string, viewerId?: string): Promise<PostResponseDto> {
    const post = await this.getVisiblePostOrThrow(postId, viewerId);
    const viewer = await this.viewerContext(viewerId, [post.id]);
    return this.mapper.toResponse(post, viewer);
  }

  async getImages(postId: string): Promise<PostImageDto[]> {
    const post = await this.getVisiblePostOrThrow(postId);
    return this.mapper.toResponse(post).images;
  }

  async getCounters(postId: string): Promise<PostCountersDto> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { commentsCount: true, repostsCount: true, likesCount: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    return {
      comments: post.commentsCount,
      reposts: post.repostsCount,
      likes: post.likesCount,
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private visibleWhere(
    blockedIds: string[],
    viewerId?: string,
  ): Prisma.PostWhereInput {
    const excluded = new Set(blockedIds);
    return {
      deletedAt: null,
      moderationStatus: {
        in: [ModerationStatus.APPROVED, ModerationStatus.PENDING],
      },
      author: { status: 'ACTIVE' },
      ...(excluded.size
        ? {
            authorId: { notIn: [...excluded] },
            // also hide posts from people who blocked the viewer
            NOT: {
              author: { blocking: { some: { blockedId: viewerId } } },
            },
          }
        : {}),
    };
  }

  private async getVisiblePostOrThrow(
    postId: string,
    viewerId?: string,
  ): Promise<PostWithRelations> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: postInclude,
    });
    if (!post) throw new NotFoundException('Post not found');
    if (
      viewerId &&
      (await this.blocks.isBlockedEitherWay(viewerId, post.author.id))
    ) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  private async assertPostExists(postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async assertMediaOwnedAndReady(
    ownerId: string,
    mediaIds: string[],
  ): Promise<void> {
    const count = await this.prisma.mediaAsset.count({
      where: { id: { in: mediaIds }, ownerId, status: 'READY' },
    });
    if (count !== mediaIds.length) {
      throw new ForbiddenException(
        'One or more media assets are missing, not yours, or not ready',
      );
    }
  }

  /** Resolve the viewer's liked/bookmarked sets in two batched queries. */
  private async viewerContext(
    viewerId: string | undefined,
    postIds: string[],
  ): Promise<ViewerContext> {
    if (!viewerId || postIds.length === 0) return {};
    const [likes, bookmarks] = await Promise.all([
      this.prisma.reaction.findMany({
        where: { userId: viewerId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.bookmark.findMany({
        where: { userId: viewerId, postId: { in: postIds } },
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

  private normalizeHashtags(tags?: string[]): string[] {
    if (!tags) return [];
    const cleaned = tags
      .map((t) => t.trim().replace(/^#+/, '').toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 50);
    return [...new Set(cleaned)];
  }
}
