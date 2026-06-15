import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public profile response. The first six fields match the frontend's
 * `UserProfile` type exactly (src/types/user.ts) so the client maps 1:1; the
 * extra fields are viewer-context hints the UI can use but safely ignore.
 */
export class ProfileResponseDto {
  @ApiProperty({ description: 'User id' })
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ description: 'Empty string when hidden/unset' })
  bio!: string;

  @ApiProperty()
  followers!: number;

  @ApiProperty()
  following!: number;

  @ApiPropertyOptional()
  avatarUrl?: string;

  // ── viewer-context extras ──
  @ApiPropertyOptional()
  coverUrl?: string;

  @ApiProperty({ description: 'Is this the authenticated user?' })
  isMe!: boolean;

  @ApiProperty({ description: 'Does the viewer follow this profile?' })
  isFollowing!: boolean;

  @ApiProperty({
    description: "Whether the viewer may see this profile's posts",
  })
  canViewPosts!: boolean;

  @ApiProperty({ enum: ['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'] })
  visibility!: string;
}
