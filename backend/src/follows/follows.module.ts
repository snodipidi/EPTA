import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

/** UsersModule → BlockService; NotificationsService comes from the global module. */
@Module({
  imports: [UsersModule],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
