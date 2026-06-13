import type { Comment } from "../types/comment";

export const mockComments: Comment[] = [
  {
    id: "c1",
    postId: "1",
    author: {
      id: "u3",
      displayName: "Комментатор",
      username: "comment_guy",
    },
    text: "бебебебе",
    createdAt: "2026-06-09T11:00:00Z",
  },
  {
    id: "c2",
    postId: "1",
    author: {
      id: "u4",
      displayName: "другой дауж",
      username: "another_one",
    },
    text: "оооооооооочень круто",
    createdAt: "2026-06-09T11:30:00Z",
  },
  {
    id: "c3",
    postId: "2",
    author: {
      id: "u1",
      displayName: "Кто-то там",
      username: "его юз",
    },
    text: "42",
    createdAt: "2026-06-09T09:45:00Z",
  },
];

export function getCommentsForPost(postId: string): Comment[] {
  return mockComments.filter((c) => c.postId === postId);
}
