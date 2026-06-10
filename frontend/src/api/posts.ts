import { API_BASE_URL } from "./config";
import { ENDPOINTS } from "./endpoints";
import type { Post, PostCounters, PostImage } from "../types/post";
import { mockPosts } from "../data/mockPosts";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getPosts(): Promise<Post[]> {
  if (USE_MOCK) return mockPosts;
  return fetchJson<Post[]>(ENDPOINTS.posts);
}

export async function getPost(id: string): Promise<Post> {
  if (USE_MOCK) {
    const post = mockPosts.find((p) => p.id === id);
    if (!post) throw new Error("Post not found");
    return post;
  }
  return fetchJson<Post>(ENDPOINTS.post(id));
}

export async function getPostImages(id: string): Promise<PostImage[]> {
  if (USE_MOCK) {
    const post = mockPosts.find((p) => p.id === id);
    return post?.images ?? [];
  }
  return fetchJson<PostImage[]>(ENDPOINTS.postImages(id));
}

export async function getPostCounters(id: string): Promise<PostCounters> {
  if (USE_MOCK) {
    const post = mockPosts.find((p) => p.id === id);
    if (!post) throw new Error("Post not found");
    return post.counters;
  }
  return fetchJson<PostCounters>(ENDPOINTS.postCounters(id));
}
