import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * Runtime validation of process.env. We fail fast at boot if a required
 * variable is missing or malformed, rather than discovering it mid-request.
 */
export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  @IsString()
  @IsOptional()
  CORS_ORIGINS = 'http://localhost:5173';

  // ── Database ──
  @IsString()
  DATABASE_URL!: string;

  // ── Redis ──
  @IsString()
  @IsOptional()
  REDIS_HOST = 'localhost';

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  REDIS_PORT = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // ── JWT ──
  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL = '900s';

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_TTL = '30d';

  // ── Throttling ──
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  THROTTLE_TTL = 60;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  THROTTLE_LIMIT = 120;

  // ── Media / S3 (optional until media module is used) ──
  @IsString()
  @IsOptional()
  S3_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  S3_REGION = 'us-east-1';

  @IsString()
  @IsOptional()
  S3_BUCKET = 'epta-media';

  @IsString()
  @IsOptional()
  S3_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  S3_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  MEDIA_PUBLIC_URL = 'http://localhost:9000/epta-media';

  // ── Python services (integration seams; blank = disabled) ──
  @IsString()
  @IsOptional()
  PY_RECOMMENDATION_URL?: string;

  @IsString()
  @IsOptional()
  PY_MODERATION_URL?: string;

  @IsString()
  @IsOptional()
  PY_ANALYTICS_URL?: string;

  @IsString()
  @IsOptional()
  PY_SEARCH_URL?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  PY_SERVICE_TIMEOUT_MS = 4000;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return validated;
}
