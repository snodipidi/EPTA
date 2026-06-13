import { useState } from "react";
import type { Post } from "../../types/post";
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

export function PostCard({ post, onCommentCountChange }: PostCardProps) {
  const { author, text, hashtags, images, counters, createdAt, replyTo } = post;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(counters.comments);

  const handleCommentAdded = () => {
    setCommentCount((n) => n + 1);
    onCommentCountChange?.(post.id, 1);
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
            {images.map((img) => (
              <img
                key={img.id}
                src={img.url}
                alt={img.alt ?? ""}
                className="post-card__image"
                loading="lazy"
              />
            ))}
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
            <button type="button" className="post-card__action" aria-label="Репосты">
              <RepostIcon />
              <span>{counters.reposts}</span>
            </button>
            <button type="button" className="post-card__action" aria-label="Лайки">
              <HeartIcon />
              <span>{counters.likes}</span>
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
