import type { PostAuthor } from "./post";

export interface Comment {
  id: string;
  postId: string;
  author: PostAuthor;
  text: string;
  createdAt: string;
}
