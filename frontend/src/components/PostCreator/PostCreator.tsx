import { AvatarIcon, ImageUploadIcon } from "../icons/Icons";
import "./PostCreator.css";

export function PostCreator() {
  return (
    <div className="post-creator">
      <div className="post-creator__avatar">
        <AvatarIcon size={40} />
      </div>
      <div className="post-creator__body">
        <input
          type="text"
          className="post-creator__input"
          placeholder="Как дела?"
          aria-label="Новый пост"
        />
        <div className="post-creator__footer">
          <button
            type="button"
            className="post-creator__upload-btn"
            aria-label="Прикрепить изображение"
          >
            <ImageUploadIcon size={26} />
          </button>
        </div>
      </div>
    </div>
  );
}
