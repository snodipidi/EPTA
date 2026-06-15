import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostAuthorDto } from './post-response.dto';

/** Mirrors the frontend `Comment` type (src/types/comment.ts). */
export class CommentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  postId!: string;

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;

  @ApiProperty()
  text!: string;

  @ApiProperty({ description: 'ISO-8601 timestamp' })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Parent comment id when this is a reply',
  })
  parentCommentId?: string;

  @ApiProperty({ description: 'Number of direct replies' })
  repliesCount!: number;
}
