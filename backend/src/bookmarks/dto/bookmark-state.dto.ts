import { ApiProperty } from '@nestjs/swagger';

export class BookmarkStateDto {
  @ApiProperty({
    description: 'Is the post currently bookmarked by the viewer?',
  })
  bookmarked!: boolean;

  @ApiProperty({ description: 'Total bookmarks on the post' })
  bookmarks!: number;
}
