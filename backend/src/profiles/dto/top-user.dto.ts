import { ApiProperty } from '@nestjs/swagger';

/** Matches the frontend `TopUser` type (src/data/mockTopUsers.ts). */
export class TopUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: '1-based leaderboard position' })
  rank!: number;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ description: 'Reputation score driving the ranking' })
  score!: number;
}
