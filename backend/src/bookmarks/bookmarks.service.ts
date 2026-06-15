import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { PostResponseDto } from '../posts/dto/post-response.dto';
import { PostMapper } from '../posts/post.mapper';
import { postInclude } from '../posts/posts.types';
import { PrismaService } from '../prisma/prisma.service';
import { BookmarkStateDto } from './dto/bookmark-state.dto';

@Injectable()
export class BookmarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: PostMapper,
  ) {}

  /** Toggle bookmark on a post (POST /posts/:id/bookmark). */
  async toggle(userId: string, postId: string): Promise<BookmarkStateDto> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.bookmark.delete({ where: { id: existing.id } });
        const updated = await tx.post.update({
          where: { id: postId },
          data: { bookmarksCount: { decrement: 1 } },
          select: { bookmarksCount: true },
        });
        return { bookmarked: false, bookmarks: updated.bookmarksCount };
      }
      await tx.bookmark.create({ data: { userId, postId } });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { bookmarksCount: { increment: 1 } },
        select: { bookmarksCount: true },
      });
      return { bookmarked: true, bookmarks: updated.bookmarksCount };
    });

    return result;
  }

  /** The viewer's saved posts, newest-saved first. */
  async listMine(
    userId: string,
    params: { cursor?: string; limit: number },
  ): Promise<PaginatedResult<PostResponseDto>> {
    const rows = await this.prisma.bookmark.findMany({
      where: { userId, post: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { post: { include: postInclude } },
    });

    // Keyset over the bookmark id; map each underlying post.
    const slice =
      rows.length > params.limit ? rows.slice(0, params.limit) : rows;
    const nextCursor =
      rows.length > params.limit ? rows[params.limit].id : null;

    const posts = slice.map((b) =>
      this.mapper.toResponse(b.post, {
        bookmarkedPostIds: new Set(slice.map((x) => x.postId)),
      }),
    );
    return new PaginatedResult(posts, nextCursor);
  }
}
