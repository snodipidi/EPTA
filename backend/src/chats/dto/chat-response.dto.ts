import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatType } from '@prisma/client';

export class ChatMemberDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiProperty({ enum: ['MEMBER', 'ADMIN', 'OWNER'] })
  role!: string;
}

export class ChatResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ChatType })
  type!: ChatType;

  @ApiPropertyOptional({ description: 'Group name (null for direct chats)' })
  name?: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiProperty({ type: [ChatMemberDto] })
  members!: ChatMemberDto[];

  @ApiPropertyOptional({ description: 'ISO-8601 of the last message' })
  lastMessageAt?: string;

  @ApiProperty({ description: 'Unread messages for the requesting user' })
  unreadCount!: number;
}

export class ChatMessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  chatId!: string;

  @ApiProperty()
  senderId!: string;

  @ApiPropertyOptional()
  text?: string;

  @ApiProperty({ type: [String] })
  mediaIds!: string[];

  @ApiPropertyOptional()
  replyToId?: string;

  @ApiProperty({ description: 'ISO-8601 timestamp' })
  createdAt!: string;

  @ApiPropertyOptional()
  editedAt?: string;
}
