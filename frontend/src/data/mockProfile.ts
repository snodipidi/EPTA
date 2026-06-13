import type { UserProfile } from "../types/user";

export const CURRENT_USER_ID = "me";

export const mockCurrentUser: UserProfile = {
  id: CURRENT_USER_ID,
  displayName: "снодипиди",
  username: "snodipidi",
  bio: "ыыыы вайбкодинг",
  followers: 67,
  following: 42,
};
