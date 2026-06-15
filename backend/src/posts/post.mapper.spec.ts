import { ConfigService } from '@nestjs/config';
import { PostMapper } from './post.mapper';
import { PostWithRelations } from './posts.types';

/**
 * Locks the PostMapper to the frontend `Post` contract (frontend/src/types/post.ts).
 * If a field name/shape drifts, this test fails — protecting the client.
 */
describe('PostMapper', () => {
  let mapper: PostMapper;

  beforeEach(() => {
    const config = {
      getOrThrow: () => ({ publicUrl: 'https://cdn.epta.test' }),
    } as unknown as ConfigService;
    mapper = new PostMapper(config);
  });

  const basePost = (): PostWithRelations =>
    ({
      id: 'p1',
      text: 'hello',
      hashtags: ['epta', 'test'],
      publishedAt: new Date('2026-06-09T10:30:00Z'),
      likesCount: 10,
      commentsCount: 12,
      repostsCount: 5,
      author: {
        id: 'u1',
        username: 'ego_yuz',
        profile: { displayName: 'Кто-то там', avatarUrl: null },
      },
      media: [],
      replyToPost: null,
    }) as unknown as PostWithRelations;

  it('maps to the exact frontend Post shape', () => {
    const dto = mapper.toResponse(basePost());
    expect(dto).toMatchObject({
      id: 'p1',
      author: { id: 'u1', displayName: 'Кто-то там', username: 'ego_yuz' },
      text: 'hello',
      hashtags: ['epta', 'test'],
      images: [],
      counters: { comments: 12, reposts: 5, likes: 10 },
      createdAt: '2026-06-09T10:30:00.000Z',
    });
  });

  it('builds image URLs from the media storage key + CDN base', () => {
    const post = basePost();
    (post.media as unknown[]) = [
      {
        media: { id: 'm1', storageKey: 'media/u1/x.webp', altText: 'описание' },
      },
    ];
    const dto = mapper.toResponse(post);
    expect(dto.images[0]).toEqual({
      id: 'm1',
      url: 'https://cdn.epta.test/media/u1/x.webp',
      alt: 'описание',
    });
  });

  it('emits replyTo when the post answers another', () => {
    const post = basePost();
    (post as unknown as { replyToPost: unknown }).replyToPost = {
      id: 'p0',
      author: { username: 'someone' },
    };
    const dto = mapper.toResponse(post);
    expect(dto.replyTo).toEqual({ id: 'p0', authorName: 'someone' });
  });

  it('marks liked/bookmarked from the viewer context', () => {
    const dto = mapper.toResponse(basePost(), {
      likedPostIds: new Set(['p1']),
      bookmarkedPostIds: new Set(),
    });
    expect(dto.liked).toBe(true);
    // Set provided but doesn't contain p1 → explicitly false.
    expect(dto.bookmarked).toBe(false);
  });

  it('leaves liked/bookmarked undefined for an anonymous viewer', () => {
    const dto = mapper.toResponse(basePost());
    expect(dto.liked).toBeUndefined();
    expect(dto.bookmarked).toBeUndefined();
  });
});
