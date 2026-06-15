import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisConfig } from '../config/configuration';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

/**
 * Provides a single shared ioredis connection (REDIS_CLIENT) plus a thin
 * RedisService with cache helpers. Global because Redis is cross-cutting
 * (cache, rate-limit, pub/sub for WS scaling).
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const { host, port, password } =
          config.getOrThrow<RedisConfig>('redis');
        return new Redis({
          host,
          port,
          password,
          // Fail fast on commands while disconnected rather than queueing forever.
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        });
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor() {}

  async onApplicationShutdown(): Promise<void> {
    // The client is disconnected by RedisService's own shutdown hook.
  }
}
