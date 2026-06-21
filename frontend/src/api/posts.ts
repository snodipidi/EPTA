import { USE_MOCK } from "./config";
import { ENDPOINTS } from "./endpoints";
import { request } from "./http";
import type { Post, PostCounters, PostImage } from "../types/post";
import { mockPosts } from "../data/mockPosts";

// ── Чтение ────────────────────────────────────────────────────────────────
// Списочные эндпоинты бэкенда отдают массив в теле (курсор — в заголовках),
// поэтому тип ответа совпадает с `Post[]` без распаковки.

export async function getPosts(): Promise<Post[]> {
  if (USE_MOCK) return mockPosts;
  return request<Post[]>(ENDPOINTS.posts);
}

export async function getPost(id: string): Promise<Post> {
  if (USE_MOCK) {
    const post = mockPosts.find((p) => p.id === id);
    if (!post) throw new Error("Post not found");
    return post;
  }
  return request<Post>(ENDPOINTS.post(id));
}

export async function getPostImages(id: string): Promise<PostImage[]> {
  if (USE_MOCK) {
    const post = mockPosts.find((p) => p.id === id);
    return post?.images ?? [];
  }
  return request<PostImage[]>(ENDPOINTS.postImages(id));
}

export async function getPostCounters(id: string): Promise<PostCounters> {
  if (USE_MOCK) {
    const post = mockPosts.find((p) => p.id === id);
    if (!post) throw new Error("Post not found");
    return post.counters;
  }
  return request<PostCounters>(ENDPOINTS.postCounters(id));
}

// ── Запись (требует авторизации) ────────────────────────────────────────────

export interface CreatePostPayload {
  text: string;
  hashtags?: string[];
}

export async function createPost(payload: CreatePostPayload): Promise<Post> {
  return request<Post>(ENDPOINTS.createPost, {
    method: "POST",
    body: payload,
  });
}

/** Состояние лайка после переключения (бэкенд `ReactionStateDto`). */
export interface ReactionState {
  liked: boolean;
  likes: number;
  type: string | null;
}

export async function toggleLike(id: string): Promise<ReactionState> {
  return request<ReactionState>(ENDPOINTS.toggleLike(id), { method: "POST" });
}
