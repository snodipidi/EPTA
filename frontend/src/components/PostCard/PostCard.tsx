import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Post } from "../../types/post";
import { toggleLike } from "../../api/posts";
import { USE_MOCK } from "../../api/config";
import { useAuth } from "../../auth/AuthContext";
import { CommentsModal } from "../CommentsModal/CommentsModal";
import {
  AvatarIcon,
  BookmarkIcon,
  CommentIcon,
  HeartIcon,
  MoreIcon,
  ReplyIcon,
  RepostIcon,
  ShareIcon,
} from "../icons/Icons";

interface PostCardProps {
  post: Post;
  onCommentCountChange?: (postId: string, delta: number) => void;
  isFirstInFeed?: boolean;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function PostCard({ post, onCommentCountChange, isFirstInFeed = false }: PostCardProps) {
  const { author, text, hashtags, images, counters, createdAt, replyTo } = post;
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(counters.comments);

  const [liked, setLiked] = useState<boolean>(post.liked ?? false);
  const [likeCount, setLikeCount] = useState(counters.likes);
  const [likePending, setLikePending] = useState(false);

  const [reposted, setReposted] = useState<boolean>(false);
  const [repostCount, setRepostCount] = useState(counters.reposts);

  const handleCommentAdded = () => {
    setCommentCount((n) => n + 1);
    onCommentCountChange?.(post.id, 1);
  };

  // Лайк/репост требуют авторизации. В мок-режиме просто переключаем локально.
  const requireAuth = (): boolean => {
    if (USE_MOCK || isAuthenticated) return true;
    navigate("/login");
    return false;
  };

  const handleToggleLike = async () => {
    if (likePending || !requireAuth()) return;

    if (USE_MOCK) {
      setLiked((v) => !v);
      setLikeCount((n) => n + (liked ? -1 : 1));
      return;
    }

    setLikePending(true);
    try {
      const state = await toggleLike(post.id);
      setLiked(state.liked);
      setLikeCount(state.likes);
    } catch {
      // Не меняем состояние при ошибке — счётчик остаётся консистентным.
    } finally {
      setLikePending(false);
    }
  };

  // Репост работает как лайк: локальный тоггл со счётчиком, без обращения к API
  // и без создания настоящего репоста в ленте.
  const handleRepost = () => {
    if (!requireAuth()) return;
    setReposted((v) => !v);
    setRepostCount((n) => n + (reposted ? -1 : 1));
  };

  return (
    <>
      <article className="post-card">
        {replyTo && (
          <div className="post-card__reply">
            <ReplyIcon size={14} />
            <span>Ответ на пост</span>
          </div>
        )}

        <div className="post-card__header">
          <div className="post-card__author">
            <div className="post-card__avatar">
              <AvatarIcon size={40} />
            </div>
            <div className="post-card__meta">
              <span className="post-card__name">{author.displayName}</span>
              <span className="post-card__handle">@{author.username}</span>
              <span className="post-card__dot">·</span>
              <time className="post-card__time" dateTime={createdAt}>
                {formatTime(createdAt)}
              </time>
            </div>
          </div>
          <button type="button" className="post-card__more" aria-label="Ещё">
            <MoreIcon />
          </button>
        </div>

        {hashtags.length > 0 && (
          <div className="post-card__hashtags">
            {hashtags.map((tag) => (
              <span key={tag} className="post-card__tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <p className="post-card__text">{text}</p>

        {post.mediaPlaceholder && images.length === 0 && (
          <div className="post-card__media post-card__media--placeholder">
            Картинка\и
          </div>
        )}

        {images.length > 0 && (
          <div
            className={`post-card__media${images.length > 1 ? " post-card__media--grid" : ""}`}
          >
            {images.map((img, index) => {
              // Первое изображение первого поста в ленте - это LCP-элемент
              const isLcpElement = isFirstInFeed && index === 0;
              
              return (
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.alt ?? ""}
                  className="post-card__image"
                  width={img.width}
                  height={img.height}
                  // LCP-элемент должен загружаться с высоким приоритетом без lazy loading
                  fetchPriority={isLcpElement ? "high" : undefined}
                  loading={isLcpElement ? "eager" : "lazy"}
                />
              );
            })}
          </div>
        )}

        <div className="post-card__actions">
          <div className="post-card__actions-left">
            <button
              type="button"
              className="post-card__action"
              aria-label="Комментарии"
              onClick={() => setCommentsOpen(true)}
            >
              <CommentIcon />
              <span>{commentCount}</span>
            </button>
            <button
              type="button"
              className={`post-card__action${reposted ? " post-card__action--active" : ""}`}
              aria-label="Репост"
              aria-pressed={reposted}
              onClick={handleRepost}
            >
              <RepostIcon />
              <span>{repostCount}</span>
            </button>
            <button
              type="button"
              className={`post-card__action${liked ? " post-card__action--active" : ""}`}
              aria-label="Лайк"
              aria-pressed={liked}
              onClick={handleToggleLike}
              disabled={likePending}
            >
              <HeartIcon />
              <span>{likeCount}</span>
            </button>
          </div>
          <div className="post-card__actions-right">
            <button type="button" className="post-card__action" aria-label="Закладка">
              <BookmarkIcon />
            </button>
            <button type="button" className="post-card__action" aria-label="Поделиться">
              <ShareIcon />
            </button>
          </div>
        </div>
      </article>

      {commentsOpen && (
        <CommentsModal
          post={post}
          onClose={() => setCommentsOpen(false)}
          onCommentAdded={handleCommentAdded}
        />
      )}
    </>
  );
}
