import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PythonServicesConfig } from '../../config/configuration';

/**
 * HTTP client for the (future) Python micro-services. NONE of them exist yet —
 * this is the integration seam required by the spec. Behaviour:
 *
 *  • If a service URL is not configured, calls are NO-OPS that return a safe
 *    default (null / [] / the input). The monolith therefore works fully
 *    without any Python service, and "turning one on" is just setting an env var.
 *  • Calls are time-boxed (AbortController) so a slow/down service degrades to
 *    the fallback instead of hanging a request.
 *
 * Uses the runtime's global fetch (Node ≥18) — no extra HTTP dependency.
 */
@Injectable()
export class PythonServiceClient {
  private readonly logger = new Logger(PythonServiceClient.name);
  private readonly config: PythonServicesConfig;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<PythonServicesConfig>('python');
  }

  /** recommendation-service: personalized post ids for a user. */
  async getRecommendedPostIds(
    userId: string,
    limit: number,
  ): Promise<string[] | null> {
    return this.post<{ postIds: string[] }>(
      this.config.recommendationUrl,
      '/recommendations',
      { userId, limit },
    ).then((r) => r?.postIds ?? null);
  }

  /** moderation-service: classify a piece of content. */
  async moderate(input: {
    contentId: string;
    contentType: 'post' | 'comment' | 'media';
    text?: string;
    mediaUrls?: string[];
  }): Promise<{
    status: 'APPROVED' | 'FLAGGED' | 'REJECTED';
    reason?: string;
  } | null> {
    return this.post(this.config.moderationUrl, '/moderate', input);
  }

  /** search-service: full-text / semantic search. */
  async search(query: string, limit: number): Promise<string[]> {
    const res = await this.post<{ postIds: string[] }>(
      this.config.searchUrl,
      '/search',
      { query, limit },
    );
    return res?.postIds ?? [];
  }

  /** analytics-service: fire-and-forget event ingestion. */
  async trackEvent(event: Record<string, unknown>): Promise<void> {
    await this.post(this.config.analyticsUrl, '/events', event).catch(
      () => undefined,
    );
  }

  /** True when a given service is configured (used to pick code paths). */
  isEnabled(service: keyof PythonServicesConfig): boolean {
    return Boolean(this.config[service]);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async post<T>(
    baseUrl: string | undefined,
    path: string,
    body: unknown,
  ): Promise<T | null> {
    if (!baseUrl) return null; // service disabled — graceful no-op

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Python service ${path} responded ${res.status}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      this.logger.warn(
        `Python service ${path} unreachable: ${(err as Error).message}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
