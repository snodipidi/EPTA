import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ModerationStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PythonServiceClient } from '../../integrations/python/python-service.client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ModerateContentJob,
  PYTHON_JOB,
  QUEUE,
  TrackEventJob,
} from '../queue.constants';

/**
 * Bridges domain events to the (future) Python micro-services over the queue.
 * DECISION: queue-based integration (vs. inline HTTP) means a slow or down
 * Python service never blocks or fails a user request — the job retries
 * independently, and results are written back to the DB asynchronously.
 */
@Processor(QUEUE.PYTHON)
export class PythonProcessor extends WorkerHost {
  private readonly logger = new Logger(PythonProcessor.name);

  constructor(
    private readonly python: PythonServiceClient,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case PYTHON_JOB.MODERATE_CONTENT:
        return this.moderate(job.data as ModerateContentJob);
      case PYTHON_JOB.TRACK_EVENT:
        return this.track(job.data as TrackEventJob);
      default:
        this.logger.warn(`Unknown python job: ${job.name}`);
    }
  }

  private async moderate(data: ModerateContentJob): Promise<void> {
    const verdict = await this.python.moderate(data);
    if (!verdict) return; // service disabled/unreachable — leave as-is

    const status =
      verdict.status === 'APPROVED'
        ? ModerationStatus.APPROVED
        : verdict.status === 'FLAGGED'
          ? ModerationStatus.FLAGGED
          : ModerationStatus.REJECTED;

    if (data.contentType === 'post') {
      await this.prisma.post.update({
        where: { id: data.contentId },
        data: { moderationStatus: status },
      });
    } else if (data.contentType === 'comment') {
      await this.prisma.comment.update({
        where: { id: data.contentId },
        data: { moderationStatus: status },
      });
    }
  }

  private async track(data: TrackEventJob): Promise<void> {
    await this.python.trackEvent({
      name: data.name,
      userId: data.userId,
      ...data.properties,
    });
  }
}
