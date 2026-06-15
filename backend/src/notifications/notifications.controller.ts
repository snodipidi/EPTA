import {
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, CursorPaginationDto } from '../common';
import { PaginatedResult } from '../common/dto/pagination.dto';
import {
  NotificationResponseDto,
  UnreadCountDto,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications (newest first)' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiOkResponse({ type: [NotificationResponseDto] })
  list(
    @CurrentUser('id') userId: string,
    @Query() query: CursorPaginationDto,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    return this.notifications.list(userId, {
      cursor: query.cursor,
      limit: query.limit,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Number of unread notifications (for the badge)' })
  @ApiOkResponse({ type: UnreadCountDto })
  unreadCount(@CurrentUser('id') userId: string): Promise<UnreadCountDto> {
    return this.notifications.unreadCount(userId);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser('id') userId: string): Promise<void> {
    return this.notifications.markAllRead(userId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.markRead(userId, id);
  }
}
