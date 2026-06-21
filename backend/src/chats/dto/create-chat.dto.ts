import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDirectChatDto {
  @ApiProperty({ description: 'Username of the other participant' })
  @IsString()
  @MinLength(1)
  username!: string;
}

export class CreateGroupChatDto {
  @ApiProperty({ example: 'епта-сквад' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    description: 'Usernames of initial members (besides the creator)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  memberUsernames!: string[];

  @ApiPropertyOptional({ description: 'Group avatar URL (http/https only)' })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string;
}
