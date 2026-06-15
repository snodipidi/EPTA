import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { ChatsModule } from './chats/chats.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PaginationInterceptor } from './common/interceptors/pagination.interceptor';
import { ConfigModule } from './config/config.module';
import { AppConfig, ThrottleConfig } from './config/configuration';
import { FeedsModule } from './feeds/feeds.module';
import { FollowsModule } from './follows/follows.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { QueuesModule } from './queues/queues.module';
import { ReactionsModule } from './reactions/reactions.module';
import { RedisModule } from './redis/redis.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // ── Infrastructure (global) ──
    ConfigModule,
    PrismaModule,
    RedisModule,

    // Structured logging. Pretty in dev, JSON in prod; auto request logging.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { nodeEnv } = config.getOrThrow<AppConfig>('app');
        return {
          pinoHttp: {
            level: nodeEnv === 'production' ? 'info' : 'debug',
            transport:
              nodeEnv === 'production'
                ? undefined
                : { target: 'pino-pretty', options: { singleLine: true } },
            // Never log auth headers / cookies.
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),

    // Global rate limiting backed by config. Per-route overrides via @Throttle.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { ttl, limit } = config.getOrThrow<ThrottleConfig>('throttle');
        return { throttlers: [{ ttl: ttl * 1000, limit }] };
      },
    }),

    // ── Feature modules ──
    IntegrationsModule,
    QueuesModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    PostsModule,
    ReactionsModule,
    BookmarksModule,
    FollowsModule,
    FeedsModule,
    MediaModule,
    ChatsModule,
    SubscriptionsModule,
    HealthModule,
  ],
  providers: [
    // Order matters: authenticate, then throttle, then authorize by role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Unwraps PaginatedResult → array body + pagination headers.
    { provide: APP_INTERCEPTOR, useClass: PaginationInterceptor },
    // Belt-and-suspenders: the filter is also registered in main.ts; here it
    // ensures DI-constructed filters work in tests that bootstrap AppModule.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
