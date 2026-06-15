import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';

/**
 * Editing only allows changing text + hashtags (you can't re-target a reply or
 * swap media via edit — that would rewrite history). PickType + PartialType keep
 * this DRY and in sync with CreatePostDto's validation.
 */
export class UpdatePostDto extends PartialType(
  PickType(CreatePostDto, ['text', 'hashtags'] as const),
) {
  @ApiPropertyOptional({ description: 'Updated post body' })
  text?: string;
}
