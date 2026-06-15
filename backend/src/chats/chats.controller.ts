import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, CursorPaginationDto } from '../common';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { ChatsService } from './chats.service';
import {
  ChatMessageResponseDto,
  ChatResponseDto,
} from './dto/chat-response.dto';
import { CreateDirectChatDto, CreateGroupChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * REST surface for chats. Real-time send/receive goes through ChatGateway, but
 * these endpoints provide the initial load (list chats, fetch history) and a
 * fallback for clients without an open socket.
 */
@ApiTags('chats')
@ApiBearerAuth('access-token')
@Controller('chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  @ApiOperation({ summary: 'List my chats (most recent first)' })
  @ApiOkResponse({ type: [ChatResponseDto] })
  listMine(@CurrentUser('id') userId: string): Promise<ChatResponseDto[]> {
    return this.chats.listMine(userId);
  }

  @Post('direct')
  @ApiOperation({ summary: 'Open (or get) a direct chat with a user' })
  @ApiOkResponse({ type: ChatResponseDto })
  direct(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDirectChatDto,
  ): Promise<ChatResponseDto> {
    return this.chats.getOrCreateDirect(userId, dto.username);
  }

  @Post('group')
  @ApiOperation({ summary: 'Create a group chat' })
  @ApiOkResponse({ type: ChatResponseDto })
  group(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGroupChatDto,
  ): Promise<ChatResponseDto> {
    return this.chats.createGroup(userId, dto);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: "Fetch a chat's message history" })
  @ApiOkResponse({ type: [ChatMessageResponseDto] })
  messages(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Query() query: CursorPaginationDto,
  ): Promise<PaginatedResult<ChatMessageResponseDto>> {
    return this.chats.getMessages(chatId, userId, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message (REST fallback for ChatGateway)' })
  @ApiOkResponse({ type: ChatMessageResponseDto })
  send(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) chatId: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessageResponseDto> {
    return this.chats.sendMessage(chatId, userId, dto);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a chat as read' })
  markRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) chatId: string,
  ): Promise<void> {
    return this.chats.markRead(chatId, userId);
  }
}
