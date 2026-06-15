import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'snodipidi@epta.dev', description: 'Unique email' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'snodipidi',
    description: 'Unique handle: 3–30 chars, letters/digits/underscore',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may contain only letters, digits and underscore',
  })
  username!: string;

  @ApiProperty({ example: 'снодипиди', description: 'Public display name' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;

  @ApiProperty({
    example: 'S3cure!passw0rd',
    description: 'At least 8 characters',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
