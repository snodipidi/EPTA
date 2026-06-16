/**
 * API Endpoints — ЕПТА
 *
 * Базовый URL: VITE_API_BASE_URL (по умолчанию http://localhost:3000/api)
 */

export const ENDPOINTS = {
  // ── auth ────────────────────────────────────────────────
  /** POST — регистрация */
  register: "/auth/register",

  /** POST — вход */
  login: "/auth/login",

  /** POST — обмен refresh-токена на новую пару */
  refresh: "/auth/refresh",

  /** POST — выход (отзыв одного refresh-токена) */
  logout: "/auth/logout",

  // ── posts ───────────────────────────────────────────────
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

  // ── comments ────────────────────────────────────────────
  /** GET — комментарии поста / POST — добавить комментарий */
  postComments: (id: string) => `/posts/${id}/comments`,

  // ── profiles ────────────────────────────────────────────
  /** GET — мой профиль */
  myProfile: "/profiles/me",

  /** GET — публичный профиль по username */
  profile: (username: string) => `/profiles/${username}`,

  /** GET — лидерборд («Топы») */
  topProfiles: "/profiles/top",
} as const;
