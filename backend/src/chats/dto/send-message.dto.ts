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

export class SendMessageDto {
  @ApiPropertyOptional({ description: 'Message text (required if no media)' })
  @ValidateIf((o: SendMessageDto) => !o.mediaIds || o.mediaIds.length === 0)
  @IsString()
  @MaxLength(4000)
  text?: string;

  @ApiPropertyOptional({ type: [String], description: 'Attached media ids' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  @Type(() => String)
  mediaIds?: string[];

  @ApiPropertyOptional({ description: 'Id of the message being replied to' })
  @IsOptional()
  @IsUUID('4')
  replyToId?: string;
}
