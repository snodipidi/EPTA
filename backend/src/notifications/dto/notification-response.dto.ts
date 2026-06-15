import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

class NotificationActorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional()
  avatarUrl?: string;
}

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiPropertyOptional({
    type: NotificationActorDto,
    description: 'Who triggered it (null for SYSTEM notifications)',
  })
  actor?: NotificationActorDto;

  @ApiPropertyOptional({ description: 'Related post id, when relevant' })
  postId?: string;

  @ApiPropertyOptional({ description: 'Type-specific payload' })
  data?: Record<string, unknown>;

  @ApiProperty({ description: 'Null until the notification is read' })
  readAt!: string | null;

  @ApiProperty({ description: 'ISO-8601 timestamp' })
  createdAt!: string;
}

export class UnreadCountDto {
  @ApiProperty()
  unread!: number;
}
