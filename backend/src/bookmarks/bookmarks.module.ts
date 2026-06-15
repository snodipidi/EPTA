import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';

/** Imports PostsModule to reuse PostMapper for the "my bookmarks" listing. */
@Module({
  imports: [PostsModule],
  controllers: [BookmarksController],
  providers: [BookmarksService],
})
export class BookmarksModule {}
