import { ApiProperty } from '@nestjs/swagger';

export class TrendingHashtagDto {
  @ApiProperty({ example: 'епта' })
  tag!: string;

  @ApiProperty({ description: 'Occurrences in the trending window' })
  count!: number;
}
