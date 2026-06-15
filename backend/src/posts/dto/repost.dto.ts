import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RepostDto {
  @ApiPropertyOptional({
    description:
      'Optional commentary. If provided the repost becomes a QUOTE; otherwise a plain REPOST.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string;
}
