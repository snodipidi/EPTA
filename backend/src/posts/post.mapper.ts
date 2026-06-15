import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Config } from '../config/configuration';
import { PostResponseDto } from './dto/post-response.dto';
import { PostWithRelations, ViewerContext } from './posts.types';

/**
 * Translates a DB post (PostWithRelations) into the exact `Post` shape the
 * frontend expects. Isolating this here means controllers/services never hand
 * Prisma rows to clients, and the frontend contract is enforced in one file.
 */
@Injectable()
export class PostMapper {
  private readonly mediaBaseUrl: string;

  constructor(config: ConfigService) {
    this.mediaBaseUrl = config
      .getOrThrow<S3Config>('s3')
      .publicUrl.replace(/\/+$/, '');
  }

  toResponse(
    post: PostWithRelations,
    viewer: ViewerContext = {},
  ): PostResponseDto {
    const images = post.media.map((link) => ({
      id: link.media.id,
      url: this.publicUrl(link.media.storageKey),
      alt: link.media.altText ?? undefined,
    }));

    return {
      id: post.id,
      author: {
        id: post.author.id,
        displayName: post.author.profile?.displayName ?? post.author.username,
        username: post.author.username,
        avatarUrl: post.author.profile?.avatarUrl ?? undefined,
      },
      text: post.text ?? '',
      hashtags: post.hashtags,
      images,
      counters: {
        comments: post.commentsCount,
        reposts: post.repostsCount,
        likes: post.likesCount,
      },
      createdAt: post.publishedAt.toISOString(),
      replyTo: post.replyToPost
        ? {
            id: post.replyToPost.id,
            authorName: post.replyToPost.author.username,
          }
        : undefined,
      liked: viewer.likedPostIds?.has(post.id) ?? undefined,
      bookmarked: viewer.bookmarkedPostIds?.has(post.id) ?? undefined,
    };
  }

  toResponseList(
    posts: PostWithRelations[],
    viewer: ViewerContext = {},
  ): PostResponseDto[] {
    return posts.map((p) => this.toResponse(p, viewer));
  }

  private publicUrl(storageKey: string): string {
    return `${this.mediaBaseUrl}/${storageKey.replace(/^\/+/, '')}`;
  }
}
