import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockService } from './services/block.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Account & identity module. Imports AuthModule for PasswordService/TokenService
 * (password change + session revocation). Exports BlockService so chats/feeds/
 * follows can enforce blocks.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, BlockService],
  exports: [UsersService, BlockService],
})
export class UsersModule {}
