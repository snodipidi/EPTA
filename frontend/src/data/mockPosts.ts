import type { Post } from "../types/post";

export const mockPosts: Post[] = [
  {
    id: "1",
    author: {
      id: "u1",
      displayName: "Кто-то там",
      username: "его юз",
    },
    text: "Сам пост бла бла блаблаблаблабла",
    hashtags: ["теги", "теги", "теги"],
    images: [],
    mediaPlaceholder: true,
    counters: { comments: 12, reposts: 5, likes: 10 },
    createdAt: "2026-06-09T10:30:00Z",
    replyTo: {
      id: "0",
      authorName: "",
    },
  },
  {
    id: "2",
    author: {
      id: "u2",
      displayName: "Ещё кто-то",
      username: "random_user",
    },
    text: "ыыыыы 42",
    hashtags: ["епта", "тест"],
    images: [],
    counters: { comments: 3, reposts: 1, likes: 7 },
    createdAt: "2026-06-09T09:15:00Z",
  },
];
