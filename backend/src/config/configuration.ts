/**
 * Structured configuration factory. Consumers read typed slices via
 * `ConfigService.get<AppConfig>('app')` etc., never raw env strings.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessTtl: string;
  refreshSecret: string;
  refreshTtl: string;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKey?: string;
  secretKey?: string;
  publicUrl: string;
}

export interface PythonServicesConfig {
  recommendationUrl?: string;
  moderationUrl?: string;
  analyticsUrl?: string;
  searchUrl?: string;
  timeoutMs: number;
}

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  } satisfies AppConfig,

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  } satisfies RedisConfig,

  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret_change_me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret_change_me',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  } satisfies JwtConfig,

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  } satisfies ThrottleConfig,

  s3: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'epta-media',
    accessKey: process.env.S3_ACCESS_KEY || undefined,
    secretKey: process.env.S3_SECRET_KEY || undefined,
    publicUrl:
      process.env.MEDIA_PUBLIC_URL ?? 'http://localhost:9000/epta-media',
  } satisfies S3Config,

  python: {
    recommendationUrl: process.env.PY_RECOMMENDATION_URL || undefined,
    moderationUrl: process.env.PY_MODERATION_URL || undefined,
    analyticsUrl: process.env.PY_ANALYTICS_URL || undefined,
    searchUrl: process.env.PY_SEARCH_URL || undefined,
    timeoutMs: parseInt(process.env.PY_SERVICE_TIMEOUT_MS ?? '4000', 10),
  } satisfies PythonServicesConfig,
});
