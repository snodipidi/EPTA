/**
 * Central registry of queue names and their job payloads. One file so producers
 * and processors can never disagree on a name or a shape (type-safe jobs).
 */
export const QUEUE = {
  COUNTERS: 'counters',
  NOTIFICATIONS: 'notifications',
  MEDIA: 'media-processing',
  PYTHON: 'python-integration',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

// ── COUNTERS queue ──────────────────────────────────────────────────────────
export const COUNTERS_JOB = {
  RECOMPUTE_POST: 'recompute-post-counters',
  RECOMPUTE_REPUTATION: 'recompute-reputation',
} as const;

export interface RecomputePostCountersJob {
  postId: string;
}
export interface RecomputeReputationJob {
  userId: string;
}

// ── NOTIFICATIONS queue ──────────────────────────────────────────────────────
export const NOTIFICATIONS_JOB = {
  FANOUT: 'fanout-notification',
} as const;

export interface FanoutNotificationJob {
  recipientId: string;
  actorId?: string;
  type: string;
  postId?: string;
  data?: Record<string, unknown>;
}

// ── MEDIA queue ──────────────────────────────────────────────────────────────
export const MEDIA_JOB = {
  PROCESS: 'process-media',
} as const;

export interface ProcessMediaJob {
  mediaId: string;
}

// ── PYTHON integration queue ──────────────────────────────────────────────────
export const PYTHON_JOB = {
  MODERATE_CONTENT: 'moderate-content',
  TRACK_EVENT: 'track-analytics-event',
  REINDEX_SEARCH: 'reindex-search',
} as const;

export interface ModerateContentJob {
  contentId: string;
  contentType: 'post' | 'comment' | 'media';
  text?: string;
  mediaUrls?: string[];
}
export interface TrackEventJob {
  name: string;
  userId?: string;
  properties?: Record<string, unknown>;
}
export interface ReindexSearchJob {
  entity: 'post' | 'user';
  id: string;
}
