import { useEffect, useState } from "react";
import { getPosts } from "../../api/posts";
import { mockCurrentUser } from "../../data/mockProfile";
import type { Post } from "../../types/post";
import { PostCard } from "../PostCard/PostCard";
import { PostCreator } from "../PostCreator/PostCreator";

export function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPosts()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  const handleCreatePost = (text: string) => {
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
  };

  return (
    <main className="feed">
      <PostCreator onSubmit={handleCreatePost} />

      {loading ? (
        <p className="feed__status">Загрузка...</p>
      ) : (
        <div className="feed__list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
