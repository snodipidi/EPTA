import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Redis } from 'ioredis';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig, RedisConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisIoAdapter } from './websocket/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Defer logging to Pino (structured JSON in prod, pretty in dev).
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const { port, corsOrigins, nodeEnv } = config.getOrThrow<AppConfig>('app');

  // ── Security middleware ──────────────────────────────────────────────────
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // ── Global prefix — the frontend calls `${API_BASE_URL}` = .../api ───────
  app.setGlobalPrefix('api');

  // Header-based API versioning so we can ship /api with version negotiation
  // later without breaking existing clients (default = v1, no URL change).
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'X-API-Version',
    defaultVersion: '1',
  });

  // ── Validation — whitelist strips unknown props, transform coerces types ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Centralized error envelope ────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── WebSocket scaling — back Socket.IO with the Redis pub/sub adapter so
  //    events fan out across backend instances. Dedicated pub/sub connections.
  const redisCfg = config.getOrThrow<RedisConfig>('redis');
  const pubClient = new Redis({
    host: redisCfg.host,
    port: redisCfg.port,
    password: redisCfg.password,
  });
  const subClient = pubClient.duplicate();
  const ioAdapter = new RedisIoAdapter(app, pubClient, subClient);
  ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);

  // Flush DB connections etc. on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // ── Swagger / OpenAPI ─────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EPTA API')
    .setDescription('EPTA social network backend — REST + WebSocket API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('auth', 'Registration, login, token refresh')
    .addTag('users', 'Accounts and identity')
    .addTag('profiles', 'Public profiles and settings')
    .addTag('posts', 'Posts, comments, reposts')
    .addTag('reactions', 'Likes and extensible reactions')
    .addTag('bookmarks', 'Saved posts')
    .addTag('follows', 'Social graph')
    .addTag('feeds', 'Timelines, trends, recommendations')
    .addTag('media', 'Uploads')
    .addTag('notifications', 'User notifications')
    .addTag('chats', 'Direct and group messaging')
    .addTag('subscriptions', 'Free / Pro / VIP tiers')
    .addTag('health', 'Liveness and readiness')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(
    `EPTA backend [${nodeEnv}] listening on http://localhost:${port}/api (docs at /api/docs)`,
    'Bootstrap',
  );
}

void bootstrap();
