import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  CursorPaginationDto,
  OptionalJwtAuthGuard,
  Public,
} from '../common';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { CommentsService } from './comments.service';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import {
  PostCountersDto,
  PostImageDto,
  PostResponseDto,
} from './dto/post-response.dto';
import { RepostDto } from './dto/repost.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
  ) {}

  // ── Public reads (optional auth → viewer-aware flags) ────────────────────

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get()
  @ApiOperation({ summary: 'List posts (public timeline)' })
  @ApiOkResponse({ type: [PostResponseDto] })
  list(
    @Query() query: CursorPaginationDto,
    @CurrentUser('id') viewerId?: string,
  ): Promise<PaginatedResult<PostResponseDto>> {
    return this.posts.list(
      { cursor: query.cursor, limit: query.limit },
      viewerId,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get(':id')
  @ApiOperation({ summary: 'Get a single post' })
  @ApiOkResponse({ type: PostResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') viewerId?: string,
  ): Promise<PostResponseDto> {
    return this.posts.findOne(id, viewerId);
  }

  @Public()
  @Get(':id/images')
  @ApiOperation({ summary: "Get a post's images" })
  @ApiOkResponse({ type: [PostImageDto] })
  images(@Param('id', ParseUUIDPipe) id: string): Promise<PostImageDto[]> {
    return this.posts.getImages(id);
  }

  @Public()
  @Get(':id/counters')
  @ApiOperation({ summary: "Get a post's interaction counters" })
  @ApiOkResponse({ type: PostCountersDto })
  counters(@Param('id', ParseUUIDPipe) id: string): Promise<PostCountersDto> {
    return this.posts.getCounters(id);
  }

  @Public()
  @Get(':id/comments')
  @ApiOperation({ summary: 'List top-level comments on a post' })
  @ApiOkResponse({ type: [CommentResponseDto] })
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CursorPaginationDto,
  ): Promise<PaginatedResult<CommentResponseDto>> {
    return this.comments.listForPost(id, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  // ── Authenticated writes ─────────────────────────────────────────────────

  @ApiBearerAuth('access-token')
  @Post()
  // Curb spam posting beyond the global limit.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a post' })
  @ApiOkResponse({ type: PostResponseDto })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    return this.posts.create(userId, dto);
  }

  @ApiBearerAuth('access-token')
  @Post(':id/repost')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Repost or quote a post' })
  @ApiOkResponse({ type: PostResponseDto })
  repost(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepostDto,
  ): Promise<PostResponseDto> {
    return this.posts.repost(userId, id, dto.text);
  }

  @ApiBearerAuth('access-token')
  @Post(':id/comments')
  // Comments are higher-frequency than posts but still worth bounding.
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({ summary: 'Comment on a post' })
  @ApiOkResponse({ type: CommentResponseDto })
  comment(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.comments.create(id, userId, dto);
  }

  @ApiBearerAuth('access-token')
  @Patch(':id')
  @ApiOperation({ summary: 'Edit a post' })
  @ApiOkResponse({ type: PostResponseDto })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.posts.update(id, userId, dto);
  }

  @ApiBearerAuth('access-token')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.posts.remove(id, userId);
  }
}
