import { ENDPOINTS } from "./endpoints";
import { request } from "./http";
import type { Comment } from "../types/comment";

/**
 * Бэкенд возвращает комментарии массивом в теле (метаданные курсора — в
 * заголовках), поэтому тип ответа совпадает с `Comment[]`. Лишние поля
 * (`parentCommentId`, `repliesCount`) UI не использует.
 */
export function getComments(postId: string): Promise<Comment[]> {
  return request<Comment[]>(ENDPOINTS.postComments(postId));
}

export function createComment(postId: string, text: string): Promise<Comment> {
  return request<Comment>(ENDPOINTS.postComments(postId), {
    method: "POST",
    body: { text },
  });
}
