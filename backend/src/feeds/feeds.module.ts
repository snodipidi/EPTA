import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { UsersModule } from '../users/users.module';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';

/**
 * Timelines, trends and recommendations. Reuses PostMapper (PostsModule) and
 * BlockService (UsersModule); PythonServiceClient comes from the global
 * IntegrationsModule.
 */
@Module({
  imports: [PostsModule, UsersModule],
  controllers: [FeedsController],
  providers: [FeedsService],
})
export class FeedsModule {}
