import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionTier } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeTierDto {
  @ApiProperty({ enum: SubscriptionTier, example: SubscriptionTier.PRO })
  @IsEnum(SubscriptionTier)
  tier!: SubscriptionTier;
}
