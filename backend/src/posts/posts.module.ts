import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PostMapper } from './post.mapper';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

/**
 * Posts + comments. Comments are kept as their own service/controller (not a god
 * service) but co-located under the posts feature because their lifecycle is
 * inseparable from posts. Exports PostsService + PostMapper so feeds/bookmarks
 * can reuse the canonical post serialization.
 */
@Module({
  imports: [UsersModule], // BlockService for interaction guards
  controllers: [PostsController, CommentsController],
  providers: [PostsService, CommentsService, PostMapper],
  exports: [PostsService, CommentsService, PostMapper],
})
export class PostsModule {}
