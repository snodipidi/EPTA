import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { UserSummaryDto } from './dto/user-summary.dto';
import { FollowsService } from './follows.service';

@ApiTags('follows')
@Controller('users')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @ApiBearerAuth('access-token')
  @Post(':username/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Follow a user' })
  follow(
    @CurrentUser('id') userId: string,
    @Param('username') username: string,
  ): Promise<void> {
    return this.follows.follow(userId, username);
  }

  @ApiBearerAuth('access-token')
  @Delete(':username/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(
    @CurrentUser('id') userId: string,
    @Param('username') username: string,
  ): Promise<void> {
    return this.follows.unfollow(userId, username);
  }

  @Public()
  @Get(':username/followers')
  @ApiOperation({ summary: "List a user's followers" })
  @ApiOkResponse({ type: [UserSummaryDto] })
  followers(
    @Param('username') username: string,
    @Query() query: CursorPaginationDto,
  ): Promise<PaginatedResult<UserSummaryDto>> {
    return this.follows.listFollowers(username, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Public()
  @Get(':username/following')
  @ApiOperation({ summary: 'List who a user follows' })
  @ApiOkResponse({ type: [UserSummaryDto] })
  following(
    @Param('username') username: string,
    @Query() query: CursorPaginationDto,
  ): Promise<PaginatedResult<UserSummaryDto>> {
    return this.follows.listFollowing(username, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
