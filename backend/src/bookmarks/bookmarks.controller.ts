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
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, CursorPaginationDto } from '../common';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { PostResponseDto } from '../posts/dto/post-response.dto';
import { BookmarksService } from './bookmarks.service';
import { BookmarkStateDto } from './dto/bookmark-state.dto';

@ApiTags('bookmarks')
@ApiBearerAuth('access-token')
@Controller()
export class BookmarksController {
  constructor(private readonly bookmarks: BookmarksService) {}

  @Post('posts/:postId/bookmark')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle bookmark on a post' })
  @ApiOkResponse({ type: BookmarkStateDto })
  toggle(
    @CurrentUser('id') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<BookmarkStateDto> {
    return this.bookmarks.toggle(userId, postId);
  }

  @Get('bookmarks')
  @ApiOperation({ summary: 'List my bookmarked posts' })
  @ApiOkResponse({ type: [PostResponseDto] })
  listMine(
    @CurrentUser('id') userId: string,
    @Query() query: CursorPaginationDto,
  ): Promise<PaginatedResult<PostResponseDto>> {
    return this.bookmarks.listMine(userId, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
