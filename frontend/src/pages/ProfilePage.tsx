import { useEffect, useState } from "react";
import { getPosts } from "../api/posts";
import { CURRENT_USER_ID, mockCurrentUser } from "../data/mockProfile";
import type { Post } from "../types/post";
import { AvatarIcon } from "../components/icons/Icons";
import { PostCard } from "../components/PostCard/PostCard";

export function ProfilePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPosts()
      .then((all) => all.filter((p) => p.author.id === CURRENT_USER_ID))
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  const profile = mockCurrentUser;

  return (
    <div className="profile-page">
      <section className="profile-page__header">
        <div className="profile-page__avatar">
          <AvatarIcon size={72} />
        </div>
        <div className="profile-page__info">
          <h1 className="profile-page__name">{profile.displayName}</h1>
          <p className="profile-page__handle">@{profile.username}</p>
          <div className="profile-page__stats">
            <div className="profile-page__stat">
              <span className="profile-page__stat-value">{profile.followers}</span>
              <span className="profile-page__stat-label">подписчики</span>
            </div>
            <div className="profile-page__stat">
              <span className="profile-page__stat-value">{profile.following}</span>
              <span className="profile-page__stat-label">подписки</span>
            </div>
          </div>
          <p className="profile-page__bio">{profile.bio}</p>
        </div>
      </section>

      <section className="profile-page__posts">
        <h2 className="profile-page__posts-title">Посты</h2>
        {loading ? (
          <p className="profile-page__status">Загрузка...</p>
        ) : posts.length === 0 ? (
          <p className="profile-page__status">Пока нет постов</p>
        ) : (
          <div className="profile-page__posts-list">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
