import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common';
import { ReactionStateDto, SetReactionDto } from './dto/reaction.dto';
import { ReactionsService } from './reactions.service';

@ApiTags('reactions')
@ApiBearerAuth('access-token')
// Reactions are toggled frequently; cap per-minute to blunt automated abuse.
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('posts/:postId')
export class ReactionsController {
  constructor(private readonly reactions: ReactionsService) {}

  @Post('like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle like on a post' })
  @ApiOkResponse({ type: ReactionStateDto })
  toggleLike(
    @CurrentUser('id') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<ReactionStateDto> {
    return this.reactions.toggleLike(userId, postId);
  }

  @Put('reaction')
  @ApiOperation({ summary: 'Set a specific reaction type on a post' })
  @ApiOkResponse({ type: ReactionStateDto })
  setReaction(
    @CurrentUser('id') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: SetReactionDto,
  ): Promise<ReactionStateDto> {
    return this.reactions.setReaction(userId, postId, dto.type);
  }

  @Delete('reaction')
  @ApiOperation({ summary: 'Remove the viewer reaction from a post' })
  @ApiOkResponse({ type: ReactionStateDto })
  removeReaction(
    @CurrentUser('id') userId: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<ReactionStateDto> {
    return this.reactions.removeReaction(userId, postId);
  }
}
