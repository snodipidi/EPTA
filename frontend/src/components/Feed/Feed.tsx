import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPost, getPosts } from "../../api/posts";
import { USE_MOCK } from "../../api/config";
import { mockCurrentUser } from "../../data/mockProfile";
import { useAuth } from "../../auth/AuthContext";
import type { Post } from "../../types/post";
import { PostCard } from "../PostCard/PostCard";
import { PostCreator } from "../PostCreator/PostCreator";
import { VerifyEmailBanner } from "../VerifyEmailBanner/VerifyEmailBanner";

export function Feed() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPosts()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  const handleCreatePost = async (text: string) => {
    if (USE_MOCK) {
      const newPost: Post = {
        id: `local-${Date.now()}`,
        author: {
          id: mockCurrentUser.id,
          displayName: mockCurrentUser.displayName,
          username: mockCurrentUser.username,
        },
        text,
        hashtags: [],
        images: [],
        counters: { comments: 0, reposts: 0, likes: 0 },
        createdAt: new Date().toISOString(),
      };
      setPosts((prev) => [newPost, ...prev]);
      return;
    }

    // Реальный режим: публиковать может только авторизованный пользователь...
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    // ...и только с подтверждённой почтой (бэкенд иначе вернёт 403).
    if (!user?.emailVerified) {
      navigate("/verify-email");
      return;
    }
    const created = await createPost({ text });
    setPosts((prev) => [created, ...prev]);
  };

  return (
    <div className="feed">
      <VerifyEmailBanner />
      <PostCreator onSubmit={handleCreatePost} />

      {loading ? (
        <p className="feed__status">Загрузка...</p>
      ) : (
        <div className="feed__list">
          {posts.map((post, index) => (
            <PostCard 
              key={post.id} 
              post={post} 
              isFirstInFeed={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
