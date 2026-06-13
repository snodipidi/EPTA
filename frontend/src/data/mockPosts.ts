import type { Post } from "../types/post";
import { CURRENT_USER_ID } from "./mockProfile";

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
  {
    id: "3",
    author: {
      id: CURRENT_USER_ID,
      displayName: "снодипиди",
      username: "snodipidi",
    },
    text: "пуки каки",
    hashtags: ["епта"],
    images: [],
    counters: { comments: 1, reposts: 0, likes: 4 },
    createdAt: "2026-06-08T18:00:00Z",
  },
  {
    id: "4",
    author: {
      id: CURRENT_USER_ID,
      displayName: "снодипиди",
      username: "snodipidi",
    },
    text: "жмишер в туре пятерка и еще один исполнитель",
    hashtags: [],
    images: [],
    counters: { comments: 0, reposts: 2, likes: 11 },
    createdAt: "2026-06-07T14:20:00Z",
  },
];
