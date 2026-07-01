import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Mirrors frontend `PostImage` (src/types/post.ts). */
export class PostImageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiPropertyOptional()
  alt?: string;

  @ApiPropertyOptional({ description: 'Intrinsic width in pixels (for layout reservation)' })
  width?: number;

  @ApiPropertyOptional({ description: 'Intrinsic height in pixels (for layout reservation)' })
  height?: number;
}

/** Mirrors frontend `PostCounters`. */
export class PostCountersDto {
  @ApiProperty()
  comments!: number;

  @ApiProperty()
  reposts!: number;

  @ApiProperty()
  likes!: number;
}

/** Mirrors frontend `PostAuthor`. */
export class PostAuthorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  username!: string;

  @ApiPropertyOptional()
  avatarUrl?: string;
}

export class ReplyToDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  authorName!: string;
}

/**
 * The canonical post payload. Field names + shape are a 1:1 match with the
 * frontend `Post` interface so `getPosts()` / `getPost()` consume it without a
 * mapping layer on the client.
 */
export class PostResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;

  @ApiProperty()
  text!: string;

  @ApiProperty({ type: [String] })
  hashtags!: string[];

  @ApiProperty({ type: [PostImageDto] })
  images!: PostImageDto[];

  @ApiProperty({ type: PostCountersDto })
  counters!: PostCountersDto;

  @ApiProperty({ description: 'ISO-8601 timestamp' })
  createdAt!: string;

  @ApiPropertyOptional({ type: ReplyToDto })
  replyTo?: ReplyToDto;

  @ApiPropertyOptional({
    description: 'Hint to the UI to render a media placeholder block',
  })
  mediaPlaceholder?: boolean;

  // ── viewer-context extras (the client may use or ignore) ──
  @ApiPropertyOptional({ description: 'Has the viewer liked this post?' })
  liked?: boolean;

  @ApiPropertyOptional({ description: 'Has the viewer bookmarked this post?' })
  bookmarked?: boolean;
}
