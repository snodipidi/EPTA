import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaStatus, MediaType } from '@prisma/client';

export class MediaResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: MediaType })
  type!: MediaType;

  @ApiProperty({ enum: MediaStatus })
  status!: MediaStatus;

  @ApiProperty({ description: 'Public URL of the asset' })
  url!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiPropertyOptional()
  width?: number;

  @ApiPropertyOptional()
  height?: number;
}
