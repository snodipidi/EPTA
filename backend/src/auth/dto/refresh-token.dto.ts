import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'A valid, non-revoked refresh token' })
  @IsJWT()
  refreshToken!: string;
}
