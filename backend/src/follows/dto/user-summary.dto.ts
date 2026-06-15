import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Compact user card used in follower/following lists. */
export class UserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional()
  avatarUrl?: string;
}
