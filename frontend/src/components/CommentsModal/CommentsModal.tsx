import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Comment } from "../../types/comment";
import type { Post } from "../../types/post";
import { createComment, getComments } from "../../api/comments";
import { USE_MOCK } from "../../api/config";
import { getCommentsForPost } from "../../data/mockComments";
import { mockCurrentUser } from "../../data/mockProfile";
import { useAuth } from "../../auth/AuthContext";
import { AvatarIcon, CloseIcon } from "../icons/Icons";

interface CommentsModalProps {
  post: Post;
  onClose: () => void;
  onCommentAdded?: (postId: string) => void;
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

export function CommentsModal({ post, onClose, onCommentAdded }: CommentsModalProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [comments, setComments] = useState<Comment[]>(() =>
    USE_MOCK ? getCommentsForPost(post.id) : [],
  );
  const [loading, setLoading] = useState(!USE_MOCK);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Реальный режим: подгружаем комментарии с бэкенда при открытии.
  useEffect(() => {
    if (USE_MOCK) return;
    let active = true;
    getComments(post.id)
      .then((list) => {
        if (active) setComments(list);
      })
      .catch(() => {
        if (active) setComments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [post.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    if (USE_MOCK) {
      const newComment: Comment = {
        id: `c-${Date.now()}`,
        postId: post.id,
        author: {
          id: mockCurrentUser.id,
          displayName: mockCurrentUser.displayName,
          username: mockCurrentUser.username,
        },
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      setComments((prev) => [...prev, newComment]);
      setText("");
      onCommentAdded?.(post.id);
      return;
    }

    // Комментировать может только авторизованный пользователь.
    if (!isAuthenticated) {
      onClose();
      navigate("/login");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createComment(post.id, trimmed);
      setComments((prev) => [...prev, created]);
      setText("");
      onCommentAdded?.(post.id);
    } catch {
      // Сохраняем введённый текст, чтобы пользователь мог повторить.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal comments-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-modal-title"
      >
        <div className="modal__header">
          <h2 id="comments-modal-title" className="modal__title">
            Комментарии
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="comments-modal__post-preview">
          <span className="comments-modal__post-author">{post.author.displayName}</span>
          <p className="comments-modal__post-text">{post.text}</p>
        </div>

        <ul className="comments-modal__list">
          {loading ? (
            <li className="comments-modal__empty">Загрузка...</li>
          ) : comments.length === 0 ? (
            <li className="comments-modal__empty">Пока нет комментариев</li>
          ) : (
            comments.map((comment) => (
              <li key={comment.id} className="comments-modal__item">
                <div className="comments-modal__avatar">
                  <AvatarIcon size={32} />
                </div>
                <div className="comments-modal__body">
                  <div className="comments-modal__meta">
                    <span className="comments-modal__name">{comment.author.displayName}</span>
                    <span className="comments-modal__handle">@{comment.author.username}</span>
                    <span className="comments-modal__dot">·</span>
                    <time className="comments-modal__time" dateTime={comment.createdAt}>
                      {formatTime(comment.createdAt)}
                    </time>
                  </div>
                  <p className="comments-modal__text">{comment.text}</p>
                </div>
              </li>
            ))
          )}
        </ul>

        <form className="comments-modal__form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="comments-modal__input"
            placeholder="Написать комментарий..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Новый комментарий"
          />
          <button
            type="submit"
            className="comments-modal__submit"
            disabled={!text.trim() || submitting}
          >
            {submitting ? "..." : "Отправить"}
          </button>
        </form>
      </div>
    </div>
  );
}
