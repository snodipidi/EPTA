import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

const ctx = { userAgent: 'jest', ip: '127.0.0.1' };

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { create: jest.Mock; findUnique: jest.Mock } };
  let passwords: { hash: jest.Mock; verify: jest.Mock };
  let tokens: { issuePair: jest.Mock };

  const pair = { accessToken: 'a', refreshToken: 'r', expiresIn: 900 };

  beforeEach(async () => {
    prisma = {
      user: { create: jest.fn(), findUnique: jest.fn() },
    };
    passwords = { hash: jest.fn(), verify: jest.fn() };
    tokens = { issuePair: jest.fn().mockResolvedValue(pair) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('hashes the password and returns a token pair + user', async () => {
      passwords.hash.mockResolvedValue('hashed');
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@epta.dev',
        username: 'a',
        role: 'USER',
        profile: { displayName: 'A' },
      });

      const res = await service.register(
        {
          email: 'A@epta.dev',
          username: 'a',
          displayName: 'A',
          password: 'secret123',
        },
        ctx,
      );

      expect(passwords.hash).toHaveBeenCalledWith('secret123');
      expect(res.accessToken).toBe('a');
      expect(res.user.displayName).toBe('A');
      // email is normalized to lowercase before persisting
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'a@epta.dev' }),
        }),
      );
    });

    it('maps a unique-constraint violation to 409 Conflict', async () => {
      passwords.hash.mockResolvedValue('hashed');
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
          meta: { target: ['email'] },
        }),
      );

      await expect(
        service.register(
          {
            email: 'a@epta.dev',
            username: 'a',
            displayName: 'A',
            password: 'secret123',
          },
          ctx,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('rejects an unknown email without leaking which field failed', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@epta.dev', password: 'nope' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@epta.dev',
        passwordHash: 'hashed',
        status: UserStatus.ACTIVE,
        profile: { displayName: 'A' },
      });
      passwords.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@epta.dev', password: 'wrong' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a non-active account even with valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@epta.dev',
        passwordHash: 'hashed',
        status: UserStatus.SUSPENDED,
        profile: { displayName: 'A' },
      });
      passwords.verify.mockResolvedValue(true);

      await expect(
        service.login({ email: 'a@epta.dev', password: 'right' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues tokens on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@epta.dev',
        username: 'a',
        role: 'USER',
        passwordHash: 'hashed',
        status: UserStatus.ACTIVE,
        profile: { displayName: 'A' },
      });
      passwords.verify.mockResolvedValue(true);

      const res = await service.login(
        { email: 'a@epta.dev', password: 'right' },
        ctx,
      );
      expect(res.accessToken).toBe('a');
      expect(tokens.issuePair).toHaveBeenCalled();
    });
  });
});
