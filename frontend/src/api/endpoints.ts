/**
 * API Endpoints — ЕПТА
 *
 * Базовый URL: VITE_API_BASE_URL (по умолчанию http://localhost:3000/api)
 */

export const ENDPOINTS = {
  /** GET — список постов ленты */
  posts: "/posts",

  /** GET — один пост по id */
  post: (id: string) => `/posts/${id}`,

  /** GET — картинки поста */
  postImages: (id: string) => `/posts/${id}/images`,

  /** GET — счётчики поста (comments, reposts, likes) */
  postCounters: (id: string) => `/posts/${id}/counters`,

  /** POST — создать пост */
  createPost: "/posts",

  /** POST — лайк/анлайк */
  toggleLike: (id: string) => `/posts/${id}/like`,

  /** POST — репост */
  repost: (id: string) => `/posts/${id}/repost`,

  /** POST — закладка */
  bookmark: (id: string) => `/posts/${id}/bookmark`,
} as const;
