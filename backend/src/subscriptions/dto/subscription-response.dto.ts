import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';

export class SubscriptionResponseDto {
  @ApiProperty({ enum: SubscriptionTier })
  tier!: SubscriptionTier;

  @ApiProperty({ enum: SubscriptionStatus })
  status!: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'ISO-8601; end of the paid period' })
  currentPeriodEnd?: string;

  @ApiProperty()
  cancelAtPeriodEnd!: boolean;
}

export class PlanDto {
  @ApiProperty({ enum: SubscriptionTier })
  tier!: SubscriptionTier;

  @ApiProperty({ example: 'PRO' })
  name!: string;

  @ApiProperty({
    description: 'Monthly price in minor units (kopeks)',
    example: 29900,
  })
  priceMonthly!: number;

  @ApiProperty({ type: [String] })
  features!: string[];
}
