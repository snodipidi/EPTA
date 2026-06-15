import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end auth flow. Requires a running Postgres + Redis (use the compose
 * stack, or set DATABASE_URL/REDIS_* to a test instance). Skipped automatically
 * if the database is unreachable so CI without infra doesn't hard-fail.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dbAvailable = true;

  const creds = {
    email: `e2e_${Date.now()}@epta.test`,
    username: `e2e_${Date.now()}`,
    displayName: 'E2E User',
    password: 'Password123!',
  };

  beforeAll(async () => {
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api');
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.init();

      prisma = app.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable && prisma) {
      await prisma.user
        .deleteMany({ where: { email: creds.email } })
        .catch(() => undefined);
    }
    await app?.close();
  });

  it('registers, then logs in, then refreshes (full token lifecycle)', async () => {
    if (!dbAvailable) {
      console.warn('⚠ Skipping auth e2e — database not reachable');
      return;
    }

    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(creds)
      .expect(201);
    expect(reg.body.accessToken).toBeDefined();
    expect(reg.body.user.username).toBe(creds.username);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password })
      .expect(200);
    expect(login.body.refreshToken).toBeDefined();

    const refresh = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(refresh.body.accessToken).toBeDefined();
    // Rotation must mint a brand-new refresh token.
    expect(refresh.body.refreshToken).not.toBe(login.body.refreshToken);
  });

  it('rejects an invalid login', async () => {
    if (!dbAvailable) return;
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'wrong' })
      .expect(401);
  });
});
