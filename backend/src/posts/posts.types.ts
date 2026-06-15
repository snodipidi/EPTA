import { Prisma } from '@prisma/client';

/**
 * The single source of truth for "a post with everything the response needs".
 * Every query that returns posts reuses this include so the mapper always has
 * the same shape — change it in ONE place.
 */
export const postInclude = {
  author: {
    select: {
      id: true,
      username: true,
      profile: { select: { displayName: true, avatarUrl: true } },
    },
  },
  media: {
    orderBy: { position: 'asc' },
    include: { media: true },
  },
  replyToPost: {
    select: {
      id: true,
      author: { select: { username: true } },
    },
  },
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

/** Per-viewer flags resolved in bulk and threaded into the mapper. */
export interface ViewerContext {
  likedPostIds?: Set<string>;
  bookmarkedPostIds?: Set<string>;
}
