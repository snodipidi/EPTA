import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'snodipidi@epta.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'S3cure!passw0rd' })
  @IsString()
  @MinLength(1)
  password!: string;
}
