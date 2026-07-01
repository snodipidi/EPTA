export interface PostCounters {
  comments: number;
  reposts: number;
  likes: number;
}

export interface PostImage {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface PostAuthor {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export interface Post {
  id: string;
  author: PostAuthor;
  text: string;
  hashtags: string[];
  images: PostImage[];
  counters: PostCounters;
  createdAt: string;
  replyTo?: {
    id: string;
    authorName: string;
  };
  mediaPlaceholder?: boolean;
  /** Контекст просмотра с бэкенда: лайкнул ли текущий пользователь пост. */
  liked?: boolean;
  /** Контекст просмотра: добавлен ли пост в закладки текущим пользователем. */
  bookmarked?: boolean;
}
