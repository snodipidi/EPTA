import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConfig } from '../config/configuration';
import { CountersProcessor } from './processors/counters.processor';
import { MediaProcessor } from './processors/media.processor';
import { NotificationsProcessor } from './processors/notifications.processor';
import { PythonProcessor } from './processors/python.processor';
import { QUEUE } from './queue.constants';
import { QueueProducer } from './queue.producer';

/**
 * BullMQ infrastructure. DECISION: queues decouple slow/secondary work (counter
 * recomputation, media processing, Python calls, notification fan-out) from the
 * request path. Producers enqueue; processors run in the same process here, but
 * because they're plain BullMQ workers they can be split into a dedicated worker
 * deployment later with zero code change.
 *
 * Global so any feature service can inject QueueProducer.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { host, port, password } =
          config.getOrThrow<RedisConfig>('redis');
        return {
          connection: { host, port, password },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 5000 },
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE.COUNTERS },
      { name: QUEUE.NOTIFICATIONS },
      { name: QUEUE.MEDIA },
      { name: QUEUE.PYTHON },
    ),
  ],
  providers: [
    QueueProducer,
    CountersProcessor,
    NotificationsProcessor,
    MediaProcessor,
    PythonProcessor,
  ],
  exports: [QueueProducer, BullModule],
})
export class QueuesModule {}
