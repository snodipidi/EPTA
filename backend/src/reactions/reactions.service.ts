import { Injectable, NotFoundException } from '@nestjs/common';
import { ReactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReactionStateDto } from './dto/reaction.dto';

/**
 * Reactions on posts. DECISION: `likesCount` on a post is the count of ALL
 * reactions regardless of type, so introducing 😂/❤️/😮 later needs no counter
 * migration — the toggle/set semantics already maintain it.
 */
@Injectable()
export class ReactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Toggle the default LIKE reaction on/off (POST /posts/:id/like). */
  async toggleLike(userId: string, postId: string): Promise<ReactionStateDto> {
    await this.assertPost(postId);

    const existing = await this.prisma.reaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    const likes = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.reaction.delete({ where: { id: existing.id } });
        const updated = await tx.post.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
          select: { likesCount: true },
        });
        return { count: updated.likesCount, type: null as ReactionType | null };
      }
      await tx.reaction.create({
        data: { userId, postId, type: ReactionType.LIKE },
      });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      });
      return { count: updated.likesCount, type: ReactionType.LIKE };
    });

    return { liked: likes.type !== null, likes: likes.count, type: likes.type };
  }

  /** Set/replace a specific reaction type (extensible reactions). */
  async setReaction(
    userId: string,
    postId: string,
    type: ReactionType,
  ): Promise<ReactionStateDto> {
    await this.assertPost(postId);

    const existing = await this.prisma.reaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    const count = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        // Switching type leaves the total unchanged.
        await tx.reaction.update({
          where: { id: existing.id },
          data: { type },
        });
        const post = await tx.post.findUniqueOrThrow({
          where: { id: postId },
          select: { likesCount: true },
        });
        return post.likesCount;
      }
      await tx.reaction.create({ data: { userId, postId, type } });
      const post = await tx.post.update({
        where: { id: postId },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      });
      return post.likesCount;
    });

    return { liked: true, likes: count, type };
  }

  async removeReaction(
    userId: string,
    postId: string,
  ): Promise<ReactionStateDto> {
    const existing = await this.prisma.reaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!existing) {
      const post = await this.prisma.post.findUniqueOrThrow({
        where: { id: postId },
        select: { likesCount: true },
      });
      return { liked: false, likes: post.likesCount, type: null };
    }

    const count = await this.prisma.$transaction(async (tx) => {
      await tx.reaction.delete({ where: { id: existing.id } });
      const post = await tx.post.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      });
      return post.likesCount;
    });

    return { liked: false, likes: count, type: null };
  }

  private async assertPost(postId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Post not found');
  }
}
