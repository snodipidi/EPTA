import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  COUNTERS_JOB,
  FanoutNotificationJob,
  MEDIA_JOB,
  ModerateContentJob,
  NOTIFICATIONS_JOB,
  ProcessMediaJob,
  PYTHON_JOB,
  QUEUE,
  RecomputePostCountersJob,
  RecomputeReputationJob,
  TrackEventJob,
} from './queue.constants';

/**
 * Type-safe façade over the raw BullMQ queues. Feature code calls these intent-
 * revealing methods instead of touching queue names/payloads directly — so a
 * job's shape is validated at the call site by the compiler.
 */
@Injectable()
export class QueueProducer {
  constructor(
    @InjectQueue(QUEUE.COUNTERS) private readonly counters: Queue,
    @InjectQueue(QUEUE.NOTIFICATIONS) private readonly notifications: Queue,
    @InjectQueue(QUEUE.MEDIA) private readonly media: Queue,
    @InjectQueue(QUEUE.PYTHON) private readonly python: Queue,
  ) {}

  recomputePostCounters(data: RecomputePostCountersJob): Promise<unknown> {
    // De-dupe bursts: a job id keyed by post collapses rapid re-enqueues.
    return this.counters.add(COUNTERS_JOB.RECOMPUTE_POST, data, {
      jobId: `post-counters:${data.postId}`,
    });
  }

  recomputeReputation(data: RecomputeReputationJob): Promise<unknown> {
    return this.counters.add(COUNTERS_JOB.RECOMPUTE_REPUTATION, data, {
      jobId: `reputation:${data.userId}`,
    });
  }

  fanoutNotification(data: FanoutNotificationJob): Promise<unknown> {
    return this.notifications.add(NOTIFICATIONS_JOB.FANOUT, data);
  }

  processMedia(data: ProcessMediaJob): Promise<unknown> {
    return this.media.add(MEDIA_JOB.PROCESS, data, {
      jobId: `media:${data.mediaId}`,
    });
  }

  moderateContent(data: ModerateContentJob): Promise<unknown> {
    return this.python.add(PYTHON_JOB.MODERATE_CONTENT, data);
  }

  trackEvent(data: TrackEventJob): Promise<unknown> {
    // Analytics is best-effort: don't retry forever, drop quickly on failure.
    return this.python.add(PYTHON_JOB.TRACK_EVENT, data, {
      attempts: 1,
      removeOnFail: { count: 100 },
    });
  }
}
