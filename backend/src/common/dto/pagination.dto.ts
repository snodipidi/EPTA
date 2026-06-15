import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Cursor (keyset) pagination input. DECISION: feeds use cursor pagination, not
 * offset — offset pagination drifts and gets slower as you scroll. The cursor is
 * an opaque id of the last seen item.
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor — pass the `nextCursor` from the previous page',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Page size',
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

/** Generic paginated envelope returned by list endpoints. */
export class PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;

  constructor(items: T[], nextCursor: string | null) {
    this.items = items;
    this.nextCursor = nextCursor;
    this.hasMore = nextCursor !== null;
  }
}

/**
 * Helper for the common keyset pattern: fetch `limit + 1` rows, and if the extra
 * row exists, pop it and use its id as the next cursor.
 */
export function buildCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): PaginatedResult<T> {
  if (rows.length > limit) {
    const nextItem = rows[limit];
    return new PaginatedResult(rows.slice(0, limit), nextItem.id);
  }
  return new PaginatedResult(rows, null);
}
