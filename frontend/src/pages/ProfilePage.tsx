import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPosts } from "../api/posts";
import { getMyProfile } from "../api/profiles";
import { USE_MOCK } from "../api/config";
import { CURRENT_USER_ID, mockCurrentUser } from "../data/mockProfile";
import { useAuth } from "../auth/AuthContext";
import type { Post } from "../types/post";
import type { UserProfile } from "../types/user";
import { AvatarIcon } from "../components/icons/Icons";
import { PostCard } from "../components/PostCard/PostCard";

export function ProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(
    USE_MOCK ? mockCurrentUser : null,
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // В реальном режиме профиль доступен только авторизованным.
  useEffect(() => {
    if (!USE_MOCK && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (USE_MOCK) {
      getPosts()
        .then((all) => all.filter((p) => p.author.id === CURRENT_USER_ID))
        .then(setPosts)
        .finally(() => setLoading(false));
      return;
    }

    if (!isAuthenticated) return;

    Promise.all([getMyProfile(), getPosts()])
      .then(([me, all]) => {
        setProfile(me);
        setPosts(all.filter((p) => p.author.id === me.id));
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <p className="profile-page__status">Загрузка...</p>
      </div>
    );
  }

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
        {isAuthenticated ? (
          <button
            type="button"
            className="profile-page__login"
            onClick={handleLogout}
          >
            выйти
          </button>
        ) : (
          <Link to="/login" className="profile-page__login">
            войти
          </Link>
        )}
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
