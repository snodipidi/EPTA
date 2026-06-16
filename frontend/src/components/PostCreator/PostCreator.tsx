import { useRef, useState } from "react";
import { AvatarIcon, ImageUploadIcon } from "../icons/Icons";

interface PostCreatorProps {
  /** Может быть асинхронным (реальная публикация на бэкенд). */
  onSubmit: (text: string) => void | Promise<void>;
}

export function PostCreator({ onSubmit }: PostCreatorProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText(""); // чистим поле только при успехе
    } catch {
      // Текст сохраняем, чтобы пользователь не потерял ввод и мог повторить.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="post-creator" onSubmit={handleSubmit}>
      <div className="post-creator__aside">
        <div className="post-creator__avatar">
          <AvatarIcon size={40} />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="post-creator__file-input"
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          className="post-creator__upload-btn"
          aria-label="Прикрепить изображение"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageUploadIcon size={26} />
        </button>
      </div>
      <div className="post-creator__body">
        <input
          type="text"
          className="post-creator__input"
          placeholder="Как дела?"
          aria-label="Новый пост"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="post-creator__footer">
          <button
            type="submit"
            className="post-creator__submit"
            disabled={!text.trim() || submitting}
          >
            {submitting ? "..." : "Отправить"}
          </button>
        </div>
      </div>
    </form>
  );
}
