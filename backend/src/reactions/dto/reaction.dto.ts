import { ApiProperty } from '@nestjs/swagger';
import { ReactionType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetReactionDto {
  @ApiProperty({ enum: ReactionType, example: ReactionType.LOVE })
  @IsEnum(ReactionType)
  type!: ReactionType;
}

export class ReactionStateDto {
  @ApiProperty({ description: 'Does the viewer currently react to this post?' })
  liked!: boolean;

  @ApiProperty({ description: 'Total reactions on the post', example: 10 })
  likes!: number;

  @ApiProperty({
    enum: ReactionType,
    nullable: true,
    description: "The viewer's current reaction type, or null",
  })
  type!: ReactionType | null;
}
