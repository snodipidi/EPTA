import { ApiProperty } from '@nestjs/swagger';
import { ProfileVisibility } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdatePrivacyDto {
  @ApiProperty({
    enum: ProfileVisibility,
    description:
      'PUBLIC — anyone; FOLLOWERS_ONLY — only approved followers; PRIVATE — only me',
  })
  @IsEnum(ProfileVisibility)
  visibility!: ProfileVisibility;
}
