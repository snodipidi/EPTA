import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, CursorPaginationDto, Public } from '../common';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { CommentsService } from './comments.service';
import { CommentResponseDto } from './dto/comment-response.dto';

/** Comment-level operations (the post-scoped create/list live on PostsController). */
@ApiTags('posts')
@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @Get(':id/replies')
  @ApiOperation({ summary: 'List replies to a comment' })
  @ApiOkResponse({ type: [CommentResponseDto] })
  replies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CursorPaginationDto,
  ): Promise<PaginatedResult<CommentResponseDto>> {
    return this.comments.listReplies(id, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @ApiBearerAuth('access-token')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment (author or moderator)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const isModerator =
      user.role === UserRole.MODERATOR ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.OWNER;
    return this.comments.remove(id, user.id, isModerator);
  }
}
