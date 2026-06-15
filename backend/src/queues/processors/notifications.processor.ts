import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import {
  FanoutNotificationJob,
  NOTIFICATIONS_JOB,
  QUEUE,
} from '../queue.constants';
import { NotificationsService } from '../../notifications/notifications.service';

/**
 * Off-request notification creation + push. Used for cases where the trigger
 * shouldn't pay the notification cost inline (e.g. bulk fan-out, or when many
 * recipients are involved). Single-recipient notifications are still created
 * synchronously by NotificationsService.notify() on the hot path.
 */
@Processor(QUEUE.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== NOTIFICATIONS_JOB.FANOUT) {
      this.logger.warn(`Unknown notifications job: ${job.name}`);
      return;
    }
    const data = job.data as FanoutNotificationJob;
    await this.notifications.notify({
      recipientId: data.recipientId,
      actorId: data.actorId,
      type: data.type as NotificationType,
      postId: data.postId,
      data: data.data as Prisma.InputJsonValue | undefined,
    });
  }
}
