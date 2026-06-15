import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildCursorPage, PaginatedResult } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { BlockService } from '../users/services/block.service';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

const commentInclude = {
  author: {
    select: {
      id: true,
      username: true,
      profile: { select: { displayName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.CommentInclude;

type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlockService,
  ) {}

  async create(
    postId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true, authorId: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (await this.blocks.isBlockedEitherWay(authorId, post.authorId)) {
      throw new ForbiddenException('Cannot comment on this post');
    }

    if (dto.parentCommentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentCommentId, postId, deletedAt: null },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Parent comment not found');
    }

    // Create the comment and bump the denormalized counters atomically.
    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          postId,
          authorId,
          text: dto.text,
          parentCommentId: dto.parentCommentId,
        },
        include: commentInclude,
      });
      await tx.post.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      });
      if (dto.parentCommentId) {
        await tx.comment.update({
          where: { id: dto.parentCommentId },
          data: { repliesCount: { increment: 1 } },
        });
      }
      return created;
    });

    return this.toResponse(comment);
  }

  /** Top-level comments for a post (newest first), cursor-paginated. */
  async listForPost(
    postId: string,
    params: { cursor?: string; limit: number },
  ): Promise<PaginatedResult<CommentResponseDto>> {
    const rows = await this.prisma.comment.findMany({
      where: { postId, parentCommentId: null, deletedAt: null },
      include: commentInclude,
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const page = buildCursorPage(rows, params.limit);
    return new PaginatedResult(
      page.items.map((c) => this.toResponse(c)),
      page.nextCursor,
    );
  }

  /** Replies to a single comment. */
  async listReplies(
    commentId: string,
    params: { cursor?: string; limit: number },
  ): Promise<PaginatedResult<CommentResponseDto>> {
    const rows = await this.prisma.comment.findMany({
      where: { parentCommentId: commentId, deletedAt: null },
      include: commentInclude,
      orderBy: { createdAt: 'asc' },
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const page = buildCursorPage(rows, params.limit);
    return new PaginatedResult(
      page.items.map((c) => this.toResponse(c)),
      page.nextCursor,
    );
  }

  async remove(
    commentId: string,
    userId: string,
    isModerator = false,
  ): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.deletedAt) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId && !isModerator) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.$transaction([
      this.prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.post.update({
        where: { id: comment.postId },
        data: { commentsCount: { decrement: 1 } },
      }),
    ]);
  }

  private toResponse(comment: CommentWithAuthor): CommentResponseDto {
    return {
      id: comment.id,
      postId: comment.postId,
      author: {
        id: comment.author.id,
        displayName:
          comment.author.profile?.displayName ?? comment.author.username,
        username: comment.author.username,
        avatarUrl: comment.author.profile?.avatarUrl ?? undefined,
      },
      text: comment.text,
      createdAt: comment.createdAt.toISOString(),
      parentCommentId: comment.parentCommentId ?? undefined,
      repliesCount: comment.repliesCount,
    };
  }
}
