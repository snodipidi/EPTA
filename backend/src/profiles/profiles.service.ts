import { Injectable, NotFoundException } from '@nestjs/common';
import { Profile, ProfileVisibility, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BlockService } from '../users/services/block.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { TopUserDto } from './dto/top-user.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const LEADERBOARD_CACHE_KEY = 'leaderboard:top';
const LEADERBOARD_TTL = 60; // seconds

type ProfileWithUser = Profile & {
  user: { id: string; username: string; status: UserStatus };
};

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly blocks: BlockService,
  ) {}

  async getMe(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, username: true, status: true } } },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return this.toResponse(profile, { isMe: true, isFollowing: false });
  }

  async getByUsername(
    username: string,
    viewerId?: string,
  ): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.findFirst({
      where: { user: { username } },
      include: { user: { select: { id: true, username: true, status: true } } },
    });

    if (!profile || profile.user.status === UserStatus.DELETED) {
      throw new NotFoundException('Profile not found');
    }

    // A block in either direction makes the profile invisible (don't leak existence).
    if (
      viewerId &&
      (await this.blocks.isBlockedEitherWay(viewerId, profile.user.id))
    ) {
      throw new NotFoundException('Profile not found');
    }

    const isMe = viewerId === profile.user.id;
    const isFollowing =
      !isMe && viewerId
        ? (await this.prisma.follow.count({
            where: { followerId: viewerId, followingId: profile.user.id },
          })) > 0
        : false;

    return this.toResponse(profile, { isMe, isFollowing });
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: dto,
      include: { user: { select: { id: true, username: true, status: true } } },
    });
    return this.toResponse(profile, { isMe: true, isFollowing: false });
  }

  async updatePrivacy(
    userId: string,
    dto: UpdatePrivacyDto,
  ): Promise<ProfileResponseDto> {
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: { visibility: dto.visibility },
      include: { user: { select: { id: true, username: true, status: true } } },
    });
    return this.toResponse(profile, { isMe: true, isFollowing: false });
  }

  /**
   * The "Топы" leaderboard. Cached in Redis for a minute — it's read on every
   * page load (sidebar) but only needs to be approximately fresh.
   */
  async getLeaderboard(limit = 10): Promise<TopUserDto[]> {
    return this.redis.remember(
      `${LEADERBOARD_CACHE_KEY}:${limit}`,
      LEADERBOARD_TTL,
      async () => {
        const profiles = await this.prisma.profile.findMany({
          where: { user: { status: UserStatus.ACTIVE } },
          orderBy: { reputationScore: 'desc' },
          take: limit,
          include: { user: { select: { id: true, username: true } } },
        });

        return profiles.map((p, index) => ({
          id: p.user.id,
          rank: index + 1,
          displayName: p.displayName,
          username: p.user.username,
          score: p.reputationScore,
        }));
      },
    );
  }

  // ── mapping ────────────────────────────────────────────────────────────

  private toResponse(
    profile: ProfileWithUser,
    ctx: { isMe: boolean; isFollowing: boolean },
  ): ProfileResponseDto {
    const canViewPosts = this.canViewPosts(profile.visibility, ctx);
    return {
      id: profile.user.id,
      displayName: profile.displayName,
      username: profile.user.username,
      // Hide bio on a profile the viewer can't see into.
      bio: canViewPosts ? (profile.bio ?? '') : '',
      followers: profile.followersCount,
      following: profile.followingCount,
      avatarUrl: profile.avatarUrl ?? undefined,
      coverUrl: canViewPosts ? (profile.coverUrl ?? undefined) : undefined,
      isMe: ctx.isMe,
      isFollowing: ctx.isFollowing,
      canViewPosts,
      visibility: profile.visibility,
    };
  }

  private canViewPosts(
    visibility: ProfileVisibility,
    ctx: { isMe: boolean; isFollowing: boolean },
  ): boolean {
    if (ctx.isMe) return true;
    switch (visibility) {
      case ProfileVisibility.PUBLIC:
        return true;
      case ProfileVisibility.FOLLOWERS_ONLY:
        return ctx.isFollowing;
      case ProfileVisibility.PRIVATE:
        return false;
    }
  }
}
