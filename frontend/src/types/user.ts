export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  followers: number;
  following: number;
  avatarUrl?: string;
}
