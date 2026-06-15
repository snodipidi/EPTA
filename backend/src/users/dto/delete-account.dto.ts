import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ description: 'Confirm your password to delete the account' })
  @IsString()
  @MinLength(1)
  password!: string;
}
