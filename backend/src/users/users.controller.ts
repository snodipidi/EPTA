import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common';
import { BlockService } from './services/block.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly blocks: BlockService,
  ) {}

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Sensitive + argon2-heavy: a strict cap blunts password-guessing on the
  // authenticated change-password path.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Change my password (revokes all sessions)' })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.users.changePassword(userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my account (soft-delete + anonymize)' })
  deleteAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    return this.users.deleteAccount(userId, dto.password);
  }

  // ── Blocks ────────────────────────────────────────────────────────────────

  @Get('me/blocks')
  @ApiOperation({ summary: 'List ids of users I have blocked' })
  listBlocked(@CurrentUser('id') userId: string): Promise<string[]> {
    return this.blocks.listBlocked(userId);
  }

  @Post(':username/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Block a user by username' })
  block(
    @CurrentUser('id') userId: string,
    @Param('username') username: string,
  ): Promise<void> {
    return this.blocks.block(userId, username);
  }

  @Delete(':username/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unblock a user by username' })
  unblock(
    @CurrentUser('id') userId: string,
    @Param('username') username: string,
  ): Promise<void> {
    return this.blocks.unblock(userId, username);
  }
}
