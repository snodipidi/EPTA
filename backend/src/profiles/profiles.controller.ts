import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, OptionalJwtAuthGuard, Public } from '../common';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { TopUserDto } from './dto/top-user.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Public()
  @Get('top')
  @ApiOperation({ summary: 'Leaderboard ("Топы") — top users by reputation' })
  @ApiOkResponse({ type: [TopUserDto] })
  leaderboard(@Query('limit') limit?: string): Promise<TopUserDto[]> {
    const n = Math.min(Math.max(parseInt(limit ?? '10', 10) || 10, 1), 50);
    return this.profiles.getLeaderboard(n);
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'My own profile' })
  @ApiOkResponse({ type: ProfileResponseDto })
  me(@CurrentUser('id') userId: string): Promise<ProfileResponseDto> {
    return this.profiles.getMe(userId);
  }

  @ApiBearerAuth('access-token')
  @Patch('me')
  @ApiOperation({ summary: 'Edit my profile' })
  @ApiOkResponse({ type: ProfileResponseDto })
  update(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.profiles.updateMyProfile(userId, dto);
  }

  @ApiBearerAuth('access-token')
  @Patch('me/settings/privacy')
  @ApiOperation({ summary: 'Update profile visibility (privacy settings)' })
  @ApiOkResponse({ type: ProfileResponseDto })
  updatePrivacy(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePrivacyDto,
  ): Promise<ProfileResponseDto> {
    return this.profiles.updatePrivacy(userId, dto);
  }

  // Optional auth: anonymous visitors see public profiles; logged-in viewers
  // additionally get isFollowing / privacy-aware fields. Declared last so it
  // doesn't shadow the static routes above (/top, /me).
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get(':username')
  @ApiOperation({ summary: 'View a public profile by username' })
  @ApiOkResponse({ type: ProfileResponseDto })
  byUsername(
    @Param('username') username: string,
    @CurrentUser('id') viewerId?: string,
  ): Promise<ProfileResponseDto> {
    return this.profiles.getByUsername(username, viewerId);
  }
}
