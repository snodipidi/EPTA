import * as path from 'node:path';
import 'dotenv/config';
import type { PrismaConfig } from 'prisma';

/**
 * Prisma config (replaces the deprecated `package.json#prisma` key).
 * Keeps the schema location and seed command in one typed place.
 * `dotenv/config` is imported explicitly because, once a Prisma config file is
 * present, the CLI no longer auto-loads `.env`.
 */
export default {
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
} satisfies PrismaConfig;
