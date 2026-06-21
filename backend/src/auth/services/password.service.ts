import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing, isolated behind a service so the algorithm is swappable and
 * mockable in tests. DECISION: argon2id — the current OWASP-recommended KDF,
 * memory-hard and resistant to GPU cracking (a step up from bcrypt).
 */
@Injectable()
export class PasswordService implements OnModuleInit {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  /**
   * Pre-computed hash used to equalise verify() timing when no real hash exists
   * (unknown email, OAuth-only account). Without it, login would short-circuit
   * for non-existent users and leak — via response time — which emails are
   * registered. Warmed at startup; lazily computed as a fallback.
   */
  private dummyHash?: string;

  async onModuleInit(): Promise<void> {
    await this.getDummyHash();
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  /**
   * Verify a password against a stored hash in (near) constant time regardless
   * of whether the account exists or has a local password. When `hash` is
   * null/undefined we still run a full argon2 verification against a dummy hash
   * and then return false — so the timing profile matches a real check.
   */
  async verify(
    hash: string | null | undefined,
    plain: string,
  ): Promise<boolean> {
    const target = hash ?? (await this.getDummyHash());
    const matches = await argon2.verify(target, plain).catch(() => false);
    // OAuth-only / unknown accounts have no local password — password login must
    // fail even though we performed the work to keep timing uniform.
    return hash ? matches : false;
  }

  private async getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = await this.hash('timing-equalizer-not-a-real-password');
    }
    return this.dummyHash;
  }
}
