import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreatePostDto {
  @ApiPropertyOptional({
    description: 'Post body. Required unless the post has media.',
    example: 'Сам пост бла бла блаблаблаблабла',
  })
  // A post must carry *something*: text or at least one media asset.
  @ValidateIf((o: CreatePostDto) => !o.mediaIds || o.mediaIds.length === 0)
  @IsString()
  @MaxLength(5000)
  text?: string;

  @ApiPropertyOptional({
    description: 'Hashtags without the leading #',
    example: ['теги', 'епта'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Type(() => String)
  hashtags?: string[];

  @ApiPropertyOptional({
    description: 'Ids of previously uploaded, READY media assets to attach',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  mediaIds?: string[];

  @ApiPropertyOptional({
    description: 'If set, this post is a reply to the given post id',
  })
  @IsOptional()
  @IsUUID('4')
  replyToPostId?: string;
}
