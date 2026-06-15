import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { MediaStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { PythonServiceClient } from '../../integrations/python/python-service.client';
import { MEDIA_JOB, ProcessMediaJob, QUEUE } from '../queue.constants';

/**
 * Async media pipeline. Today it (a) flips PENDING assets to READY and (b) hands
 * the asset to the moderation-service if configured. The real thumbnail/transcode
 * work (sharp/ffmpeg) slots in here without touching the upload request path —
 * which is exactly why upload returns immediately and processing is a job.
 */
@Processor(QUEUE.MEDIA)
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly python: PythonServiceClient,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== MEDIA_JOB.PROCESS) {
      this.logger.warn(`Unknown media job: ${job.name}`);
      return;
    }
    const { mediaId } = job.data as ProcessMediaJob;

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });
    if (!asset) return;

    await this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { status: MediaStatus.PROCESSING },
    });

    // ── seam: generate variants/thumbnails here (sharp/ffmpeg) ──

    // Optional moderation pass (no-op if the service isn't configured).
    const verdict = await this.python.moderate({
      contentId: mediaId,
      contentType: 'media',
      mediaUrls: [asset.storageKey],
    });

    await this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: {
        status:
          verdict?.status === 'REJECTED'
            ? MediaStatus.FAILED
            : MediaStatus.READY,
      },
    });
    this.logger.debug(`Processed media ${mediaId}`);
  }
}
