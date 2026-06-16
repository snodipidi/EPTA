import { ENDPOINTS } from "./endpoints";
import { request } from "./http";
import type { UserProfile } from "../types/user";

/**
 * Профиль с сервера. Первые шесть полей совпадают с `UserProfile`, остальные —
 * контекст просмотра (бэкенд `ProfileResponseDto`), который UI может игнорировать.
 */
export interface ProfileResponse extends UserProfile {
  coverUrl?: string;
  isMe: boolean;
  isFollowing: boolean;
  canViewPosts: boolean;
  visibility: "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE";
}

export function getMyProfile(): Promise<ProfileResponse> {
  return request<ProfileResponse>(ENDPOINTS.myProfile);
}

export function getProfileByUsername(
  username: string,
): Promise<ProfileResponse> {
  return request<ProfileResponse>(ENDPOINTS.profile(username));
}
