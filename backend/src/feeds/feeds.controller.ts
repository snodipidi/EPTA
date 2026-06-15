import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, CursorPaginationDto, Public } from '../common';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { PostResponseDto } from '../posts/dto/post-response.dto';
import { TrendingHashtagDto } from './dto/trending-hashtag.dto';
import { FeedsService } from './feeds.service';

@ApiTags('feeds')
@Controller('feeds')
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @ApiBearerAuth('access-token')
  @Get('following')
  @ApiOperation({ summary: 'Home feed — posts from accounts I follow' })
  @ApiOkResponse({ type: [PostResponseDto] })
  following(
    @CurrentUser('id') userId: string,
    @Query() query: CursorPaginationDto,
  ): Promise<PaginatedResult<PostResponseDto>> {
    return this.feeds.following(userId, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Trending posts ("тренды")' })
  @ApiOkResponse({ type: [PostResponseDto] })
  trending(@Query('limit') limit?: string): Promise<PostResponseDto[]> {
    return this.feeds.trending(this.clamp(limit, 20));
  }

  @Public()
  @Get('trending/hashtags')
  @ApiOperation({ summary: 'Trending hashtags' })
  @ApiOkResponse({ type: [TrendingHashtagDto] })
  trendingHashtags(
    @Query('limit') limit?: string,
  ): Promise<TrendingHashtagDto[]> {
    return this.feeds.trendingHashtags(this.clamp(limit, 10));
  }

  @ApiBearerAuth('access-token')
  @Get('recommended')
  @ApiOperation({
    summary: 'Recommended posts (recommendation-service, heuristic fallback)',
  })
  @ApiOkResponse({ type: [PostResponseDto] })
  recommended(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ): Promise<PostResponseDto[]> {
    return this.feeds.recommended(userId, this.clamp(limit, 20));
  }

  private clamp(value: string | undefined, fallback: number): number {
    const n = parseInt(value ?? '', 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(Math.max(n, 1), 50);
  }
}
