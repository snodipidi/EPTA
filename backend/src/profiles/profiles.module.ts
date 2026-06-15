import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

/**
 * Public presentation of users. Imports UsersModule for BlockService (privacy
 * checks must respect blocks). Reads the follow graph directly via Prisma for
 * the isFollowing flag — a read-only query, not business logic worth a service hop.
 */
@Module({
  imports: [UsersModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
