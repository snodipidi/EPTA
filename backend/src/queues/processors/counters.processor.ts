import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  COUNTERS_JOB,
  QUEUE,
  RecomputePostCountersJob,
  RecomputeReputationJob,
} from '../queue.constants';

/**
 * Reconciles denormalized counters against the source-of-truth rows. The hot
 * path keeps counters correct via transactional increments; this job is the
 * self-healing safety net (and the place to recompute the leaderboard score).
 */
@Processor(QUEUE.COUNTERS)
export class CountersProcessor extends WorkerHost {
  private readonly logger = new Logger(CountersProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case COUNTERS_JOB.RECOMPUTE_POST:
        return this.recomputePost(job.data as RecomputePostCountersJob);
      case COUNTERS_JOB.RECOMPUTE_REPUTATION:
        return this.recomputeReputation(job.data as RecomputeReputationJob);
      default:
        this.logger.warn(`Unknown counters job: ${job.name}`);
    }
  }

  private async recomputePost(data: RecomputePostCountersJob): Promise<void> {
    const [likes, comments, reposts, bookmarks] = await Promise.all([
      this.prisma.reaction.count({ where: { postId: data.postId } }),
      this.prisma.comment.count({
        where: { postId: data.postId, deletedAt: null },
      }),
      this.prisma.post.count({ where: { parentPostId: data.postId } }),
      this.prisma.bookmark.count({ where: { postId: data.postId } }),
    ]);

    await this.prisma.post.update({
      where: { id: data.postId },
      data: {
        likesCount: likes,
        commentsCount: comments,
        repostsCount: reposts,
        bookmarksCount: bookmarks,
      },
    });
  }

  /**
   * Recompute a user's reputation (drives the "Топы" leaderboard). Simple,
   * transparent formula; a Python analytics-service could later replace it.
   */
  private async recomputeReputation(
    data: RecomputeReputationJob,
  ): Promise<void> {
    const agg = await this.prisma.post.aggregate({
      where: { authorId: data.userId, deletedAt: null },
      _sum: { likesCount: true, commentsCount: true, repostsCount: true },
    });
    const followers = await this.prisma.profile.findUnique({
      where: { userId: data.userId },
      select: { followersCount: true },
    });

    const score =
      (agg._sum.likesCount ?? 0) * 1 +
      (agg._sum.commentsCount ?? 0) * 2 +
      (agg._sum.repostsCount ?? 0) * 3 +
      (followers?.followersCount ?? 0) * 5;

    await this.prisma.profile.update({
      where: { userId: data.userId },
      data: { reputationScore: score },
    });
  }
}
